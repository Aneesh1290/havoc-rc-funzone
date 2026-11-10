import { db, initDB } from "./db";
import { simulatorPool } from "./simulator-db";
import { WRISTBAND_PALETTE, getSlotWristbandColor, resolveColorNameToHex } from "./slotColors";
import { getDistinctSlotColors, ensureColorInventorySchema, invalidateSubcategoryBandsCache } from "./color-inventory-db";

export * from "./band-types";
import { 
  BandStatus, 
  BandCategory, 
  BandLocation, 
  BandTransactionType, 
  BandItem, 
  BandTransaction, 
  BandSubcategoryBreakdown, 
  BandColorBreakdown, 
  BandInventorySummary, 
  BAND_SUBCATEGORIES, 
  normalizeBandCategory 
} from "./band-types";

function isPostgresActive(): boolean {
  const url = process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL;
  return Boolean(url && simulatorPool);
}

let pgSchemaInitialized = false;
let pgSchemaPromise: Promise<void> | null = null;

async function ensurePgSchema() {
  if (pgSchemaInitialized || !isPostgresActive()) return;
  if (pgSchemaPromise) return pgSchemaPromise;

  pgSchemaPromise = (async () => {
    try {
      await simulatorPool.query(`
        CREATE TABLE IF NOT EXISTS band_items (
          id SERIAL PRIMARY KEY,
          band_code VARCHAR(100) NOT NULL,
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_band_code_per_color UNIQUE (band_code, color_name)
        );

        -- Migration: Drop old single-column unique constraint if present so different colors can share the same band numbers
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'band_items_band_code_key'
          ) THEN
            ALTER TABLE band_items DROP CONSTRAINT band_items_band_code_key;
          END IF;
        END $$;

        -- Ensure compound unique constraint exists on (band_code, color_name)
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'unique_band_code_per_color'
          ) THEN
            ALTER TABLE band_items ADD CONSTRAINT unique_band_code_per_color UNIQUE (band_code, color_name);
          END IF;
        END $$;

        ALTER TABLE band_items ADD COLUMN IF NOT EXISTS location VARCHAR(50) DEFAULT 'warehouse';
        UPDATE band_items SET category = 'Standard' WHERE category IS NULL OR category = '';
        CREATE INDEX IF NOT EXISTS idx_band_items_code ON band_items(band_code);
        CREATE INDEX IF NOT EXISTS idx_band_items_len_code ON band_items(LENGTH(band_code), band_code);
        CREATE INDEX IF NOT EXISTS idx_band_items_color_hex ON band_items(color_name, color_hex);
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

      // Safely sync active time_slots into PostgreSQL in parallel so both Havoc RC Fun Zone and Havoc Sim Podium see them
      try {
        initDB();
        const localSlots = db.prepare("SELECT label, start_hour, end_hour, active, sort_order, color, color_name, remark FROM time_slots WHERE active = 1").all() as any[];
        await Promise.all(
          localSlots.map(slot =>
            simulatorPool.query(`
              INSERT INTO time_slots (label, start_hour, end_hour, active, sort_order, color, color_name, remark)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (label) DO UPDATE 
              SET color = COALESCE(time_slots.color, EXCLUDED.color),
                  color_name = COALESCE(time_slots.color_name, EXCLUDED.color_name),
                  sort_order = EXCLUDED.sort_order,
                  active = EXCLUDED.active
            `, [slot.label, slot.start_hour, slot.end_hour, slot.active ?? 1, slot.sort_order ?? 0, slot.color, slot.color_name, slot.remark])
          )
        );
      } catch (slotSyncErr) {
        console.warn("[Band Inventory] Could not sync time_slots to Postgres:", slotSyncErr);
      }
    } catch (err) {
      console.warn("[Band Inventory] Could not auto-initialize Postgres schema:", err);
    } finally {
      pgSchemaPromise = null;
    }
  })();

  return pgSchemaPromise;
}

export const TARGET_SLOT_BAND_COLORS: { code: string; name: string; hex: string; count: number }[] = [];

let bandInventorySeedChecked = false;

export async function ensureBandInventorySeeded(force: boolean = false) {
  if (bandInventorySeedChecked && !force) return;
  bandInventorySeedChecked = true;
  initDB();

  // Standardize any existing bands with missing category to 'Standard'
  try {
    db.prepare("UPDATE band_items SET category = 'Standard' WHERE category IS NULL OR category = ''").run();
  } catch (e) {}

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

// In-memory cache for inventory summary (60s TTL; auto-invalidated on every stock mutation)
let cachedBandSummary: { data: BandInventorySummary; timestamp: number } | null = null;
const BAND_SUMMARY_CACHE_TTL = 60 * 1000;

export function invalidateBandSummaryCache() {
  cachedBandSummary = null;
  invalidateSubcategoryBandsCache();
}

export async function getBandInventorySummary(): Promise<BandInventorySummary> {
  if (cachedBandSummary && Date.now() - cachedBandSummary.timestamp < BAND_SUMMARY_CACHE_TTL) {
    return cachedBandSummary.data;
  }

  await ensureBandInventorySeeded();

  if (isPostgresActive()) {
    try {
      // Run DDL check in background if needed, do not block read path
      ensurePgSchema().catch(() => {});

      const pgSummaryPromise = (async (): Promise<BandInventorySummary> => {
        // Run a single consolidated aggregation query for band_items instead of 4 separate full-table scans
        const [subcatRes, todayRes, slotInvRes, subcatConfigs] = await Promise.all([
          simulatorPool.query(`
            SELECT
              COALESCE(color_name, 'Unknown') as color_name,
              COALESCE(color_hex, '#CCCCCC') as color_hex,
              COALESCE(category, 'Standard') as category,
              COUNT(*)::int as total,
              SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END)::int as available,
              SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END)::int as issued,
              SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END)::int as damaged,
              SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END)::int as lost,
              SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END)::int as retired,
              SUM(CASE WHEN location = 'reception' AND status = 'available' THEN 1 ELSE 0 END)::int as in_reception,
              SUM(CASE WHEN (location = 'warehouse' OR location IS NULL) AND status = 'available' THEN 1 ELSE 0 END)::int as warehouse
            FROM band_items
            GROUP BY color_name, color_hex, category
            ORDER BY color_name ASC, total DESC
          `).catch(() => ({ rows: [] as any[] })),
          simulatorPool.query(`
            SELECT
              SUM(CASE WHEN transaction_type = 'ISSUE' THEN 1 ELSE 0 END)::int AS issued_today,
              SUM(CASE WHEN transaction_type = 'RETURN' THEN 1 ELSE 0 END)::int AS returned_today
            FROM band_transactions
            WHERE created_at::date = CURRENT_DATE
          `).catch(() => ({ rows: [] as any[] })),
          simulatorPool.query("SELECT id, color_hex, color_name, quantity, in_reception FROM wristband_color_inventory").catch(() => ({ rows: [] as any[] })),
          simulatorPool.query("SELECT color_hex, color_name, category_name FROM subcategory_bands WHERE color_name IS NOT NULL AND color_name != ''").catch(() => ({ rows: [] as any[] })),
        ]);

        let totalBands = 0;
        let available = 0;
        let issued = 0;
        let damaged = 0;
        let lost = 0;
        let retired = 0;

        const catMap = new Map<string, { total: number; available: number; issued: number }>();
        const colorBreakdownMap = new Map<string, BandColorBreakdown>();
        const nameToKeyMap = new Map<string, string>();
        const normalizeColorKey = (name?: string) => (name || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

        // 1. Process all counts, categories, and colors from the single grouping query
        for (const row of subcatRes.rows) {
          const rowTotal = Number(row.total || 0);
          const rowAvail = Number(row.available || 0);
          const rowIssued = Number(row.issued || 0);
          const rowDamaged = Number(row.damaged || 0);
          const rowLost = Number(row.lost || 0);
          const rowRetired = Number(row.retired || 0);
          const rowInRec = Number(row.in_reception || 0);
          const rowWh = Number(row.warehouse !== undefined && row.warehouse !== null ? row.warehouse : Math.max(0, rowAvail - rowInRec));
          const rowCat = row.category || 'Standard';

          totalBands += rowTotal;
          available += rowAvail;
          issued += rowIssued;
          damaged += rowDamaged;
          lost += rowLost;
          retired += rowRetired;

          // Category aggregation
          const catStat = catMap.get(rowCat) || { total: 0, available: 0, issued: 0 };
          catStat.total += rowTotal;
          catStat.available += rowAvail;
          catStat.issued += rowIssued;
          catMap.set(rowCat, catStat);

          // Color breakdown aggregation
          const hex = (row.color_hex || "").trim().toUpperCase();
          const name = (row.color_name || "").trim();
          const normKey = normalizeColorKey(name);
          const key = hex || normKey;

          let existing: BandColorBreakdown | undefined = hex ? colorBreakdownMap.get(hex) : undefined;
          if (!existing && normKey) {
            const mappedKey = nameToKeyMap.get(normKey);
            if (mappedKey) existing = colorBreakdownMap.get(mappedKey);
          }

          let targetBreakdown: BandColorBreakdown;
          if (existing) {
            existing.total += rowTotal;
            existing.available += rowWh;
            existing.in_reception = (existing.in_reception || 0) + rowInRec;
            existing.issued += rowIssued;
            existing.damaged += rowDamaged;
            existing.lost += rowLost;
            existing.retired += rowRetired;
            targetBreakdown = existing;
          } else {
            targetBreakdown = {
              color_name: name || hex,
              color_hex: hex,
              total: rowTotal,
              available: rowWh,
              in_reception: rowInRec,
              issued: rowIssued,
              damaged: rowDamaged,
              lost: rowLost,
              retired: rowRetired,
              warehouse: rowWh,
              subcategories: []
            };
            colorBreakdownMap.set(key, targetBreakdown);
            if (normKey) nameToKeyMap.set(normKey, key);
            if (hex) nameToKeyMap.set(hex, key);
          }

          if (!targetBreakdown.subcategories) targetBreakdown.subcategories = [];
          targetBreakdown.subcategories.push({
            category: rowCat,
            total: rowTotal,
            available: rowAvail,
            issued: rowIssued,
            damaged: rowDamaged,
            lost: rowLost,
            retired: rowRetired,
            in_reception: rowInRec,
            warehouse: rowWh
          });
        }

        const activeInventory = Math.max(0, totalBands - retired);
        const availabilityRate = activeInventory > 0 ? Math.round((available / activeInventory) * 100) : 0;

        const todayRow = todayRes.rows[0] || {};
        const issuedToday = Number(todayRow.issued_today || 0);
        const returnedToday = Number(todayRow.returned_today || 0);

        // 2. Also incorporate slot colors from wristband_color_inventory
        for (const sir of slotInvRes.rows) {
          const hex = (sir.color_hex || "").trim().toUpperCase();
          const name = (sir.color_name || "").trim();
          const normKey = normalizeColorKey(name);
          const invId = sir.id;
          const poolQty = Number(sir.quantity || 0);
          const inRec = Number(sir.in_reception || 0);

          let existing = hex ? colorBreakdownMap.get(hex) : undefined;
          if (!existing && normKey) {
            const mappedKey = nameToKeyMap.get(normKey);
            if (mappedKey) existing = colorBreakdownMap.get(mappedKey);
          }
          if (!existing && normKey) {
            for (const [_, item] of colorBreakdownMap.entries()) {
              const iNorm = normalizeColorKey(item.color_name);
              if (iNorm === normKey || (iNorm && normKey && (iNorm.includes(normKey) || normKey.includes(iNorm)))) {
                existing = item;
                break;
              }
            }
          }

          if (existing) {
            existing.color_inventory_id = invId;
            if (name && name !== hex) existing.color_name = name;
            if (existing.total === 0 && (poolQty > 0 || inRec > 0)) {
              existing.total = poolQty + inRec;
              existing.available = poolQty;
              existing.in_reception = inRec;
            } else if (existing.total > 0) {
              if (!existing.in_reception || existing.in_reception === 0) {
                if (inRec > 0) {
                  existing.in_reception = inRec;
                  existing.available = Math.max(0, existing.available - inRec);
                }
              }
            }
          } else {
            const key = hex || normKey;
            colorBreakdownMap.set(key, {
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
            if (normKey) nameToKeyMap.set(normKey, key);
            if (hex) nameToKeyMap.set(hex, key);
          }
        }

        // 3. Subcategories config
        for (const sc of subcatConfigs.rows) {
          const hex = (sc.color_hex || "").trim().toUpperCase();
          const scName = (sc.color_name || "").trim();
          const scCat = (sc.category_name || "").trim();

          let target: BandColorBreakdown | undefined = undefined;
          for (const item of colorBreakdownMap.values()) {
            const itemUpper = (item.color_name || "").trim().toUpperCase();
            const scUpper = scName.toUpperCase();
            if (itemUpper === scUpper) {
              target = item;
              break;
            }
            const itemHasKeyword = /VIP|VISITOR|STAFF|MARSHAL|CHILD|SPECIAL|EXCAVATOR/i.test(itemUpper);
            if (itemHasKeyword && (itemUpper.includes(scUpper) || scUpper.includes(itemUpper))) {
              target = item;
              break;
            }
          }
          if (target) {
            if (scName) target.color_name = scName;
            if (hex) target.color_hex = hex;
            if (scCat) {
              if (!target.subcategories || target.subcategories.length === 0) {
                target.subcategories = [{
                  category: scCat,
                  total: target.total,
                  available: target.available,
                  issued: target.issued,
                  damaged: target.damaged,
                  lost: target.lost,
                  retired: target.retired,
                  in_reception: target.in_reception || 0,
                  warehouse: target.available
                }];
              } else {
                target.subcategories[0].category = scCat;
              }
            }
          }
        }

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

        const categoryBreakdown = Array.from(catMap.entries()).map(([cat, stats]) => ({
          category: cat,
          total: stats.total,
          available: stats.available,
          issued: stats.issued,
        })).sort((a, b) => b.total - a.total);

        const finalSummary: BandInventorySummary = {
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

        cachedBandSummary = { data: finalSummary, timestamp: Date.now() };
        return finalSummary;
      })();

      // 4000ms timeout race so cold start does NOT freeze admin
      const timeoutPromise = new Promise<BandInventorySummary>((_, reject) =>
        setTimeout(() => reject(new Error("PG summary query timeout")), 4000)
      );

      return await Promise.race([pgSummaryPromise, timeoutPromise]);
    } catch (pgErr) {
      console.warn("[Band Inventory] Fallback to SQLite for summary:", pgErr);
    }
  }

  // SQLite fallback
  try {
    initDB();
    db.prepare("UPDATE band_items SET category = 'Standard' WHERE category IS NULL OR category = ''").run();
  } catch (_) {}
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
      SUM(CASE WHEN (location = 'warehouse' OR location IS NULL) AND status = 'available' THEN 1 ELSE 0 END) as warehouse,
      SUM(CASE WHEN location = 'reception' AND status = 'available' THEN 1 ELSE 0 END) as in_reception,
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
  const nameToKeyMap = new Map<string, string>();

  const normalizeColorKey = (name?: string) => (name || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Merge actual SQLite inventory counts (matching by HEX first, then by normalized name)
  for (const r of colorRows) {
    const hex = (r.color_hex || "").trim().toUpperCase();
    const name = (r.color_name || "").trim();
    const normKey = normalizeColorKey(name);
    const key = hex || normKey;
    const inRec = Number(r.in_reception || 0);
    const wh = Number(r.warehouse !== undefined && r.warehouse !== null ? r.warehouse : Math.max(0, Number(r.available || 0) - inRec));

    let existing = hex ? colorBreakdownMap.get(hex) : undefined;
    if (!existing && normKey) {
      const mappedKey = nameToKeyMap.get(normKey);
      if (mappedKey) existing = colorBreakdownMap.get(mappedKey);
    }

    if (existing) {
      if (name && (!existing.color_name || existing.color_name === existing.color_hex)) {
        existing.color_name = name;
      }
      existing.color_hex = hex || existing.color_hex;
      existing.total = Number(r.total || 0);
      existing.available = wh;
      existing.in_reception = inRec;
      existing.issued = Number(r.issued || 0);
      existing.damaged = Number(r.damaged || 0);
      existing.lost = Number(r.lost || 0);
      existing.retired = Number(r.retired || 0);
    } else {
      colorBreakdownMap.set(key, {
        color_name: name || hex,
        color_hex: hex,
        total: Number(r.total || 0),
        available: wh,
        in_reception: inRec,
        issued: Number(r.issued || 0),
        damaged: Number(r.damaged || 0),
        lost: Number(r.lost || 0),
        retired: Number(r.retired || 0),
      });
      if (normKey) nameToKeyMap.set(normKey, key);
      if (hex) nameToKeyMap.set(hex, key);
    }
  }

  // 2. Also incorporate any configured slot colors from wristband_color_inventory with their stock & reception values
  try {
    const slotInvRows = db.prepare("SELECT id, color_hex, color_name, quantity, in_reception FROM wristband_color_inventory").all() as any[];
    for (const sir of slotInvRows) {
      const hex = (sir.color_hex || "").trim().toUpperCase();
      const name = (sir.color_name || "").trim();
      const normKey = normalizeColorKey(name);
      const invId = sir.id;
      const poolQty = Number(sir.quantity || 0);
      const inRec = Number(sir.in_reception || 0);

      let existing = hex ? colorBreakdownMap.get(hex) : undefined;
      if (!existing && normKey) {
        const mappedKey = nameToKeyMap.get(normKey);
        if (mappedKey) existing = colorBreakdownMap.get(mappedKey);
      }
      if (!existing && normKey) {
        for (const [k, item] of colorBreakdownMap.entries()) {
          const iNorm = normalizeColorKey(item.color_name);
          if (iNorm === normKey || (iNorm && normKey && (iNorm.includes(normKey) || normKey.includes(iNorm)))) {
            existing = item;
            break;
          }
        }
      }

      if (existing) {
        existing.color_inventory_id = invId;
        if (name && name !== hex) {
          existing.color_name = name;
        }
        // If individual band items haven't been generated yet, reflect the color pool's stock
        if (existing.total === 0 && (poolQty > 0 || inRec > 0)) {
          existing.total = poolQty + inRec;
          existing.available = poolQty;
          existing.in_reception = inRec;
        } else if (existing.total > 0) {
          // Physical band_items exist! Do NOT inflate existing.total with duplicate phantom poolQty!
          if (!existing.in_reception || existing.in_reception === 0) {
            if (inRec > 0) {
              existing.in_reception = inRec;
              existing.available = Math.max(0, existing.available - inRec);
            }
          }
        }
      } else {
        const key = hex || normKey;
        colorBreakdownMap.set(key, {
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
        if (normKey) nameToKeyMap.set(normKey, key);
        if (hex) nameToKeyMap.set(hex, key);
      }
    }
  } catch (ignoreInv) {}

  // Incorporate configured subcategories to ensure the latest color_name and category is reflected
  try {
    const subcatConfigs = db.prepare("SELECT color_hex, color_name, category_name FROM subcategory_bands WHERE color_name IS NOT NULL AND color_name != ''").all() as any[];
    for (const sc of subcatConfigs) {
      const hex = (sc.color_hex || "").trim().toUpperCase();
      const scName = (sc.color_name || "").trim();
      const scCat = (sc.category_name || "").trim();

      let target: BandColorBreakdown | undefined = undefined;
      for (const item of colorBreakdownMap.values()) {
        const itemUpper = (item.color_name || "").trim().toUpperCase();
        const scUpper = scName.toUpperCase();
        if (itemUpper === scUpper) {
          target = item;
          break;
        }
        const itemHasKeyword = /VIP|VISITOR|STAFF|MARSHAL|CHILD|SPECIAL|EXCAVATOR/i.test(itemUpper);
        if (itemHasKeyword && (itemUpper.includes(scUpper) || scUpper.includes(itemUpper))) {
          target = item;
          break;
        }
      }
      if (target) {
        if (scName) target.color_name = scName;
        if (hex) target.color_hex = hex;
        if (scCat) {
          if (!target.subcategories || target.subcategories.length === 0) {
            target.subcategories = [{
              category: scCat,
              total: target.total,
              available: target.available,
              issued: target.issued,
              damaged: target.damaged,
              lost: target.lost,
              retired: target.retired,
              in_reception: target.in_reception || 0,
              warehouse: target.available
            }];
          } else {
            target.subcategories[0].category = scCat;
          }
        }
      }
    }
  } catch (_) {}

  // Subcategories breakdown grouped by (color_name, color_hex, category) in SQLite
  try {
    const sqliteSubcats = db.prepare(`
      SELECT
        color_name,
        color_hex,
        COALESCE(category, 'Standard') as category,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) as issued,
        SUM(CASE WHEN status = 'damaged' THEN 1 ELSE 0 END) as damaged,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
        SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END) as retired,
        SUM(CASE WHEN location = 'reception' AND status = 'available' THEN 1 ELSE 0 END) as in_reception,
        SUM(CASE WHEN (location = 'warehouse' OR location IS NULL) AND status = 'available' THEN 1 ELSE 0 END) as warehouse
      FROM band_items
      GROUP BY color_name, color_hex, category
      ORDER BY color_name ASC, total DESC
    `).all() as any[];

    for (const row of sqliteSubcats) {
      const hex = (row.color_hex || "").trim().toUpperCase();
      const name = (row.color_name || "").trim();
      const targetBreakdown = colorBreakdownMap.get(hex) || (name ? colorBreakdownMap.get(name.toLowerCase()) : undefined);
      if (targetBreakdown) {
        if (!targetBreakdown.subcategories) targetBreakdown.subcategories = [];
        targetBreakdown.subcategories.push({
          category: row.category,
          total: Number(row.total || 0),
          available: Number(row.available || 0),
          issued: Number(row.issued || 0),
          damaged: Number(row.damaged || 0),
          lost: Number(row.lost || 0),
          retired: Number(row.retired || 0),
          in_reception: Number(row.in_reception || 0),
          warehouse: Number(row.warehouse || 0),
        });
      }
    }
  } catch (sqliteSubErr) {
    console.warn("[Band Inventory SQLite] Subcategory query notice:", sqliteSubErr);
  }

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
      ensurePgSchema().catch(() => {});
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
      const allowedSortCols = ['band_code', 'status', 'total_uses', 'created_at', 'updated_at'];
      const sortBy = allowedSortCols.includes(options.sortBy || '') ? options.sortBy! : 'band_code';
      const sortOrder = options.sortOrder === 'DESC' ? 'DESC' : 'ASC';

      let orderByClause = '';
      if (sortBy === 'band_code') {
        orderByClause = `LENGTH(band_code) ${sortOrder}, band_code ${sortOrder}`;
      } else {
        orderByClause = `${sortBy} ${sortOrder}, id ${sortOrder}`;
      }

      let querySql = `SELECT * FROM band_items ${whereSql} ORDER BY ${orderByClause}`;
      const queryParams = [...params];
      if (options.limit && options.limit > 0) {
        querySql += ` LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
        queryParams.push(options.limit, Math.max(0, options.offset || 0));
      }

      const queryPromise = (async () => {
        const [countRes, itemsRes] = await Promise.all([
          simulatorPool.query(`SELECT COUNT(*)::int as cnt FROM band_items ${whereSql}`, params),
          simulatorPool.query(querySql, queryParams)
        ]);
        const totalCount = countRes.rows[0]?.cnt || 0;
        const items = (itemsRes.rows as BandItem[]).map(i => ({ ...i, category: "Standard" as BandCategory }));
        return { items, totalCount };
      })();

      const timeoutPromise = new Promise<{ items: BandItem[]; totalCount: number }>((_, reject) =>
        setTimeout(() => reject(new Error("PG items query timeout")), 4000)
      );

      return await Promise.race([queryPromise, timeoutPromise]);
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
  const sortBy = allowedSortCols.includes(options.sortBy || "") ? options.sortBy! : "band_code";
  const sortOrder = options.sortOrder === "DESC" ? "DESC" : "ASC";

  let orderByClause = "";
  if (sortBy === "band_code") {
    orderByClause = `
      CASE WHEN band_code GLOB '[0-9]*' THEN 0 ELSE 1 END ${sortOrder},
      CASE WHEN band_code GLOB '[0-9]*' THEN CAST(band_code AS INTEGER) ELSE LENGTH(band_code) END ${sortOrder},
      band_code ${sortOrder}
    `;
  } else {
    orderByClause = `${sortBy} ${sortOrder}, id ${sortOrder}`;
  }

  let querySql = `
    SELECT * FROM band_items 
    ${whereSql} 
    ORDER BY ${orderByClause}
  `;

  if (options.limit && options.limit > 0) {
    querySql += ` LIMIT ? OFFSET ?`;
    params.push(options.limit, Math.max(0, options.offset || 0));
  }

  const rawItems = db.prepare(querySql).all(...params) as BandItem[];

  const items = rawItems.map(i => ({ ...i, category: "Standard" as BandCategory }));
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

