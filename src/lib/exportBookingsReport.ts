import ExcelJS from "exceljs";
import { getSlotWristbandColor } from "./slotColors";

export interface BookingExportItem {
  id: number;
  order_number: number;
  order_code?: string;
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

// Helper to determine text contrast (black or white) based on background hex
function getContrastTextColor(hexColor: string): string {
  const cleanHex = hexColor.replace("#", "").toUpperCase();
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length >= 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "000000" : "FFFFFF";
}

function normalizeHex(hex?: string | null): string {
  if (!hex) return "06B6D4";
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return clean.split("").map(c => c + c).join("").toUpperCase();
  }
  return clean.toUpperCase();
}

/**
 * Generates and downloads an Excel report matching the exact Havoc presentation format:
 * - Professional solid cell borders on all data cells and headers
 * - Distinct colored fill for "SLOT NO / COLOUR" cells matching that slot's wristband color
 * - Title Banner, Spanning Headers (NUMBER OF TICKETS, AMOUNT), and Total Footers
 * - Clean blank rows separating different time slots
 */
export async function generateBookingsExcelReport(
  bookings: BookingExportItem[],
  timeSlotsMetadata: { label: string; color?: string | null; color_name?: string | null; sort_order?: number }[] = [],
  reportTitle?: string
) {
  if (!bookings || bookings.length === 0) {
    throw new Error("No booking data available to export.");
  }

  // 1. Build a lookup for slot index/number, color hex, and color name
  const slotMetaMap = new Map<string, { slotIndex: number; colorHex: string; colorName: string }>();
  timeSlotsMetadata.forEach((ts, idx) => {
    const slotIdx = ts.sort_order !== undefined && ts.sort_order > 0 ? ts.sort_order : idx + 1;
    const cName = cleanColourName(ts.color_name, ts.color);
    const band = getSlotWristbandColor(ts.label, ts.color, ts.color_name);
    slotMetaMap.set(ts.label.trim().toUpperCase(), {
      slotIndex: slotIdx,
      colorHex: normalizeHex(band.hex),
      colorName: cName
    });
  });

  // Group items by order_number
  const ordersMap = new Map<number, {
    orderNo: number;
    orderCode: string;
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
        orderCode: b.order_code || `#PAYDUE_FZ_${orderNum}`,
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

  // Group orders by Time Slot
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

  // Create Excel Workbook and Sheet using exceljs
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Havoc RC Funzone";
  workbook.created = new Date();

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

  const sheetName = (headerDateTitle.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 31)) || "Bookings Report";
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // Define Standard Borders
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } }
  };

  const mediumBorder: Partial<ExcelJS.Borders> = {
    top: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "medium", color: { argb: "FF000000" } },
    bottom: { style: "medium", color: { argb: "FF000000" } },
    right: { style: "medium", color: { argb: "FF000000" } }
  };

  const doubleBottomBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "double", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } }
  };

  // Configure Column Widths (A to P -> 16 columns)
  worksheet.columns = [
    { key: "totalSl", width: 10 },        // A: TOTAL SL
    { key: "sn", width: 7 },             // B: SN
    { key: "orderNo", width: 18 },       // C: ORDER NO
    { key: "name", width: 24 },          // D: NAME
    { key: "phone", width: 16 },         // E: PHONE NO
    { key: "email", width: 30 },         // F: E-MAIL ID
    { key: "date", width: 12 },          // G: DATE
    { key: "timeSlot", width: 15 },      // H: TIME SLOT
    { key: "slotColour", width: 24 },    // I: SLOT NO / COLOUR
    { key: "v", width: 6 },              // J: V
    { key: "p", width: 6 },              // K: P
    { key: "vv", width: 6 },             // L: VV
    { key: "vp", width: 6 },             // M: VP
    { key: "amtReceived", width: 18 },   // N: AMOUNT RECEIVED
    { key: "amtDue", width: 18 },        // O: AMOUNT DUE
    { key: "status", width: 14 }         // P: STATUS
  ];

  // ROW 1: Main Title Banner (spanning A1 to P1)
  const titleRow = worksheet.addRow([headerDateTitle]);
  titleRow.height = 30;
  worksheet.mergeCells("A1:P1");
  const titleCell = worksheet.getCell("A1");
  titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF000000" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  for (let col = 1; col <= 16; col++) {
    worksheet.getRow(1).getCell(col).border = mediumBorder;
  }

  // ROW 2: Header Top Row
  const headerRow1 = worksheet.addRow([
    "TOTAL SL",
    "SN",
    "ORDER NO",
    "NAME",
    "PHONE NO",
    "E-MAIL ID",
    "DATE",
    "TIME SLOT",
    "SLOT NO / COLOUR",
    "NUMBER OF TICKETS", "", "", "", // cols 10, 11, 12, 13
    "AMOUNT RECEIVED",
    "AMOUNT DUE",
    "STATUS"
  ]);
  headerRow1.height = 24;

  // ROW 3: Sub-Header Row (for V, P, VV, VP)
  const headerRow2 = worksheet.addRow([
    "", "", "", "", "", "", "", "", "",
    "V", "P", "VV", "VP",
    "", "", ""
  ]);
  headerRow2.height = 22;

  // Merges for Table Header:
  // J2:M2 -> "NUMBER OF TICKETS"
  worksheet.mergeCells("J2:M2");
  // Multi-row merges for non-split headers: A2:A3, B2:B3, ... I2:I3, N2:N3, O2:O3, P2:P3
  const spanningCols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "N", "O", "P"];
  spanningCols.forEach(col => {
    worksheet.mergeCells(`${col}2:${col}3`);
  });

  // Style Header Rows (Rows 2 & 3)
  for (let r = 2; r <= 3; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 16; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F2F2" }
      };
      cell.border = thinBorder;
    }
  }

  let totalSlCounter = 1;
  let grandTotalV = 0;
  let grandTotalP = 0;
  let grandTotalVV = 0;
  let grandTotalVP = 0;
  let grandTotalTickets = 0;
  let grandTotalAmountReceived = 0;
  let grandTotalAmountDue = 0;

  // Populate Data Rows Grouped by Slot
  sortedSlotKeys.forEach((slotKey, slotIndex) => {
    // Add an empty gap row between different time slots (without borders)
    if (slotIndex > 0) {
      const gapRow = worksheet.addRow([]);
      gapRow.height = 14;
    }

    const ordersInSlot = slotGroups.get(slotKey)!;
    ordersInSlot.sort((a, b) => a.orderNo - b.orderNo);

    // Get slot meta, number, and color
    const meta = slotMetaMap.get(slotKey.trim().toUpperCase());
    const slotNum = meta ? meta.slotIndex : (slotIndex + 1);

    const firstOrder = ordersInSlot[0];
    const cName = meta?.colorName || cleanColourName(firstOrder?.slotColorName, firstOrder?.slotColor);
    const slotDisplayText = `SLOT-${slotNum}/ ${cName || "BAND"}`;

    // Color hex for this slot
    const slotHex = meta?.colorHex || normalizeHex(firstOrder?.slotColor) || "06B6D4";
    const contrastTextColor = getContrastTextColor(slotHex);

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
          pCount += qty;
        }
      }

      grandTotalV += vCount;
      grandTotalP += pCount;
      grandTotalVV += vvCount;
      grandTotalVP += vpCount;
      grandTotalTickets += (vCount + pCount + vvCount + vpCount);

      const isPaid = order.payment_status.toLowerCase() === "paid";
      const totalAmt = order.total_amount > 0 ? order.total_amount : Math.round(calculatedBaseAmount * 1.18);
      const received = isPaid ? totalAmt : 0;
      const due = isPaid ? 0 : totalAmt;

      grandTotalAmountReceived += received;
      grandTotalAmountDue += due;

      const dataRow = worksheet.addRow([
        currentSl,
        sn,
        order.orderCode,
        order.name,
        order.phone,
        order.email,
        order.date,
        order.timeSlot,
        slotDisplayText,
        vCount > 0 ? vCount : "",
        pCount > 0 ? pCount : "",
        vvCount > 0 ? vvCount : "",
        vpCount > 0 ? vpCount : "",
        received > 0 ? `₹ ${received.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
        due > 0 ? `₹ ${due.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
        order.fulfillment_status
      ]);
      dataRow.height = 20;

      // Apply solid borders and alignment to every cell in the row
      for (let c = 1; c <= 16; c++) {
        const cell = dataRow.getCell(c);
        cell.border = thinBorder;
        cell.font = { name: "Calibri", size: 10 };

        // Alignments:
        // Text left-aligned for Name, Email, Order Code
        // Center-aligned for SL, SN, Date, Slot, Ticket Quantities, Status
        // Right-aligned for Currency amounts
        if (c === 3 || c === 4 || c === 6) {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        } else if (c === 14 || c === 15) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      }

      // Fill Column 9 (SLOT NO / COLOUR) with that specific slot's color
      const slotCell = dataRow.getCell(9);
      slotCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${slotHex}` }
      };
      slotCell.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: `FF${contrastTextColor}` }
      };
    });
  });

  // Blank separator before Totals
  const preTotalGap = worksheet.addRow([]);
  preTotalGap.height = 10;

  // ROW: Category Totals (TOTAL row)
  const totalRow = worksheet.addRow([
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
  totalRow.height = 24;

  for (let c = 1; c <= 16; c++) {
    const cell = totalRow.getCell(c);
    if (c >= 9 && c <= 15) {
      cell.border = thinBorder;
      cell.font = { name: "Calibri", size: 10, bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F0F0" }
      };
      if (c === 14 || c === 15) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    }
  }

  // ROW: Overall Total Tickets
  const overallRow = worksheet.addRow([
    "", "", "", "", "", "", "", "",
    "TOTAL TICKETS",
    grandTotalTickets,
    "", "", "", "", "", ""
  ]);
  overallRow.height = 24;

  // Merge J:M on the overall tickets row
  const overallRowNum = overallRow.number;
  worksheet.mergeCells(`J${overallRowNum}:M${overallRowNum}`);

  for (let c = 9; c <= 13; c++) {
    const cell = overallRow.getCell(c);
    cell.border = doubleBottomBorder;
    cell.font = { name: "Calibri", size: 11, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEAEAEA" }
    };
  }

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Havoc_Funzone_Report_${headerDateTitle.replace(/\s+/g, "_")}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
