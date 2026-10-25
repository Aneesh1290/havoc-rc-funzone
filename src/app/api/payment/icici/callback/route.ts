import { NextRequest, NextResponse } from 'next/server';
import { 
  getOnlineCheckoutHold, 
  deleteOnlineCheckoutHold, 
  getNextOrderNumber, 
  getTickets 
} from '@/lib/db';
import { confirmSimulatorSlotLocks, deleteSimulatorSlotLocks } from '@/lib/simulator-db';
import { generateIciciHash } from '@/lib/icici';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { sendBookingConfirmationWhatsApp } from '@/lib/whatsapp';
import { formatOrderNumber } from '@/lib/order-utils';
import Database from 'better-sqlite3';
import path from 'path';

function getDbInstance() {
  const dbPath = process.env.DB_PATH || (process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'havoc.db') : path.resolve(process.cwd(), 'havoc.db'));
  return new Database(dbPath);
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
  const body = await parseRequestBody(req);
  console.log('[ICICI PG Callback] Received POST payload:', body);

  const receivedHash = body.secureHash;
  const computedHash = generateIciciHash(body);

  if (receivedHash && computedHash && receivedHash !== computedHash) {
    console.error('[ICICI Callback] Hash Mismatch!', { receivedHash, computedHash });
    return NextResponse.redirect(new URL('/checkout.html?error=Payment+Verification+Failed', req.url), 303);
  }

  const baseOrderId = body.merchantTxnNo || '';
  const txnID = body.txnID || body.paymentID || null;
  const responseCode = body.responseCode;

  // Handle successful payment
  if (responseCode === "0000") {
    if (baseOrderId.startsWith('TXN_RC_')) {
      const holdRow = getOnlineCheckoutHold(baseOrderId);

      if (!holdRow) {
        console.warn('[ICICI Callback] Hold record not found for txn_id:', baseOrderId);
        // Check if booking already exists (e.g. duplicate callback from gateway)
        const db = getDbInstance();
        try {
          const existing = db.prepare('SELECT order_number FROM bookings WHERE payment_ref = ? OR icici_txn_id = ?').get(txnID, txnID) as { order_number: number } | undefined;
          if (existing && existing.order_number) {
            const finalOrderId = formatOrderNumber(existing.order_number);
            return NextResponse.redirect(new URL(`/success.html?order_id=${encodeURIComponent(finalOrderId)}`, req.url), 303);
          }
        } finally {
          db.close();
        }
        return NextResponse.redirect(new URL('/checkout.html?error=Hold+expired+or+booking+missing', req.url), 303);
      }

      try {
        const items = JSON.parse(holdRow.items_json || '[]');
        const totalBaseCost = items.reduce((sum: number, i: any) => sum + (Number(i.itemTotal) || 0), 0);
        
        // Sequential order number assigned strictly upon payment success!
        const orderNo = getNextOrderNumber();
        const createdAt = new Date().toISOString();
        const formattedOrderCode = formatOrderNumber(orderNo, createdAt);
        const finalOrderId = formattedOrderCode;

        const db = getDbInstance();
        try {
          const insertStmt = db.prepare(`
            INSERT INTO bookings (
              order_number, ticket_id, booking_date, time_slot, quantity, 
              customer_name, customer_email, customer_phone, total_amount, 
              payment_status, fulfillment_status, simulator_name, simulator_slot, 
              created_at, payment_ref, icici_txn_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', 'Unfulfilled', ?, ?, ?, ?, ?)
          `);

          const runInsertTxn = db.transaction(() => {
            for (const item of items) {
              let itemPrice = Number(holdRow.amount) / items.length;
              if (totalBaseCost > 0 && item.itemTotal) {
                const ratio = Number(item.itemTotal) / totalBaseCost;
                itemPrice = Number(holdRow.amount) * ratio;
              }

              insertStmt.run(
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
                txnID
              );
            }
          });

          runInsertTxn();
        } finally {
          db.close();
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
        } catch (commErr) {
          console.error('[ICICI Callback] Communication dispatch error:', commErr);
        }

        // Redirect to success page
        return NextResponse.redirect(new URL(`/success.html?order_id=${encodeURIComponent(formattedOrderCode)}`, req.url), 303);

      } catch (parseErr) {
        console.error('[ICICI Callback] Error processing hold items:', parseErr);
        return NextResponse.redirect(new URL('/checkout.html?error=Error+confirming+booking', req.url), 303);
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
    return NextResponse.redirect(new URL(`/checkout.html?error=${encodeURIComponent(body.responseDescription || 'Payment Failed or Cancelled')}`, req.url), 303);
  }

  return NextResponse.redirect(new URL('/checkout.html?error=Payment+Failed+or+Cancelled', req.url), 303);
}

export async function GET(req: NextRequest) {
  // Support GET in case the gateway redirects user via GET with query params
  const searchParams = req.nextUrl.searchParams;
  const merchantTxnNo = searchParams.get('merchantTxnNo') || '';
  const responseCode = searchParams.get('responseCode') || '';
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');

  if (orderId) {
    return NextResponse.redirect(new URL(`/success.html?order_id=${orderId}`, req.url), 303);
  }

  if (responseCode === '0000' && merchantTxnNo) {
    const db = getDbInstance();
    try {
      const existing = db.prepare('SELECT order_number FROM bookings WHERE payment_ref = ? OR icici_txn_id = ?').get(merchantTxnNo, merchantTxnNo) as { order_number: number } | undefined;
      if (existing) {
        const formattedExisting = formatOrderNumber(existing.order_number, null, 'Paid');
        return NextResponse.redirect(new URL(`/success.html?order_id=${encodeURIComponent(formattedExisting)}`, req.url), 303);
      }
    } finally {
      db.close();
    }
  }

  if (merchantTxnNo.startsWith('TXN_RC_')) {
    deleteOnlineCheckoutHold(merchantTxnNo);
    await deleteSimulatorSlotLocks(merchantTxnNo).catch(() => {});
  }

  return NextResponse.redirect(new URL('/checkout.html?error=Payment+Cancelled', req.url), 303);
}
