import { simulatorPool } from "./simulator-db";
import { initDB, db } from "./db";
import { getSlotWristbandColor } from "./slotColors";

export interface WristbandColorInventoryItem {
  id: number;
  color_hex: string;
  color_name: string;
  quantity: number;
  in_reception?: number;
  slot_labels: string[]; // labels of currently assigned slots (e.g. ["11AM-12PM", "9"])
  is_active_in_slots: boolean;
  created_at?: string;
  updated_at?: string;
}

let colorInventorySchemaInitialized = false;

/**
 * Ensures the wristband_color_inventory table exists in PostgreSQL and SQLite fallback
 */
export async function ensureColorInventorySchema(): Promise<void> {
  // 1. PostgreSQL Schema
  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);
  if (hasPg && !colorInventorySchemaInitialized) {
    try {
      await simulatorPool.query(`
        CREATE TABLE IF NOT EXISTS wristband_color_inventory (
          id SERIAL PRIMARY KEY,
          color_hex VARCHAR(50) NOT NULL UNIQUE,
          color_name VARCHAR(100) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
          in_reception INTEGER NOT NULL DEFAULT 0 CHECK (in_reception >= 0),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_wci_color_hex ON wristband_color_inventory(color_hex);
        CREATE INDEX IF NOT EXISTS idx_wci_color_name ON wristband_color_inventory(color_name);
      `);

      // Add in_reception column if table already existed without it
      try {
        await simulatorPool.query(`
          ALTER TABLE wristband_color_inventory ADD COLUMN IF NOT EXISTS in_reception INTEGER NOT NULL DEFAULT 0;
        `);
      } catch (colErr) {}

      colorInventorySchemaInitialized = true;
    } catch (pgErr) {
      console.warn("[Color Inventory] PostgreSQL schema init notice:", pgErr);
    }
  }

  // 2. SQLite local fallback schema
  try {
    initDB();
    db.exec(`
      CREATE TABLE IF NOT EXISTS wristband_color_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        color_hex TEXT NOT NULL UNIQUE,
        color_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        in_reception INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add in_reception column if missing
    try {
      db.exec(`ALTER TABLE wristband_color_inventory ADD COLUMN in_reception INTEGER NOT NULL DEFAULT 0;`);
    } catch (sqliteColErr) {}
  } catch (sqliteErr) {
    console.warn("[Color Inventory] SQLite schema init notice:", sqliteErr);
  }
}

/**
 * Returns distinct colors defined in active time_slots
 */
export function getDistinctSlotColors(): Array<{ hex: string; name: string; slotLabels: string[] }> {
  initDB();
  const rows = db.prepare(`
    SELECT label, color, color_name 
    FROM time_slots 
    WHERE active = 1 
    ORDER BY sort_order ASC, start_hour ASC
  `).all() as any[];

  const map = new Map<string, { hex: string; name: string; slotLabels: string[] }>();

  for (const row of rows) {
    const resolved = getSlotWristbandColor(row.label, row.color, row.color_name);
    const hex = (resolved.hex || '').trim().toUpperCase();
    if (!hex) continue;

    if (!map.has(hex)) {
      map.set(hex, {
        hex,
        name: resolved.name || hex,
        slotLabels: [row.label]
      });
    } else {
      const entry = map.get(hex)!;
      if (!entry.slotLabels.includes(row.label)) {
        entry.slotLabels.push(row.label);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Get all inventory records with live slot mapping
 */
export async function getColorInventory(): Promise<WristbandColorInventoryItem[]> {
  await ensureColorInventorySchema();

  const slotColors = getDistinctSlotColors();
  const slotColorMap = new Map<string, { name: string; slotLabels: string[] }>();
  slotColors.forEach(sc => slotColorMap.set(sc.hex.toUpperCase(), sc));

  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);

  if (hasPg) {
    try {
      const res = await simulatorPool.query(`
        SELECT id, color_hex, color_name, quantity, in_reception, created_at, updated_at
        FROM wristband_color_inventory
        ORDER BY color_name ASC, color_hex ASC
      `);

      return res.rows.map(r => {
        const hex = (r.color_hex || '').trim().toUpperCase();
        const activeSlotInfo = slotColorMap.get(hex);
        return {
          id: r.id,
          color_hex: hex,
          color_name: r.color_name,
          quantity: Number(r.quantity || 0),
          in_reception: Number(r.in_reception || 0),
          slot_labels: activeSlotInfo ? activeSlotInfo.slotLabels : [],
          is_active_in_slots: Boolean(activeSlotInfo),
          created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
          updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined
        };
      });
    } catch (pgErr) {
      console.warn("[Color Inventory] PG query error, falling back to SQLite:", pgErr);
    }
  }

  // SQLite fallback
  initDB();
  const sqliteRows = db.prepare(`
    SELECT id, color_hex, color_name, quantity, in_reception, created_at, updated_at
    FROM wristband_color_inventory
    ORDER BY color_name ASC, color_hex ASC
  `).all() as any[];

  return sqliteRows.map(r => {
    const hex = (r.color_hex || '').trim().toUpperCase();
    const activeSlotInfo = slotColorMap.get(hex);
    return {
      id: r.id,
      color_hex: hex,
      color_name: r.color_name,
      quantity: Number(r.quantity || 0),
      in_reception: Number(r.in_reception || 0),
      slot_labels: activeSlotInfo ? activeSlotInfo.slotLabels : [],
      is_active_in_slots: Boolean(activeSlotInfo),
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  });
}

/**
 * Manual Synchronization:
 * 1. Reads current wristband colours from existing Slots configuration.
 * 2. Compares with inventory records already present in PostgreSQL.
 * 3. Identifies colours that do not yet have inventory records.
 * 4. Creates inventory records ONLY for those missing colours with default quantity = 0.
 * 5. Leaves all existing inventory records, quantities, and stock untouched.
 * 6. Returns a summary of new records added.
 */
export async function syncColorInventoryFromSlots(): Promise<{
  success: boolean;
  addedCount: number;
  addedColors: string[];
  alreadyExistingCount: number;
  message: string;
}> {
  await ensureColorInventorySchema();

  const slotColors = getDistinctSlotColors();
  if (slotColors.length === 0) {
    return {
      success: true,
      addedCount: 0,
      addedColors: [],
      alreadyExistingCount: 0,
      message: "No active slot colours found to synchronize."
    };
  }

  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);
  const addedColors: string[] = [];
  let alreadyExistingCount = 0;

  if (hasPg) {
    try {
      const client = await simulatorPool.connect();
      try {
        await client.query("BEGIN");

        // Fetch existing inventory hexes in PG
        const existingRes = await client.query("SELECT UPPER(color_hex) as hex FROM wristband_color_inventory");
        const existingHexSet = new Set(existingRes.rows.map(r => r.hex));

        for (const sc of slotColors) {
          const hex = sc.hex.toUpperCase();
          if (existingHexSet.has(hex)) {
            alreadyExistingCount++;
            continue;
          }

          // Insert with quantity = 0, ON CONFLICT DO NOTHING to strictly prevent duplicate or overwrite
          const insRes = await client.query(`
            INSERT INTO wristband_color_inventory (color_hex, color_name, quantity, created_at, updated_at)
            VALUES ($1, $2, 0, NOW(), NOW())
            ON CONFLICT (color_hex) DO NOTHING
            RETURNING id
          `, [hex, sc.name]);

          if (insRes.rows.length > 0) {
            addedColors.push(sc.name);
          } else {
            alreadyExistingCount++;
          }
        }

        await client.query("COMMIT");
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (pgErr) {
      console.warn("[Color Inventory] Postgres sync failed, running SQLite sync:", pgErr);
      // Also sync to SQLite below
    }
  }

  // Also safely sync to local SQLite so offline/dev remains consistent
  initDB();
  const existingSqlite = db.prepare("SELECT UPPER(color_hex) as hex FROM wristband_color_inventory").all() as any[];
  const sqliteHexSet = new Set(existingSqlite.map(r => r.hex));

  const insertSqlite = db.prepare(`
    INSERT OR IGNORE INTO wristband_color_inventory (color_hex, color_name, quantity, created_at, updated_at)
    VALUES (?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  for (const sc of slotColors) {
    const hex = sc.hex.toUpperCase();
    if (!sqliteHexSet.has(hex)) {
      insertSqlite.run(hex, sc.name);
      if (!hasPg && !addedColors.includes(sc.name)) {
        addedColors.push(sc.name);
      }
    } else if (!hasPg) {
      alreadyExistingCount++;
    }
  }

  const addedCount = addedColors.length;
  const message = addedCount === 0
    ? "Inventory is already up to date. No new records were added."
    : `Successfully synchronized ${addedCount} new colour record${addedCount > 1 ? 's' : ''} with quantity 0 (${addedColors.join(", ")}). Existing records remained untouched.`;

  return {
    success: true,
    addedCount,
    addedColors,
    alreadyExistingCount,
    message
  };
}

/**
 * Manually update quantity for a color inventory record in PostgreSQL.
 * Allows setting an absolute quantity or adding stock (+N).
 */
export async function updateColorStock(params: {
  id: number;
  newQuantity?: number;
  addAmount?: number;
}): Promise<{ success: boolean; item?: WristbandColorInventoryItem; error?: string }> {
  await ensureColorInventorySchema();
  const { id, newQuantity, addAmount } = params;

  if (typeof newQuantity !== 'number' && typeof addAmount !== 'number') {
    return { success: false, error: "Either newQuantity or addAmount must be provided." };
  }

  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);

  if (hasPg) {
    try {
      let query: string;
      let values: any[];

      if (typeof newQuantity === 'number') {
        const cleanQty = Math.max(0, Math.floor(newQuantity));
        query = `
          UPDATE wristband_color_inventory
          SET quantity = $1, updated_at = NOW()
          WHERE id = $2
          RETURNING id, color_hex, color_name, quantity, created_at, updated_at
        `;
        values = [cleanQty, id];
      } else {
        const cleanAdd = Math.floor(addAmount!);
        query = `
          UPDATE wristband_color_inventory
          SET quantity = GREATEST(0, quantity + $1), updated_at = NOW()
          WHERE id = $2
          RETURNING id, color_hex, color_name, quantity, created_at, updated_at
        `;
        values = [cleanAdd, id];
      }

      const res = await simulatorPool.query(query, values);
      if (res.rows.length === 0) {
        return { success: false, error: "Inventory record not found in PostgreSQL." };
      }

      const row = res.rows[0];

      // Mirror update in SQLite
      try {
        initDB();
        db.prepare("UPDATE wristband_color_inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE color_hex = ?")
          .run(row.quantity, row.color_hex);
      } catch (e) {}

      return {
        success: true,
        item: {
          id: row.id,
          color_hex: row.color_hex,
          color_name: row.color_name,
          quantity: Number(row.quantity),
          slot_labels: [],
          is_active_in_slots: true
        }
      };
    } catch (pgErr: any) {
      console.warn("[Color Inventory] PG update error, trying SQLite fallback:", pgErr);
    }
  }

  // SQLite fallback
  try {
    initDB();
    const current = db.prepare("SELECT * FROM wristband_color_inventory WHERE id = ?").get(id) as any;
    if (!current) {
      return { success: false, error: "Inventory record not found." };
    }

    let finalQty = current.quantity;
    if (typeof newQuantity === 'number') {
      finalQty = Math.max(0, Math.floor(newQuantity));
    } else if (typeof addAmount === 'number') {
      finalQty = Math.max(0, current.quantity + Math.floor(addAmount));
    }

    db.prepare("UPDATE wristband_color_inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(finalQty, id);

    return {
      success: true,
      item: {
        id: current.id,
        color_hex: current.color_hex,
        color_name: current.color_name,
        quantity: finalQty,
        slot_labels: [],
        is_active_in_slots: true
      }
    };
  } catch (sqliteErr: any) {
    return { success: false, error: sqliteErr.message || "Failed to update stock" };
  }
}

/**
 * Stock Out to Reception:
 * Transfers wristbands from main warehouse stock (quantity) to Front Desk / Reception (in_reception).
 * Both stock quantity and reception counters are tracked accurately, and physical band items are tagged as 'reception'.
 */
export async function stockOutColorToReception(params: {
  id: number;
  amount: number;
  notes?: string;
  staffName?: string;
}): Promise<{
  success: boolean;
  item?: WristbandColorInventoryItem;
  startCode?: string;
  endCode?: string;
  movedBandsCount?: number;
  error?: string;
}> {
  const { id, amount, notes, staffName } = params;
  if (!id || typeof amount !== 'number' || amount <= 0) {
    return { success: false, error: "Please provide a valid stock out quantity." };
  }

  await ensureColorInventorySchema();
  const cleanAmount = Math.floor(amount);
  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);

  let targetColorHex = "";
  let targetColorName = "";
  let updatedItem: WristbandColorInventoryItem | undefined;

  if (hasPg) {
    try {
      // Check current quantity first
      const checkRes = await simulatorPool.query("SELECT quantity, in_reception, color_hex, color_name FROM wristband_color_inventory WHERE id = $1", [id]);
      if (checkRes.rows.length === 0) {
        return { success: false, error: "Inventory record not found." };
      }
      targetColorHex = checkRes.rows[0].color_hex;
      targetColorName = checkRes.rows[0].color_name;

      const res = await simulatorPool.query(`
        UPDATE wristband_color_inventory
        SET quantity = GREATEST(0, quantity - $1),
            in_reception = in_reception + $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, color_hex, color_name, quantity, in_reception, created_at, updated_at
      `, [cleanAmount, id]);

      const row = res.rows[0];

      // Mirror to SQLite
      try {
        initDB();
        db.prepare(`
          UPDATE wristband_color_inventory 
          SET quantity = ?, in_reception = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE color_hex = ?
        `).run(row.quantity, row.in_reception, row.color_hex);
      } catch (e) {}

      updatedItem = {
        id: row.id,
        color_hex: row.color_hex,
        color_name: row.color_name,
        quantity: Number(row.quantity),
        in_reception: Number(row.in_reception),
        slot_labels: [],
        is_active_in_slots: true
      };
    } catch (pgErr: any) {
      console.warn("[Color Inventory] PG stock out error, falling back to SQLite:", pgErr);
    }
  }

  // SQLite fallback if not set
  if (!updatedItem) {
    try {
      initDB();
      const current = db.prepare("SELECT * FROM wristband_color_inventory WHERE id = ?").get(id) as any;
      if (!current) {
        return { success: false, error: "Inventory record not found." };
      }
      targetColorHex = current.color_hex;
      targetColorName = current.color_name;

      const newQty = Math.max(0, (current.quantity || 0) - cleanAmount);
      const newReception = (current.in_reception || 0) + cleanAmount;

      db.prepare(`
        UPDATE wristband_color_inventory 
        SET quantity = ?, in_reception = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newQty, newReception, id);

      updatedItem = {
        id: current.id,
        color_hex: current.color_hex,
        color_name: current.color_name,
        quantity: newQty,
        in_reception: newReception,
        slot_labels: [],
        is_active_in_slots: true
      };
    } catch (sqliteErr: any) {
      return { success: false, error: sqliteErr.message || "Failed to stock out to reception." };
    }
  }

  // Also move actual band items in catalog from warehouse -> reception
  let startCode: string | undefined;
  let endCode: string | undefined;
  let movedBandsCount = 0;

  try {
    // Dynamic import to prevent circular references
    const { handoverWristbandsToReception } = await import("./band-inventory-db");
    const handoverRes = await handoverWristbandsToReception({
      color_hex: targetColorHex,
      color_name: targetColorName,
      amount: cleanAmount,
      staff_name: staffName || "Admin Staff",
      notes: notes || `Stock Out Handover of ${cleanAmount} bands to Reception`
    });

    if (handoverRes.success && handoverRes.movedCount > 0) {
      startCode = handoverRes.startCode;
      endCode = handoverRes.endCode;
      movedBandsCount = handoverRes.movedCount;
    }
  } catch (err) {
    console.warn("[stockOutColorToReception] Could not earmark individual band items:", err);
  }

  return {
    success: true,
    item: updatedItem,
    startCode,
    endCode,
    movedBandsCount
  };
}

/**
 * Return from Reception back to Main Stock (if excess bands returned to storage)
 */
export async function returnColorFromReception(params: {
  id: number;
  amount: number;
}): Promise<{
  success: boolean;
  item?: WristbandColorInventoryItem;
  error?: string;
}> {
  const { id, amount } = params;
  if (!id || typeof amount !== 'number' || amount <= 0) {
    return { success: false, error: "Please provide a valid return quantity." };
  }

  await ensureColorInventorySchema();
  const cleanAmount = Math.floor(amount);
  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);

  let targetColorHex = "";
  let targetColorName = "";
  let updatedItem: WristbandColorInventoryItem | undefined;

  if (hasPg) {
    try {
      const checkRes = await simulatorPool.query("SELECT quantity, in_reception, color_hex, color_name FROM wristband_color_inventory WHERE id = $1", [id]);
      if (checkRes.rows.length === 0) {
        return { success: false, error: "Inventory record not found." };
      }
      const cur = checkRes.rows[0];
      targetColorHex = cur.color_hex;
      targetColorName = cur.color_name;

      if ((cur.in_reception || 0) < cleanAmount) {
        return { success: false, error: `Cannot return ${cleanAmount} bands. Reception only has ${cur.in_reception || 0} bands recorded.` };
      }

      const res = await simulatorPool.query(`
        UPDATE wristband_color_inventory
        SET quantity = quantity + $1,
            in_reception = in_reception - $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, color_hex, color_name, quantity, in_reception, created_at, updated_at
      `, [cleanAmount, id]);

      const row = res.rows[0];
      try {
        initDB();
        db.prepare(`
          UPDATE wristband_color_inventory 
          SET quantity = ?, in_reception = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE color_hex = ?
        `).run(row.quantity, row.in_reception, row.color_hex);
      } catch (e) {}

      updatedItem = {
        id: row.id,
        color_hex: row.color_hex,
        color_name: row.color_name,
        quantity: Number(row.quantity),
        in_reception: Number(row.in_reception),
        slot_labels: [],
        is_active_in_slots: true
      };
    } catch (pgErr: any) {
      console.warn("[Color Inventory] PG return from reception error:", pgErr);
    }
  }

  if (!updatedItem) {
    try {
      initDB();
      const current = db.prepare("SELECT * FROM wristband_color_inventory WHERE id = ?").get(id) as any;
      if (!current) {
        return { success: false, error: "Inventory record not found." };
      }
      targetColorHex = current.color_hex;
      targetColorName = current.color_name;

      if ((current.in_reception || 0) < cleanAmount) {
        return { success: false, error: `Cannot return ${cleanAmount} bands. Reception only has ${current.in_reception || 0} bands recorded.` };
      }

      const newQty = current.quantity + cleanAmount;
      const newReception = (current.in_reception || 0) - cleanAmount;

      db.prepare(`
        UPDATE wristband_color_inventory 
        SET quantity = ?, in_reception = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newQty, newReception, id);

      updatedItem = {
        id: current.id,
        color_hex: current.color_hex,
        color_name: current.color_name,
        quantity: newQty,
        in_reception: newReception,
        slot_labels: [],
        is_active_in_slots: true
      };
    } catch (sqliteErr: any) {
      return { success: false, error: sqliteErr.message || "Failed to return from reception." };
    }
  }

  // Also return physical band items in catalog from reception -> warehouse
  try {
    const { returnWristbandsFromReception } = await import("./band-inventory-db");
    await returnWristbandsFromReception({
      color_hex: targetColorHex,
      color_name: targetColorName,
      amount: cleanAmount,
      staff_name: "Admin Staff",
      notes: `Returned ${cleanAmount} bands from Reception to Warehouse`
    });
  } catch (err) {
    console.warn("[returnColorFromReception] Could not update physical band locations:", err);
  }

  return {
    success: true,
    item: updatedItem
  };
}

/**
 * Set or Reset Reception count directly (e.g. if reception was entered incorrectly,
 * or user wants to move all bands back to storage or reset reception count to 0).
 */
export async function setColorReception(params: {
  id: number;
  receptionAmount: number;
  returnToWarehouse?: boolean;
}): Promise<{
  success: boolean;
  item?: WristbandColorInventoryItem;
  error?: string;
}> {
  const { id, receptionAmount, returnToWarehouse = true } = params;
  if (!id || typeof receptionAmount !== 'number' || receptionAmount < 0) {
    return { success: false, error: "Please provide a valid reception quantity (>= 0)." };
  }

  await ensureColorInventorySchema();
  const cleanReception = Math.max(0, Math.floor(receptionAmount));
  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);

  if (hasPg) {
    try {
      const checkRes = await simulatorPool.query("SELECT quantity, in_reception, color_hex, color_name FROM wristband_color_inventory WHERE id = $1", [id]);
      if (checkRes.rows.length === 0) {
        return { success: false, error: "Inventory record not found." };
      }
      const cur = checkRes.rows[0];
      const diff = (cur.in_reception || 0) - cleanReception;
      const newQty = returnToWarehouse ? Math.max(0, (cur.quantity || 0) + diff) : cur.quantity;

      const res = await simulatorPool.query(`
        UPDATE wristband_color_inventory
        SET quantity = $1,
            in_reception = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING id, color_hex, color_name, quantity, in_reception, created_at, updated_at
      `, [newQty, cleanReception, id]);

      const row = res.rows[0];
      try {
        initDB();
        db.prepare(`
          UPDATE wristband_color_inventory 
          SET quantity = ?, in_reception = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE color_hex = ?
        `).run(row.quantity, row.in_reception, row.color_hex);
      } catch (e) {}

      return {
        success: true,
        item: {
          id: row.id,
          color_hex: row.color_hex,
          color_name: row.color_name,
          quantity: Number(row.quantity),
          in_reception: Number(row.in_reception),
          slot_labels: [],
          is_active_in_slots: true
        }
      };
    } catch (pgErr: any) {
      console.warn("[Color Inventory] PG set reception error:", pgErr);
    }
  }

  try {
    initDB();
    const current = db.prepare("SELECT * FROM wristband_color_inventory WHERE id = ?").get(id) as any;
    if (!current) {
      return { success: false, error: "Inventory record not found." };
    }

    const diff = (current.in_reception || 0) - cleanReception;
    const newQty = returnToWarehouse ? Math.max(0, (current.quantity || 0) + diff) : current.quantity;

    db.prepare(`
      UPDATE wristband_color_inventory 
      SET quantity = ?, in_reception = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newQty, cleanReception, id);

    return {
      success: true,
      item: {
        id: current.id,
        color_hex: current.color_hex,
        color_name: current.color_name,
        quantity: newQty,
        in_reception: cleanReception,
        slot_labels: [],
        is_active_in_slots: true
      }
    };
  } catch (sqliteErr: any) {
    return { success: false, error: sqliteErr.message || "Failed to set reception count." };
  }
}


/**
 * Decrement reception counter for a given color hex/name (used when a band is issued to a customer).
 */
export async function decrementReceptionCountByHex(colorHexOrName: string, amount: number = 1): Promise<void> {
  if (!colorHexOrName) return;
  await ensureColorInventorySchema();
  const clean = colorHexOrName.trim().toUpperCase();
  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);

  if (hasPg) {
    try {
      await simulatorPool.query(
        `UPDATE wristband_color_inventory 
         SET in_reception = GREATEST(0, in_reception - $1), updated_at = NOW() 
         WHERE UPPER(color_hex) = $2 OR UPPER(color_name) = $2`,
        [amount, clean]
      );
    } catch (e) {
      console.warn("[Color Inventory] PG decrement reception error:", e);
    }
  }

  try {
    initDB();
    db.prepare(`
      UPDATE wristband_color_inventory 
      SET in_reception = MAX(0, in_reception - ?), updated_at = CURRENT_TIMESTAMP 
      WHERE UPPER(color_hex) = ? OR UPPER(color_name) = ?
    `).run(amount, clean, clean);
  } catch (e) {
    console.warn("[Color Inventory] SQLite decrement reception error:", e);
  }
}

/**
 * Increment reception counter for a given color hex/name (used when a band is unassigned/returned).
 */
export async function incrementReceptionCountByHex(colorHexOrName: string, amount: number = 1): Promise<void> {
  if (!colorHexOrName) return;
  await ensureColorInventorySchema();
  const clean = colorHexOrName.trim().toUpperCase();
  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);

  if (hasPg) {
    try {
      await simulatorPool.query(
        `UPDATE wristband_color_inventory 
         SET in_reception = in_reception + $1, updated_at = NOW() 
         WHERE UPPER(color_hex) = $2 OR UPPER(color_name) = $2`,
        [amount, clean]
      );
    } catch (e) {
      console.warn("[Color Inventory] PG increment reception error:", e);
    }
  }

  try {
    initDB();
    db.prepare(`
      UPDATE wristband_color_inventory 
      SET in_reception = in_reception + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE UPPER(color_hex) = ? OR UPPER(color_name) = ?
    `).run(amount, clean, clean);
  } catch (e) {
    console.warn("[Color Inventory] SQLite increment reception error:", e);
  }
}

/**
 * Decrement stock quantity for a given color hex/name (used when a band coupon is redeemed).
 */
export async function decrementColorStockByHex(colorHexOrName: string, amount: number = 1): Promise<void> {
  if (!colorHexOrName) return;
  await ensureColorInventorySchema();
  const clean = colorHexOrName.trim().toUpperCase();
  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);

  if (hasPg) {
    try {
      await simulatorPool.query(
        `UPDATE wristband_color_inventory 
         SET quantity = GREATEST(0, quantity - $1), updated_at = NOW() 
         WHERE UPPER(color_hex) = $2 OR UPPER(color_name) = $2`,
        [amount, clean]
      );
    } catch (e) {
      console.warn("[Color Inventory] PG decrement error:", e);
    }
  }

  try {
    initDB();
    db.prepare(`
      UPDATE wristband_color_inventory 
      SET quantity = MAX(0, quantity - ?), updated_at = CURRENT_TIMESTAMP 
      WHERE UPPER(color_hex) = ? OR UPPER(color_name) = ?
    `).run(amount, clean, clean);
  } catch (e) {
    console.warn("[Color Inventory] SQLite decrement error:", e);
  }
}

/**
 * Explicit manual deletion of an inventory record by an authorized administrator.
 * Only deletes when explicitly invoked. Never called automatically on slot deletion.
 */
export async function deleteColorInventoryRecord(id: number): Promise<{ success: boolean; error?: string }> {
  await ensureColorInventorySchema();
  const hasPg = Boolean(process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL);

  if (hasPg) {
    try {
      const res = await simulatorPool.query("DELETE FROM wristband_color_inventory WHERE id = $1 RETURNING color_hex", [id]);
      if (res.rows[0]?.color_hex) {
        try {
          initDB();
          db.prepare("DELETE FROM wristband_color_inventory WHERE color_hex = ?").run(res.rows[0].color_hex);
        } catch (e) {}
      }
      return { success: true };
    } catch (pgErr: any) {
      console.warn("[Color Inventory] PG delete error:", pgErr);
    }
  }

  try {
    initDB();
    db.prepare("DELETE FROM wristband_color_inventory WHERE id = ?").run(id);
    return { success: true };
  } catch (sqliteErr: any) {
    return { success: false, error: sqliteErr.message || "Failed to delete record" };
  }
}
