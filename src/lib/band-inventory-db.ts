import { db, initDB } from "./db";
import { WRISTBAND_PALETTE } from "./slotColors";

export type BandStatus = "available" | "issued" | "damaged" | "lost" | "retired";
export type BandCategory = "Standard" | "VIP" | "Child" | "Staff / Marshal";
export type BandTransactionType = 
  | "STOCK_IN" 
  | "STOCK_OUT" 
  | "ISSUE" 
  | "RETURN" 
  | "DAMAGED" 
  | "LOST" 
  | "STATUS_CHANGE";

export interface BandItem {
  id: number;
  band_code: string;
  color_name: string;
  color_hex: string;
  category: BandCategory;
  status: BandStatus;
  current_holder_name?: string | null;
  current_booking_id?: number | null;
  current_order_number?: string | null;
  total_uses: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BandTransaction {
  id: number;
  band_id: number;
  band_code: string;
  color_name: string;
  color_hex: string;
  transaction_type: BandTransactionType;
  quantity: number;
  customer_name?: string | null;
  booking_id?: number | null;
  order_number?: string | null;
  staff_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface BandColorBreakdown {
  color_name: string;
  color_hex: string;
  total: number;
  available: number;
  issued: number;
  damaged: number;
  lost: number;
  retired: number;
}

export interface BandInventorySummary {
  totalBands: number;
  available: number;
  issued: number;
  damaged: number;
  lost: number;
  retired: number;
  activeInventory: number; // total minus retired
  issuedToday: number;
  returnedToday: number;
  availabilityRate: number; // percentage
  colorBreakdown: BandColorBreakdown[];
  categoryBreakdown: { category: string; total: number; available: number; issued: number }[];
  lowStockColors: { color_name: string; color_hex: string; available: number }[];
}

/**
 * Ensures table existence and auto-seeds initial starter band items if the table is empty.
 */
export function ensureBandInventorySeeded() {
  initDB();

  try {
    const countRow = db.prepare("SELECT COUNT(*) as count FROM band_items").get() as { count: number } | undefined;
    if (countRow && countRow.count === 0) {
      console.log("[Band Inventory] Seeding starter wristband inventory...");
      
      const seedColors = [
        { code: "CYAN", name: "Cyan / Neon Blue", hex: "#06B6D4", count: 10 },
        { code: "GRN",  name: "Emerald Green",    hex: "#10B981", count: 10 },
        { code: "AMB",  name: "Amber Yellow",     hex: "#F59E0B", count: 10 },
        { code: "ORG",  name: "Vibrant Orange",   hex: "#F97316", count: 10 },
        { code: "RED",  name: "Ruby Red",         hex: "#EF4444", count: 10 },
        { code: "PUR",  name: "Electric Purple",  hex: "#8B5CF6", count: 10 },
      ];

      const insertItem = db.prepare(`
        INSERT INTO band_items (band_code, color_name, color_hex, category, status, total_uses, notes)
        VALUES (?, ?, ?, 'Standard', 'available', 0, 'Initial Starter Stock')
      `);

      const insertTx = db.prepare(`
        INSERT INTO band_transactions (band_id, band_code, color_name, color_hex, transaction_type, quantity, staff_name, notes)
        VALUES (?, ?, ?, ?, 'STOCK_IN', 1, 'System Setup', 'Initial Master Stock In')
      `);

      const seedTx = db.transaction(() => {
        for (const item of seedColors) {
          for (let i = 1; i <= item.count; i++) {
            const padNum = String(i).padStart(3, "0");
            const bandCode = `BND-${item.code}-${padNum}`;
            const info = insertItem.run(bandCode, item.name, item.hex);
            insertTx.run(info.lastInsertRowid, bandCode, item.name, item.hex);
          }
        }
      });

      seedTx();
      console.log("[Band Inventory] Seeded 60 starter wristbands successfully.");
    }
  } catch (err) {
    console.error("[Band Inventory] Failed to seed initial bands:", err);
  }
}

/**
 * Calculates real-time stock summary, availability counts, and color breakdowns.
 */
export function getBandInventorySummary(): BandInventorySummary {
  ensureBandInventorySeeded();

  // Basic counts
  const counts = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available,
      SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) AS issued,
      SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END) AS damaged,
      SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost,
      SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END) AS retired
    FROM band_items
  `).get() as any;

  const totalBands = Number(counts?.total || 0);
  const available = Number(counts?.available || 0);
  const issued = Number(counts?.issued || 0);
  const damaged = Number(counts?.damaged || 0);
  const lost = Number(counts?.lost || 0);
  const retired = Number(counts?.retired || 0);
  const activeInventory = Math.max(0, totalBands - retired);
  const availabilityRate = activeInventory > 0 ? Math.round((available / activeInventory) * 100) : 0;

  // Today's movements (using SQLite localdate)
  const todayRow = db.prepare(`
    SELECT
      SUM(CASE WHEN transaction_type = 'ISSUE' THEN 1 ELSE 0 END) AS issued_today,
      SUM(CASE WHEN transaction_type = 'RETURN' THEN 1 ELSE 0 END) AS returned_today
    FROM band_transactions
    WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
  `).get() as any;

  const issuedToday = Number(todayRow?.issued_today || 0);
  const returnedToday = Number(todayRow?.returned_today || 0);

  // Group by color
  const colorRows = db.prepare(`
    SELECT
      color_name,
      color_hex,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) as issued,
      SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END) as damaged,
      SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
      SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END) as retired
    FROM band_items
    GROUP BY color_name, color_hex
    ORDER BY total DESC, color_name ASC
  `).all() as any[];

  const colorBreakdown: BandColorBreakdown[] = colorRows.map(r => ({
    color_name: r.color_name,
    color_hex: r.color_hex,
    total: Number(r.total || 0),
    available: Number(r.available || 0),
    issued: Number(r.issued || 0),
    damaged: Number(r.damaged || 0),
    lost: Number(r.lost || 0),
    retired: Number(r.retired || 0),
  }));

  // Low stock colors (< 3 available)
  const lowStockColors = colorBreakdown
    .filter(c => c.available < 3)
    .map(c => ({
      color_name: c.color_name,
      color_hex: c.color_hex,
      available: c.available,
    }));

  // Group by category
  const categoryRows = db.prepare(`
    SELECT
      category,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) as issued
    FROM band_items
    GROUP BY category
    ORDER BY total DESC
  `).all() as any[];

  const categoryBreakdown = categoryRows.map(r => ({
    category: r.category || "Standard",
    total: Number(r.total || 0),
    available: Number(r.available || 0),
    issued: Number(r.issued || 0),
  }));

  return {
    totalBands,
    available,
    issued,
    damaged,
    lost,
    retired,
    activeInventory,
    issuedToday,
    returnedToday,
    availabilityRate,
    colorBreakdown,
    categoryBreakdown,
    lowStockColors,
  };
}

export interface GetBandItemsOptions {
  search?: string;
  status?: string;
  color_name?: string;
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: "band_code" | "status" | "total_uses" | "created_at" | "updated_at";
  sortOrder?: "ASC" | "DESC";
}

/**
 * Retrieves master band items with filtering and pagination.
 */
export function getBandItems(options: GetBandItemsOptions = {}): { items: BandItem[]; totalCount: number } {
  ensureBandInventorySeeded();

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (options.search && options.search.trim()) {
    const s = `%${options.search.trim()}%`;
    whereClauses.push("(band_code LIKE ? OR current_holder_name LIKE ? OR current_order_number LIKE ? OR notes LIKE ?)");
    params.push(s, s, s, s);
  }

  if (options.status && options.status !== "all") {
    whereClauses.push("status = ?");
    params.push(options.status.trim().toLowerCase());
  }

  if (options.color_name && options.color_name !== "all") {
    whereClauses.push("color_name = ?");
    params.push(options.color_name.trim());
  }

  if (options.category && options.category !== "all") {
    whereClauses.push("category = ?");
    params.push(options.category.trim());
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Get total count
  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM band_items ${whereSql}`).get(...params) as { cnt: number };
  const totalCount = countRow ? countRow.cnt : 0;

  // Sorting
  const allowedSortCols = ["band_code", "status", "total_uses", "created_at", "updated_at"];
  const sortBy = allowedSortCols.includes(options.sortBy || "") ? options.sortBy! : "updated_at";
  const sortOrder = options.sortOrder === "ASC" ? "ASC" : "DESC";

  let querySql = `
    SELECT * FROM band_items 
    ${whereSql} 
    ORDER BY ${sortBy} ${sortOrder}
  `;

  if (options.limit && options.limit > 0) {
    querySql += ` LIMIT ? OFFSET ?`;
    const offset = Math.max(0, options.offset || 0);
    const items = db.prepare(querySql).all(...params, options.limit, offset) as BandItem[];
    return { items, totalCount };
  }

  const items = db.prepare(querySql).all(...params) as BandItem[];
  return { items, totalCount };
}

