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

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAY_NAMES = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"
];

const MONTH_FULL_NAMES = [
  "OCTOBER", "NOVEMBER", "DECEMBER", "JANUARY", "FEBRUARY", "MARCH",
  "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER"
];

// Helper to reliably parse booking dates like "Oct 20", "October 20", "2026-10-20"
function parseBookingDate(dateStr: string, referenceYear?: number): Date | null {
  if (!dateStr || dateStr === "UNASSIGNED") return null;

  const clean = dateStr.trim();
  const yearToUse = referenceYear || new Date().getFullYear();

  // Pattern 1: "Oct 20" or "October 20" or "Oct 20, 2026"
  const wordMatch = clean.match(/^([A-Za-z]+)\s*(\d{1,2})(?:[,\s]+(\d{4}))?$/i);
  if (wordMatch) {
    const monthKey = wordMatch[1].toLowerCase().slice(0, 3);
    const day = parseInt(wordMatch[2], 10);
    const yr = wordMatch[3] ? parseInt(wordMatch[3], 10) : yearToUse;
    const mIdx = MONTH_NAME_TO_INDEX[monthKey];
    if (mIdx !== undefined && !isNaN(day) && day >= 1 && day <= 31) {
      return new Date(yr, mIdx, day);
    }
  }

  // Pattern 2: ISO "2026-10-20"
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const yr = parseInt(isoMatch[1], 10);
    const mIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(yr, mIdx, day);
  }

  // Pattern 3: Fallback standard date
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    // If parsed year is suspiciously 2001 (e.g. from new Date("Oct 20")), replace with yearToUse
    if (parsed.getFullYear() < 2020) {
      return new Date(yearToUse, parsed.getMonth(), parsed.getDate());
    }
    return parsed;
  }

  return null;
}

// Format a date string (e.g. "Oct 20") into a full display banner "OCTOBER 20 (TUESDAY)"
function formatFullDateBanner(
  dateStr: string, 
  fallbackTitle?: string,
  referenceYear?: number
): { bannerTitle: string; sheetTabName: string; sortTimestamp: number } {
  if (!dateStr || dateStr === "UNASSIGNED") {
    return { bannerTitle: fallbackTitle || "ALL BOOKINGS", sheetTabName: "All Bookings", sortTimestamp: 0 };
  }

  const d = parseBookingDate(dateStr, referenceYear);

  if (d && !isNaN(d.getTime())) {
    const monthLong = d.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
    const dayNum = d.getDate();
    const weekday = WEEKDAY_NAMES[d.getDay()]; // Direct 0-6 index lookup ensures 100% correct day
    const bannerTitle = `${monthLong} ${dayNum} (${weekday})`;
    const monthShort = d.toLocaleDateString("en-US", { month: "short" });
    const sheetTabName = `${monthShort} ${dayNum}`.slice(0, 31);
    return { bannerTitle, sheetTabName, sortTimestamp: d.getTime() };
  }

  const clean = dateStr.toUpperCase();
  return { bannerTitle: clean, sheetTabName: dateStr.slice(0, 31), sortTimestamp: 0 };
}

interface OrderData {
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
}

/**
 * Renders a complete Havoc-formatted day report into a specific Worksheet
 */