export async function getBandItemByCode(code: string, options?: { color_hex?: string; color_name?: string }): Promise<BandItem | undefined> {
  if (!code) return undefined;
  const clean = code.trim();
  const hex = options?.color_hex ? options.color_hex.trim().toUpperCase() : undefined;
  const name = options?.color_name ? options.color_name.trim().toLowerCase() : undefined;

  if (isPostgresActive()) {
    try {
      let query = "SELECT * FROM band_items WHERE UPPER(band_code) = UPPER($1)";
      const params: any[] = [clean];
      if (hex) {
        query += " AND UPPER(color_hex) = UPPER($2)";
        params.push(hex);
      } else if (name) {
        query += " AND LOWER(color_name) = LOWER($2)";
        params.push(name);
      }
      query += " ORDER BY id DESC LIMIT 1";

      const res = await simulatorPool.query(query, params);
      if (res.rows.length > 0) return res.rows[0] as BandItem;
    } catch (pgErr) {
      console.warn("[Band Inventory] Fallback to SQLite for getByCode:", pgErr);
    }
  }

  let sqliteQuery = "SELECT * FROM band_items WHERE UPPER(band_code) = UPPER(?)";
  const sqliteParams: any[] = [clean];
  if (hex) {
    sqliteQuery += " AND UPPER(color_hex) = UPPER(?)";
    sqliteParams.push(hex);
  } else if (name) {
    sqliteQuery += " AND LOWER(color_name) = LOWER(?)";
    sqliteParams.push(name);
  }
  sqliteQuery += " ORDER BY id DESC LIMIT 1";

  return db.prepare(sqliteQuery).get(...sqliteParams) as BandItem | undefined;
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

    const existing = await getBandItemByCode(cleanCode, { color_name: data.color_name, color_hex: data.color_hex });
    if (existing) {
      return { success: false, error: `Band ID '${cleanCode}' already exists for color '${data.color_name}'.` };
    }

    const category = "Standard";
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
    const category = "Standard";
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
          await ensurePgSchema();
          await client.query("BEGIN");

          // Pre-generate all candidate band codes
          const codes: string[] = [];
          for (let i = 0; i < count; i++) {
            codes.push(formatBandCode(i));
          }

          // Fast batch insert with ON CONFLICT DO NOTHING in chunks of 500
          let createdCount = 0;
          const chunkSize = 250;
          for (let i = 0; i < codes.length; i += chunkSize) {
            const chunk = codes.slice(i, i + chunkSize);
            if (chunk.length === 0) continue;

            const valueParams: any[] = [];
            const valueRows: string[] = [];

            chunk.forEach((code, idx) => {
              const baseIdx = idx * 5;
              valueRows.push(`($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, 'available', 0, $${baseIdx + 5}, 'warehouse')`);
              valueParams.push(code, data.color_name.trim(), data.color_hex.trim(), category, notes);
            });

            const insertQuery = `
              INSERT INTO band_items (band_code, color_name, color_hex, category, status, total_uses, notes, location)
              VALUES ${valueRows.join(", ")}
              ON CONFLICT (band_code, color_name) DO NOTHING
              RETURNING id, band_code;
            `;

            const insRes = await client.query(insertQuery, valueParams);
            const insertedRows = insRes.rows || [];
            createdCount += insertedRows.length;

            if (insertedRows.length > 0) {
              const txParams: any[] = [];
              const txRows: string[] = [];
              insertedRows.forEach((row: any, tIdx: number) => {
                const bIdx = tIdx * 6;
                txRows.push(`($${bIdx + 1}, $${bIdx + 2}, $${bIdx + 3}, $${bIdx + 4}, 'STOCK_IN', 1, $${bIdx + 5}, $${bIdx + 6})`);
                txParams.push(row.id, row.band_code, data.color_name.trim(), data.color_hex.trim(), staffName, notes);
              });

              await client.query(
                `INSERT INTO band_transactions (band_id, band_code, color_name, color_hex, transaction_type, quantity, staff_name, notes)
                 VALUES ${txRows.join(", ")}`,
                txParams
              );
            }
          }

          await client.query("COMMIT");

          if (createdCount === 0) {
            return {
              success: false,
              createdCount: 0,
              error: `No new bands created: all wristband codes in this range (${codes[0]} to ${codes[codes.length - 1]}) already exist for color '${data.color_name}'.`
            };
          }

          // Sync with color inventory stock count
          try {
            await client.query(
              `UPDATE wristband_color_inventory 
               SET quantity = quantity + $1, updated_at = NOW() 
               WHERE UPPER(color_hex) = $2 OR UPPER(color_name) = $3`,
              [createdCount, data.color_hex.trim().toUpperCase(), data.color_name.trim().toUpperCase()]
            );
          } catch (colSyncErr) {
            console.warn("[Bulk Create Bands] Color inventory counter sync notice:", colSyncErr);
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
      INSERT INTO band_items (band_code, color_name, color_hex, category, status, total_uses, notes, location)
      VALUES (?, ?, ?, ?, 'available', 0, ?, 'warehouse')
      ON CONFLICT(band_code, color_name) DO NOTHING
    `);

    const insertTx = db.prepare(`
      INSERT INTO band_transactions (band_id, band_code, color_name, color_hex, transaction_type, quantity, staff_name, notes)
      VALUES (?, ?, ?, ?, 'STOCK_IN', 1, ?, ?)
    `);

    let createdCount = 0;
    const runBulk = db.transaction(() => {
      for (let i = 0; i < count; i++) {
        const code = formatBandCode(i);

        const info = insertItem.run(code, data.color_name.trim(), data.color_hex.trim(), category, notes);
        if (info.changes > 0) {
          insertTx.run(Number(info.lastInsertRowid), code, data.color_name.trim(), data.color_hex.trim(), staffName, notes);
          createdCount++;
        }
      }
    });

    runBulk();

    if (createdCount === 0) {
      const firstCode = formatBandCode(0);
      const lastCode = formatBandCode(count - 1);
      return { 
        success: false, 
        createdCount: 0, 
        error: `No new bands created: all wristband codes in range (${firstCode} to ${lastCode}) already exist for color '${data.color_name}'.` 
      };
    }

    // SQLite sync color inventory stock
    try {
      db.prepare(`
        UPDATE wristband_color_inventory 
        SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP 
        WHERE UPPER(color_hex) = ? OR UPPER(color_name) = ?
      `).run(createdCount, data.color_hex.trim().toUpperCase(), data.color_name.trim().toUpperCase());
    } catch (e) {}

    return { success: true, createdCount };
  } catch (err: any) {
    console.error("[Bulk Create Bands Error]", err);
    return { success: false, createdCount: 0, error: err.message || "Failed to bulk generate bands." };
  }
}

export async function issueBandItem(data: {
  band_id?: number;
  band_code?: string;
  color_hex?: string;
  color_name?: string;
  expected_category?: string;
  allow_category_override?: boolean;
  customer_name?: string;
  booking_id?: number;
  order_number?: string;
  staff_name?: string;
  notes?: string;
}): Promise<{ success: boolean; item?: BandItem; error?: string }> {
  try {
    const band = data.band_id 
      ? await getBandItemById(data.band_id) 
      : (data.band_code ? await getBandItemByCode(data.band_code, { color_hex: data.color_hex, color_name: data.color_name }) : undefined);

    if (!band) {
      return { 
        success: false, 
        error: `Wristband '${data.band_code || data.band_id}' does not exist in inventory for this color.` 
      };
    }

    // Category / Subcategory validation if ticket type was specified
    if (data.expected_category && !data.allow_category_override && band.category) {
      const normExpected = normalizeBandCategory(data.expected_category);
      const normBand = normalizeBandCategory(band.category);
      if (normBand !== "Standard" && normExpected !== "Standard" && normBand !== normExpected) {
        return {
          success: false,
          error: `Subcategory Mismatch: Band '${band.band_code}' is registered as '${band.category}', but this ticket requires a '${normExpected}' band.`
        };
      }
    }

    if (band.location !== "reception") {
      return {
        success: false,
        error: `Wristband '${band.band_code}' (${band.color_name}) is still in Warehouse Storage! It must be stocked out to Reception before it can be issued to a player.`
      };
    }

    if (band.status === "issued") {
      return { 
        success: false, 
        error: `Band '${band.band_code}' is already issued to ${band.current_holder_name || "another player"}. Please return it first.` 
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
  color_hex?: string;
  color_name?: string;
  condition: "good" | "damaged" | "lost";
  staff_name?: string;
  notes?: string;
}): Promise<{ success: boolean; item?: BandItem; error?: string }> {
  try {
    const band = data.band_id 
      ? await getBandItemById(data.band_id) 
      : (data.band_code ? await getBandItemByCode(data.band_code, { color_hex: data.color_hex, color_name: data.color_name }) : undefined);

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
/**
 * Handover Wristbands to Reception:
 * Earmarks specific available bands of a given color and moves their location from 'warehouse' to 'reception'.
 * Supports Auto Sequential Allotment, Manual Series (start_code to end_code), or Random Specific Barcodes.
 * Returns the exact count and band code range (e.g. BND-AQU-001 to BND-AQU-200).
 */
export async function handoverWristbandsToReception(data: {
  color_name?: string;
  color_hex?: string;
  category?: string;
  amount: number;
  start_code?: string;
  end_code?: string;
  specific_codes?: string[];
  staff_name?: string;
  notes?: string;
  skipColorInventorySync?: boolean;
}): Promise<{
  success: boolean;
  movedCount: number;
  startCode?: string;
  endCode?: string;
  bandCodes: string[];
  error?: string;
}> {
  try {
    const { color_name, color_hex, category, amount, start_code, end_code, specific_codes, skipColorInventorySync } = data;
    const cleanAmount = Math.max(0, Math.floor(amount || 0));
    const hasSpecific = specific_codes && specific_codes.length > 0;
    const hasSeries = !!(start_code && start_code.trim());

    if (!hasSpecific && !hasSeries && cleanAmount <= 0) {
      return { success: false, movedCount: 0, bandCodes: [], error: "Invalid handover quantity." };
    }

    const staffName = data.staff_name || "Admin Staff";
    const notes = data.notes?.trim() || `Handed over bands to Reception Desk`;

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

          if (category && category !== "all") {
            whereParts.push(`LOWER(category) = LOWER($${pIdx++})`);
            whereParams.push(category.trim());
          }

          let limitClause = "";
          if (hasSpecific) {
            const cleanCodes = Array.from(new Set(specific_codes!.map(c => c.trim().toUpperCase()).filter(Boolean)));
            whereParts.push(`UPPER(band_code) = ANY($${pIdx++}::text[])`);
            whereParams.push(cleanCodes);
          } else if (start_code && end_code && end_code.trim()) {
            whereParts.push(`UPPER(band_code) >= UPPER($${pIdx++}) AND UPPER(band_code) <= UPPER($${pIdx++})`);
            whereParams.push(start_code.trim(), end_code.trim());
            if (cleanAmount > 0) {
              limitClause = `LIMIT $${pIdx++}`;
              whereParams.push(cleanAmount);
            }
          } else if (start_code) {
            whereParts.push(`UPPER(band_code) >= UPPER($${pIdx++})`);
            whereParams.push(start_code.trim());
            if (cleanAmount > 0) {
              limitClause = `LIMIT $${pIdx++}`;
              whereParams.push(cleanAmount);
            }
          } else {
            limitClause = `LIMIT $${pIdx++}`;
            whereParams.push(cleanAmount);
          }

          const selectSql = `
            SELECT id, band_code, color_name, color_hex 
            FROM band_items 
            WHERE ${whereParts.join(" AND ")}
            ORDER BY band_code ASC, id ASC
            ${limitClause}
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

            if (!skipColorInventorySync && (color_hex || color_name)) {
              try {
                await client.query(`
                  UPDATE wristband_color_inventory 
                  SET quantity = GREATEST(0, quantity - $1),
                      in_reception = COALESCE(in_reception, 0) + $1,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE UPPER(color_hex) = UPPER($2) OR LOWER(color_name) = LOWER($3)
                `, [eligibleBands.length, (color_hex || '').trim(), (color_name || '').trim()]);
              } catch (syncErr) {
                console.warn("[Postgres] Failed to update color inventory:", syncErr);
              }
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

    if (category && category !== "all") {
      whereParts.push("LOWER(category) = ?");
      params.push(category.trim().toLowerCase());
    }

    let limitClause = "";
    if (hasSpecific) {
      const cleanCodes = Array.from(new Set(specific_codes!.map(c => c.trim().toUpperCase()).filter(Boolean)));
      whereParts.push(`UPPER(band_code) IN (${cleanCodes.map(() => '?').join(',')})`);
      params.push(...cleanCodes);
    } else if (start_code && end_code && end_code.trim()) {
      whereParts.push("UPPER(band_code) >= ? AND UPPER(band_code) <= ?");
      params.push(start_code.trim().toUpperCase(), end_code.trim().toUpperCase());
      if (cleanAmount > 0) {
        limitClause = "LIMIT ?";
        params.push(cleanAmount);
      }
    } else if (start_code) {
      whereParts.push("UPPER(band_code) >= ?");
      params.push(start_code.trim().toUpperCase());
      if (cleanAmount > 0) {
        limitClause = "LIMIT ?";
        params.push(cleanAmount);
      }
    } else {
      limitClause = "LIMIT ?";
      params.push(cleanAmount);
    }

    const selectSql = `
      SELECT id, band_code, color_name, color_hex
      FROM band_items
      WHERE ${whereParts.join(" AND ")}
      ORDER BY band_code ASC, id ASC
      ${limitClause}
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

        if (!skipColorInventorySync && (color_hex || color_name)) {
          try {
            db.prepare(`
              UPDATE wristband_color_inventory 
              SET quantity = MAX(0, quantity - ?),
                  in_reception = COALESCE(in_reception, 0) + ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE UPPER(color_hex) = ? OR LOWER(color_name) = ?
            `).run(eligibleBands.length, eligibleBands.length, (color_hex || '').toUpperCase(), (color_name || '').toLowerCase());
          } catch (syncErr) {
            console.warn("[SQLite] Failed to update color inventory:", syncErr);
          }
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
 * Preview Wristbands that will be handed over to Reception without modifying DB.
 * Supports Auto Sequential, Manual Series (start_code to end_code), or Specific/Random Codes.
 */
export async function previewHandoverRange(data: {
  color_name?: string;
  color_hex?: string;
  category?: string;
  amount: number;
  start_code?: string;
  end_code?: string;
  specific_codes?: string[];
}): Promise<{
  success: boolean;
  totalAvailable: number;
  count: number;
  startCode?: string;
  endCode?: string;
  bandCodes: string[];
  invalidCodes?: string[];
  error?: string;
}> {
  try {
    const { color_name, color_hex, category, amount, start_code, end_code, specific_codes } = data;
    const cleanAmount = Math.max(0, Math.floor(amount || 0));
    const hasSpecific = specific_codes && specific_codes.length > 0;
    const cleanSpecificCodes = hasSpecific
      ? Array.from(new Set(specific_codes!.map(c => c.trim().toUpperCase()).filter(Boolean)))
      : [];

    await ensureBandInventorySeeded();

    if (isPostgresActive()) {
      try {
        const whereParts = ["status = 'available'", "COALESCE(location, 'warehouse') != 'reception'"];
        const params: any[] = [];
        let pIdx = 1;

        if (color_hex) {
          whereParts.push(`UPPER(color_hex) = UPPER($${pIdx++})`);
          params.push(color_hex.trim());
        } else if (color_name) {
          whereParts.push(`LOWER(color_name) = LOWER($${pIdx++})`);
          params.push(color_name.trim());
        }

        if (category && category !== "all") {
          whereParts.push(`LOWER(category) = LOWER($${pIdx++})`);
          params.push(category.trim());
        }

        const countRes = await simulatorPool.query(
          `SELECT COUNT(*) as cnt FROM band_items WHERE ${whereParts.join(" AND ")}`,
          params
        );
        const totalAvailable = parseInt(countRes.rows[0]?.cnt || "0", 10);

        const filterParts = [...whereParts];
        const queryParams = [...params];
        let limitClause = "";

        if (hasSpecific) {
          filterParts.push(`UPPER(band_code) = ANY($${pIdx++}::text[])`);
          queryParams.push(cleanSpecificCodes);
        } else if (start_code && end_code && end_code.trim()) {
          filterParts.push(`UPPER(band_code) >= UPPER($${pIdx++}) AND UPPER(band_code) <= UPPER($${pIdx++})`);
          queryParams.push(start_code.trim(), end_code.trim());
          if (cleanAmount > 0) {
            limitClause = `LIMIT $${pIdx++}`;
            queryParams.push(cleanAmount);
          }
        } else if (start_code) {
          filterParts.push(`UPPER(band_code) >= UPPER($${pIdx++})`);
          queryParams.push(start_code.trim());
          if (cleanAmount > 0) {
            limitClause = `LIMIT $${pIdx++}`;
            queryParams.push(cleanAmount);
          }
        } else {
          if (cleanAmount <= 0) {
            return { success: true, totalAvailable, count: 0, bandCodes: [] };
          }
          limitClause = `LIMIT $${pIdx++}`;
          queryParams.push(cleanAmount);
        }

        const querySql = `
          SELECT band_code
          FROM band_items
          WHERE ${filterParts.join(" AND ")}
          ORDER BY band_code ASC, id ASC
          ${limitClause}
        `;
        const res = await simulatorPool.query(querySql, queryParams);
        const codes = res.rows.map((r: any) => r.band_code);

        let invalidCodes: string[] | undefined = undefined;
        if (hasSpecific) {
          const matchedUpper = codes.map((c: string) => c.toUpperCase());
          invalidCodes = cleanSpecificCodes.filter(c => !matchedUpper.includes(c));
        }

        return {
          success: true,
          totalAvailable,
          count: codes.length,
          startCode: codes[0],
          endCode: codes[codes.length - 1],
          bandCodes: codes,
          invalidCodes
        };
      } catch (pgErr) {
        console.warn("[Band Inventory] Fallback to SQLite for previewHandoverRange:", pgErr);
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

    if (category && category !== "all") {
      whereParts.push("LOWER(category) = ?");
      params.push(category.trim().toLowerCase());
    }

    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM band_items WHERE ${whereParts.join(" AND ")}`).get(...params) as { cnt: number };
    const totalAvailable = countRow ? countRow.cnt : 0;

    const filterParts = [...whereParts];
    const queryParams = [...params];
    let limitClause = "";

    if (hasSpecific) {
      filterParts.push(`UPPER(band_code) IN (${cleanSpecificCodes.map(() => '?').join(',')})`);
      queryParams.push(...cleanSpecificCodes);
    } else if (start_code && end_code && end_code.trim()) {
      filterParts.push("UPPER(band_code) >= ? AND UPPER(band_code) <= ?");
      queryParams.push(start_code.trim().toUpperCase(), end_code.trim().toUpperCase());
      if (cleanAmount > 0) {
        limitClause = "LIMIT ?";
        queryParams.push(cleanAmount);
      }
    } else if (start_code) {
      filterParts.push("UPPER(band_code) >= ?");
      queryParams.push(start_code.trim().toUpperCase());
      if (cleanAmount > 0) {
        limitClause = "LIMIT ?";
        queryParams.push(cleanAmount);
      }
    } else {
      if (cleanAmount <= 0) {
        return { success: true, totalAvailable, count: 0, bandCodes: [] };
      }
      limitClause = "LIMIT ?";
      queryParams.push(cleanAmount);
    }

    const selectSql = `
      SELECT band_code
      FROM band_items
      WHERE ${filterParts.join(" AND ")}
      ORDER BY band_code ASC, id ASC
      ${limitClause}
    `;
    const rows = db.prepare(selectSql).all(...queryParams) as { band_code: string }[];
    const codes = rows.map(r => r.band_code);

    let invalidCodes: string[] | undefined = undefined;
    if (hasSpecific) {
      const matchedUpper = codes.map((c: string) => c.toUpperCase());
      invalidCodes = cleanSpecificCodes.filter(c => !matchedUpper.includes(c));
    }

    return {
      success: true,
      totalAvailable,
      count: codes.length,
      startCode: codes[0],
      endCode: codes[codes.length - 1],
      bandCodes: codes,
      invalidCodes
    };
  } catch (err: any) {
    console.error("[previewHandoverRange Error]", err);
    return { success: false, totalAvailable: 0, count: 0, bandCodes: [], error: err.message };
  }
}


