import { db, initDB } from "./db";
import { simulatorPool } from "./simulator-db";
import { WRISTBAND_PALETTE, getSlotWristbandColor, resolveColorNameToHex } from "./slotColors";
import { getDistinctSlotColors, ensureColorInventorySchema } from "./color-inventory-db";

export type BandStatus = "available" | "issued" | "damaged" | "lost" | "retired";
export type BandCategory = "Standard" | "VIP" | "Child" | "Staff / Marshal";
export type BandLocation = "warehouse" | "reception";

export type BandTransactionType = 
  | "STOCK_IN" 
  | "STOCK_OUT" 
  | "HANDOVER"
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
  location?: BandLocation;
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
  in_reception?: number;
  color_inventory_id?: number;
}

export interface BandInventorySummary {
  totalBands: number;
  available: number;
  issued: number;
  damaged: number;
  lost: number;
  retired: number;
  activeInventory: number;
  issuedToday: number;
  returnedToday: number;
  availabilityRate: number;
  colorBreakdown: BandColorBreakdown[];
  categoryBreakdown: { category: string; total: number; available: number; issued: number }[];
  lowStockColors: { color_name: string; color_hex: string; available: number }[];
}

function isPostgresActive(): boolean {
  const url = process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL;
  return Boolean(url && simulatorPool);
}

