import { NextRequest, NextResponse } from "next/server";
import { 
  getDeskPaymentLinkByToken, 
  getBookingById, 
  getOnlineCheckoutHold, 
  createOnlineCheckoutHold, 
  getTickets 
} from "@/lib/db";
import { 
  getIciciMerchantId, 
  getIciciAggregatorId, 
  getIciciInitiateSaleUrl, 
  generateIciciHash 
} from "@/lib/icici";

// GET: Retrieve payment link details for customer UI
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const link = getDeskPaymentLinkByToken(token);
    if (!link) {
      return NextResponse.json({ error: "Payment link not found or expired" }, { status: 404 });
    }

    const bookingIds: number[] = JSON.parse(link.booking_ids || "[]");
    const bookings = bookingIds.map(id => getBookingById(id)).filter(Boolean);

    // If all bookings are already paid, reflect status
    const allPaid = bookings.length > 0 && bookings.every((b: any) => (b.payment_status || "").toLowerCase() === "paid");
    const currentStatus = allPaid ? "completed" : link.status;

    return NextResponse.json({
      token: link.token,
      customer_name: link.customer_name,
      customer_phone: link.customer_phone,
      country_code: link.country_code,
      total_amount: link.total_amount,
      status: currentStatus,
      paid_at: link.paid_at,
      payment_ref: link.payment_ref,
      bookings: bookings.map((b: any) => ({
        id: b.id,
        order_number: b.order_number,
        ticket_name: b.ticket_name,
        date: b.booking_date,
        time_slot: b.time_slot,
        quantity: b.quantity,
        total_amount: b.total_amount,
        payment_status: b.payment_status,
        fulfillment_status: b.fulfillment_status,
        simulator_name: b.simulator_name,
        simulator_slot: b.simulator_slot,
      })),
    });
  } catch (error: any) {
    console.error("[Get Payment Link Error]", error);
    return NextResponse.json({ error: error.message || "Failed to load payment link" }, { status: 500 });
  }
}

// POST: Initiate online PG payment for this desk payment link
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const link = getDeskPaymentLinkByToken(token);
    if (!link) {
      return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
    }

    if (link.status === "completed") {
      return NextResponse.json({ error: "This order has already been paid and completed." }, { status: 400 });
    }

    const bookingIds: number[] = JSON.parse(link.booking_ids || "[]");
    const bookings = bookingIds.map(id => getBookingById(id)).filter(Boolean);

    if (bookings.length === 0) {
      return NextResponse.json({ error: "No bookings found for this payment link." }, { status: 404 });
    }

    const allTickets = getTickets();
    const ticketMap = new Map(allTickets.map(t => [t.id, t]));

    // Format hold items
    const items = bookings.map((b: any) => {
      const ticketDef = ticketMap.get(b.ticket_id);
      return {
        ticketId: b.ticket_id,
        ticket_id: b.ticket_id,
        ticketName: ticketDef?.name || b.ticket_name || "RC Session",
        date: b.booking_date,
        booking_date: b.booking_date,
        timeSlot: b.time_slot,
        time_slot: b.time_slot,
        quantity: b.quantity || 1,
        itemTotal: b.total_amount,
        simulatorName: b.simulator_name,
        simulatorSlot: b.simulator_slot,
        bookingId: b.id,
      };
    });

    // Generate temporary txn ID strictly <= 20 chars
    const attemptSuffix = Date.now().toString().slice(-6);
    const tempTxnId = `TXN_RC_${attemptSuffix}`;

    const custName = link.customer_name || "Customer";
    const custPhone = link.customer_phone || "";
    const custEmail = (bookings[0] as any)?.customer_email || "";

    createOnlineCheckoutHold({
      txn_id: tempTxnId,
      customer_name: custName,
      customer_email: custEmail,
      customer_phone: custPhone,
      amount: Number(link.total_amount),
      items_json: JSON.stringify(items),
      whatsapp_consent: 1,
    });

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

    const returnBase = process.env.ICICI_RETURN_BASE 
      || process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.NODE_ENV === 'production' 
          ? 'https://havocrcfunzone.com' 
          : `${req.nextUrl.protocol}//${req.nextUrl.host}`);

    const aggregatorId = getIciciAggregatorId();
    const payload: Record<string, any> = {
      merchantId: getIciciMerchantId(),
      merchantTxnNo: tempTxnId,
      amount: Number(link.total_amount).toFixed(2),
      currencyCode: "356",
      payType: "0",
      customerEmailID: custEmail || "guest@havocrcfunzone.com",
      transactionType: "SALE",
      txnDate: txnDate,
      returnURL: `${returnBase}/api/payment/icici/callback`,
      customerMobileNo: cleanMobile,
      customerName: custName
    };

    if (aggregatorId) {
      payload.aggregatorID = aggregatorId;
    }

    payload.secureHash = generateIciciHash(payload);

    const iciciRes = await fetch(getIciciInitiateSaleUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await iciciRes.json();

    if (data.responseCode !== "R1000") {
      console.error("[ICICI Desk Pay Link error]", data);
      return NextResponse.json({
        error: data.responseDescription || "Payment gateway connection error",
        details: data
      }, { status: 500 });
    }

    return NextResponse.json({
      redirectURI: data.redirectURI,
      tranCtx: data.tranCtx,
      paymentUrl: `${data.redirectURI}?tranCtx=${data.tranCtx}`,
      txn_id: tempTxnId
    });
  } catch (error: any) {
    console.error("[Initiate Pay Link Error]", error);
    return NextResponse.json({ error: error.message || "Failed to initiate online payment" }, { status: 500 });
  }
}