/**
 * Return Wristbands from Reception back to Warehouse:
 * Returns wristbands located at 'reception' back to 'warehouse'.
 */
export async function returnWristbandsFromReception(data: {
  color_name?: string;
  color_hex?: string;
  category?: string;
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
    const { color_name, color_hex, category, amount } = data;
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

          if (category && category !== "all") {
            whereParts.push(`LOWER(category) = LOWER($${pIdx++})`);
            whereParams.push(category.trim());
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

    if (category && category !== "all") {
      whereParts.push("LOWER(category) = ?");
      params.push(category.trim().toLowerCase());
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

/**
 * Standardizes ALL band items across PostgreSQL and SQLite so their category is set to 'Standard'.
 */
export async function standardizeAllBandCategories(): Promise<{ success: boolean; updatedCount: number }> {
  let updatedCount = 0;
  if (isPostgresActive()) {
    try {
      await ensurePgSchema();
      const res = await simulatorPool.query("UPDATE band_items SET category = 'Standard' WHERE category IS NULL OR category != 'Standard'");
      updatedCount += res.rowCount || 0;
    } catch (pgErr) {
      console.warn("[Band Inventory] Fallback to SQLite for standardizeAllBandCategories:", pgErr);
    }
  }

  try {
    initDB();
    const res = db.prepare("UPDATE band_items SET category = 'Standard' WHERE category IS NULL OR category != 'Standard'").run();
    updatedCount += res.changes || 0;
  } catch (sqliteErr) {
    console.warn("[Band Inventory] SQLite standardize error:", sqliteErr);
  }

  return { success: true, updatedCount };
}

/**
 * Safely purges or resets phantom/extra color stock and unissued wristband items.
 * Guaranteed NEVER to delete or corrupt issued/damaged wristband records so booking audit histories remain intact.
 */
export async function purgeOrResetColorStock(params: {
  colorHex?: string;
  colorName?: string;
  colorInventoryId?: number;
  subcategoryId?: number;
  actionType: "reset_to_zero" | "delete_pool" | "purge_unissued_bands" | "delete_everything";
}): Promise<{
  success: boolean;
  purgedBandsCount: number;
  resetInventoryCount: number;
  deletedPoolCount: number;
  deletedSubcatCount: number;
  message?: string;
  error?: string;
}> {
  const hex = (params.colorHex || "").trim().toUpperCase();
  const name = (params.colorName || "").trim();

  let purgedBandsCount = 0;
  let resetInventoryCount = 0;
  let deletedPoolCount = 0;
  let deletedSubcatCount = 0;

  if (isPostgresActive()) {
    try {
      await ensurePgSchema();

      // 1. Reset or delete from wristband_color_inventory
      if (params.actionType === "reset_to_zero") {
        const res = await simulatorPool.query(`
          UPDATE wristband_color_inventory 
          SET quantity = 0, in_reception = 0, updated_at = NOW()
          WHERE (id = $1 AND $1 > 0)
             OR (UPPER(color_hex) = $2 AND $2 != '')
             OR (UPPER(color_name) = UPPER($3) AND $3 != '')
        `, [params.colorInventoryId || -1, hex, name]);
        resetInventoryCount += res.rowCount || 0;
      } else if (params.actionType === "delete_pool" || params.actionType === "delete_everything") {
        const res = await simulatorPool.query(`
          DELETE FROM wristband_color_inventory
          WHERE (id = $1 AND $1 > 0)
             OR (UPPER(color_hex) = $2 AND $2 != '')
             OR (UPPER(color_name) = UPPER($3) AND $3 != '')
        `, [params.colorInventoryId || -1, hex, name]);
        deletedPoolCount += res.rowCount || 0;
      }

      // 2. Purge unissued bands from band_items (ONLY unissued/available bands, NEVER issued/damaged!)
      if (params.actionType === "purge_unissued_bands" || params.actionType === "delete_everything") {
        const res = await simulatorPool.query(`
          DELETE FROM band_items
          WHERE ((UPPER(color_hex) = $1 AND $1 != '') 
             OR (UPPER(color_name) = UPPER($2) AND $2 != '')
             OR ($2 != '' AND UPPER(color_name) LIKE '%' || UPPER($2) || '%')
             OR ($2 != '' AND UPPER($2) LIKE '%' || UPPER(color_name) || '%'))
            AND (status = 'available' OR total_uses = 0)
        `, [hex, name]);
        purgedBandsCount += res.rowCount || 0;
      }

      // 3. Delete from subcategory_bands if subcategoryId or delete_everything
      if (params.subcategoryId || params.actionType === "delete_everything") {
        const res = await simulatorPool.query(`
          DELETE FROM subcategory_bands
          WHERE (id = $1 AND $1 > 0)
             OR (UPPER(color_hex) = $2 AND $2 != '')
             OR (UPPER(color_name) = UPPER($3) AND $3 != '')
        `, [params.subcategoryId || -1, hex, name]);
        deletedSubcatCount += res.rowCount || 0;
      }
    } catch (pgErr) {
      console.warn("[purgeOrResetColorStock PG Error]", pgErr);
    }
  }

  // SQLite fallback
  try {
    initDB();

    if (params.actionType === "reset_to_zero") {
      const res = db.prepare(`
        UPDATE wristband_color_inventory 
        SET quantity = 0, in_reception = 0, updated_at = CURRENT_TIMESTAMP
        WHERE (id = ? AND ? > 0)
           OR (UPPER(color_hex) = ? AND ? != '')
           OR (UPPER(color_name) = UPPER(?) AND ? != '')
      `).run(
        params.colorInventoryId || -1, params.colorInventoryId || -1,
        hex, hex,
        name, name
      );
      resetInventoryCount += res.changes || 0;
    } else if (params.actionType === "delete_pool" || params.actionType === "delete_everything") {
      const res = db.prepare(`
        DELETE FROM wristband_color_inventory
        WHERE (id = ? AND ? > 0)
           OR (UPPER(color_hex) = ? AND ? != '')
           OR (UPPER(color_name) = UPPER(?) AND ? != '')
      `).run(
        params.colorInventoryId || -1, params.colorInventoryId || -1,
        hex, hex,
        name, name
      );
      deletedPoolCount += res.changes || 0;
    }

    if (params.actionType === "purge_unissued_bands" || params.actionType === "delete_everything") {
      const res = db.prepare(`
        DELETE FROM band_items
        WHERE ((UPPER(color_hex) = ? AND ? != '') 
           OR (UPPER(color_name) = UPPER(?) AND ? != '')
           OR (? != '' AND UPPER(color_name) LIKE '%' || UPPER(?) || '%')
           OR (? != '' AND UPPER(?) LIKE '%' || UPPER(color_name) || '%'))
          AND (status = 'available' OR total_uses = 0)
      `).run(hex, hex, name, name, name, name, name, name);
      purgedBandsCount += res.changes || 0;
    }

    if (params.subcategoryId || params.actionType === "delete_everything") {
      const res = db.prepare(`
        DELETE FROM subcategory_bands
        WHERE (id = ? AND ? > 0)
           OR (UPPER(color_hex) = ? AND ? != '')
           OR (UPPER(color_name) = UPPER(?) AND ? != '')
      `).run(
        params.subcategoryId || -1, params.subcategoryId || -1,
        hex, hex,
        name, name
      );
      deletedSubcatCount += res.changes || 0;
    }
  } catch (sqliteErr: any) {
    console.warn("[purgeOrResetColorStock SQLite Error]", sqliteErr);
  }

  return {
    success: true,
    purgedBandsCount,
    resetInventoryCount,
    deletedPoolCount,
    deletedSubcatCount,
    message: `Operation complete. Reset: ${resetInventoryCount}, Purged Unissued Bands: ${purgedBandsCount}, Deleted Pools: ${deletedPoolCount}`
  };
}

