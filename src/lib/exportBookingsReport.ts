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
  payment_ref?: string;
  transaction_id?: string;
  simulator_name?: string;
  simulator_slot?: string;
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
  payment_ref?: string;
  transaction_id?: string;
  simulator_name?: string;
  simulator_slot?: string;
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

  // Configure Print Page Setup: Landscape mode & Fit to page so all columns print without cutting off
  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: ordersForDay.length <= 35 ? 1 : 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2
    },
    horizontalCentered: true,
    showGridLines: true
  };

  // Configure Column Widths (A to O -> 15 columns matching client's screenshot)
  worksheet.columns = [
    { key: "totalSl", width: 9 },         // A: TOTAL SL
    { key: "sn", width: 6 },              // B: SN
    { key: "orderNo", width: 18 },        // C: ORDER NO (Pink header)
    { key: "name", width: 22 },           // D: NAME (Pink header)
    { key: "phone", width: 15 },          // E: PHONE NO
    { key: "email", width: 26 },          // F: E-MAIL ID
    { key: "date", width: 13 },           // G: DATE
    { key: "timeSlot", width: 14 },       // H: TIME/SLOT
    { key: "simPodium", width: 20 },      // I: TYPE OF SIM PODIUM
    { key: "ppt", width: 8 },             // J: PPT (Total Participants / Passes)
    { key: "amtReceived", width: 16 },    // K: AMOUNT RECEIVED
    { key: "amtDue", width: 15 },         // L: AMOUNT DUE
    { key: "status", width: 13 },         // M: STATUS
    { key: "gatewayTxnId", width: 20 },   // N: GATEWAY TXN ID
    { key: "deskRef", width: 18 }         // O: DESK REF / UTR
  ];

  // Helper to render the single-row table header with exact client colors
  // Cols A & B: Dark green (#1E5E3A), white bold text
  // Cols C & D: Dusty rose / pink (#DDA7A5), black bold text
  // Cols E to O: Dark green (#1E5E3A), white bold text
  const renderTableHeader = (ws: ExcelJS.Worksheet) => {
    const headerRow = ws.addRow([
      "TOTAL SL",
      "SN",
      "ORDER NO",
      "NAME",
      "PHONE NO",
      "E-MAIL ID",
      "DATE",
      "TIME/SLOT",
      "TYPE OF SIM PODIUM",
      "PPT",
      "AMOUNT RECEIVED",
      "AMOUNT DUE",
      "STATUS",
      "GATEWAY TXN ID",
      "DESK REF / UTR"
    ]);
    headerRow.height = 26;
    const rNum = headerRow.number;

    for (let c = 1; c <= 15; c++) {
      const cell = headerRow.getCell(c);
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

      if (c === 3 || c === 4) {
        // Columns C & D: ORDER NO and NAME (Pink background, black text)
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF000000" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDDA7A5" } // Dusty rose pink
        };
      } else {
        // Columns A, B, and E through O: Dark Forest Green background, white text
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E5E3A" } // Dark green
        };
      }
    }
  };

  // Group orders by Date first, then within each Date group by Time Slot
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

  // Format Top Banner (Row 1): Light sage green (#D5E8D4), spanning A1:O1, right-aligned banner text
  // Must mention "Havoc Rc Fun Zone - All Booking" on every page
  let row1BannerText = "Havoc Rc Fun Zone - All Booking";
  const parsedFirstDate = sortedDates.length === 1 ? parseBookingDate(sortedDates[0]) : null;
  if (parsedFirstDate && !isNaN(parsedFirstDate.getTime())) {
    const monthShort = parsedFirstDate.toLocaleDateString("en-US", { month: "short" });
    const dayNum = parsedFirstDate.getDate();
    const weekdayShort = parsedFirstDate.toLocaleDateString("en-US", { weekday: "short" });
    row1BannerText = `Havoc Rc Fun Zone - All Booking (${monthShort} ${dayNum}, ${weekdayShort})`;
  }

  const titleRow = worksheet.addRow([row1BannerText]);
  titleRow.height = 28;
  worksheet.mergeCells("A1:O1");
  const titleCell = worksheet.getCell("A1");
  titleCell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FF000000" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  for (let col = 1; col <= 15; col++) {
    const cCell = worksheet.getRow(1).getCell(col);
    cCell.border = thinBorder;
    cCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD5E8D4" } // Sage green banner
    };
  }

  // If there's only 1 date (e.g. single day tab like "Oct 31 (Sat)"), render the table header right below title
  if (sortedDates.length === 1) {
    renderTableHeader(worksheet);
  }

  let totalSlCounter = 1;
  let grandTotalTickets = 0;
  let grandTotalAmountReceived = 0;
  let grandTotalAmountDue = 0;

  let isFirstSection = true;

  // Populate Data Rows: Date by Date, and within each Date Slot by Slot
  sortedDates.forEach((dateKey, dateIdx) => {
    const slotGroups = dateToSlotsMap.get(dateKey)!;

    // Track per-day totals
    let dayTickets = 0;
    let dayAmountReceived = 0;
    let dayAmountDue = 0;

    // Sort slots chronologically within this date
    const sortedSlotKeys = Array.from(slotGroups.keys()).sort((a, b) => {
      return getSlotStartMinutes(a) - getSlotStartMinutes(b);
    });

    // If multiple dates are present (like in "All Bookings"), add a clear Date Section Divider Header
    if (sortedDates.length > 1) {
      if (!isFirstSection) {
        const dateGapRow = worksheet.addRow([]);
        dateGapRow.height = 16;
      }

      const { bannerTitle: dateBanner } = formatFullDateBanner(dateKey);
      const sectionRow = worksheet.addRow([`DATE: ${dateBanner}`]);
      sectionRow.height = 24;
      const sectionRowNum = sectionRow.number;
      worksheet.mergeCells(`A${sectionRowNum}:O${sectionRowNum}`);
      
      const sCell = worksheet.getCell(`A${sectionRowNum}`);
      sCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0D1B2A" } };
      sCell.alignment = { horizontal: "center", vertical: "middle" };
      sCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE9ECEF" }
      };
      for (let c = 1; c <= 15; c++) {
        const cCell = worksheet.getRow(sectionRowNum).getCell(c);
        cCell.border = thinBorder;
        cCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE9ECEF" }
        };
      }

      // Render the Table Header for this specific date
      renderTableHeader(worksheet);
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

      ordersInSlot.forEach((order, snIdx) => {
        const sn = snIdx + 1;
        const currentSl = totalSlCounter++;

        // Count total tickets / participants
        let orderTickets = 0;
        let calculatedBaseAmount = 0;

        for (const item of order.items) {
          const qty = item.quantity || 1;
          orderTickets += qty;
          calculatedBaseAmount += (item.ticket_price || 0) * qty;
        }

        // Accumulate Day & Grand Totals
        dayTickets += orderTickets;
        grandTotalTickets += orderTickets;

        const isPaid = order.payment_status.toLowerCase() === "paid";
        const totalAmt = order.total_amount > 0 ? order.total_amount : Math.round(calculatedBaseAmount * 1.18);
        const received = isPaid ? totalAmt : 0;
        const due = isPaid ? 0 : totalAmt;

        dayAmountReceived += received;
        dayAmountDue += due;

        grandTotalAmountReceived += received;
        grandTotalAmountDue += due;

        const simPodiumDisplay = order.simulator_name 
          ? (order.simulator_slot ? `${order.simulator_name} (${order.simulator_slot})` : order.simulator_name)
          : "-";

        const dataRow = worksheet.addRow([
          currentSl,
          sn,
          order.orderCode,
          order.name,
          order.phone,
          order.email,
          order.date,
          order.timeSlot,
          simPodiumDisplay,
          orderTickets,
          received > 0 ? `₹ ${received.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
          due > 0 ? `₹ ${due.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
          order.fulfillment_status,
          order.transaction_id || "-",
          order.payment_ref || "-"
        ]);
        dataRow.height = 20;

        // Apply solid borders and alignment
        for (let c = 1; c <= 15; c++) {
          const cell = dataRow.getCell(c);
          cell.border = thinBorder;
          cell.font = { name: "Calibri", size: 10 };

          if (c === 3 || c === 4 || c === 6 || c === 9 || c === 14 || c === 15) {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          } else if (c === 11 || c === 12) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          }
        }
      });
    });

    // If multiple dates are present (like in "All Bookings"), output the TOTAL for this specific day right here
    if (sortedDates.length > 1) {
      // Blank separator before Day Totals
      const preDayTotalGap = worksheet.addRow([]);
      preDayTotalGap.height = 8;

      const dayTotalRow = worksheet.addRow([
        "", "", "", "", "", "", "", "",
        "DAY TOTAL",
        dayTickets,
        dayAmountReceived > 0 ? `₹ ${dayAmountReceived.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
        dayAmountDue > 0 ? `₹ ${dayAmountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
        "", "", ""
      ]);
      dayTotalRow.height = 24;

      for (let c = 1; c <= 15; c++) {
        const cell = dayTotalRow.getCell(c);
        if (c >= 9 && c <= 12) {
          cell.border = thinBorder;
          cell.font = { name: "Calibri", size: 10, bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0F0F0" }
          };
          if (c === 11 || c === 12) {
            cell.alignment = { horizontal: "right", vertical: "middle" };
          } else {
            cell.alignment = { horizontal: "center", vertical: "middle" };
          }
        }
      }
    }
  });

  // Blank separator before Sheet Totals
  const preTotalGap = worksheet.addRow([]);
  preTotalGap.height = 12;

  // ROW: Sheet Totals (TOTAL / GRAND TOTAL row)
  const totalRowLabel = sortedDates.length > 1 ? "GRAND TOTAL" : "TOTAL";

  const totalRow = worksheet.addRow([
    "", "", "", "", "", "", "", "",
    totalRowLabel,
    grandTotalTickets,
    grandTotalAmountReceived > 0 ? `₹ ${grandTotalAmountReceived.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
    grandTotalAmountDue > 0 ? `₹ ${grandTotalAmountDue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "₹ 0.00",
    "", "", ""
  ]);
  totalRow.height = 24;

  for (let c = 1; c <= 15; c++) {
    const cell = totalRow.getCell(c);
    if (c >= 9 && c <= 12) {
      cell.border = doubleBottomBorder;
      cell.font = { name: "Calibri", size: 11, bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" }
      };
      if (c === 11 || c === 12) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
    }
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
        payment_ref: b.payment_ref || "",
        transaction_id: b.transaction_id || "",
        simulator_name: b.simulator_name || "",
        simulator_slot: b.simulator_slot || "",
        items: []
      });
    } else {
      const existing = ordersMap.get(orderNum)!;
      if (b.payment_ref && !existing.payment_ref) {
        existing.payment_ref = b.payment_ref;
      }
      if (b.transaction_id && !existing.transaction_id) {
        existing.transaction_id = b.transaction_id;
      }
      if (b.simulator_name && !existing.simulator_name) {
        existing.simulator_name = b.simulator_name;
        existing.simulator_slot = b.simulator_slot;
      }
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

  // Reference timestamps for today and previous day (yesterday)
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).getTime();

  // Sort distinct dates chronologically using accurate timestamps
  const allSortedDates = Array.from(dateGroups.keys()).sort((a, b) => {
    const metaA = formatFullDateBanner(a, undefined, detectedYear);
    const metaB = formatFullDateBanner(b, undefined, detectedYear);
    return metaA.sortTimestamp - metaB.sortTimestamp;
  });

  // Separate dates into past dates and present/future dates
  const pastDates: string[] = [];
  const presentAndFutureDates: string[] = [];

  for (const dKey of allSortedDates) {
    const parsed = parseBookingDate(dKey, detectedYear);
    if (!parsed) {
      // Keep unassigned or custom labels in present/future
      presentAndFutureDates.push(dKey);
      continue;
    }
    const dateMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
    if (dateMidnight < startOfToday) {
      pastDates.push(dKey);
    } else {
      presentAndFutureDates.push(dKey);
    }
  }

  // Include 2 consecutive past dates (e.g. T-2 and T-1, or the 2 most recent past dates with bookings)
  const startOfTwoDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2).getTime();
  const calendarTwoPastDates = pastDates.filter(dKey => {
    const parsed = parseBookingDate(dKey, detectedYear);
    if (!parsed) return false;
    const dateMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
    return dateMidnight >= startOfTwoDaysAgo && dateMidnight < startOfToday;
  });

  const selectedPastDates = calendarTwoPastDates.length >= 2
    ? calendarTwoPastDates
    : (pastDates.length >= 2 ? pastDates.slice(-2) : (calendarTwoPastDates.length > 0 ? calendarTwoPastDates : pastDates));

  // Ordered day tabs: 2 Consecutive Past Days -> Present Day (Today) -> Future Dates
  const targetDayDates = [...selectedPastDates, ...presentAndFutureDates];

  // If the user explicitly filtered for historical dates (all in past with no recent past/today/future),
  // fallback to allSortedDates so historical exports are preserved.
  const isHistoricalOnly = presentAndFutureDates.length === 0 && selectedPastDates.length === 0;
  const sortedDates = isHistoricalOnly ? allSortedDates : (targetDayDates.length > 0 ? targetDayDates : allSortedDates);

  // Create Excel Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Havoc RC Funzone";
  workbook.created = new Date();

  // 1. "All Bookings" master sheet contains ALL bookings (complete archive)
  const allSheet = workbook.addWorksheet("All Bookings", { 
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });
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

    const ordersForThisDay = dateGroups.get(dateKey) || [];
    const daySheet = workbook.addWorksheet(cleanTab, { 
      views: [{ showGridLines: true }],
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: ordersForThisDay.length <= 35 ? 1 : 0
      }
    });
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