let pgSchemaInitialized = false;
async function ensurePgSchema() {
  if (pgSchemaInitialized || !isPostgresActive()) return;
  try {
    await simulatorPool.query(`
      CREATE TABLE IF NOT EXISTS band_items (
        id SERIAL PRIMARY KEY,
        band_code VARCHAR(100) NOT NULL UNIQUE,
        color_name VARCHAR(100) NOT NULL,
        color_hex VARCHAR(50) NOT NULL,
        category VARCHAR(50) DEFAULT 'Standard',
        status VARCHAR(50) DEFAULT 'available',
        current_holder_name VARCHAR(255),
        current_booking_id INTEGER,
        current_order_number VARCHAR(100),
        total_uses INTEGER DEFAULT 0,
        notes TEXT,
        location VARCHAR(50) DEFAULT 'warehouse',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE band_items ADD COLUMN IF NOT EXISTS location VARCHAR(50) DEFAULT 'warehouse';
      CREATE INDEX IF NOT EXISTS idx_band_items_code ON band_items(band_code);
      CREATE INDEX IF NOT EXISTS idx_band_items_status ON band_items(status);
      CREATE INDEX IF NOT EXISTS idx_band_items_color ON band_items(color_name);
      CREATE INDEX IF NOT EXISTS idx_band_items_location ON band_items(location);

      CREATE TABLE IF NOT EXISTS band_transactions (
        id SERIAL PRIMARY KEY,
        band_id INTEGER NOT NULL REFERENCES band_items(id) ON DELETE CASCADE,
        band_code VARCHAR(100) NOT NULL,
        color_name VARCHAR(100) NOT NULL,
        color_hex VARCHAR(50) NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        quantity INTEGER DEFAULT 1,
        customer_name VARCHAR(255),
        booking_id INTEGER,
        order_number VARCHAR(100),
        staff_name VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_band_tx_band_id ON band_transactions(band_id);
      CREATE INDEX IF NOT EXISTS idx_band_tx_type ON band_transactions(transaction_type);
      CREATE TABLE IF NOT EXISTS time_slots (
        id SERIAL PRIMARY KEY,
        label VARCHAR(100) NOT NULL UNIQUE,
        start_hour NUMERIC,
        end_hour NUMERIC,
        active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        color VARCHAR(50),
        color_name VARCHAR(100),
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    pgSchemaInitialized = true;

    // Safely sync active time_slots into PostgreSQL so both Havoc RC Fun Zone and Havoc Sim Podium see them
    try {
      initDB();
      const localSlots = db.prepare("SELECT label, start_hour, end_hour, active, sort_order, color, color_name, remark FROM time_slots WHERE active = 1").all() as any[];
      for (const slot of localSlots) {
        await simulatorPool.query(`
          INSERT INTO time_slots (label, start_hour, end_hour, active, sort_order, color, color_name, remark)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (label) DO UPDATE 
          SET color = COALESCE(time_slots.color, EXCLUDED.color),
              color_name = COALESCE(time_slots.color_name, EXCLUDED.color_name),
              sort_order = EXCLUDED.sort_order,
              active = EXCLUDED.active
        `, [slot.label, slot.start_hour, slot.end_hour, slot.active ?? 1, slot.sort_order ?? 0, slot.color, slot.color_name, slot.remark]);
      }
    } catch (slotSyncErr) {
      console.warn("[Band Inventory] Could not sync time_slots to Postgres:", slotSyncErr);
    }

    // Note: Automatic sync of starter band_items is permanently disabled.
  } catch (err) {
    console.warn("[Band Inventory] Could not auto-initialize Postgres schema:", err);
  }
}

export const TARGET_SLOT_BAND_COLORS: { code: string; name: string; hex: string; count: number }[] = [];

export async function ensureBandInventorySeeded(force: boolean = false) {
  initDB();

  // Check persistent seeded flag in SQLite unless force is true
  try {
    const flagRow = db.prepare("SELECT value FROM site_settings WHERE key = 'band_inventory_seeded'").get() as { value: string } | undefined;
    if (flagRow?.value === '1' && !force) {
      // Already initialized previously; do not create or re-seed phantom colors!
      return;
    }
  } catch (ignore) {}

  // If items already exist, do NOT insert any synthetic colors
  let hasExistingBands = false;
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM band_items").get() as { count: number } | undefined;
    if (Number(row?.count || 0) > 0) {
      hasExistingBands = true;
    }
  } catch (e) {}

  if (hasExistingBands && !force) {
    try {
      db.prepare(`
        INSERT INTO site_settings (key, value, description)
        VALUES ('band_inventory_seeded', '1', 'Flag indicating band inventory seed completed')
        ON CONFLICT(key) DO UPDATE SET value = '1'
      `).run();
    } catch (ignore) {}
    return;
  }

  // Set persistent seeded flag in SQLite so it never re-seeds on future deployments
  try {
    db.prepare(`
      INSERT INTO site_settings (key, value, description)
      VALUES ('band_inventory_seeded', '1', 'Flag indicating band inventory seed completed')
      ON CONFLICT(key) DO UPDATE SET value = '1'
    `).run();
  } catch (err) {
    console.error("[Band Inventory SQLite] Failed to set seed flag:", err);
  }
}

export async function getBandInventorySummary(): Promise<BandInventorySummary> {
  await ensureBandInventorySeeded();

  if (isPostgresActive()) {
    try {
      await ensurePgSchema();
      const countsRes = await simulatorPool.query(`
        SELECT
          COUNT(*)::int AS total,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END)::int AS available,
          SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END)::int AS issued,
          SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END)::int AS damaged,
          SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END)::int AS lost,
          SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END)::int AS retired
        FROM band_items
      `);
      const counts = countsRes.rows[0] || {};
      const totalBands = Number(counts.total || 0);
      const available = Number(counts.available || 0);
      const issued = Number(counts.issued || 0);
      const damaged = Number(counts.damaged || 0);
      const lost = Number(counts.lost || 0);
      const retired = Number(counts.retired || 0);
      const activeInventory = Math.max(0, totalBands - retired);
      const availabilityRate = activeInventory > 0 ? Math.round((available / activeInventory) * 100) : 0;

      const todayRes = await simulatorPool.query(`
        SELECT
          SUM(CASE WHEN transaction_type = 'ISSUE' THEN 1 ELSE 0 END)::int AS issued_today,
          SUM(CASE WHEN transaction_type = 'RETURN' THEN 1 ELSE 0 END)::int AS returned_today
        FROM band_transactions
        WHERE created_at::date = CURRENT_DATE
      `);
      const todayRow = todayRes.rows[0] || {};
      const issuedToday = Number(todayRow.issued_today || 0);
      const returnedToday = Number(todayRow.returned_today || 0);

      const colorRowsRes = await simulatorPool.query(`
        SELECT
          color_name,
          color_hex,
          COUNT(*)::int as total,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END)::int as available,
          SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END)::int as issued,
          SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END)::int as damaged,
          SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END)::int as lost,
          SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END)::int as retired
        FROM band_items
        GROUP BY color_name, color_hex
        ORDER BY total DESC, color_name ASC
      `);

      const colorBreakdownMap = new Map<string, BandColorBreakdown>();

      // 1. Merge actual Postgres inventory counts (matching by HEX first, then by name)
      for (const r of colorRowsRes.rows) {
        const hex = (r.color_hex || "").trim().toUpperCase();
        const name = (r.color_name || "").trim();
        const existing = colorBreakdownMap.get(hex) || (name ? colorBreakdownMap.get(name.toLowerCase()) : undefined);

        if (existing) {
          if (name && (!existing.color_name || existing.color_name === existing.color_hex)) {
            existing.color_name = name;
          }
          existing.color_hex = hex || existing.color_hex;
          existing.total = Number(r.total || 0);
          existing.available = Number(r.available || 0);
          existing.issued = Number(r.issued || 0);
          existing.damaged = Number(r.damaged || 0);
          existing.lost = Number(r.lost || 0);
          existing.retired = Number(r.retired || 0);
        } else {
          colorBreakdownMap.set(hex || name.toLowerCase(), {
            color_name: name || hex,
            color_hex: hex,
            total: Number(r.total || 0),
            available: Number(r.available || 0),
            issued: Number(r.issued || 0),
            damaged: Number(r.damaged || 0),
            lost: Number(r.lost || 0),
            retired: Number(r.retired || 0),
          });
        }
      }

      // 2. Also incorporate any configured slot colors from wristband_color_inventory with their stock & reception values
      try {
        const slotInvRes = await simulatorPool.query("SELECT id, color_hex, color_name, quantity, in_reception FROM wristband_color_inventory");
        for (const sir of slotInvRes.rows) {
          const hex = (sir.color_hex || "").trim().toUpperCase();
          const name = (sir.color_name || "").trim();
          const invId = sir.id;
          const poolQty = Number(sir.quantity || 0);
          const inRec = Number(sir.in_reception || 0);

          const existing = colorBreakdownMap.get(hex) || (name ? colorBreakdownMap.get(name.toLowerCase()) : undefined);
          if (existing) {
            existing.color_inventory_id = invId;
            existing.in_reception = inRec;
            // If individual band items haven't been generated yet, reflect the color pool's stock
            if (existing.total === 0 && (poolQty > 0 || inRec > 0)) {
              existing.total = poolQty + inRec;
              existing.available = poolQty;
            } else if (existing.total > 0 && inRec > 0) {
              // Individual items exist. If in_reception was recorded, warehouse available is remaining after reception
              existing.available = Math.max(0, existing.available - inRec);
            }
          } else {
            colorBreakdownMap.set(hex || name.toLowerCase(), {
              color_inventory_id: invId,
              color_name: name || hex,
              color_hex: hex,
              total: poolQty + inRec,
              available: poolQty,
              issued: 0,
              damaged: 0,
              lost: 0,
              retired: 0,
              in_reception: inRec,
            });
          }
        }
      } catch (ignoreInv) {}

      const colorBreakdown: BandColorBreakdown[] = Array.from(colorBreakdownMap.values()).sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.color_name.localeCompare(b.color_name);
      });

      const lowStockColors = colorBreakdown
        .filter(c => c.total > 0 && c.available < 3)
        .map(c => ({
          color_name: c.color_name,
          color_hex: c.color_hex,
          available: c.available,
        }));

      const catRes = await simulatorPool.query(`
        SELECT
          category,
          COUNT(*)::int as total,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END)::int as available,
          SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END)::int as issued
        FROM band_items
        GROUP BY category
        ORDER BY total DESC
      `);

      const categoryBreakdown = catRes.rows.map(r => ({
        category: r.category || 'Standard',
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
    } catch (pgErr) {
      console.warn("[Band Inventory] Fallback to SQLite for summary:", pgErr);
    }
  }

  // SQLite fallback
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

  const todayRow = db.prepare(`
    SELECT
      SUM(CASE WHEN transaction_type = 'ISSUE' THEN 1 ELSE 0 END) AS issued_today,
      SUM(CASE WHEN transaction_type = 'RETURN' THEN 1 ELSE 0 END) AS returned_today
    FROM band_transactions
    WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
  `).get() as any;

  const issuedToday = Number(todayRow?.issued_today || 0);
  const returnedToday = Number(todayRow?.returned_today || 0);

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

  const colorBreakdownMap = new Map<string, BandColorBreakdown>();

  // 1. Merge actual SQLite inventory counts (matching by HEX first, then by name)
  for (const r of colorRows) {
    const hex = (r.color_hex || "").trim().toUpperCase();
    const name = (r.color_name || "").trim();
    const existing = colorBreakdownMap.get(hex) || (name ? colorBreakdownMap.get(name.toLowerCase()) : undefined);

    if (existing) {
      if (name && (!existing.color_name || existing.color_name === existing.color_hex)) {
        existing.color_name = name;
      }
      existing.color_hex = hex || existing.color_hex;
      existing.total = Number(r.total || 0);
      existing.available = Number(r.available || 0);
      existing.issued = Number(r.issued || 0);
      existing.damaged = Number(r.damaged || 0);
      existing.lost = Number(r.lost || 0);
      existing.retired = Number(r.retired || 0);
    } else {
      colorBreakdownMap.set(hex || name.toLowerCase(), {
        color_name: name || hex,
        color_hex: hex,
        total: Number(r.total || 0),
        available: Number(r.available || 0),
        issued: Number(r.issued || 0),
        damaged: Number(r.damaged || 0),
        lost: Number(r.lost || 0),
        retired: Number(r.retired || 0),
      });
    }
  }

  // 2. Also incorporate any configured slot colors from wristband_color_inventory with their stock & reception values
  try {
    const slotInvRows = db.prepare("SELECT id, color_hex, color_name, quantity, in_reception FROM wristband_color_inventory").all() as any[];
    for (const sir of slotInvRows) {
      const hex = (sir.color_hex || "").trim().toUpperCase();
      const name = (sir.color_name || "").trim();
      const invId = sir.id;
      const poolQty = Number(sir.quantity || 0);
      const inRec = Number(sir.in_reception || 0);

      const existing = colorBreakdownMap.get(hex) || (name ? colorBreakdownMap.get(name.toLowerCase()) : undefined);
      if (existing) {
        existing.color_inventory_id = invId;
        existing.in_reception = inRec;
        // If individual band items haven't been generated yet, reflect the color pool's stock
        if (existing.total === 0 && (poolQty > 0 || inRec > 0)) {
          existing.total = poolQty + inRec;
          existing.available = poolQty;
        } else if (existing.total > 0 && inRec > 0) {
          // Individual items exist. If in_reception was recorded, warehouse available is remaining after reception
          existing.available = Math.max(0, existing.available - inRec);
        }
      } else {
        colorBreakdownMap.set(hex || name.toLowerCase(), {
          color_inventory_id: invId,
          color_name: name || hex,
          color_hex: hex,
          total: poolQty + inRec,
          available: poolQty,
          issued: 0,
          damaged: 0,
          lost: 0,
          retired: 0,
          in_reception: inRec,
        });
      }
    }
  } catch (ignoreInv) {}

  const colorBreakdown: BandColorBreakdown[] = Array.from(colorBreakdownMap.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.color_name.localeCompare(b.color_name);
  });

  const lowStockColors = colorBreakdown
    .filter(c => c.total > 0 && c.available < 3)
    .map(c => ({
      color_name: c.color_name,
      color_hex: c.color_hex,
      available: c.available,
    }));

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
  location?: string;
  color_name?: string;
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: "band_code" | "status" | "total_uses" | "created_at" | "updated_at";
  sortOrder?: "ASC" | "DESC";
}

export async function getBandItems(options: GetBandItemsOptions = {}): Promise<{ items: BandItem[]; totalCount: number }> {
  await ensureBandInventorySeeded();

  if (isPostgresActive()) {
    try {
      await ensurePgSchema();
      const whereClauses: string[] = [];
      const params: any[] = [];
      let pIdx = 1;

      if (options.search && options.search.trim()) {
        const s = `%${options.search.trim()}%`;
        whereClauses.push(`(band_code ILIKE $${pIdx} OR current_holder_name ILIKE $${pIdx} OR current_order_number ILIKE $${pIdx} OR notes ILIKE $${pIdx})`);
        params.push(s);
        pIdx++;
      }

      if (options.status && options.status !== 'all') {
        whereClauses.push(`status = $${pIdx}`);
        params.push(options.status.trim().toLowerCase());
        pIdx++;
      }

      if (options.location && options.location !== 'all') {
        whereClauses.push(`location = $${pIdx}`);
        params.push(options.location.trim().toLowerCase());
        pIdx++;
      }

      if (options.color_name && options.color_name !== 'all') {
        whereClauses.push(`color_name = $${pIdx}`);
        params.push(options.color_name.trim());
        pIdx++;
      }

      if (options.category && options.category !== 'all') {
        whereClauses.push(`category = $${pIdx}`);
        params.push(options.category.trim());
        pIdx++;
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const countRes = await simulatorPool.query(`SELECT COUNT(*)::int as cnt FROM band_items ${whereSql}`, params);
      const totalCount = countRes.rows[0]?.cnt || 0;

      const allowedSortCols = ['band_code', 'status', 'total_uses', 'created_at', 'updated_at'];
      const sortBy = allowedSortCols.includes(options.sortBy || '') ? options.sortBy! : 'updated_at';
      const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';

      let querySql = `SELECT * FROM band_items ${whereSql} ORDER BY ${sortBy} ${sortOrder}`;
      if (options.limit && options.limit > 0) {
        querySql += ` LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
        params.push(options.limit, Math.max(0, options.offset || 0));
      }

      const itemsRes = await simulatorPool.query(querySql, params);
      return { items: itemsRes.rows as BandItem[], totalCount };
    } catch (pgErr) {
      console.warn("[Band Inventory] Fallback to SQLite for items:", pgErr);
    }
  }

  // SQLite fallback
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

  if (options.location && options.location !== "all") {
    whereClauses.push("location = ?");
    params.push(options.location.trim().toLowerCase());
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
  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM band_items ${whereSql}`).get(...params) as { cnt: number };
  const totalCount = countRow ? countRow.cnt : 0;

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

export async function getBandItemById(id: number): Promise<BandItem | undefined> {
  if (isPostgresActive()) {
    try {
      const res = await simulatorPool.query("SELECT * FROM band_items WHERE id = $1", [id]);
      if (res.rows.length > 0) return res.rows[0] as BandItem;
    } catch (pgErr) {
      console.warn("[Band Inventory] Fallback to SQLite for getById:", pgErr);
    }
  }
  return db.prepare("SELECT * FROM band_items WHERE id = ?").get(id) as BandItem | undefined;
}

export async function getBandItemByCode(code: string): Promise<BandItem | undefined> {
  if (!code) return undefined;
  const clean = code.trim();
  if (isPostgresActive()) {
    try {
      const res = await simulatorPool.query("SELECT * FROM band_items WHERE UPPER(band_code) = UPPER($1)", [clean]);
      if (res.rows.length > 0) return res.rows[0] as BandItem;
    } catch (pgErr) {
      console.warn("[Band Inventory] Fallback to SQLite for getByCode:", pgErr);
    }
  }
  return db.prepare("SELECT * FROM band_items WHERE UPPER(band_code) = UPPER(?)").get(clean) as BandItem | undefined;
}

export async function createBandItem(data: {
  band_code: string;
  color_name: string;
  color_hex: string;
  category?: BandCategory;
  notes?: string;
  staff_name?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    await ensureBandInventorySeeded();

    const cleanCode = data.band_code.trim().toUpperCase();
    if (!cleanCode) return { success: false, error: "Unique Band ID / Code is required." };

    const existing = await getBandItemByCode(cleanCode);
    if (existing) {
      return { success: false, error: `Band ID '${cleanCode}' already exists in master inventory.` };
    }

    const category = data.category || "Standard";
    const notes = data.notes?.trim() || null;
    const staffName = data.staff_name || "Admin Staff";

    if (isPostgresActive()) {
      try {
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");
          const insRes = await client.query(
            `INSERT INTO band_items (band_code, color_name, color_hex, category, status, total_uses, notes)
               VALUES ($1, $2, $3, $4, 'available', 0, $5)
               RETURNING id`,
            [cleanCode, data.color_name.trim(), data.color_hex.trim(), category, notes]
          );
          const newId = insRes.rows[0].id;
          await client.query(
            `INSERT INTO band_transactions (band_id, band_code, color_name, color_hex, transaction_type, quantity, staff_name, notes)
               VALUES ($1, $2, $3, $4, 'STOCK_IN', 1, $5, $6)`,
            [newId, cleanCode, data.color_name.trim(), data.color_hex.trim(), staffName, notes || 'Manual stock-in']
          );
          await client.query("COMMIT");
          return { success: true, id: newId };
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for createBandItem:", pgErr);
      }
    }

    // SQLite fallback
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

export async function bulkCreateBandItems(data: {
  prefix: string;
  startingNumber: number;
  count: number;
  color_name: string;
  color_hex: string;
  category?: BandCategory;
  notes?: string;
  staff_name?: string;
  separator?: string;
  padLength?: number;
}): Promise<{ success: boolean; createdCount: number; error?: string }> {
  try {
    await ensureBandInventorySeeded();

    const prefix = (data.prefix || "").trim().toUpperCase();
    const count = Math.min(Math.max(1, data.count), 50000);
    const startNum = Math.max(0, data.startingNumber ?? 1);
    const category = data.category || "Standard";
    const staffName = data.staff_name || "Admin Staff";
    const notes = data.notes?.trim() || `Batch Stock-In of ${count} bands`;
    // If separator is explicitly specified (e.g. "" for no dash), honor it; otherwise default to "-" unless prefix ends with dash
    const sep = data.separator !== undefined 
      ? data.separator 
      : (prefix.endsWith("-") || !prefix ? "" : "-");
    const padLen = data.padLength !== undefined ? data.padLength : 3;

    // Helper to format band code
    const isNumConcat = sep === "" && /^\d+$/.test(prefix) && padLen > 0;
    const combinedStart = isNumConcat ? parseInt(prefix + String(startNum).padStart(padLen, "0"), 10) : startNum;
    const totalLen = isNumConcat ? prefix.length + padLen : padLen;

    const formatBandCode = (indexOffset: number) => {
      if (isNumConcat) {
        return String(combinedStart + indexOffset).padStart(totalLen, "0");
      }
      const curNum = startNum + indexOffset;
      const formattedNum = String(curNum).padStart(padLen, "0");
      if (!prefix) return formattedNum;
      if (prefix.endsWith("-") && sep === "-") return `${prefix}${formattedNum}`;
      return `${prefix}${sep}${formattedNum}`;
    };

    if (isPostgresActive()) {
      try {
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");
          let createdCount = 0;
          for (let i = 0; i < count; i++) {
            const code = formatBandCode(i);

            const existCheck = await client.query("SELECT id FROM band_items WHERE UPPER(band_code) = UPPER($1)", [code]);
            if (existCheck.rows.length > 0) continue;

            const insRes = await client.query(
              `INSERT INTO band_items (band_code, color_name, color_hex, category, status, total_uses, notes)
                 VALUES ($1, $2, $3, $4, 'available', 0, $5)
                 RETURNING id`,
              [code, data.color_name.trim(), data.color_hex.trim(), category, notes]
            );
            const newId = insRes.rows[0]?.id;
            if (newId) {
              await client.query(
                `INSERT INTO band_transactions (band_id, band_code, color_name, color_hex, transaction_type, quantity, staff_name, notes)
                   VALUES ($1, $2, $3, $4, 'STOCK_IN', 1, $5, $6)`,
                [newId, code, data.color_name.trim(), data.color_hex.trim(), staffName, notes]
              );
              createdCount++;
            }
          }
          await client.query("COMMIT");
          if (createdCount === 0) {
            return { success: false, createdCount: 0, error: "No new bands created (all codes in range already exist)." };
          }
          return { success: true, createdCount };
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for bulkCreate:", pgErr);
      }
    }

    // SQLite fallback
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
        const code = formatBandCode(i);

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

export async function issueBandItem(data: {
  band_id?: number;
  band_code?: string;
  customer_name?: string;
  booking_id?: number;
  order_number?: string;
  staff_name?: string;
  notes?: string;
}): Promise<{ success: boolean; item?: BandItem; error?: string }> {
  try {
    const band = data.band_id 
      ? await getBandItemById(data.band_id) 
      : (data.band_code ? await getBandItemByCode(data.band_code) : undefined);

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

    if (isPostgresActive()) {
      try {
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE band_items
               SET status = 'issued',
                   current_holder_name = $1,
                   current_booking_id = $2,
                   current_order_number = $3,
                   total_uses = total_uses + 1,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $4`,
            [customerName, data.booking_id || null, orderNumber, band.id]
          );

          await client.query(
            `INSERT INTO band_transactions (
                band_id, band_code, color_name, color_hex, transaction_type, 
                quantity, customer_name, booking_id, order_number, staff_name, notes
              )
              VALUES ($1, $2, $3, $4, 'ISSUE', 1, $5, $6, $7, $8, $9)`,
            [band.id, band.band_code, band.color_name, band.color_hex, customerName, data.booking_id || null, orderNumber, staffName, notes || 'Issued at Reception / Track Desk']
          );
          await client.query("COMMIT");
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }

        const updated = await getBandItemById(band.id);
        return { success: true, item: updated };
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for issueBandItem:", pgErr);
      }
    }

    // SQLite fallback
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
    const updated = await getBandItemById(band.id);
    return { success: true, item: updated };
  } catch (err: any) {
    console.error("[Issue Band Error]", err);
    return { success: false, error: err.message || "Failed to issue wristband." };
  }
}

