import { NextRequest, NextResponse } from 'next/server';
import { 
  createOnlineCheckoutHold, 
  deleteOnlineCheckoutHold, 
  getBookedQuantities, 
  getTickets,
  cleanupExpiredHolds 
} from '@/lib/db';
import { 
  lockSimulatorSlot, 
  deleteSimulatorSlotLocks, 
  parseSimulatorSlotAssignments, 
  getTakenSimulatorSlots 
} from '@/lib/simulator-db';
import { 
  getIciciAggregatorId, 
  getIciciMerchantId, 
  generateIciciHash, 
  getIciciBaseUrl 
} from '@/lib/icici';

export async function POST(req: NextRequest) {
  let tempTxnId = '';
  try {
    const body = await req.json();
    const { amount, customer_details, booking_data } = body;
    const items = Array.isArray(booking_data) ? booking_data : [booking_data];

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No booking items provided' }, { status: 400 });
    }

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    // 1. Clean up expired holds older than 2 minutes before running concurrency checks
    await cleanupExpiredHolds(2);

    // 2. Concurrency check: Ensure requested tickets don't exceed remaining capacity
    const tickets = getTickets();
    const ticketMap = new Map(tickets.map(t => [t.id, t]));

    for (const item of items) {
      const ticketId = item.ticketId || item.ticket_id;
      const date = item.date || item.booking_date;
      const timeSlot = item.timeSlot || item.time_slot || item.time;
      const quantity = Number(item.quantity) || 1;

      const ticketDef = ticketMap.get(ticketId);
      if (ticketDef) {
        const bookedList = getBookedQuantities(date, timeSlot);
        const bookedRow = bookedList.find(b => b.ticket_id === ticketId);
        const currentBooked = bookedRow ? bookedRow.total_booked : 0;

        if (currentBooked + quantity > ticketDef.capacity) {
          return NextResponse.json({ 
            error: `Selected slot for "${ticketDef.name}" on ${date} (${timeSlot}) is fully booked or being held by another guest.` 
          }, { status: 409 });
        }
      }

      // 3. Concurrency check for simulator slot (if attached)
      if (item.simulatorName && item.simulatorSlot) {
        const assignments = parseSimulatorSlotAssignments(item.simulatorName, item.simulatorSlot);
        for (const assign of assignments) {
          if (assign.simulatorName && assign.slotLabel) {
            const takenSlots = await getTakenSimulatorSlots(assign.simulatorName, date);
            if (takenSlots.includes(assign.slotLabel)) {
              return NextResponse.json({
                error: `Simulator slot "${assign.simulatorName}" at ${assign.slotLabel} on ${date} is already reserved or held.`
              }, { status: 409 });
            }
          }
        }
      }
    }

    // 4. Generate temporary tracking ID strictly <= 20 characters (ICICI PG requirement)
    // Format: TXN_RC_<compact_timestamp_suffix> (e.g. TXN_RC_123456, 13 chars)
    // We do NOT call getNextOrderNumber() or insert into bookings here!
    const attemptSuffix = Date.now().toString().slice(-6);
    tempTxnId = `TXN_RC_${attemptSuffix}`;

    const custName = customer_details?.name || 'Customer';
    const custEmail = customer_details?.email || '';
    const custPhone = customer_details?.phone || '';
    const whatsappConsent = customer_details?.whatsapp_consent === false ? 0 : 1;

    // 5. Insert hold into online_checkout_holds
    createOnlineCheckoutHold({
      txn_id: tempTxnId,
      customer_name: custName,
      customer_email: custEmail,
      customer_phone: custPhone,
      amount: Number(amount),
      items_json: JSON.stringify(items),
      whatsapp_consent: whatsappConsent,
    });

    // 6. Lock temporary simulator slots with source_order_id = tempTxnId and status = 'PENDING'
    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const item = items[itemIdx];
      if (item.simulatorName && item.simulatorSlot) {
        const assignments = parseSimulatorSlotAssignments(item.simulatorName, item.simulatorSlot);
        for (let idx = 0; idx < assignments.length; idx++) {
          const assign = assignments[idx];
          if (assign.simulatorName && assign.slotLabel) {
            const itemOrderId = assignments.length > 1 || items.length > 1
              ? `${tempTxnId}_${itemIdx + 1}_${idx + 1}`
              : tempTxnId;

            await lockSimulatorSlot({
              simulatorName: assign.simulatorName,
              bookingDate: item.date || item.booking_date,
              bookingTime: assign.slotLabel,
              sourceOrderId: itemOrderId,
              customerName: custName,
              customerEmail: custEmail,
              customerPhone: custPhone,
              status: 'PENDING'
            });
          }
        }
      }
    }

    // 7. Build ICICI Gateway request payload
    const istDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());
    const txnDate = istDateStr.replace(/\D/g, ''); // YYYYMMDDHHMMSS in IST

    const digitsOnly = custPhone.replace(/\D/g, '');
    const cleanMobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : (digitsOnly || '9999999999');

    // Return URL base resolution: prioritize explicit env, else request origin
    const returnBase = process.env.ICICI_RETURN_BASE 
      || process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.NODE_ENV === 'production' 
          ? 'https://havocrcfunzone.com' 
          : `${req.nextUrl.protocol}//${req.nextUrl.host}`);

    const payload: Record<string, any> = {
      merchantId: getIciciMerchantId(),
      merchantTxnNo: tempTxnId,
      amount: Number(amount).toFixed(2),
      aggregatorID: getIciciAggregatorId(),
      currencyCode: "356",
      payType: "0",
      customerEmailID: custEmail || "guest@havocrcfunzone.com",
      transactionType: "SALE",
      txnDate: txnDate,
      returnURL: `${returnBase}/api/payment/icici/callback`,
      customerMobileNo: cleanMobile,
      customerName: custName
    };

    payload.secureHash = generateIciciHash(payload);

    // 8. Call ICICI initiateSale API
    const iciciRes = await fetch(`${getIciciBaseUrl()}/initiateSale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await iciciRes.json();

    if (data.responseCode !== "R1000") {
      console.error('ICICI initiateSale error response:', data);
      // Clean up hold and slot locks immediately
      deleteOnlineCheckoutHold(tempTxnId);
      await deleteSimulatorSlotLocks(tempTxnId);

      return NextResponse.json({
        error: data.responseDescription || 'Failed to initiate ICICI PG payment',
        code: data.responseCode,
        details: data
      }, { status: 500 });
    }

    return NextResponse.json({
      redirectURI: data.redirectURI,
      tranCtx: data.tranCtx,
      txn_id: tempTxnId
    });

  } catch (err: any) {
    console.error('Create ICICI order API error:', err);
    if (tempTxnId) {
      deleteOnlineCheckoutHold(tempTxnId);
      await deleteSimulatorSlotLocks(tempTxnId);
    }
    return NextResponse.json({ 
      error: err.message || 'Failed to communicate with ICICI Gateway' 
    }, { status: 500 });
  }
}