export function getBandItemById(id: number): BandItem | undefined {
  return db.prepare("SELECT * FROM band_items WHERE id = ?").get(id) as BandItem | undefined;
}

export function getBandItemByCode(code: string): BandItem | undefined {
  if (!code) return undefined;
  return db.prepare("SELECT * FROM band_items WHERE UPPER(band_code) = UPPER(?)").get(code.trim()) as BandItem | undefined;
}

/**
 * Creates a single new band item and records the STOCK_IN audit log.
 */
export function createBandItem(data: {
  band_code: string;
  color_name: string;
  color_hex: string;
  category?: BandCategory;
  notes?: string;
  staff_name?: string;
}): { success: boolean; id?: number; error?: string } {
  try {
    ensureBandInventorySeeded();

    const cleanCode = data.band_code.trim().toUpperCase();
    if (!cleanCode) return { success: false, error: "Unique Band ID / Code is required." };

    const existing = getBandItemByCode(cleanCode);
    if (existing) {
      return { success: false, error: `Band ID '${cleanCode}' already exists in master inventory.` };
    }

    const category = data.category || "Standard";
    const notes = data.notes?.trim() || null;
    const staffName = data.staff_name || "Admin Staff";

    const insertTx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO band_items (band_code, color_name, color_hex, category, status, total_uses, notes)
        VALUES (?, ?, ?, ?, 'available', 0, ?)
      `).run(cleanCode, data.color_name.trim(), data.color_hex.trim(), category, notes);

      const newId = Number(info.lastInsertRowid);

      db.prepare(`
        INSERT INTO band_transactions (band_id, band_code, color_name, color_hex, transaction_type, quantity, staff_name, notes)
        VALUES (?, ?, ?, ?, 'STOCK_IN', 1, ?, ?)
      `).run(newId, cleanCode, data.color_name.trim(), data.color_hex.trim(), staffName, notes || "Manual stock-in");

      return newId;
    });

    const newId = insertTx();
    return { success: true, id: newId };
  } catch (err: any) {
    console.error("[Create Band Error]", err);
    return { success: false, error: err.message || "Failed to create band item." };
  }
}

/**
 * Bulk generate and stock-in multiple wristband items with sequential IDs.
 */
export function bulkCreateBandItems(data: {
  prefix: string;
  startingNumber: number;
  count: number;
  color_name: string;
  color_hex: string;
  category?: BandCategory;
  notes?: string;
  staff_name?: string;
}): { success: boolean; createdCount: number; error?: string } {
  try {
    ensureBandInventorySeeded();

    const prefix = data.prefix.trim().toUpperCase();
    const count = Math.min(Math.max(1, data.count), 200); // capped at 200 per batch
    const startNum = Math.max(1, data.startingNumber || 1);
    const category = data.category || "Standard";
    const staffName = data.staff_name || "Admin Staff";
    const notes = data.notes?.trim() || `Batch Stock-In of ${count} bands`;

    const insertItem = db.prepare(`
      INSERT INTO band_items (band_code, color_name, color_hex, category, status, total_uses, notes)
      VALUES (?, ?, ?, ?, 'available', 0, ?)
    `);

    const insertTx = db.prepare(`
      INSERT INTO band_transactions (band_id, band_code, color_name, color_hex, transaction_type, quantity, staff_name, notes)
      VALUES (?, ?, ?, ?, 'STOCK_IN', 1, ?, ?)
    `);

    let createdCount = 0;

    const runBulk = db.transaction(() => {
      for (let i = 0; i < count; i++) {
        const curNum = startNum + i;
        const padCode = String(curNum).padStart(3, "0");
        const code = prefix.endsWith("-") ? `${prefix}${padCode}` : `${prefix}-${padCode}`;

        // Skip duplicates safely
        const exists = db.prepare("SELECT id FROM band_items WHERE UPPER(band_code) = UPPER(?)").get(code);
        if (exists) continue;

        const info = insertItem.run(code, data.color_name.trim(), data.color_hex.trim(), category, notes);
        insertTx.run(Number(info.lastInsertRowid), code, data.color_name.trim(), data.color_hex.trim(), staffName, notes);
        createdCount++;
      }
    });

    runBulk();

    if (createdCount === 0) {
      return { success: false, createdCount: 0, error: "No new bands created (all codes in range already exist)." };
    }

    return { success: true, createdCount };
  } catch (err: any) {
    console.error("[Bulk Create Bands Error]", err);
    return { success: false, createdCount: 0, error: err.message || "Failed to bulk generate bands." };
  }
}

/**
 * Issues a wristband to a customer or booking.
 */
export function issueBandItem(data: {
  band_id?: number;
  band_code?: string;
  customer_name?: string;
  booking_id?: number;
  order_number?: string;
  staff_name?: string;
  notes?: string;
}): { success: boolean; item?: BandItem; error?: string } {
  try {
    const band = data.band_id 
      ? getBandItemById(data.band_id) 
      : (data.band_code ? getBandItemByCode(data.band_code) : undefined);

    if (!band) {
      return { success: false, error: `Wristband '${data.band_code || data.band_id}' not found in inventory.` };
    }

    if (band.status === "issued") {
      return { 
        success: false, 
        error: `Band '${band.band_code}' is currently issued to ${band.current_holder_name || "another player"}. Please return it first.` 
      };
    }

    if (band.status === "damaged" || band.status === "lost" || band.status === "retired") {
      return { 
        success: false, 
        error: `Band '${band.band_code}' cannot be issued because its status is '${band.status.toUpperCase()}'.` 
      };
    }

    const customerName = data.customer_name?.trim() || "Guest Player";
    const orderNumber = data.order_number?.trim() || (data.booking_id ? `#${data.booking_id}` : null);
    const staffName = data.staff_name || "Admin Staff";
    const notes = data.notes?.trim() || null;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE band_items
        SET status = 'issued',
            current_holder_name = ?,
            current_booking_id = ?,
            current_order_number = ?,
            total_uses = total_uses + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(customerName, data.booking_id || null, orderNumber, band.id);

      db.prepare(`
        INSERT INTO band_transactions (
          band_id, band_code, color_name, color_hex, transaction_type, 
          quantity, customer_name, booking_id, order_number, staff_name, notes
        )
        VALUES (?, ?, ?, ?, 'ISSUE', 1, ?, ?, ?, ?, ?)
      `).run(
        band.id, 
        band.band_code, 
        band.color_name, 
        band.color_hex, 
        customerName, 
        data.booking_id || null, 
        orderNumber, 
        staffName, 
        notes || "Issued at Reception / Track Desk"
      );
    });

    tx();
    const updated = getBandItemById(band.id);
    return { success: true, item: updated };
  } catch (err: any) {
    console.error("[Issue Band Error]", err);
    return { success: false, error: err.message || "Failed to issue wristband." };
  }
}

