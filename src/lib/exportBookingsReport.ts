import * as XLSX from "xlsx";
import { getSlotWristbandColor } from "./slotColors";

export interface BookingExportItem {
  id: number;
  order_number: number;
  booking_date: string;
  time_slot: string;
  quantity: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  total_amount?: number;
  payment_status?: string;
  fulfillment_status?: string;
  ticket_name?: string;
  ticket_price?: number;
  slot_color?: string;
  slot_color_name?: string;
  created_at?: string;
}

interface ProcessedRow {
  totalSl: number;
  sn: number;
  orderNo: string | number;
  name: string;
  phone: string;
  email: string;
  date: string;
  timeSlot: string;
  slotNoColour: string;
  vQty: number | string;
  pQty: number | string;
  vvQty: number | string;
  vpQty: number | string;
  otherQty: number | string;
  amountReceived: number;
  amountDue: number;
  status: string;
}

// Convert "11AM-12PM" or "3PM-4PM" into start minutes from midnight for chronological sorting
function getSlotStartMinutes(slot: string): number {
  if (!slot) return 9999;
  const match = slot.match(/^(\d+)(?::(\d+))?\s*(AM|PM)?/i);
  if (!match) return 9999;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3] ? match[3].toUpperCase() : "";
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function cleanColourName(colorName?: string | null, colorHex?: string | null): string {
  if (colorName && colorName.trim()) {
    return colorName.replace(/band|wristband/gi, "").trim().toUpperCase();
  }
  const wristband = getSlotWristbandColor(undefined, colorHex, colorName);
  return (wristband?.name || "BAND").replace(/band|wristband/gi, "").trim().toUpperCase();
}

/**
 * Exports bookings into a beautifully styled Excel workbook matching the exact Havoc report format:
 * Top header: DATE (DAY) e.g. "OCTOBER 18 (SUNDAY)" or "ALL BOOKINGS"
 * Table Headers:
 * TOTAL SL | SN | ORDER NO | NAME | PHONE NO | E-MAIL ID | DATE | TIME SLOT | SLOT NO / COLOUR | NO OF TIC [V, P, VV, VP] | AMOUNT RECEIVED | AMOUNT DUE | STATUS
 * Grouped by Slot with separate subtotal & grand totals
 */
