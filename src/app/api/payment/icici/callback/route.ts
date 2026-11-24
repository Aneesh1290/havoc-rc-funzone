import { NextRequest, NextResponse } from 'next/server';
import { 
  db,
  getOnlineCheckoutHold, 
  deleteOnlineCheckoutHold, 
  getNextOrderNumber, 
  getTickets,
  logPaymentGatewayAdvice
} from '@/lib/db';
import { confirmSimulatorSlotLocks, deleteSimulatorSlotLocks } from '@/lib/simulator-db';
import { generateIciciHash, getIciciReturnBase } from '@/lib/icici';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { sendBookingConfirmationWhatsApp, notifyAdminsBookingWhatsApp } from '@/lib/whatsapp';
import { formatOrderNumber } from '@/lib/order-utils';

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
        const items = JSON.parse(holdRow.items_json || '[]');
        const totalBaseCost = items.reduce((sum: number, i: any) => sum + (Number(i.itemTotal) || 0), 0);
        
        let finalOrderId = "";
        let formattedOrderCode = "";

        // Check if items belong to existing desk-checkin booking IDs (paying for existing unpaid desk booking)
        const existingBookingIds = items
          .map((i: any) => i.bookingId || i.booking_id)
          .filter((id: any) => id && typeof id === 'number');

        try {
          if (existingBookingIds.length > 0 && existingBookingIds.length === items.length) {
            // Update existing desk bookings to Paid and mark payment_ref
            const placeholders = existingBookingIds.map(() => '?').join(',');
            db.prepare(`
              UPDATE bookings 
              SET payment_status = 'Paid', payment_ref = ?, icici_txn_id = ?
              WHERE id IN (${placeholders})
            `).run(txnID, txnID, ...existingBookingIds);

            // Update any desk payment links holding these booking IDs
            try {
              const matchedLinks = db.prepare(`SELECT * FROM desk_payment_links WHERE status = 'pending'`).all() as any[];
              for (const l of matchedLinks) {
                const bIds: number[] = JSON.parse(l.booking_ids || '[]');
                if (bIds.some(id => existingBookingIds.includes(id))) {
                  db.prepare(`UPDATE desk_payment_links SET status = 'completed', paid_at = datetime('now'), payment_ref = ? WHERE id = ?`).run(txnID, l.id);
                }
              }
            } catch (_) {}

            // Find first booking's order_number and preserve its desk PAYDUE prefix
            const firstRow = db.prepare('SELECT order_number, created_at, order_prefix FROM bookings WHERE id = ?').get(existingBookingIds[0]) as any;
            const existingOrderNo = firstRow?.order_number || existingBookingIds[0];
            formattedOrderCode = formatOrderNumber(existingOrderNo, firstRow?.order_prefix || 'PAYDUE');
            finalOrderId = formattedOrderCode;

            // Delete hold
            deleteOnlineCheckoutHold(baseOrderId);

            return NextResponse.redirect(new URL(`/success.html?order_id=${encodeURIComponent(finalOrderId)}`, redirectBase), 303);
          }

          // Otherwise, sequential order number assigned strictly upon payment success for standard online checkout!
          const orderNo = getNextOrderNumber();
          const createdAt = new Date().toISOString();
          formattedOrderCode = formatOrderNumber(orderNo, 'PAID');
          finalOrderId = formattedOrderCode;

          const couponCode = (items.length > 0 && items[0]?.appliedCoupon) ? String(items[0].appliedCoupon) : null;
          const insertStmt = db.prepare(`
            INSERT INTO bookings (
              order_number, ticket_id, booking_date, time_slot, quantity, 
              customer_name, customer_email, customer_phone, total_amount, 
              payment_status, fulfillment_status, simulator_name, simulator_slot, 
              created_at, payment_ref, icici_txn_id, applied_coupon, order_prefix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', 'Unfulfilled', ?, ?, ?, ?, ?, ?, 'PAID')
          `);

          let firstBookingId: number | null = null;
          const runInsertTxn = db.transaction(() => {
            for (const item of items) {
              let itemPrice = Number(holdRow.amount) / items.length;
              if (totalBaseCost > 0 && item.itemTotal) {
                const ratio = Number(item.itemTotal) / totalBaseCost;
                itemPrice = Number(holdRow.amount) * ratio;
              }

              const info = insertStmt.run(
                orderNo,
                item.ticketId || item.ticket_id,
                item.date || item.booking_date,
                item.timeSlot || item.time_slot || item.time,
                item.quantity || 1,
                holdRow.customer_name,
                holdRow.customer_email,
                holdRow.customer_phone,
                Math.round(itemPrice),
                item.simulatorName || null,
                item.simulatorSlot || null,
                createdAt,
                txnID,
                txnID,
                couponCode
              );
              if (firstBookingId === null && info?.lastInsertRowid) {
                firstBookingId = Number(info.lastInsertRowid);
              }
            }
          });

          runInsertTxn();

          // Auto-issue offer wristband if the used coupon is a VIP band offer
          if (couponCode) {
            try {
              const couponRow = db.prepare('SELECT * FROM coupons WHERE code = ?').get(couponCode.toUpperCase().trim()) as any;
              if (couponRow) {
                db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(couponRow.id);
                if (couponRow.is_band_coupon === 1) {
                  // Attempt issue in band inventory
                  try {
                    const { issueBandItem } = await import('@/lib/band-inventory-db');
                    const bandItem = db.prepare('SELECT * FROM band_items WHERE (barcode = ? OR serial_number = ?) AND status != "issued" LIMIT 1').get(couponCode, couponCode) as any;
                    if (bandItem) {
                      await issueBandItem({
                        band_id: bandItem.id,
                        customer_name: holdRow.customer_name || 'Customer',
                        order_number: formattedOrderCode,
                        booking_id: firstBookingId || undefined,
                        notes: `Auto-issued upon online payment redemption of VIP coupon: ${couponCode}`
                      });
                    } else if (couponRow.band_color) {
                      const { decrementColorStockByHex } = await import('@/lib/color-inventory-db');
                      await decrementColorStockByHex(couponRow.band_color, 1);
                    }
                  } catch (invErr) {
                    console.error('[ICICI Callback] Error updating VIP band inventory for coupon:', invErr);
                  }
                }
              }
            } catch (couponErr) {
              console.error('[ICICI Callback] Error processing coupon update:', couponErr);
            }
          }
        } catch (dbErr) {
          console.error('[ICICI Callback] Database error during booking registration:', dbErr);
          throw dbErr;
        }

        // Confirm simulator slot locks in shared PostgreSQL (convert tempTxnId -> finalOrderId)
        try {
          await confirmSimulatorSlotLocks(baseOrderId, finalOrderId, holdRow.customer_name || undefined, holdRow.customer_phone || undefined);
        } catch (simLockErr) {
          console.error('[ICICI Callback] Error confirming simulator slot locks:', simLockErr);
        }

        // Delete hold from online_checkout_holds now that booking is confirmed
        deleteOnlineCheckoutHold(baseOrderId);

        // Disptach Email & WhatsApp notifications
        try {
          const allTickets = getTickets();
          const emailItems = items.map((item: any) => {
            const tObj = allTickets.find(t => t.id === (item.ticketId || item.ticket_id));
            return {
              ticketName: tObj?.name || 'RC Fun Zone Pass',
              quantity: item.quantity || 1,
              date: item.date || item.booking_date,
              timeSlot: item.timeSlot || item.time_slot || item.time,
              itemTotal: item.itemTotal,
              simulatorName: item.simulatorName,
              simulatorSlot: item.simulatorSlot
            };
          });

          if (holdRow.customer_email) {
            sendBookingConfirmationEmail({
              orderId: formattedOrderCode,
              customerName: holdRow.customer_name || 'Customer',
              customerEmail: holdRow.customer_email,
              customerPhone: holdRow.customer_phone || '',
              totalAmount: holdRow.amount,
              paymentStatus: 'Paid',
              items: emailItems
            }).catch(e => console.error('[ICICI Callback] Confirmation email error:', e));
          }

          if (holdRow.customer_phone) {
            sendBookingConfirmationWhatsApp({
              orderId: formattedOrderCode,
              customerName: holdRow.customer_name || 'Customer',
              customerPhone: holdRow.customer_phone,
              totalAmount: holdRow.amount,
              paymentStatus: 'Paid',
              items: emailItems
            }).catch(e => console.error('[ICICI Callback] Confirmation WhatsApp error:', e));
          }

          notifyAdminsBookingWhatsApp({
            orderId: formattedOrderCode,
            customerName: holdRow.customer_name || 'Customer',
            customerPhone: holdRow.customer_phone || '',
            totalAmount: holdRow.amount,
            paymentStatus: 'Paid',
            items: emailItems
          }).catch(e => console.error('[ICICI Callback] Admin WhatsApp alert error:', e));
        } catch (commErr) {
          console.error('[ICICI Callback] Communication dispatch error:', commErr);
        }

        // Redirect to success page
        return NextResponse.redirect(new URL(`/success.html?order_id=${encodeURIComponent(formattedOrderCode)}`, redirectBase), 303);

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