export async function returnBandItem(data: {
  band_id?: number;
  band_code?: string;
  condition: "good" | "damaged" | "lost";
  staff_name?: string;
  notes?: string;
}): Promise<{ success: boolean; item?: BandItem; error?: string }> {
  try {
    const band = data.band_id 
      ? await getBandItemById(data.band_id) 
      : (data.band_code ? await getBandItemByCode(data.band_code) : undefined);

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

    if (isPostgresActive()) {
      try {
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE band_items
               SET status = $1,
                   current_holder_name = NULL,
                   current_booking_id = NULL,
                   current_order_number = NULL,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
            [newStatus, band.id]
          );

          await client.query(
            `INSERT INTO band_transactions (
                band_id, band_code, color_name, color_hex, transaction_type, 
                quantity, customer_name, booking_id, order_number, staff_name, notes
              )
              VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10)`,
            [
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
            ]
          );
          await client.query("COMMIT");
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }

        const updated = await getBandItemById(band.id);
        return { success: true, item: updated };
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for returnBandItem:", pgErr);
      }
    }

    // SQLite fallback
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
    const updated = await getBandItemById(band.id);
    return { success: true, item: updated };
  } catch (err: any) {
    console.error("[Return Band Error]", err);
    return { success: false, error: err.message || "Failed to return wristband." };
  }
}