/**
 * Returns a wristband back to stock and checks condition.
 */
export function returnBandItem(data: {
  band_id?: number;
  band_code?: string;
  condition: "good" | "damaged" | "lost";
  staff_name?: string;
  notes?: string;
}): { success: boolean; item?: BandItem; error?: string } {
  try {
    const band = data.band_id 
      ? getBandItemById(data.band_id) 
      : (data.band_code ? getBandItemByCode(data.band_code) : undefined);

    if (!band) {
      return { success: false, error: `Wristband '${data.band_code || data.band_id}' not found.` };
    }

    const prevHolder = band.current_holder_name;
    const prevOrder = band.current_order_number;
    const prevBookingId = band.current_booking_id;
    const staffName = data.staff_name || "Admin Staff";
    const notes = data.notes?.trim() || null;

    let newStatus: BandStatus = "available";
    let txType: BandTransactionType = "RETURN";

    if (data.condition === "damaged") {
      newStatus = "damaged";
      txType = "DAMAGED";
    } else if (data.condition === "lost") {
      newStatus = "lost";
      txType = "LOST";
    }

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE band_items
        SET status = ?,
            current_holder_name = NULL,
            current_booking_id = NULL,
            current_order_number = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, band.id);

      db.prepare(`
        INSERT INTO band_transactions (
          band_id, band_code, color_name, color_hex, transaction_type, 
          quantity, customer_name, booking_id, order_number, staff_name, notes
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `).run(
        band.id, 
        band.band_code, 
        band.color_name, 
        band.color_hex, 
        txType, 
        prevHolder || null, 
        prevBookingId || null, 
        prevOrder || null, 
        staffName, 
        notes || `Returned condition: ${data.condition.toUpperCase()}`
      );
    });

    tx();
    const updated = getBandItemById(band.id);
    return { success: true, item: updated };
  } catch (err: any) {
    console.error("[Return Band Error]", err);
    return { success: false, error: err.message || "Failed to return wristband." };
  }
}