export function generateBookingsExcelReport(
  bookings: BookingExportItem[],
  timeSlotsMetadata: { label: string; color?: string | null; color_name?: string | null; sort_order?: number }[] = [],
  reportTitle?: string
) {
  if (!bookings || bookings.length === 0) {
    throw new Error("No booking data available to export.");
  }

  // 1. Build a lookup for slot index/number and color
  const slotMetaMap = new Map<string, { slotIndex: number; colorName: string }>();
  timeSlotsMetadata.forEach((ts, idx) => {
    const slotIdx = ts.sort_order !== undefined && ts.sort_order > 0 ? ts.sort_order : idx + 1;
    const cName = cleanColourName(ts.color_name, ts.color);
    slotMetaMap.set(ts.label.trim().toUpperCase(), { slotIndex: slotIdx, colorName: cName });
  });

  // Group items by order_number so all ticket passes of the same order stay combined
  const ordersMap = new Map<number, {
    orderNo: number;
    name: string;
    phone: string;
    email: string;
    date: string;
    timeSlot: string;
    slotColor: string;
    slotColorName: string;
    payment_status: string;
    fulfillment_status: string;
    total_amount: number;
    items: BookingExportItem[];
  }>();

  for (const b of bookings) {
    const orderNum = b.order_number || b.id;
    if (!ordersMap.has(orderNum)) {
      ordersMap.set(orderNum, {
        orderNo: orderNum,
        name: b.customer_name || "Guest",
        phone: b.customer_phone || "",
        email: b.customer_email || "",
        date: b.booking_date || "",
        timeSlot: b.time_slot || "",
        slotColor: b.slot_color || "",
        slotColorName: b.slot_color_name || "",
        payment_status: b.payment_status || "Unpaid",
        fulfillment_status: b.fulfillment_status || "Unfulfilled",
        total_amount: Number(b.total_amount || 0),
        items: []
      });
    }
    ordersMap.get(orderNum)!.items.push(b);
  }

  // 2. Group orders by Time Slot (and date if multi-date)
  const slotGroups = new Map<string, typeof ordersMap extends Map<any, infer V> ? V[] : never>();

  for (const order of ordersMap.values()) {
    const slotKey = order.timeSlot || "UNASSIGNED";
    if (!slotGroups.has(slotKey)) {
      slotGroups.set(slotKey, []);
    }
    slotGroups.get(slotKey)!.push(order);
  }

  // Sort slots chronologically
  const sortedSlotKeys = Array.from(slotGroups.keys()).sort((a, b) => {
    return getSlotStartMinutes(a) - getSlotStartMinutes(b);
  });

  // Assign distinct slot numbering (SLOT-1, SLOT-2, ...)
  const slotLabelToDisplay = new Map<string, string>();
  sortedSlotKeys.forEach((slotKey, sIdx) => {
    const meta = slotMetaMap.get(slotKey.trim().toUpperCase());
    const slotNum = meta ? meta.slotIndex : (sIdx + 1);
    
    // Pick color from meta or from first order in this slot
    const firstOrder = slotGroups.get(slotKey)?.[0];
    const cName = meta?.colorName || cleanColourName(firstOrder?.slotColorName, firstOrder?.slotColor);

    slotLabelToDisplay.set(slotKey, `SLOT-${slotNum}/ ${cName || "BAND"}`);
  });

  // 3. Prepare spreadsheet data rows
  const excelRows: any[][] = [];

  // Determine top title: e.g. "OCTOBER 18 (SUNDAY)"
  let headerDateTitle = reportTitle;
  if (!headerDateTitle) {
    const distinctDates = Array.from(new Set(bookings.map(b => b.booking_date).filter(Boolean)));
    if (distinctDates.length === 1) {
      headerDateTitle = distinctDates[0].toUpperCase();
    } else {
      headerDateTitle = "ALL BOOKINGS REPORT";
    }
  }

  // Row 1: Main Title Banner (spanning columns A to Q)
  excelRows.push([
    "", "", "", "", "", "", "",
    headerDateTitle,
    "", "", "", "", "", "", "", "", ""
  ]);

  // Row 2: Secondary Header / Top Row for Column Spanning (NO OF TIC and AMOUNT)
  excelRows.push([
    "TOTAL SL",
    "SN",
    "ORDER NO",
    "NAME",
    "PHONE NO",
    "E-MAIL ID",
    "DATE",
    "TIME SLOT",
    "SLOT NO / COLOUR",
    "NO OF TIC",
    "",
    "",
    "",
    "AMOUNT RECEIVED",
    "AMOUNT DUE",
    "STATUS",
    ""
  ]);

  // Row 3: Sub-header row for ticket breakdown columns
  excelRows.push([
    "", "", "", "", "", "", "", "", "",
    "V",   // Visitor
    "P",   // Participant
    "VV",  // VIP Visitor
    "VP",  // VIP Participant
    "",    // Amount Received
    "",    // Amount Due
    "",    // Status
    ""
  ]);

  let totalSlCounter = 1;
  let grandTotalV = 0;
  let grandTotalP = 0;
  let grandTotalVV = 0;
  let grandTotalVP = 0;
  let grandTotalTickets = 0;
  let grandTotalAmountReceived = 0;
  let grandTotalAmountDue = 0;

  // Process slot groups
  for (const slotKey of sortedSlotKeys) {
    const ordersInSlot = slotGroups.get(slotKey)!;
    // Sort orders in slot by orderNo
    ordersInSlot.sort((a, b) => a.orderNo - b.orderNo);

    const slotDisplay = slotLabelToDisplay.get(slotKey) || slotKey;

    ordersInSlot.forEach((order, snIdx) => {
      const sn = snIdx + 1;
      const currentSl = totalSlCounter++;

      // Count quantities per pass type
      let vCount = 0;
      let pCount = 0;
      let vvCount = 0;
      let vpCount = 0;

      let calculatedBaseAmount = 0;
      for (const item of order.items) {
        const tName = (item.ticket_name || "").toUpperCase();
        const qty = item.quantity || 1;
        calculatedBaseAmount += (item.ticket_price || 0) * qty;

        if (tName.includes("VIP_PARTICIPANT") || tName.includes("VIP PARTICIPANT")) {
          vpCount += qty;
        } else if (tName.includes("VIP_VISITOR") || tName.includes("VIP VISITOR")) {
          vvCount += qty;
        } else if (tName.includes("PARTICIPANT")) {
          pCount += qty;
        } else if (tName.includes("VISITOR")) {
          vCount += qty;
        } else {
          pCount += qty; // fallback
        }
      }

      grandTotalV += vCount;
      grandTotalP += pCount;
      grandTotalVV += vvCount;
      grandTotalVP += vpCount;
      grandTotalTickets += (vCount + pCount + vvCount + vpCount);

      // Financials
      // If payment_status is 'Paid', amount is in Received; otherwise in Due
      const isPaid = order.payment_status.toLowerCase() === "paid";
      const totalAmt = order.total_amount > 0 ? order.total_amount : Math.round(calculatedBaseAmount * 1.18);

      const received = isPaid ? totalAmt : 0;
      const due = isPaid ? 0 : totalAmt;

      grandTotalAmountReceived += received;
      grandTotalAmountDue += due;

      const rowData = [
        currentSl,
        sn,
        order.orderNo,
        order.name,
        order.phone,
        order.email,
        order.date,
        order.timeSlot,
        slotDisplay,
        vCount > 0 ? vCount : "",
        pCount > 0 ? pCount : "",
        vvCount > 0 ? vvCount : "",
        vpCount > 0 ? vpCount : "",
        received > 0 ? `₹ ${received.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
        due > 0 ? `₹ ${due.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
        order.fulfillment_status
      ];

      excelRows.push(rowData);
    });
  }

  // Blank separator row before total
  excelRows.push([]);

  // TOTAL Row matching exact Havoc format:
  // TOTAL | (empty...) | TOTAL (at column 9) | V | P | VV | VP | ₹ AMOUNT RECEIVED | ₹ AMOUNT DUE
  excelRows.push([
    "", "", "", "", "", "", "", "",
    "TOTAL",
    grandTotalV,
    grandTotalP,
    grandTotalVV,
    grandTotalVP,
    `₹ ${grandTotalAmountReceived.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    `₹ ${grandTotalAmountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    ""
  ]);

  // Overall Total Tickets Row
  excelRows.push([
    "", "", "", "", "", "", "", "",
    "TOTAL TICKETS",
    grandTotalTickets,
    "", "", "", "", "", ""
  ]);

  // Create Worksheet
  const ws = XLSX.utils.aoa_to_sheet(excelRows);

  // Define merges for banner header and columns
  ws["!merges"] = [
    // Row 1 Title Banner
    { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
    // NO OF TIC across 4 columns (V, P, VV, VP) -> cols 9, 10, 11, 12
    { s: { r: 1, c: 9 }, e: { r: 1, c: 12 } },
    // Columns that span rows 1 and 2 (0-indexed r:1 to r:2)
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }, // TOTAL SL
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } }, // SN
    { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } }, // ORDER NO
    { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } }, // NAME
    { s: { r: 1, c: 4 }, e: { r: 2, c: 4 } }, // PHONE NO
    { s: { r: 1, c: 5 }, e: { r: 2, c: 5 } }, // E-MAIL ID
    { s: { r: 1, c: 6 }, e: { r: 2, c: 6 } }, // DATE
    { s: { r: 1, c: 7 }, e: { r: 2, c: 7 } }, // TIME SLOT
    { s: { r: 1, c: 8 }, e: { r: 2, c: 8 } }, // SLOT NO / COLOUR
    { s: { r: 1, c: 13 }, e: { r: 2, c: 13 } }, // AMOUNT RECEIVED
    { s: { r: 1, c: 14 }, e: { r: 2, c: 14 } }, // AMOUNT DUE
    { s: { r: 1, c: 15 }, e: { r: 2, c: 15 } }, // STATUS
  ];

  // Set Column Widths
  ws["!cols"] = [
    { wch: 10 }, // TOTAL SL
    { wch: 6 },  // SN
    { wch: 12 }, // ORDER NO
    { wch: 22 }, // NAME
    { wch: 15 }, // PHONE NO
    { wch: 28 }, // E-MAIL ID
    { wch: 10 }, // DATE
    { wch: 14 }, // TIME SLOT
    { wch: 20 }, // SLOT NO / COLOUR
    { wch: 6 },  // V
    { wch: 6 },  // P
    { wch: 6 },  // VV
    { wch: 6 },  // VP
    { wch: 18 }, // AMOUNT RECEIVED
    { wch: 18 }, // AMOUNT DUE
    { wch: 14 }  // STATUS
  ];

  // Create Workbook
  const wb = XLSX.utils.book_new();
  const sheetName = (headerDateTitle.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 31)) || "Bookings Report";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate binary and trigger download in browser
  const filename = `Havoc_Funzone_Report_${headerDateTitle.replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
