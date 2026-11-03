import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { db, initDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleMigration(req);
}

export async function POST(req: NextRequest) {
  return handleMigration(req);
}

async function handleMigration(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  // Migration protection key: ?secret=havoc_supabase_migrate_2026
  if (secret !== "havoc_supabase_migrate_2026") {
    return NextResponse.json(
      { error: "Unauthorized. Please provide ?secret=havoc_supabase_migrate_2026 in the URL." },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.SUPABASE_DATABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json(
      {
        error: "Missing SUPABASE_DATABASE_URL in Render environment variables.",
        instructions: "Please go to Render Dashboard -> Environment -> Add 'SUPABASE_DATABASE_URL' with your Supabase connection string, and try again."
      },
      { status: 400 }
    );
  }

  const sourceUrl = process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL;

  // Initialize Target Pool (Supabase)
  const targetPool = new Pool({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  let sourcePool: Pool | null = null;
  if (sourceUrl && sourceUrl !== supabaseUrl) {
    sourcePool = new Pool({
      connectionString: sourceUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
  }

  const report: Record<string, any> = {};

  try {
    // Test Supabase connection
    await targetPool.query("SELECT 1");

    // 1. Create all schemas on Supabase
    await targetPool.query(`
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

      CREATE INDEX IF NOT EXISTS idx_band_items_code ON band_items(band_code);
      CREATE INDEX IF NOT EXISTS idx_band_items_status ON band_items(status);
      CREATE INDEX IF NOT EXISTS idx_band_items_color ON band_items(color_name);
      CREATE INDEX IF NOT EXISTS idx_band_items_location ON band_items(location);

      CREATE TABLE IF NOT EXISTS band_transactions (
        id SERIAL PRIMARY KEY,
        band_id INTEGER REFERENCES band_items(id) ON DELETE CASCADE,
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

      CREATE TABLE IF NOT EXISTS wristband_color_inventory (
        id SERIAL PRIMARY KEY,
        color_hex VARCHAR(50) NOT NULL UNIQUE,
        color_name VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        in_reception INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS subcategory_bands (
        id SERIAL PRIMARY KEY,
        category_name VARCHAR(100) NOT NULL,
        color_hex VARCHAR(50) NOT NULL,
        color_name VARCHAR(100) NOT NULL,
        remark TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS simulator_slot_locks (
        id SERIAL PRIMARY KEY,
        simulator_name TEXT NOT NULL,
        booking_date TEXT NOT NULL,
        booking_time TEXT NOT NULL,
        source_platform TEXT NOT NULL,
        source_order_id TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        status TEXT DEFAULT 'CONFIRMED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_sim_slot_lock UNIQUE (simulator_name, booking_date, booking_time)
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        order_id TEXT UNIQUE,
        name TEXT,
        email TEXT,
        phone TEXT,
        item_name TEXT,
        price NUMERIC DEFAULT 0,
        booking_date TEXT,
        booking_time TEXT,
        status TEXT DEFAULT 'CONFIRMED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        instructor_id INTEGER,
        instructor_fee NUMERIC DEFAULT 0,
        players INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS slots (
        id SERIAL PRIMARY KEY,
        time_range TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        price NUMERIC,
        description TEXT,
        image_url TEXT
      );
    `);

    // Helper to query source (Postgres first, SQLite fallback)
    const fetchSourceRows = async (table: string, sqliteQuery?: string): Promise<any[]> => {
      if (sourcePool) {
        try {
          const res = await sourcePool.query(`SELECT * FROM ${table}`);
          if (res.rows && res.rows.length > 0) return res.rows;
        } catch (e) {
          console.warn(`[Migration] Could not read ${table} from source Postgres, falling back to SQLite:`, e);
        }
      }
      if (sqliteQuery) {
        try {
          initDB();
          return db.prepare(sqliteQuery).all() as any[];
        } catch (err) {
          console.warn(`[Migration] SQLite query failed for ${table}:`, err);
        }
      }
      return [];
    };

    // 2. Migrate wristband_color_inventory
    const colorRows = await fetchSourceRows("wristband_color_inventory", "SELECT * FROM wristband_color_inventory");
    for (const r of colorRows) {
      await targetPool.query(`
        INSERT INTO wristband_color_inventory (color_hex, color_name, quantity, in_reception)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (color_hex) DO UPDATE SET
          color_name = EXCLUDED.color_name,
          quantity = EXCLUDED.quantity,
          in_reception = EXCLUDED.in_reception;
      `, [r.color_hex, r.color_name, r.quantity || 0, r.in_reception || 0]);
    }
    report.wristband_color_inventory = colorRows.length;

    // 3. Migrate subcategory_bands
    const subcatRows = await fetchSourceRows("subcategory_bands", "SELECT * FROM subcategory_bands");
    for (const r of subcatRows) {
      await targetPool.query(`
        INSERT INTO subcategory_bands (id, category_name, color_hex, color_name, remark, active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          category_name = EXCLUDED.category_name,
          color_hex = EXCLUDED.color_hex,
          color_name = EXCLUDED.color_name,
          remark = EXCLUDED.remark,
          active = EXCLUDED.active;
      `, [r.id, r.category_name, r.color_hex, r.color_name, r.remark, r.active ?? 1]);
    }
    report.subcategory_bands = subcatRows.length;

    // 4. Migrate time_slots
    const timeSlotRows = await fetchSourceRows("time_slots", "SELECT * FROM time_slots");
    for (const r of timeSlotRows) {
      await targetPool.query(`
        INSERT INTO time_slots (label, start_hour, end_hour, active, sort_order, color, color_name, remark)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (label) DO UPDATE SET
          color = EXCLUDED.color,
          color_name = EXCLUDED.color_name,
          sort_order = EXCLUDED.sort_order,
          active = EXCLUDED.active;
      `, [r.label, r.start_hour, r.end_hour, r.active ?? 1, r.sort_order ?? 0, r.color, r.color_name, r.remark]);
    }
    report.time_slots = timeSlotRows.length;

    // 5. Migrate site_settings
    const settingsRows = await fetchSourceRows("site_settings", "SELECT * FROM site_settings");
    for (const r of settingsRows) {
      await targetPool.query(`
        INSERT INTO site_settings (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          description = EXCLUDED.description;
      `, [r.key, r.value, r.description || '']);
    }
    report.site_settings = settingsRows.length;

    // 6. Migrate slots (Sim Podium slots)
    const slotRows = await fetchSourceRows("slots");
    for (const r of slotRows) {
      await targetPool.query(`
        INSERT INTO slots (id, time_range, active, sort_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          time_range = EXCLUDED.time_range,
          active = EXCLUDED.active,
          sort_order = EXCLUDED.sort_order;
      `, [r.id, r.time_range, r.active ?? 1, r.sort_order ?? 0]);
    }
    report.slots = slotRows.length;

    // 7. Migrate products (Sim Podium simulators)
    const productRows = await fetchSourceRows("products");
    for (const r of productRows) {
      await targetPool.query(`
        INSERT INTO products (id, name, type, price, description, image_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          price = EXCLUDED.price,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url;
      `, [r.id, r.name, r.type, r.price, r.description, r.image_url]);
    }
    report.products = productRows.length;

    // 8. Migrate simulator_slot_locks
    const lockRows = await fetchSourceRows("simulator_slot_locks");
    for (const r of lockRows) {
      await targetPool.query(`
        INSERT INTO simulator_slot_locks (
          simulator_name, booking_date, booking_time, source_platform, source_order_id, customer_name, customer_phone, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (simulator_name, booking_date, booking_time) DO UPDATE SET
          source_order_id = EXCLUDED.source_order_id,
          customer_name = EXCLUDED.customer_name,
          customer_phone = EXCLUDED.customer_phone,
          status = EXCLUDED.status;
      `, [r.simulator_name, r.booking_date, r.booking_time, r.source_platform, r.source_order_id, r.customer_name, r.customer_phone, r.status || 'CONFIRMED', r.created_at || new Date()]);
    }
    report.simulator_slot_locks = lockRows.length;

    // 9. Migrate bookings (Sim Podium table)
    const bookingRows = await fetchSourceRows("bookings");
    for (const r of bookingRows) {
      await targetPool.query(`
        INSERT INTO bookings (
          order_id, name, email, phone, item_name, price, booking_date, booking_time, status, created_at, instructor_id, instructor_fee, players
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (order_id) DO UPDATE SET
          status = EXCLUDED.status;
      `, [
        r.order_id, r.name, r.email, r.phone, r.item_name, r.price || 0,
        r.booking_date, r.booking_time, r.status || 'CONFIRMED', r.created_at || new Date(),
        r.instructor_id, r.instructor_fee || 0, r.players || 1
      ]);
    }
    report.bookings = bookingRows.length;

    // 10. Migrate band_items (batch processing to handle 36k items quickly)
    const existingBandsRes = await targetPool.query("SELECT COUNT(*)::int as cnt FROM band_items");
    const existingBandsCount = existingBandsRes.rows[0]?.cnt || 0;

    if (existingBandsCount >= 30000) {
      report.band_items = existingBandsCount;
    } else {
      const bandRows = await fetchSourceRows("band_items", "SELECT * FROM band_items ORDER BY id ASC");
      let migratedBands = 0;
      const BATCH_SIZE = 500;
      
      for (let i = 0; i < bandRows.length; i += BATCH_SIZE) {
        const batch = bandRows.slice(i, i + BATCH_SIZE);
        const values: any[] = [];
        const valueStrings: string[] = [];
        let pIdx = 1;

        for (const b of batch) {
          valueStrings.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, $${pIdx + 11})`);
          values.push(
            b.id,
            b.band_code,
            b.color_name,
            b.color_hex,
            b.category || "Standard",
            b.status || "available",
            b.current_holder_name || null,
            b.current_booking_id || null,
            b.current_order_number || null,
            b.total_uses || 0,
            b.notes || null,
            b.location || "warehouse"
          );
          pIdx += 12;
        }

        if (valueStrings.length > 0) {
          await targetPool.query(`
            INSERT INTO band_items (
              id, band_code, color_name, color_hex, category, status, current_holder_name, current_booking_id, current_order_number, total_uses, notes, location
            ) VALUES ${valueStrings.join(", ")}
            ON CONFLICT (band_code, color_name) DO UPDATE SET
              status = EXCLUDED.status,
              current_holder_name = EXCLUDED.current_holder_name,
              current_order_number = EXCLUDED.current_order_number,
              location = EXCLUDED.location,
              total_uses = EXCLUDED.total_uses;
          `, values);
          migratedBands += batch.length;
        }
      }
      report.band_items = migratedBands;
    }

    // 11. Migrate band_transactions (sanitizing orphan band_ids so foreign keys never fail)
    const validBandIdsRes = await targetPool.query("SELECT id FROM band_items");
    const validBandIds = new Set(validBandIdsRes.rows.map(r => r.id));

    const txRows = await fetchSourceRows("band_transactions", "SELECT * FROM band_transactions ORDER BY id ASC");
    let migratedTxs = 0;
    const BATCH_SIZE = 500;
    for (let i = 0; i < txRows.length; i += BATCH_SIZE) {
      const batch = txRows.slice(i, i + BATCH_SIZE);
      const values: any[] = [];
      const valueStrings: string[] = [];
      let pIdx = 1;

      for (const t of batch) {
        const safeBandId = (t.band_id && validBandIds.has(t.band_id)) ? t.band_id : null;
        valueStrings.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, $${pIdx + 11})`);
        values.push(
          t.id,
          safeBandId,
          t.band_code,
          t.color_name,
          t.color_hex,
          t.transaction_type,
          t.quantity || 1,
          t.customer_name || null,
          t.booking_id || null,
          t.order_number || null,
          t.staff_name || null,
          t.notes || null
        );
        pIdx += 12;
      }

      if (valueStrings.length > 0) {
        await targetPool.query(`
          INSERT INTO band_transactions (
            id, band_id, band_code, color_name, color_hex, transaction_type, quantity, customer_name, booking_id, order_number, staff_name, notes
          ) VALUES ${valueStrings.join(", ")}
          ON CONFLICT (id) DO NOTHING;
        `, values);
        migratedTxs += batch.length;
      }
    }
    report.band_transactions = migratedTxs;

    // 12. Reset all serial sequences in Supabase so future INSERTs don't hit duplicate key errors
    const serialTables = [
      { table: "band_items", col: "id" },
      { table: "band_transactions", col: "id" },
      { table: "wristband_color_inventory", col: "id" },
      { table: "subcategory_bands", col: "id" },
      { table: "time_slots", col: "id" },
      { table: "simulator_slot_locks", col: "id" },
      { table: "bookings", col: "id" },
      { table: "slots", col: "id" },
      { table: "products", col: "id" },
    ];

    for (const item of serialTables) {
      try {
        await targetPool.query(`
          SELECT setval(
            pg_get_serial_sequence('${item.table}', '${item.col}'),
            COALESCE((SELECT MAX(${item.col}) FROM ${item.table}), 1)
          );
        `);
      } catch (seqErr) {
        // ignore if table doesn't have sequence
      }
    }

    return NextResponse.json({
      success: true,
      message: "🎉 Migration to Supabase completed successfully!",
      migratedRecords: report,
      nextStep: "In your Render Dashboard, change SIMULATOR_DATABASE_URL to your SUPABASE_DATABASE_URL value, then click Save and Redeploy."
    });
  } catch (err: any) {
    console.error("[Migration Error]", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to migrate data to Supabase",
        partialReport: report
      },
      { status: 500 }
    );
  } finally {
    await targetPool.end().catch(() => {});
    if (sourcePool) await sourcePool.end().catch(() => {});
  }
}