/**
 * Retires / write-off band from inventory (STOCK_OUT).
 */
export function stockOutBandItem(data: {
  band_id: number;
  reason?: string;
  staff_name?: string;
}): { success: boolean; error?: string } {
  try {
    const band = getBandItemById(data.band_id);
    if (!band) return { success: false, error: "Band item not found." };

    const reason = data.reason?.trim() || "Item retired / discarded";
    const staffName = data.staff_name || "Admin Staff";

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE band_items 
        SET status = 'retired',
            current_holder_name = NULL,
            current_booking_id = NULL,
            current_order_number = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(band.id);

      db.prepare(`
        INSERT INTO band_transactions (
          band_id, band_code, color_name, color_hex, transaction_type, 
          quantity, staff_name, notes
        )
        VALUES (?, ?, ?, ?, 'STOCK_OUT', 1, ?, ?)
      `).run(band.id, band.band_code, band.color_name, band.color_hex, staffName, reason);
    });

    tx();
    return { success: true };
  } catch (err: any) {
    console.error("[Stock Out Band Error]", err);
    return { success: false, error: err.message || "Failed to retire band." };
  }
}

/**
 * Marks a damaged or lost band as repaired / recovered back to 'available'.
 */
export function restoreBandItem(data: {
  band_id: number;
  staff_name?: string;
  notes?: string;
}): { success: boolean; error?: string } {
  try {
    const band = getBandItemById(data.band_id);
    if (!band) return { success: false, error: "Band item not found." };

    const staffName = data.staff_name || "Admin Staff";
    const notes = data.notes?.trim() || "Restored back to available stock";

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE band_items 
        SET status = 'available',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(band.id);

      db.prepare(`
        INSERT INTO band_transactions (
          band_id, band_code, color_name, color_hex, transaction_type, 
          quantity, staff_name, notes
        )
        VALUES (?, ?, ?, ?, 'STATUS_CHANGE', 1, ?, ?)
      `).run(band.id, band.band_code, band.color_name, band.color_hex, staffName, notes);
    });

    tx();
    return { success: true };
  } catch (err: any) {
    console.error("[Restore Band Error]", err);
    return { success: false, error: err.message || "Failed to restore band." };
  }
}