function renderDaySheet(
  worksheet: ExcelJS.Worksheet,
  bannerTitle: string,
  ordersForDay: OrderData[],
  slotMetaMap: Map<string, { slotIndex: number; colorHex: string; colorName: string }>
) {
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
  const titleRow = worksheet.addRow([bannerTitle]);
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
  worksheet.mergeCells("J2:M2");
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

  // Group orders by Date first, then within each Date group by Time Slot
  // This ensures that "All Bookings" groups and sorts all orders by Date first (e.g. Oct 20 orders together, then Oct 21 orders together),
  // instead of mixing different dates into the same time slot!
  const dateToSlotsMap = new Map<string, Map<string, OrderData[]>>();

  for (const order of ordersForDay) {
    const dKey = order.date || "UNASSIGNED";
    if (!dateToSlotsMap.has(dKey)) {
      dateToSlotsMap.set(dKey, new Map<string, OrderData[]>());
    }
    const slotMap = dateToSlotsMap.get(dKey)!;
    const slotKey = order.timeSlot || "UNASSIGNED";
    if (!slotMap.has(slotKey)) {
      slotMap.set(slotKey, []);
    }
    slotMap.get(slotKey)!.push(order);
  }

  // Sort dates chronologically
  const sortedDates = Array.from(dateToSlotsMap.keys()).sort((a, b) => {
    const timeA = parseBookingDate(a)?.getTime() || 0;
    const timeB = parseBookingDate(b)?.getTime() || 0;
    return timeA - timeB;
  });

  let totalSlCounter = 1;
  let grandTotalV = 0;
  let grandTotalP = 0;
  let grandTotalVV = 0;
  let grandTotalVP = 0;
  let grandTotalTickets = 0;
  let grandTotalAmountReceived = 0;
  let grandTotalAmountDue = 0;

  let isFirstSection = true;

  // Populate Data Rows: Date by Date, and within each Date Slot by Slot
  sortedDates.forEach((dateKey, dateIdx) => {
    const slotGroups = dateToSlotsMap.get(dateKey)!;

    // Track per-day totals
    let dayV = 0;
    let dayP = 0;
    let dayVV = 0;
    let dayVP = 0;
    let dayAmountReceived = 0;
    let dayAmountDue = 0;

    // Sort slots chronologically within this date
    const sortedSlotKeys = Array.from(slotGroups.keys()).sort((a, b) => {
      return getSlotStartMinutes(a) - getSlotStartMinutes(b);
    });

    // If multiple dates are present (like in "All Bookings"), add a clear Date Section Divider Header
    if (sortedDates.length > 1) {
      // Add gap row before next date section (unless very top)
      if (!isFirstSection) {
        const dateGapRow = worksheet.addRow([]);
        dateGapRow.height = 18;
      }

      const { bannerTitle: dateBanner } = formatFullDateBanner(dateKey);
      const sectionRow = worksheet.addRow([`DATE: ${dateBanner}`]);
      sectionRow.height = 24;
      const sectionRowNum = sectionRow.number;
      worksheet.mergeCells(`A${sectionRowNum}:P${sectionRowNum}`);
      
      const sCell = worksheet.getCell(`A${sectionRowNum}`);
      sCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0D1B2A" } };
      sCell.alignment = { horizontal: "center", vertical: "middle" };
      sCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE9ECEF" }
      };
      for (let c = 1; c <= 16; c++) {
        const cCell = worksheet.getRow(sectionRowNum).getCell(c);
        cCell.border = thinBorder;
        cCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE9ECEF" }
        };
      }
    }

    sortedSlotKeys.forEach((slotKey, slotIndex) => {
      // Add an empty gap row between different time slots (without borders)
      if (slotIndex > 0 || (sortedDates.length === 1 && !isFirstSection)) {
        const gapRow = worksheet.addRow([]);
        gapRow.height = 14;
      }
      isFirstSection = false;

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

        // Accumulate Day Totals
        dayV += vCount;
        dayP += pCount;
        dayVV += vvCount;
        dayVP += vpCount;

        // Accumulate Grand Totals
        grandTotalV += vCount;
        grandTotalP += pCount;
        grandTotalVV += vvCount;
        grandTotalVP += vpCount;
        grandTotalTickets += (vCount + pCount + vvCount + vpCount);

        const isPaid = order.payment_status.toLowerCase() === "paid";
        const totalAmt = order.total_amount > 0 ? order.total_amount : Math.round(calculatedBaseAmount * 1.18);
        const received = isPaid ? totalAmt : 0;
        const due = isPaid ? 0 : totalAmt;

        dayAmountReceived += received;
        dayAmountDue += due;

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

        // Apply solid borders and alignment
        for (let c = 1; c <= 16; c++) {
          const cell = dataRow.getCell(c);
          cell.border = thinBorder;
          cell.font = { name: "Calibri", size: 10 };

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

    // If multiple dates are present (like in "All Bookings"), output the TOTAL for this specific day right here
    if (sortedDates.length > 1) {
      const dayTickets = dayV + dayP + dayVV + dayVP;

      // Small blank separator before Day Totals
      const preDayTotalGap = worksheet.addRow([]);
      preDayTotalGap.height = 8;

      // ROW: Day Category Totals (TOTAL row)
      const dayTotalRow = worksheet.addRow([
        "", "", "", "", "", "", "", "",
        "TOTAL",
        dayV > 0 ? dayV : "",
        dayP > 0 ? dayP : "",
        dayVV > 0 ? dayVV : "",
        dayVP > 0 ? dayVP : "",
        dayAmountReceived > 0 ? `₹ ${dayAmountReceived.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
        dayAmountDue > 0 ? `₹ ${dayAmountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
        ""
      ]);
      dayTotalRow.height = 24;

      for (let c = 1; c <= 16; c++) {
        const cell = dayTotalRow.getCell(c);
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

      // ROW: Total Tickets for this day
      const dayOverallRow = worksheet.addRow([
        "", "", "", "", "", "", "", "",
        "TOTAL TICKETS",
        dayTickets,
        "", "", "", "", "", ""
      ]);
      dayOverallRow.height = 24;

      const dayOverallRowNum = dayOverallRow.number;
      worksheet.mergeCells(`J${dayOverallRowNum}:M${dayOverallRowNum}`);

      for (let c = 9; c <= 13; c++) {
        const cell = dayOverallRow.getCell(c);
        cell.border = doubleBottomBorder;
        cell.font = { name: "Calibri", size: 11, bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEAEAEA" }
        };
      }
    }
  });

  // Blank separator before Sheet Totals
  const preTotalGap = worksheet.addRow([]);
  preTotalGap.height = 12;

  // ROW: Sheet Totals (TOTAL / GRAND TOTAL row)
  const totalRowLabel = sortedDates.length > 1 ? "GRAND TOTAL" : "TOTAL";
  const overallTicketLabel = sortedDates.length > 1 ? "GRAND TOTAL TICKETS" : "TOTAL TICKETS";

  const totalRow = worksheet.addRow([
    "", "", "", "", "", "", "", "",
    totalRowLabel,
    grandTotalV > 0 ? grandTotalV : "",
    grandTotalP > 0 ? grandTotalP : "",
    grandTotalVV > 0 ? grandTotalVV : "",
    grandTotalVP > 0 ? grandTotalVP : "",
    grandTotalAmountReceived > 0 ? `₹ ${grandTotalAmountReceived.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
    grandTotalAmountDue > 0 ? `₹ ${grandTotalAmountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
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
        fgColor: { argb: "FFE0E0E0" }
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
    overallTicketLabel,
    grandTotalTickets,
    "", "", "", "", "", ""
  ]);
  overallRow.height = 24;

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
      fgColor: { argb: "FFD6D6D6" }
    };
  }
}

/**
 * Generates and downloads an Excel report matching the exact Havoc presentation format:
 * - Each distinct booking date gets its own dedicated sheet tab (e.g. "Oct 18", "Oct 20", "Oct 21")
 * - If only one date is selected, that date's sheet is generated.
 * - If multiple dates are present, an additional "All Bookings" summary tab is also included.
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
  const ordersMap = new Map<number, OrderData>();

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

  const allOrders = Array.from(ordersMap.values());

  // Group orders by booking_date
  const dateGroups = new Map<string, OrderData[]>();
  for (const order of allOrders) {
    const dKey = order.date || "UNASSIGNED";
    if (!dateGroups.has(dKey)) {
      dateGroups.set(dKey, []);
    }
    dateGroups.get(dKey)!.push(order);
  }

  // Determine reference year from bookings (e.g. 2026 from created_at)
  let detectedYear = new Date().getFullYear();
  for (const b of bookings) {
    if (b.created_at) {
      const y = new Date(b.created_at).getFullYear();
      if (!isNaN(y) && y >= 2020) {
        detectedYear = y;
        break;
      }
    }
  }

  // Today's start of day timestamp (midnight) to filter out past dates
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // Sort distinct dates chronologically using accurate timestamps
  const allSortedDates = Array.from(dateGroups.keys()).sort((a, b) => {
    const metaA = formatFullDateBanner(a, undefined, detectedYear);
    const metaB = formatFullDateBanner(b, undefined, detectedYear);
    return metaA.sortTimestamp - metaB.sortTimestamp;
  });

  // Filter out dates that are once gone (in the past):
  // Keep present date orders (today) and future date orders.
  // If the user explicitly filtered/selected orders that happen to only be past orders,
  // we fallback to allSortedDates so the export isn't completely empty.
  const upcomingAndPresentDates = allSortedDates.filter(dKey => {
    const parsed = parseBookingDate(dKey, detectedYear);
    if (!parsed) return true; // keep unassigned or custom labels
    const dateMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
    return dateMidnight >= startOfToday;
  });

  const sortedDates = upcomingAndPresentDates.length > 0 ? upcomingAndPresentDates : allSortedDates;

  // Filter allOrders for the "All Bookings" sheet to only include upcoming & present dates
  const activeOrdersSet = new Set(sortedDates);
  const filteredExportOrders = allOrders.filter(order => {
    const dKey = order.date || "UNASSIGNED";
    return activeOrdersSet.has(dKey);
  });

  // Create Excel Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Havoc RC Funzone";
  workbook.created = new Date();

  // 1. "All Bookings" master sheet contains ALL bookings (complete archive)
  const allSheet = workbook.addWorksheet("All Bookings", { views: [{ showGridLines: true }] });
  renderDaySheet(allSheet, "ALL BOOKINGS REPORT", allOrders, slotMetaMap);

  // 2. Day tabs only show present date (today) and future dates (past dates omitted)
  const usedTabNames = new Set<string>(["All Bookings"]);

  for (const dateKey of sortedDates) {
    const { bannerTitle, sheetTabName } = formatFullDateBanner(dateKey, reportTitle, detectedYear);

    // Ensure tab name is unique and valid for Excel (max 31 chars, no invalid chars : \ / ? * [ ])
    let cleanTab = sheetTabName.replace(/[:\\/?*\[\]]/g, "_").slice(0, 31);
    let counter = 1;
    while (usedTabNames.has(cleanTab)) {
      cleanTab = `${sheetTabName.slice(0, 27)} (${counter++})`;
    }
    usedTabNames.add(cleanTab);

    const daySheet = workbook.addWorksheet(cleanTab, { views: [{ showGridLines: true }] });
    const ordersForThisDay = dateGroups.get(dateKey) || [];
    renderDaySheet(daySheet, bannerTitle, ordersForThisDay, slotMetaMap);
  }

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const downloadFileName = sortedDates.length === 1 
    ? `Havoc_Funzone_Report_${sortedDates[0].replace(/\s+/g, "_")}.xlsx`
    : `Havoc_Funzone_Report_Multi_Day.xlsx`;
  anchor.download = downloadFileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