export async function stockOutBandItem(data: {
  band_id: number;
  reason?: string;
  staff_name?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const band = await getBandItemById(data.band_id);
    if (!band) return { success: false, error: "Band item not found." };

    const reason = data.reason?.trim() || "Item retired / discarded";
    const staffName = data.staff_name || "Admin Staff";

    if (isPostgresActive()) {
      try {
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE band_items 
               SET status = 'retired',
                   current_holder_name = NULL,
                   current_booking_id = NULL,
                   current_order_number = NULL,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
            [band.id]
          );

          await client.query(
            `INSERT INTO band_transactions (
                band_id, band_code, color_name, color_hex, transaction_type, 
                quantity, staff_name, notes
              )
              VALUES ($1, $2, $3, $4, 'STOCK_OUT', 1, $5, $6)`,
            [band.id, band.band_code, band.color_name, band.color_hex, staffName, reason]
          );
          await client.query("COMMIT");
          return { success: true };
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for stockOutBandItem:", pgErr);
      }
    }

    // SQLite fallback
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
 * Handover Wristbands to Reception:
 * Earmarks specific available bands of a given color and moves their location from 'warehouse' to 'reception'.
 * Returns the exact count and band code range (e.g. BND-AQU-001 to BND-AQU-200).
 */
export async function handoverWristbandsToReception(data: {
  color_name?: string;
  color_hex?: string;
  amount: number;
  staff_name?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  movedCount: number;
  startCode?: string;
  endCode?: string;
  bandCodes: string[];
  error?: string;
}> {
  try {
    const { color_name, color_hex, amount } = data;
    const cleanAmount = Math.floor(amount);
    if (cleanAmount <= 0) {
      return { success: false, movedCount: 0, bandCodes: [], error: "Invalid handover quantity." };
    }

    const staffName = data.staff_name || "Admin Staff";
    const notes = data.notes?.trim() || `Handed over ${cleanAmount} bands to Reception Desk`;

    await ensureBandInventorySeeded();

    if (isPostgresActive()) {
      try {
        await ensurePgSchema();
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");

          const whereParams: any[] = [];
          const whereParts = ["status = 'available'", "COALESCE(location, 'warehouse') != 'reception'"];
          let pIdx = 1;

          if (color_hex) {
            whereParts.push(`UPPER(color_hex) = UPPER($${pIdx++})`);
            whereParams.push(color_hex.trim());
          } else if (color_name) {
            whereParts.push(`LOWER(color_name) = LOWER($${pIdx++})`);
            whereParams.push(color_name.trim());
          }

          whereParams.push(cleanAmount);
          const selectSql = `
            SELECT id, band_code, color_name, color_hex 
            FROM band_items 
            WHERE ${whereParts.join(" AND ")}
            ORDER BY band_code ASC, id ASC
            LIMIT $${pIdx}
          `;

          const eligibleRes = await client.query(selectSql, whereParams);
          const eligibleBands = eligibleRes.rows;

          if (eligibleBands.length > 0) {
            const ids = eligibleBands.map(b => b.id);
            await client.query(`
              UPDATE band_items 
              SET location = 'reception', updated_at = CURRENT_TIMESTAMP
              WHERE id = ANY($1::int[])
            `, [ids]);

            for (const b of eligibleBands) {
              await client.query(`
                INSERT INTO band_transactions (
                  band_id, band_code, color_name, color_hex, transaction_type, 
                  quantity, staff_name, notes
                ) VALUES ($1, $2, $3, $4, 'HANDOVER', 1, $5, $6)
              `, [b.id, b.band_code, b.color_name, b.color_hex, staffName, notes]);
            }
          }

          await client.query("COMMIT");

          const codes = eligibleBands.map(b => b.band_code);
          return {
            success: true,
            movedCount: codes.length,
            startCode: codes[0],
            endCode: codes[codes.length - 1],
            bandCodes: codes
          };
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for handoverWristbandsToReception:", pgErr);
      }
    }

    // SQLite fallback
    initDB();
    const whereParts = ["status = 'available'", "COALESCE(location, 'warehouse') != 'reception'"];
    const params: any[] = [];

    if (color_hex) {
      whereParts.push("UPPER(color_hex) = ?");
      params.push(color_hex.trim().toUpperCase());
    } else if (color_name) {
      whereParts.push("LOWER(color_name) = ?");
      params.push(color_name.trim().toLowerCase());
    }

    params.push(cleanAmount);
    const selectSql = `
      SELECT id, band_code, color_name, color_hex
      FROM band_items
      WHERE ${whereParts.join(" AND ")}
      ORDER BY band_code ASC, id ASC
      LIMIT ?
    `;

    const eligibleBands = db.prepare(selectSql).all(...params) as any[];

    if (eligibleBands.length > 0) {
      const updateStmt = db.prepare("UPDATE band_items SET location = 'reception', updated_at = CURRENT_TIMESTAMP WHERE id = ?");
      const txStmt = db.prepare(`
        INSERT INTO band_transactions (
          band_id, band_code, color_name, color_hex, transaction_type,
          quantity, staff_name, notes
        ) VALUES (?, ?, ?, ?, 'HANDOVER', 1, ?, ?)
      `);

      const tx = db.transaction(() => {
        for (const b of eligibleBands) {
          updateStmt.run(b.id);
          txStmt.run(b.id, b.band_code, b.color_name, b.color_hex, staffName, notes);
        }
      });
      tx();
    }

    const codes = eligibleBands.map(b => b.band_code);
    return {
      success: true,
      movedCount: codes.length,
      startCode: codes[0],
      endCode: codes[codes.length - 1],
      bandCodes: codes
    };
  } catch (err: any) {
    console.error("[Handover Wristbands Error]", err);
    return { success: false, movedCount: 0, bandCodes: [], error: err.message || "Failed to handover wristbands." };
  }
}

/**
 * Return Wristbands from Reception back to Warehouse:
 * Returns wristbands located at 'reception' back to 'warehouse'.
 */
export async function returnWristbandsFromReception(data: {
  color_name?: string;
  color_hex?: string;
  amount: number;
  staff_name?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  returnedCount: number;
  bandCodes: string[];
  error?: string;
}> {
  try {
    const { color_name, color_hex, amount } = data;
    const cleanAmount = Math.floor(amount);
    if (cleanAmount <= 0) {
      return { success: false, returnedCount: 0, bandCodes: [], error: "Invalid return quantity." };
    }

    const staffName = data.staff_name || "Admin Staff";
    const notes = data.notes?.trim() || `Returned ${cleanAmount} bands from Reception to Warehouse`;

    await ensureBandInventorySeeded();

    if (isPostgresActive()) {
      try {
        await ensurePgSchema();
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");

          const whereParams: any[] = [];
          const whereParts = ["status = 'available'", "location = 'reception'"];
          let pIdx = 1;

          if (color_hex) {
            whereParts.push(`UPPER(color_hex) = UPPER($${pIdx++})`);
            whereParams.push(color_hex.trim());
          } else if (color_name) {
            whereParts.push(`LOWER(color_name) = LOWER($${pIdx++})`);
            whereParams.push(color_name.trim());
          }

          whereParams.push(cleanAmount);
          const selectSql = `
            SELECT id, band_code, color_name, color_hex 
            FROM band_items 
            WHERE ${whereParts.join(" AND ")}
            ORDER BY band_code DESC, id DESC
            LIMIT $${pIdx}
          `;

          const eligibleRes = await client.query(selectSql, whereParams);
          const eligibleBands = eligibleRes.rows;

          if (eligibleBands.length > 0) {
            const ids = eligibleBands.map(b => b.id);
            await client.query(`
              UPDATE band_items 
              SET location = 'warehouse', updated_at = CURRENT_TIMESTAMP
              WHERE id = ANY($1::int[])
            `, [ids]);

            for (const b of eligibleBands) {
              await client.query(`
                INSERT INTO band_transactions (
                  band_id, band_code, color_name, color_hex, transaction_type, 
                  quantity, staff_name, notes
                ) VALUES ($1, $2, $3, $4, 'STATUS_CHANGE', 1, $5, $6)
              `, [b.id, b.band_code, b.color_name, b.color_hex, staffName, notes]);
            }
          }

          await client.query("COMMIT");

          const codes = eligibleBands.map(b => b.band_code);
          return {
            success: true,
            returnedCount: codes.length,
            bandCodes: codes
          };
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for returnWristbandsFromReception:", pgErr);
      }
    }

    // SQLite fallback
    initDB();
    const whereParts = ["status = 'available'", "location = 'reception'"];
    const params: any[] = [];

    if (color_hex) {
      whereParts.push("UPPER(color_hex) = ?");
      params.push(color_hex.trim().toUpperCase());
    } else if (color_name) {
      whereParts.push("LOWER(color_name) = ?");
      params.push(color_name.trim().toLowerCase());
    }

    params.push(cleanAmount);
    const selectSql = `
      SELECT id, band_code, color_name, color_hex
      FROM band_items
      WHERE ${whereParts.join(" AND ")}
      ORDER BY band_code DESC, id DESC
      LIMIT ?
    `;

    const eligibleBands = db.prepare(selectSql).all(...params) as any[];

    if (eligibleBands.length > 0) {
      const updateStmt = db.prepare("UPDATE band_items SET location = 'warehouse', updated_at = CURRENT_TIMESTAMP WHERE id = ?");
      const txStmt = db.prepare(`
        INSERT INTO band_transactions (
          band_id, band_code, color_name, color_hex, transaction_type,
          quantity, staff_name, notes
        ) VALUES (?, ?, ?, ?, 'STATUS_CHANGE', 1, ?, ?)
      `);

      const tx = db.transaction(() => {
        for (const b of eligibleBands) {
          updateStmt.run(b.id);
          txStmt.run(b.id, b.band_code, b.color_name, b.color_hex, staffName, notes);
        }
      });
      tx();
    }

    const codes = eligibleBands.map(b => b.band_code);
    return {
      success: true,
      returnedCount: codes.length,
      bandCodes: codes
    };
  } catch (err: any) {
    console.error("[Return Reception Error]", err);
    return { success: false, returnedCount: 0, bandCodes: [], error: err.message || "Failed to return wristbands." };
  }
}

export async function restoreBandItem(data: {
  band_id: number;
  staff_name?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const band = await getBandItemById(data.band_id);
    if (!band) return { success: false, error: "Band item not found." };

    const staffName = data.staff_name || "Admin Staff";
    const notes = data.notes?.trim() || "Restored back to available stock";

    if (isPostgresActive()) {
      try {
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            `UPDATE band_items 
               SET status = 'available',
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
            [band.id]
          );

          await client.query(
            `INSERT INTO band_transactions (
                band_id, band_code, color_name, color_hex, transaction_type, 
                quantity, staff_name, notes
              )
              VALUES ($1, $2, $3, $4, 'STATUS_CHANGE', 1, $5, $6)`,
            [band.id, band.band_code, band.color_name, band.color_hex, staffName, notes]
          );
          await client.query("COMMIT");
          return { success: true };
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for restoreBandItem:", pgErr);
      }
    }

    // SQLite fallback
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

export async function updateBandItem(id: number, data: {
  band_code: string;
  color_name: string;
  color_hex: string;
  category?: BandCategory;
  status?: BandStatus;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanCode = data.band_code.trim().toUpperCase();
    if (!cleanCode) return { success: false, error: "Band code is required." };

    if (isPostgresActive()) {
      try {
        const existRes = await simulatorPool.query(
          "SELECT id FROM band_items WHERE UPPER(band_code) = UPPER($1) AND id != $2",
          [cleanCode, id]
        );
        if (existRes.rows.length > 0) {
          return { success: false, error: `Band code '${cleanCode}' is already used by another item.` };
        }

        await simulatorPool.query(
          `UPDATE band_items
             SET band_code = $1,
                 color_name = $2,
                 color_hex = $3,
                 category = COALESCE($4, category),
                 status = COALESCE($5, status),
                 notes = $6,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7`,
          [
            cleanCode,
            data.color_name.trim(),
            data.color_hex.trim(),
            data.category || null,
            data.status || null,
            data.notes?.trim() || null,
            id
          ]
        );
        return { success: true };
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for updateBandItem:", pgErr);
      }
    }

    // SQLite fallback
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

export async function deleteBandItem(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    if (isPostgresActive()) {
      try {
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");
          await client.query("DELETE FROM band_transactions WHERE band_id = $1", [id]);
          await client.query("DELETE FROM band_items WHERE id = $1", [id]);
          await client.query("COMMIT");
          return { success: true };
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for deleteBandItem:", pgErr);
      }
    }

    // SQLite fallback
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

export async function bulkDeleteBandItems(ids: number[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!ids || ids.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    if (isPostgresActive()) {
      try {
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");
          await client.query("DELETE FROM band_transactions WHERE band_id = ANY($1::int[])", [ids]);
          const res = await client.query("DELETE FROM band_items WHERE id = ANY($1::int[])", [ids]);
          await client.query("COMMIT");
          return { success: true, count: res.rowCount || ids.length };
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for bulkDeleteBandItems:", pgErr);
      }
    }

    // SQLite fallback
    const placeholders = ids.map(() => "?").join(",");
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM band_transactions WHERE band_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM band_items WHERE id IN (${placeholders})`).run(...ids);
    });
    tx();
    return { success: true, count: ids.length };
  } catch (err: any) {
    console.error("[Bulk Delete Band Error]", err);
    return { success: false, count: 0, error: err.message || "Failed to bulk delete bands." };
  }
}

export async function deleteAllBandInventory(options?: { resetStarterStock?: boolean }): Promise<{ success: boolean; error?: string }> {
  try {
    if (isPostgresActive()) {
      try {
        const client = await simulatorPool.connect();
        try {
          await client.query("BEGIN");
          await client.query("DELETE FROM band_transactions");
          await client.query("DELETE FROM band_items");
          await client.query("COMMIT");
        } catch (txErr) {
          await client.query("ROLLBACK");
          throw txErr;
        } finally {
          client.release();
        }
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for deleteAllBandInventory:", pgErr);
      }
    }

    // SQLite fallback
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM band_transactions").run();
      db.prepare("DELETE FROM band_items").run();
    });
    tx();

    if (options?.resetStarterStock) {
      // Re-seed 10 starter stock per slot color
      await ensureBandInventorySeeded(true);
    } else {
      // Mark as seeded so empty inventory stays empty
      try {
        db.prepare(`
          INSERT INTO site_settings (key, value, description)
          VALUES ('band_inventory_seeded', '1', 'Flag indicating initial band inventory seed completed')
          ON CONFLICT(key) DO UPDATE SET value = '1'
        `).run();
      } catch (ignore) {}
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Delete All Band Inventory Error]", err);
    return { success: false, error: err.message || "Failed to clear band inventory." };
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

export async function getBandTransactions(options: GetBandTransactionsOptions = {}): Promise<{ transactions: BandTransaction[]; totalCount: number }> {
  await ensureBandInventorySeeded();

  if (isPostgresActive()) {
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];
      let pIdx = 1;

      if (options.band_id) {
        whereClauses.push(`band_id = $${pIdx}`);
        params.push(options.band_id);
        pIdx++;
      }

      if (options.band_code && options.band_code.trim()) {
        whereClauses.push(`UPPER(band_code) = UPPER($${pIdx})`);
        params.push(options.band_code.trim());
        pIdx++;
      }

      if (options.type && options.type !== 'all') {
        whereClauses.push(`transaction_type = $${pIdx}`);
        params.push(options.type.trim().toUpperCase());
        pIdx++;
      }

      if (options.search && options.search.trim()) {
        const s = `%${options.search.trim()}%`;
        whereClauses.push(`(band_code ILIKE $${pIdx} OR customer_name ILIKE $${pIdx} OR order_number ILIKE $${pIdx} OR staff_name ILIKE $${pIdx} OR notes ILIKE $${pIdx})`);
        params.push(s);
        pIdx++;
      }

      if (options.startDate) {
        whereClauses.push(`created_at::date >= $${pIdx}::date`);
        params.push(options.startDate);
        pIdx++;
      }

      if (options.endDate) {
        whereClauses.push(`created_at::date <= $${pIdx}::date`);
        params.push(options.endDate);
        pIdx++;
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const countRes = await simulatorPool.query(`SELECT COUNT(*)::int as cnt FROM band_transactions ${whereSql}`, params);
      const totalCount = countRes.rows[0]?.cnt || 0;

      let querySql = `SELECT * FROM band_transactions ${whereSql} ORDER BY created_at DESC, id DESC`;
      if (options.limit && options.limit > 0) {
        querySql += ` LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
        params.push(options.limit, Math.max(0, options.offset || 0));
      }

      const txRes = await simulatorPool.query(querySql, params);
      return { transactions: txRes.rows as BandTransaction[], totalCount };
    } catch (pgErr) {
      console.warn("[Band Inventory] Fallback to SQLite for getBandTransactions:", pgErr);
    }
  }

  // SQLite fallback
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