export function updateBandItem(id: number, data: {
  band_code: string;
  color_name: string;
  color_hex: string;
  category?: BandCategory;
  status?: BandStatus;
  notes?: string;
}): { success: boolean; error?: string } {
  try {
    const cleanCode = data.band_code.trim().toUpperCase();
    if (!cleanCode) return { success: false, error: "Band code is required." };

    // Check collision
    const existing = db.prepare("SELECT id FROM band_items WHERE UPPER(band_code) = UPPER(?) AND id != ?").get(cleanCode, id);
    if (existing) {
      return { success: false, error: `Band code '${cleanCode}' is already used by another item.` };
    }

    db.prepare(`
      UPDATE band_items
      SET band_code = ?,
          color_name = ?,
          color_hex = ?,
          category = COALESCE(?, category),
          status = COALESCE(?, status),
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      cleanCode, 
      data.color_name.trim(), 
      data.color_hex.trim(), 
      data.category || null, 
      data.status || null, 
      data.notes?.trim() || null, 
      id
    );

    return { success: true };
  } catch (err: any) {
    console.error("[Update Band Error]", err);
    return { success: false, error: err.message || "Failed to update band." };
  }
}

export function deleteBandItem(id: number): { success: boolean; error?: string } {
  try {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM band_transactions WHERE band_id = ?").run(id);
      db.prepare("DELETE FROM band_items WHERE id = ?").run(id);
    });
    tx();
    return { success: true };
  } catch (err: any) {
    console.error("[Delete Band Error]", err);
    return { success: false, error: err.message || "Failed to delete band." };
  }
}

export interface GetBandTransactionsOptions {
  band_id?: number;
  band_code?: string;
  type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Retrieves audit log of all band movements (Stock in, Issue, Return, Damaged, Lost).
 */
export function getBandTransactions(options: GetBandTransactionsOptions = {}): { transactions: BandTransaction[]; totalCount: number } {
  ensureBandInventorySeeded();

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (options.band_id) {
    whereClauses.push("band_id = ?");
    params.push(options.band_id);
  }

  if (options.band_code && options.band_code.trim()) {
    whereClauses.push("UPPER(band_code) = UPPER(?)");
    params.push(options.band_code.trim());
  }

  if (options.type && options.type !== "all") {
    whereClauses.push("transaction_type = ?");
    params.push(options.type.trim().toUpperCase());
  }

  if (options.search && options.search.trim()) {
    const s = `%${options.search.trim()}%`;
    whereClauses.push("(band_code LIKE ? OR customer_name LIKE ? OR order_number LIKE ? OR staff_name LIKE ? OR notes LIKE ?)");
    params.push(s, s, s, s, s);
  }

  if (options.startDate) {
    whereClauses.push("DATE(created_at, 'localtime') >= DATE(?)");
    params.push(options.startDate);
  }

  if (options.endDate) {
    whereClauses.push("DATE(created_at, 'localtime') <= DATE(?)");
    params.push(options.endDate);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM band_transactions ${whereSql}`).get(...params) as { cnt: number };
  const totalCount = countRow ? countRow.cnt : 0;

  let querySql = `
    SELECT * FROM band_transactions 
    ${whereSql} 
    ORDER BY created_at DESC, id DESC
  `;

  if (options.limit && options.limit > 0) {
    querySql += ` LIMIT ? OFFSET ?`;
    const offset = Math.max(0, options.offset || 0);
    const transactions = db.prepare(querySql).all(...params, options.limit, offset) as BandTransaction[];
    return { transactions, totalCount };
  }

  const transactions = db.prepare(querySql).all(...params) as BandTransaction[];
  return { transactions, totalCount };
}
