import { NextRequest, NextResponse } from 'next/server';
import { 
  db,
  getOnlineCheckoutHold, 
  deleteOnlineCheckoutHold, 
  logPaymentGatewayAdvice
} from '@/lib/db';
import { deleteSimulatorSlotLocks } from '@/lib/simulator-db';
import { generateIciciHash, getIciciReturnBase } from '@/lib/icici';
import { formatOrderNumber } from '@/lib/order-utils';
import { confirmPaidOrderFromHold } from '@/lib/order-reconciliation';

function getRedirectBaseUrl(req: NextRequest): string {
  // 1. Production whitelisted domain from getIciciReturnBase
  const returnBase = getIciciReturnBase();
  if (returnBase && !returnBase.includes('localhost') && !returnBase.includes('127.0.0.1')) {
    return returnBase;
  }

  // 2. Check X-Forwarded-Host from Render reverse proxy
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('10000')) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return 'https://havocrcfunzone.in';
}

async function parseRequestBody(req: NextRequest): Promise<Record<string, any>> {
  const contentType = req.headers.get('content-type') || '';
  
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    try {
      const formData = await req.formData();
      const obj: Record<string, any> = {};
      formData.forEach((value, key) => {
        obj[key] = typeof value === 'string' ? value : value.name;
      });
      return obj;
    } catch (e) {
      // fallback to text parse
    }
  }

  if (contentType.includes('application/json')) {
    try {
      return await req.json();
    } catch (e) {
      // fallback
    }
  }

  // Fallback: parse raw text
  try {
    const raw = await req.text();
    if (raw.startsWith('{')) {
      return JSON.parse(raw);
    }
    const params = new URLSearchParams(raw);
    const obj: Record<string, any> = {};
    params.forEach((v, k) => { obj[k] = v; });
    return obj;
  } catch (e) {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const redirectBase = getRedirectBaseUrl(req);
  const body = await parseRequestBody(req);

  console.log('================== [ICICI BANK PAYMENT ADVICE / CALLBACK] ==================');
  console.log('Timestamp (IST)   :', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  console.log('Callback Origin   :', req.headers.get('origin') || req.headers.get('referer') || 'Unknown');
  console.log('Content-Type      :', req.headers.get('content-type'));
  console.log('Parsed Parameters :', JSON.stringify(body, null, 2));

  const receivedHash = body.secureHash || body.responseParams?.secureHash;
  let computedHash = generateIciciHash(body);
  if (receivedHash && computedHash !== receivedHash && body.responseParams) {
    const paramsHash = generateIciciHash(body.responseParams);
    if (paramsHash === receivedHash) {
      computedHash = paramsHash;
    }
  }

  console.log('Hash Verification :', {
    receivedHash: receivedHash || 'NONE',
    computedHash: computedHash,
    isMatch: receivedHash === computedHash
  });
  console.log('============================================================================');

  const baseOrderId = body.merchantTxnNo || body.responseParams?.merchantTxnNo || '';
  const txnID = body.txnID || body.paymentID || body.responseParams?.txnID || body.responseParams?.paymentID || null;
  const responseCode = body.responseCode || body.responseParams?.responseCode || '';
  const isSuccess = responseCode === "0000" || responseCode === "000" || body.status === "SUC" || body.properties?.isSuccess === true;

  // Log incoming payment advice callback for 100% audit durability
  logPaymentGatewayAdvice({
    gateway: 'icici',
    merchant_txn_no: baseOrderId,
    gateway_txn_id: txnID,
    response_code: responseCode,
    status: isSuccess ? 'SUCCESS' : (receivedHash && computedHash && receivedHash !== computedHash ? 'HASH_MISMATCH' : 'FAILED'),
    amount: Number(body.amount || body.responseParams?.amount || 0) || undefined,
    customer_phone: body.customerMobileNo || body.responseParams?.customerMobileNo || undefined,
    customer_email: body.customerEmailID || body.responseParams?.customerEmailID || undefined,
    raw_payload: JSON.stringify(body)
  });

  if (receivedHash && computedHash && receivedHash !== computedHash) {
    console.error('[ICICI Callback] Hash Mismatch!', { receivedHash, computedHash });
    return NextResponse.redirect(new URL('/checkout.html?error=Payment+Verification+Failed', redirectBase), 303);
  }

  // Handle successful payment
  if (isSuccess) {
    if (baseOrderId.startsWith('TXN_RC_')) {
      let holdRow = getOnlineCheckoutHold(baseOrderId);

      if (!holdRow) {
        console.warn('[ICICI Callback] Hold record not found for txn_id:', baseOrderId);
        // 1. Check if booking already exists (e.g. duplicate callback from gateway)
        try {
          const existing = db.prepare('SELECT order_number, order_prefix FROM bookings WHERE payment_ref = ? OR icici_txn_id = ?').get(txnID, txnID) as { order_number: number; order_prefix?: string } | undefined;
          if (existing && existing.order_number) {
            const finalOrderId = formatOrderNumber(existing.order_number, existing.order_prefix || 'PAID');
            return NextResponse.redirect(new URL(`/success.html?order_id=${encodeURIComponent(finalOrderId)}`, redirectBase), 303);
          }
        } catch (_) {}

        // 2. Fallback Recovery: If hold was wiped out by timeout, reconstruct a safety booking so order is NEVER lost!
        const recoveredAmount = Number(body.amount || body.responseParams?.amount || 0);
        const recoveredPhone = body.customerMobileNo || body.responseParams?.customerMobileNo || '';
        const recoveredEmail = body.customerEmailID || body.responseParams?.customerEmailID || '';

        console.log('[ICICI Callback] Triggering safety order recovery for paid transaction:', { baseOrderId, txnID, recoveredAmount });

        const defaultTicket = db.prepare('SELECT id, name FROM tickets WHERE active = 1 ORDER BY id ASC LIMIT 1').get() as { id: number; name: string } | undefined;
        const fallbackItems = [{
          ticketId: defaultTicket?.id || 1,
          ticketName: defaultTicket?.name || 'RC Fun Zone Pass',
          date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
          timeSlot: 'General Session',
          quantity: 1,
          itemTotal: recoveredAmount || 1000
        }];

        holdRow = {
          id: 0,
          txn_id: baseOrderId,
          customer_name: 'Online Guest',
          customer_email: recoveredEmail,
          customer_phone: recoveredPhone,
          amount: recoveredAmount || 0,
          items_json: JSON.stringify(fallbackItems),
          whatsapp_consent: 1,
          created_at: new Date().toISOString()
        };
      }

      try {
        const confirmRes = await confirmPaidOrderFromHold({
          holdRow,
          txnID: txnID || `ICICI_${baseOrderId}`,
          source: 'icici_callback'
        });

        if (confirmRes.success && confirmRes.orderId) {
          return NextResponse.redirect(new URL(`/success.html?order_id=${encodeURIComponent(confirmRes.orderId)}`, redirectBase), 303);
        } else {
          console.error('[ICICI Callback] Error confirming order from hold:', confirmRes.message);
          return NextResponse.redirect(new URL('/checkout.html?error=Error+confirming+booking', redirectBase), 303);
        }
      } catch (parseErr) {
        console.error('[ICICI Callback] Error processing hold items:', parseErr);
        return NextResponse.redirect(new URL('/checkout.html?error=Error+confirming+booking', redirectBase), 303);
      }
    }
  }

  // Payment failed or cancelled
  console.warn('[ICICI Callback] Payment failed or cancelled. responseCode:', responseCode, 'merchantTxnNo:', baseOrderId);
  if (baseOrderId.startsWith('TXN_RC_')) {
    // Delete temporary hold immediately - slot is released without burning or skipping any official order numbers!
    deleteOnlineCheckoutHold(baseOrderId);
    try {
      await deleteSimulatorSlotLocks(baseOrderId);
    } catch (pgErr) {
      console.error('[ICICI Callback] Error releasing simulator slot locks on cancel:', pgErr);
    }
    return NextResponse.redirect(new URL(`/checkout.html?error=${encodeURIComponent(body.responseDescription || 'Payment Failed or Cancelled')}`, redirectBase), 303);
  }

  return NextResponse.redirect(new URL('/checkout.html?error=Payment+Failed+or+Cancelled', redirectBase), 303);
}

export async function GET(req: NextRequest) {
  const redirectBase = getRedirectBaseUrl(req);
  // Support GET in case the gateway redirects user via GET with query params
  const searchParams = req.nextUrl.searchParams;
  const merchantTxnNo = searchParams.get('merchantTxnNo') || '';
  const responseCode = searchParams.get('responseCode') || '';
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');

  if (orderId) {
    return NextResponse.redirect(new URL(`/success.html?order_id=${orderId}`, redirectBase), 303);
  }

  if ((responseCode === '0000' || responseCode === '000') && merchantTxnNo) {
    try {
      const existing = db.prepare('SELECT order_number, order_prefix FROM bookings WHERE payment_ref = ? OR icici_txn_id = ?').get(merchantTxnNo, merchantTxnNo) as { order_number: number; order_prefix?: string } | undefined;
      if (existing) {
        const formattedExisting = formatOrderNumber(existing.order_number, existing.order_prefix || 'PAID');
        return NextResponse.redirect(new URL(`/success.html?order_id=${encodeURIComponent(formattedExisting)}`, redirectBase), 303);
      }
    } catch (_) {}
  }

  if (merchantTxnNo.startsWith('TXN_RC_')) {
    deleteOnlineCheckoutHold(merchantTxnNo);
    await deleteSimulatorSlotLocks(merchantTxnNo).catch(() => {});
  }

  return NextResponse.redirect(new URL('/checkout.html?error=Payment+Cancelled', redirectBase), 303);
}
