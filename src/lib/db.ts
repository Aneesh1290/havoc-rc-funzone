import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { deleteSimulatorSlotLocks } from './simulator-db';

// Initialize the database connection
// Supports Render persistent disk mount paths (e.g. DB_PATH=/var/data/havoc.db or DATA_DIR=/var/data)
function getDatabasePath(): string {
  // If DATA_DIR or DB_PATH is specified:
  // Note: During `next build` on Render, the persistent disk is NOT mounted yet!
  // We check if the target directory can be accessed/created; if not, we fallback safely during build.
  if (process.env.DB_PATH) {
    try {
      const dir = path.dirname(process.env.DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return process.env.DB_PATH;
    } catch (e) {
      console.warn("DB_PATH directory not accessible (likely during build), falling back to local havoc.db:", e);
      return path.resolve(process.cwd(), 'havoc.db');
    }
  }
  if (process.env.DATA_DIR) {
    try {
      if (!fs.existsSync(process.env.DATA_DIR)) {
        fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
      }
      return path.join(process.env.DATA_DIR, 'havoc.db');
    } catch (e) {
      console.warn("DATA_DIR not accessible (likely during build), falling back to local havoc.db:", e);
      return path.resolve(process.cwd(), 'havoc.db');
    }
  }
  return path.resolve(process.cwd(), 'havoc.db');
}

const dbPath = getDatabasePath();
export const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });

// Initialize database schema
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS band_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      band_code TEXT NOT NULL UNIQUE,
      color_name TEXT NOT NULL,
      color_hex TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Standard',
      status TEXT NOT NULL DEFAULT 'available', -- 'available', 'issued', 'damaged', 'lost', 'retired'
      current_holder_name TEXT,
      current_booking_id INTEGER,
      current_order_number TEXT,
      total_uses INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      location TEXT NOT NULL DEFAULT 'warehouse', -- 'warehouse', 'reception'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS band_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      band_id INTEGER NOT NULL,
      band_code TEXT NOT NULL,
      color_name TEXT NOT NULL,
      color_hex TEXT NOT NULL,
      transaction_type TEXT NOT NULL, -- 'STOCK_IN', 'STOCK_OUT', 'ISSUE', 'RETURN', 'DAMAGED', 'LOST', 'STATUS_CHANGE'
      quantity INTEGER NOT NULL DEFAULT 1,
      customer_name TEXT,
      booking_id INTEGER,
      order_number TEXT,
      staff_name TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_band_items_code ON band_items(band_code);
    CREATE INDEX IF NOT EXISTS idx_band_items_status ON band_items(status);
    CREATE INDEX IF NOT EXISTS idx_band_items_color ON band_items(color_name);
    CREATE INDEX IF NOT EXISTS idx_band_tx_band_id ON band_transactions(band_id);
    CREATE INDEX IF NOT EXISTS idx_band_tx_type ON band_transactions(transaction_type);
    CREATE INDEX IF NOT EXISTS idx_band_tx_created ON band_transactions(created_at);
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      total_amount INTEGER,
      payment_status TEXT DEFAULT 'Unpaid',
      fulfillment_status TEXT DEFAULT 'Unfulfilled',
      tags TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ticket_id) REFERENCES tickets(id)
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL, -- 'percentage' or 'flat'
      value REAL NOT NULL,
      max_uses INTEGER, -- null for unlimited
      used_count INTEGER NOT NULL DEFAULT 0,
      expiry_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Admin User',
      role TEXT NOT NULL DEFAULT 'Administrator',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vip_perks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      tagline TEXT NOT NULL,
      image TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_date TEXT NOT NULL, -- e.g. 'Oct 18' or 'ALL'
      time_slot TEXT NOT NULL,    -- e.g. '11AM-12PM' or 'ALL_DAY'
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unique_block UNIQUE (booking_date, time_slot)
    );

    CREATE TABLE IF NOT EXISTS time_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL UNIQUE,     -- e.g. '11AM-12PM'
      start_hour REAL NOT NULL,       -- e.g. 11.0 (for ordering and past-time checks)
      end_hour REAL NOT NULL,         -- e.g. 12.0
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      color TEXT,                     -- Wristband hex color e.g. '#06B6D4'
      color_name TEXT,                -- Wristband custom name e.g. 'Neon Blue Band'
      remark TEXT,                    -- Slot Type / Remark (e.g. Regular, VIP, Rush Hour)
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS online_checkout_holds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txn_id TEXT UNIQUE NOT NULL,
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      amount REAL NOT NULL,
      items_json TEXT NOT NULL,
      whatsapp_consent INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Seed default site settings
  try {
    db.prepare(`
      INSERT OR IGNORE INTO site_settings (key, value, description) 
      VALUES ('monday_open', '0', 'Allow bookings on Mondays (1 = Open, 0 = Closed)')
    `).run();
  } catch (e) {}

  try { db.exec('ALTER TABLE time_slots ADD COLUMN color TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE time_slots ADD COLUMN color_name TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE time_slots ADD COLUMN remark TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN customer_name TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN customer_email TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN customer_phone TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN total_amount INTEGER'); } catch (e) {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'Unpaid'"); } catch (e) {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN fulfillment_status TEXT DEFAULT 'Unfulfilled'"); } catch (e) {}
  try { db.exec("ALTER TABLE bookings ADD COLUMN tags TEXT DEFAULT ''"); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN simulator_name TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN simulator_slot TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN created_at TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN order_number INTEGER'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN payment_ref TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN icici_txn_id TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN wristband_number TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE bookings ADD COLUMN applied_coupon TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE coupons ADD COLUMN is_band_coupon INTEGER DEFAULT 0'); } catch (e) {}
  try { db.exec('ALTER TABLE coupons ADD COLUMN band_category TEXT DEFAULT \'VIP\''); } catch (e) {}
  try { db.exec('ALTER TABLE coupons ADD COLUMN band_color TEXT'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_online_holds_created ON online_checkout_holds(created_at)'); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_online_holds_txn ON online_checkout_holds(txn_id)'); } catch (e) {}
  try { db.exec("ALTER TABLE band_items ADD COLUMN location TEXT DEFAULT 'warehouse'"); } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_band_items_location ON band_items(location)'); } catch (e) {}
  try { db.exec('ALTER TABLE admin_users ADD COLUMN permissions TEXT DEFAULT \'all\''); } catch (e) {}
  try { db.exec('ALTER TABLE admin_users ADD COLUMN must_change_password INTEGER DEFAULT 0'); } catch (e) {}
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_sequence (
        id INTEGER PRIMARY KEY,
        last_order_number INTEGER NOT NULL DEFAULT 0
      );
    `);
  } catch (e) {}
  try {
    db.exec(`
      UPDATE admin_users 
      SET role = 'staff' 
      WHERE LOWER(username) != 'admin' AND (role = 'Administrator' OR role IS NULL OR role = '');
    `);
  } catch (e) {}

  // Ticket table simulator perks and perks metadata columns
  try { db.exec('ALTER TABLE tickets ADD COLUMN has_simulator_perk INTEGER NOT NULL DEFAULT 0'); } catch (e) {}
  try { db.exec('ALTER TABLE tickets ADD COLUMN perk_duration_mins INTEGER NOT NULL DEFAULT 30'); } catch (e) {}
  try { db.exec('ALTER TABLE tickets ADD COLUMN perk_title TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE tickets ADD COLUMN description TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE tickets ADD COLUMN benefits TEXT'); } catch (e) {}

  // Ensure default VIP_PARTICIPANT has simulator perk enabled
  try {
    db.exec(`
      UPDATE tickets 
      SET has_simulator_perk = 1, 
          perk_duration_mins = 30, 
          perk_title = '30-Min Havoc Sim Podium Session' 
      WHERE UPPER(name) = 'VIP_PARTICIPANT' AND (has_simulator_perk = 0 OR has_simulator_perk IS NULL)
    `);
  } catch (e) {}

  // Seed default tickets if table is empty
  const count = db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO tickets (name, price, capacity, active) VALUES (?, ?, ?, ?)');
    insert.run('VISITOR', 300, 50, 1);
    insert.run('PARTICIPANT', 1000, 50, 1);
    insert.run('VIP_VISITOR', 500, 20, 1);
    insert.run('VIP_PARTICIPANT', 1500, 20, 1);
  }

  // Seed default admin user if table is empty
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number };
  if (adminCount.count === 0) {
    // Default password 'sabharwal@65' securely hashed with bcrypt
    const defaultHash = '$2b$10$1jzr5veKnTyOLca4BKSAXOLeTYCxL5bF1BkyM6CMZ2xavjMoMvu.u';
    db.prepare('INSERT INTO admin_users (username, password_hash, name, role) VALUES (?, ?, ?, ?)').run(
      'admin',
      defaultHash,
      'Admin User',
      'Administrator'
    );
  }

  // Seed default VIP perks / simulators if table is empty
  const perkCount = db.prepare('SELECT COUNT(*) as count FROM vip_perks').get() as { count: number };
  if (perkCount.count === 0) {
    const insertPerk = db.prepare('INSERT INTO vip_perks (name, category, tagline, image, active, sort_order) VALUES (?, ?, ?, ?, 1, ?)');
    const defaultSims = [
      { name: "RC Flying Sim", category: "Flying", tagline: "Aeromodelling & Drone Flight Simulation", image: "/simulators/uploads/1789025889762-rc-flying-sim.png", order: 1 },
      { name: "Flight Sim Pro (Airbus Edition)", category: "Flying", tagline: "Commercial Dual-Seat Airliner Cockpit", image: "/simulators/flight-sim-pro(airbus).png", order: 2 },
      { name: "Flight Sim Pro (Boeing Edition)", category: "Flying", tagline: "Panoramic 180° Curved Cockpit Simulator", image: "/simulators/flight-sim-pro(boeing).png", order: 3 },
      { name: "Race Sim GT", category: "Racing", tagline: "Pro Direct Drive GT Racing Cockpit", image: "/simulators/race-sim-gt.png", order: 4 },
      { name: "Race Sim F1", category: "Racing", tagline: "Formula 1 Seating with Ultra-Wide Display", image: "/simulators/race-sim-f1.png", order: 5 },
      { name: "Race Sim Beginner", category: "Racing", tagline: "Beginner Friendly Curved Display Racing Rig", image: "/simulators/race-sim-beginner.png", order: 6 },
      { name: "Race Sim Jr. & Play Station PS5", category: "Gaming & Racing", tagline: "Youth Cockpit + PlayStation 5 Console", image: "/simulators/race-sim-jr.png", order: 7 }
    ];
    for (const sim of defaultSims) {
      insertPerk.run(sim.name, sim.category, sim.tagline, sim.image, sim.order);
    }
  }

  // Seed default hourly time slots if table is empty
  const slotCount = db.prepare('SELECT COUNT(*) as count FROM time_slots').get() as { count: number };
  if (slotCount.count === 0) {
    const insertSlot = db.prepare('INSERT INTO time_slots (label, start_hour, end_hour, active, sort_order, color) VALUES (?, ?, ?, 1, ?, ?)');
    const defaultSlots = [
      { label: "11AM-12PM", start: 11.0, end: 12.0, order: 1, color: "#06B6D4" },
      { label: "12PM-1PM",  start: 12.0, end: 13.0, order: 2, color: "#10B981" },
      { label: "1PM-2PM",   start: 13.0, end: 14.0, order: 3, color: "#F59E0B" },
      { label: "2PM-3PM",   start: 14.0, end: 15.0, order: 4, color: "#F97316" },
      { label: "3PM-4PM",   start: 15.0, end: 16.0, order: 5, color: "#EF4444" },
      { label: "4PM-5PM",   start: 16.0, end: 17.0, order: 6, color: "#8B5CF6" },
      { label: "5PM-6PM",   start: 17.0, end: 18.0, order: 7, color: "#EC4899" },
      { label: "6PM-7PM",   start: 18.0, end: 19.0, order: 8, color: "#3B82F6" },
      { label: "7PM-8PM",   start: 19.0, end: 20.0, order: 9, color: "#14B8A6" },
      { label: "8PM-9PM",   start: 20.0, end: 21.0, order: 10, color: "#84CC16" },
      { label: "9PM-10PM",  start: 21.0, end: 22.0, order: 11, color: "#EAB308" },
      { label: "10PM-11PM", start: 22.0, end: 23.0, order: 12, color: "#6366F1" },
      { label: "11PM-12AM", start: 23.0, end: 24.0, order: 13, color: "#64748B" },
    ];
    for (const s of defaultSlots) {
      insertSlot.run(s.label, s.start, s.end, s.order, s.color);
    }
  } else {
    // Backfill colors for existing slots if they don't have one set yet
    try {
      const updateColorStmt = db.prepare('UPDATE time_slots SET color = ? WHERE label = ? AND (color IS NULL OR color = \'\')');
      const fallbackPalette: Record<string, string> = {
        "11AM-12PM": "#06B6D4",
        "12PM-1PM":  "#10B981",
        "1PM-2PM":   "#F59E0B",
        "2PM-3PM":   "#F97316",
        "3PM-4PM":   "#EF4444",
        "4PM-5PM":   "#8B5CF6",
        "5PM-6PM":   "#EC4899",
        "6PM-7PM":   "#3B82F6",
        "7PM-8PM":   "#14B8A6",
        "8PM-9PM":   "#84CC16",
        "9PM-10PM":  "#EAB308",
        "10PM-11PM": "#6366F1",
        "11PM-12AM": "#64748B",
      };
      for (const [lbl, col] of Object.entries(fallbackPalette)) {
        updateColorStmt.run(col, lbl);
      }
    } catch (e) {}
  }

  // If bookings table was cleared or only has 1 record, ensure sequence matches max(id)
  try {
    const bookingStats = db.prepare('SELECT COUNT(*) as count, MAX(id) as max_id FROM bookings').get() as { count: number; max_id: number | null };
    if (bookingStats.count === 0) {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'bookings'").run();
    } else if (bookingStats.count === 1 && bookingStats.max_id && bookingStats.max_id > 1) {
      // If there's only 1 booking left from testing, normalize it to id 1
      db.prepare('UPDATE bookings SET id = 1 WHERE id = ?').run(bookingStats.max_id);
      db.prepare("UPDATE sqlite_sequence SET seq = 1 WHERE name = 'bookings'").run();
    }
  } catch (e) {
    // sqlite_sequence may not exist yet if no table with autoincrement was touched
  }

  // Ensure legacy rows have order_number initialized
  try {
    db.exec('UPDATE bookings SET order_number = id WHERE order_number IS NULL');
  } catch (e) {
    // ignore
  }
}

export interface TicketRow {
  id: number;
  name: string;
  price: number;
  capacity: number;
  active: number;
  has_simulator_perk?: number;
  perk_duration_mins?: number;
  perk_title?: string | null;
  description?: string | null;
  benefits?: string | null;
}

export interface CouponRow {
  id: number;
  code: string;
  discount_type: 'percentage' | 'flat';
  value: number;
  max_uses: number | null;
  used_count: number;
  expiry_date: string | null;
  is_band_coupon?: number;
  band_category?: string;
  band_color?: string;
  created_at: string;
}

export function getTickets(): TicketRow[] {
  return db.prepare('SELECT * FROM tickets').all() as TicketRow[];
}

export function getBookedQuantities(date: string, timeSlot: string): { ticket_id: number, total_booked: number }[] {
  const booked = db.prepare(`
    SELECT ticket_id, SUM(quantity) as total_booked 
    FROM bookings 
    WHERE booking_date = ? AND time_slot = ?
      AND LOWER(COALESCE(fulfillment_status, '')) NOT IN ('canceled', 'cancelled')
      AND LOWER(COALESCE(payment_status, '')) NOT IN ('refunded', 'canceled', 'cancelled')
    GROUP BY ticket_id
  `).all(date, timeSlot) as { ticket_id: number, total_booked: number }[];

  const bookedMap = new Map<number, number>();
  for (const b of booked) {
    bookedMap.set(b.ticket_id, (bookedMap.get(b.ticket_id) || 0) + Number(b.total_booked || 0));
  }

  // Also include active online checkout holds (< 2 minutes old)
  try {
    const activeHolds = db.prepare(`
      SELECT items_json FROM online_checkout_holds
      WHERE datetime(created_at) >= datetime('now', '-2 minutes')
    `).all() as { items_json: string }[];

    for (const hold of activeHolds) {
      if (!hold.items_json) continue;
      try {
        const items = JSON.parse(hold.items_json);
        if (Array.isArray(items)) {
          for (const item of items) {
            const itemDate = item.date || item.booking_date;
            const itemSlot = item.timeSlot || item.time_slot || item.time;
            const ticketId = item.ticketId || item.ticket_id;
            if (itemDate === date && itemSlot === timeSlot && ticketId) {
              const qty = Number(item.quantity) || 1;
              bookedMap.set(Number(ticketId), (bookedMap.get(Number(ticketId)) || 0) + qty);
            }
          }
        }
      } catch (parseErr) {
        // ignore JSON parse error
      }
    }
  } catch (err) {
    // ignore if table not created yet
  }

  const result: { ticket_id: number, total_booked: number }[] = [];
  for (const [ticket_id, total_booked] of bookedMap.entries()) {
    result.push({ ticket_id, total_booked });
  }
  return result;
}

export function getAllBookings() {
  return db.prepare(`
    SELECT 
      b.id, b.order_number, b.booking_date, b.time_slot, b.quantity, b.customer_name, b.customer_email, b.customer_phone, b.total_amount, 
      b.payment_status, b.fulfillment_status, b.tags, b.simulator_name, b.simulator_slot, b.created_at, b.payment_ref, b.wristband_number,
      COALESCE(t.name, 'CUSTOM_TICKET') as ticket_name, COALESCE(t.price, 0) as ticket_price,
      s.color as slot_color, s.color_name as slot_color_name
    FROM bookings b
    LEFT JOIN tickets t ON b.ticket_id = t.id
    LEFT JOIN time_slots s ON b.time_slot = s.label
    ORDER BY b.id DESC
  `).all();
}

export function getBookingById(id: number) {
  return db.prepare(`
    SELECT 
      b.id, b.order_number, b.booking_date, b.time_slot, b.quantity, b.customer_name, b.customer_email, b.customer_phone, b.total_amount, 
      b.payment_status, b.fulfillment_status, b.tags, b.simulator_name, b.simulator_slot, b.created_at, b.payment_ref, b.wristband_number,
      b.ticket_id, COALESCE(t.name, 'CUSTOM_TICKET') as ticket_name, COALESCE(t.price, 0) as ticket_price,
      s.color as slot_color, s.color_name as slot_color_name
    FROM bookings b
    LEFT JOIN tickets t ON b.ticket_id = t.id
    LEFT JOIN time_slots s ON b.time_slot = s.label
    WHERE b.id = ?
  `).get(id);
}

export function getBookingsByOrderNumber(orderNum: number) {
  return db.prepare(`
    SELECT 
      b.id, b.order_number, b.booking_date, b.time_slot, b.quantity, b.customer_name, b.customer_email, b.customer_phone, b.total_amount, 
      b.payment_status, b.fulfillment_status, b.tags, b.simulator_name, b.simulator_slot, b.created_at, b.payment_ref, b.wristband_number,
      b.ticket_id, COALESCE(t.name, 'CUSTOM_TICKET') as ticket_name, COALESCE(t.price, 0) as ticket_price,
      s.color as slot_color, s.color_name as slot_color_name
    FROM bookings b
    LEFT JOIN tickets t ON b.ticket_id = t.id
    LEFT JOIN time_slots s ON b.time_slot = s.label
    WHERE b.order_number = ? OR (b.order_number IS NULL AND b.id = ?)
    ORDER BY b.id ASC
  `).all(orderNum, orderNum);
}

export function getBookingsByPhone(phoneQuery: string, countryCode?: string) {
  const digits = (phoneQuery || '').replace(/\D/g, '');
  if (!digits) return [];

  const corePhone = digits.length > 10 ? digits.slice(-10) : digits;
  const candidates = db.prepare(`
    SELECT 
      b.id, b.order_number, b.booking_date, b.time_slot, b.quantity, b.customer_name, b.customer_email, b.customer_phone, b.total_amount, 
      b.payment_status, b.fulfillment_status, b.tags, b.simulator_name, b.simulator_slot, b.created_at, b.payment_ref, b.wristband_number,
      b.ticket_id, COALESCE(t.name, 'CUSTOM_TICKET') as ticket_name, COALESCE(t.price, 0) as ticket_price,
      s.color as slot_color, s.color_name as slot_color_name
    FROM bookings b
    LEFT JOIN tickets t ON b.ticket_id = t.id
    LEFT JOIN time_slots s ON b.time_slot = s.label
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(b.customer_phone, ' ', ''), '-', ''), '+', ''), '(', '') LIKE '%' || ? || '%'
    ORDER BY b.id ASC
  `).all(corePhone) as any[];

  if (!countryCode) {
    return candidates;
  }

  const cleanCode = countryCode.replace(/\D/g, '');
  const cleanInputPhone = digits.replace(/^0+/, '');
  const fullExpected = cleanCode + cleanInputPhone;

  return candidates.filter((b) => {
    const rawDbPhone = (b.customer_phone || '').trim();
    const dbDigits = rawDbPhone.replace(/\D/g, '').replace(/^0+/, '');
    if (!dbDigits) return false;

    // 1. Exact match with international full number (e.g. "919876543210" === "919876543210")
    if (dbDigits === fullExpected) return true;

    // 2. If stored phone has explicit '+' prefix: it has an explicit country code and must match fullExpected
    if (rawDbPhone.startsWith('+')) {
      return dbDigits === fullExpected;
    }

    // 3. If stored phone starts with cleanCode and length matches fullExpected
    if (cleanCode && dbDigits.startsWith(cleanCode) && dbDigits.length === fullExpected.length) {
      return dbDigits === fullExpected;
    }

    // 4. If stored phone has NO country code prefix at all (just local 10 digits e.g. 9876543210):
    // Only match if the selected country code is India ("91", the local domestic default)
    if (cleanCode === '91' && (dbDigits === cleanInputPhone || dbDigits === corePhone)) {
      return true;
    }

    return false;
  });
}

export function attendPaidBookings(bookingIds: number[]) {
  if (!bookingIds || bookingIds.length === 0) return { changes: 0 };
  const placeholders = bookingIds.map(() => '?').join(',');
  return db.prepare(`
    UPDATE bookings 
    SET fulfillment_status = 'Fulfilled' 
    WHERE (id IN (${placeholders}) OR order_number IN (${placeholders}))
      AND LOWER(payment_status) = 'paid'
  `).run(...bookingIds, ...bookingIds);
}

export function collectAndFulfillBookings(bookingIds: number[], paymentRef: string) {
  if (!bookingIds || bookingIds.length === 0) return { changes: 0 };
  const placeholders = bookingIds.map(() => '?').join(',');
  return db.prepare(`
    UPDATE bookings 
    SET payment_status = 'Paid', fulfillment_status = 'Fulfilled', payment_ref = ?
    WHERE id IN (${placeholders}) OR order_number IN (${placeholders})
  `).run(paymentRef, ...bookingIds, ...bookingIds);
}

export function updateOrderGroupStatus(orderNum: number, paymentStatus?: string, fulfillmentStatus?: string, paymentRef?: string) {
  if (paymentRef !== undefined) {
    db.prepare('UPDATE bookings SET payment_ref = ? WHERE order_number = ? OR (order_number IS NULL AND id = ?)').run(paymentRef, orderNum, orderNum);
  }
  if (paymentStatus && fulfillmentStatus) {
    return db.prepare('UPDATE bookings SET payment_status = ?, fulfillment_status = ? WHERE order_number = ? OR (order_number IS NULL AND id = ?)').run(paymentStatus, fulfillmentStatus, orderNum, orderNum);
  } else if (paymentStatus) {
    return db.prepare('UPDATE bookings SET payment_status = ? WHERE order_number = ? OR (order_number IS NULL AND id = ?)').run(paymentStatus, orderNum, orderNum);
  } else if (fulfillmentStatus) {
    return db.prepare('UPDATE bookings SET fulfillment_status = ? WHERE order_number = ? OR (order_number IS NULL AND id = ?)').run(fulfillmentStatus, orderNum, orderNum);
  }
}

export function updateOrderGroupPaymentRef(orderNum: number, paymentRef: string) {
  return db.prepare('UPDATE bookings SET payment_ref = ? WHERE order_number = ? OR (order_number IS NULL AND id = ?)').run(paymentRef, orderNum, orderNum);
}

export function updateOrderGroupTags(orderNum: number, tags: string) {
  return db.prepare('UPDATE bookings SET tags = ? WHERE order_number = ? OR (order_number IS NULL AND id = ?)').run(tags, orderNum, orderNum);
}

export function cancelOrderGroup(orderNum: number) {
  return db.prepare(`
    UPDATE bookings 
    SET payment_status = 'Refunded', fulfillment_status = 'Canceled' 
    WHERE order_number = ? OR (order_number IS NULL AND id = ?)
  `).run(orderNum, orderNum);
}

export function deleteOrderGroup(orderNums: number[]) {
  if (!orderNums || orderNums.length === 0) return { changes: 0 };
  const placeholders = orderNums.map(() => '?').join(',');
  return db.prepare(`DELETE FROM bookings WHERE order_number IN (${placeholders}) OR (order_number IS NULL AND id IN (${placeholders}))`).run(...orderNums, ...orderNums);
}

export function updateBookingStatus(id: number, paymentStatus?: string, fulfillmentStatus?: string) {
  if (paymentStatus && fulfillmentStatus) {
    return db.prepare('UPDATE bookings SET payment_status = ?, fulfillment_status = ? WHERE id = ?').run(paymentStatus, fulfillmentStatus, id);
  } else if (paymentStatus) {
    return db.prepare('UPDATE bookings SET payment_status = ? WHERE id = ?').run(paymentStatus, id);
  } else if (fulfillmentStatus) {
    return db.prepare('UPDATE bookings SET fulfillment_status = ? WHERE id = ?').run(fulfillmentStatus, id);
  }
}

export function updateBookingTags(id: number, tags: string) {
  return db.prepare('UPDATE bookings SET tags = ? WHERE id = ?').run(tags, id);
}

export function updateBookingWristbandNumber(id: number, wristbandNumber: string) {
  const cleanBand = (wristbandNumber || '').trim();
  return db.prepare('UPDATE bookings SET wristband_number = ? WHERE id = ?').run(cleanBand || null, id);
}

export function cancelBooking(id: number) {
  // If order was Paid, mark Payment as Refunded; if Unpaid, keep as Refunded or Unpaid. Mark Fulfillment as Canceled.
  const existing = db.prepare('SELECT payment_status FROM bookings WHERE id = ?').get(id) as { payment_status?: string } | undefined;
  const isPaid = (existing?.payment_status || '').toLowerCase() === 'paid';
  const newPaymentStatus = isPaid ? 'Refunded' : 'Refunded';
  
  return db.prepare(`
    UPDATE bookings 
    SET payment_status = ?, fulfillment_status = 'Canceled' 
    WHERE id = ?
  `).run(newPaymentStatus, id);
}

export function cancelDeskBookings(ids: number[], reason = "Customer Walkout / Not Interested") {
  if (!ids || ids.length === 0) return { changes: 0 };
  const placeholders = ids.map(() => '?').join(',');
  const tagNote = `[Desk Walkout: ${reason}]`;
  
  return db.prepare(`
    UPDATE bookings 
    SET fulfillment_status = 'Canceled',
        tags = CASE 
          WHEN tags IS NULL OR tags = '' THEN '${tagNote}'
          ELSE tags || ' ' || '${tagNote}'
        END
    WHERE id IN (${placeholders})
  `).run(...ids);
}

export function adjustBookingQuantity(bookingId: number, targetQty: number, reason = "Desk Quantity Adjustment") {
  const current = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as any;
  if (!current) return null;

  const currentQty = Number(current.quantity) || 1;
  const newQty = Math.max(0, targetQty);

  if (newQty <= 0) {
    cancelDeskBookings([bookingId], reason);
    return { canceled: true, newQuantity: 0, newTotal: 0 };
  }

  // If session was previously canceled and we are adding players back, reactivate fulfillment status
  const isCanceled = (current.fulfillment_status || '').toLowerCase() === 'canceled';
  const newFulfillmentStatus = isCanceled ? 'Unfulfilled' : (current.fulfillment_status || 'Unfulfilled');

  // Recalculate total amount proportionally
  const unitPrice = current.ticket_price || (currentQty > 0 ? (current.total_amount / (currentQty * 1.18)) : (current.total_amount || 0));
  const newTotal = Math.round(unitPrice * newQty * 1.18);
  const tagNote = `[Qty changed from ${currentQty} to ${newQty}: ${reason}]`;

  db.prepare(`
    UPDATE bookings 
    SET quantity = ?,
        total_amount = ?,
        fulfillment_status = ?,
        tags = CASE 
          WHEN tags IS NULL OR tags = '' THEN '${tagNote}'
          ELSE tags || ' ' || '${tagNote}'
        END
    WHERE id = ?
  `).run(newQty, newTotal, newFulfillmentStatus, bookingId);

  return { canceled: false, newQuantity: newQty, newTotal };
}

export function reduceBookingQuantity(bookingId: number, countToReduce: number = 1, reason = "Partial Walkout at Desk") {
  const current = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as any;
  if (!current) return null;

  const currentQty = Number(current.quantity) || 1;
  return adjustBookingQuantity(bookingId, currentQty - countToReduce, reason);
}

export interface EliminatedSlotInfo {
  sessionNum?: number;
  participantNum?: number;
  simulatorName: string;
  slotLabel: string;
}

/**
 * Eliminates a specific participant from a booking (e.g. Participant 1 or Participant 2).
 * Adjusts quantity, recalculates price, strips the participant's simulator assignment from simulator_name & simulator_slot,
 * and returns the removed slot info so it can be unreserved in PostgreSQL.
 */
export function eliminateBookingParticipant(
  bookingId: number,
  participantNumberToEliminate: number,
  reason = "Specific Participant Eliminated at Desk"
): {
  canceled: boolean;
  newQuantity: number;
  newTotal: number;
  removedSlotInfo: EliminatedSlotInfo[];
  bookingDate?: string;
  orderNumber?: number;
} | null {
  const current = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as any;
  if (!current) return null;

  const currentQty = Number(current.quantity) || 1;
  const newQty = Math.max(0, currentQty - 1);

  // Parse simulator selections if present
  let removedSlotInfo: EliminatedSlotInfo[] = [];
  let updatedSimName = current.simulator_name || null;
  let updatedSimSlot = current.simulator_slot || null;

  if (current.simulator_name && current.simulator_slot) {
    const rawNames = (current.simulator_name as string).split('|').map(s => s.trim()).filter(Boolean);
    const rawSlots = (current.simulator_slot as string).replace(/[()]/g, '').split('•').map(s => s.trim()).filter(Boolean);

    const count = Math.max(rawNames.length, rawSlots.length);
    const keptNames: string[] = [];
    const keptSlots: string[] = [];

    for (let i = 0; i < count; i++) {
      const nSeg = rawNames[i] || '';
      const sSeg = rawSlots[i] || '';

      // Check participant number (e.g. (P1) or (P2) or Participant 1)
      const pMatch = nSeg.match(/\(P(\d+)\)/i) || sSeg.match(/\(P(\d+)/i);
      const sessMatch = nSeg.match(/#(\d+)/) || sSeg.match(/#(\d+)/);

      const parsedPNum = pMatch ? parseInt(pMatch[1], 10) : (i + 1);
      const parsedSessNum = sessMatch ? parseInt(sessMatch[1], 10) : (i + 1);

      // Clean simulator name and slot label
      const cleanSimName = nSeg.replace(/^#\d+(?:\s*\([^)]*\))?:\s*/, '').trim() || 'Simulator';
      const timeMatch = sSeg.match(/(\d{1,2}(?::\d{2})?(?:AM|PM)-\d{1,2}(?::\d{2})?(?:AM|PM))/i);
      const cleanSlotLabel = timeMatch ? timeMatch[1] : sSeg.replace(/^#\d+[^:]*:\s*/, '').trim();

      if (parsedPNum === participantNumberToEliminate) {
        removedSlotInfo.push({
          sessionNum: parsedSessNum,
          participantNum: parsedPNum,
          simulatorName: cleanSimName,
          slotLabel: cleanSlotLabel
        });
      } else {
        keptNames.push(nSeg);
        keptSlots.push(sSeg);
      }
    }

    if (keptNames.length === 0) {
      updatedSimName = null;
      updatedSimSlot = null;
    } else if (keptNames.length === 1) {
      // Clean single entry format
      const singleCleanName = keptNames[0].replace(/^#\d+(?:\s*\([^)]*\))?:\s*/, '').trim();
      const singleTimeMatch = keptSlots[0]?.match(/(\d{1,2}(?::\d{2})?(?:AM|PM)-\d{1,2}(?::\d{2})?(?:AM|PM))/i);
      const singleCleanSlot = singleTimeMatch ? singleTimeMatch[1] : (keptSlots[0] || '').replace(/^#\d+[^:]*:\s*/, '').trim();

      updatedSimName = singleCleanName;
      updatedSimSlot = singleCleanSlot;
    } else {
      updatedSimName = keptNames.join(' | ');
      updatedSimSlot = `(${keptSlots.join(' • ')})`;
    }
  }

  // If new quantity is 0, cancel the session completely
  if (newQty <= 0) {
    cancelDeskBookings([bookingId], reason);
    return {
      canceled: true,
      newQuantity: 0,
      newTotal: 0,
      removedSlotInfo,
      bookingDate: current.date,
      orderNumber: current.order_number
    };
  }

  // Calculate new total amount
  const unitPrice = current.ticket_price || (currentQty > 0 ? (current.total_amount / (currentQty * 1.18)) : (current.total_amount || 0));
  const newTotal = Math.round(unitPrice * newQty * 1.18);
  const tagNote = `[Eliminated P${participantNumberToEliminate} (Qty ${currentQty} -> ${newQty}): ${reason}]`;

  db.prepare(`
    UPDATE bookings 
    SET quantity = ?,
        total_amount = ?,
        simulator_name = ?,
        simulator_slot = ?,
        tags = CASE 
          WHEN tags IS NULL OR tags = '' THEN '${tagNote}'
          ELSE tags || ' ' || '${tagNote}'
        END
    WHERE id = ?
  `).run(newQty, newTotal, updatedSimName, updatedSimSlot, bookingId);

  return {
    canceled: false,
    newQuantity: newQty,
    newTotal,
    removedSlotInfo,
    bookingDate: current.date,
    orderNumber: current.order_number
  };
}

export function deleteBookings(ids: number[]) {
  if (!ids || ids.length === 0) return { changes: 0 };
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`DELETE FROM bookings WHERE id IN (${placeholders})`).run(...ids);
}

export interface OnlineCheckoutHoldRow {
  id: number;
  txn_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  amount: number;
  items_json: string;
  whatsapp_consent: number;
  created_at: string;
}

export function createOnlineCheckoutHold(data: {
  txn_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  amount: number;
  items_json: string;
  whatsapp_consent?: number;
}) {
  const stmt = db.prepare(`
    INSERT INTO online_checkout_holds (
      txn_id, customer_name, customer_email, customer_phone, amount, items_json, whatsapp_consent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  return stmt.run(
    data.txn_id,
    data.customer_name || 'Customer',
    data.customer_email || '',
    data.customer_phone || '',
    data.amount,
    data.items_json,
    data.whatsapp_consent !== undefined ? (data.whatsapp_consent ? 1 : 0) : 1
  );
}

export function getOnlineCheckoutHold(txn_id: string): OnlineCheckoutHoldRow | undefined {
  return db.prepare('SELECT * FROM online_checkout_holds WHERE txn_id = ?').get(txn_id) as OnlineCheckoutHoldRow | undefined;
}

export function deleteOnlineCheckoutHold(txn_id: string) {
  return db.prepare('DELETE FROM online_checkout_holds WHERE txn_id = ?').run(txn_id);
}

export async function cleanupExpiredHolds(maxAgeMinutes: number = 2): Promise<number> {
  try {
    const expiredRows = db.prepare(`
      SELECT txn_id FROM online_checkout_holds 
      WHERE datetime(created_at) <= datetime('now', '-' || ? || ' minutes')
    `).all(maxAgeMinutes) as { txn_id: string }[];

    if (!expiredRows || expiredRows.length === 0) return 0;

    for (const r of expiredRows) {
      try {
        await deleteSimulatorSlotLocks(r.txn_id);
      } catch (pgErr) {
        console.error("Cleanup PG lock release error:", pgErr);
      }
      db.prepare('DELETE FROM online_checkout_holds WHERE txn_id = ?').run(r.txn_id);
    }
    return expiredRows.length;
  } catch (err) {
    console.error("Error in cleanupExpiredHolds:", err);
    return 0;
  }
}

// Global timer singleton for Next.js to prevent multi-interval leaks in development
declare global {
  var _rcHoldCleanupInterval: NodeJS.Timeout | undefined;
}

if (typeof setInterval !== 'undefined') {
  if (!global._rcHoldCleanupInterval) {
    global._rcHoldCleanupInterval = setInterval(() => {
      cleanupExpiredHolds().catch(e => console.error("Periodic hold cleanup error:", e));
    }, 60 * 1000);
  }
}

export function getNextOrderNumber(): number {
  const row = db.prepare('SELECT MAX(COALESCE(order_number, id)) as max_num FROM bookings').get() as { max_num: number | null };
  const maxInBookings = (row && row.max_num && row.max_num > 0) ? row.max_num : 0;

  try {
    const seqRow = db.prepare('SELECT last_order_number FROM order_sequence WHERE id = 1').get() as { last_order_number: number } | undefined;
    let nextNum: number;
    if (!seqRow) {
      nextNum = maxInBookings + 1;
      db.prepare('INSERT OR REPLACE INTO order_sequence (id, last_order_number) VALUES (1, ?)').run(nextNum);
    } else {
      nextNum = Math.max(seqRow.last_order_number, maxInBookings) + 1;
      db.prepare('UPDATE order_sequence SET last_order_number = ? WHERE id = 1').run(nextNum);
    }
    return nextNum;
  } catch (seqErr) {
    return maxInBookings + 1;
  }
}

export interface BatchBookingItem {
  ticketId: number;
  date: string;
  timeSlot: string;
  quantity: number;
  itemTotal: number;
  simulatorName?: string;
  simulatorSlot?: string;
}

export function addBatchBooking(
  items: BatchBookingItem[],
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  appliedCoupon?: string | null
) {
  if (!items || items.length === 0) return null;
  const createdAt = new Date().toISOString();
  const orderNumber = getNextOrderNumber();
  const cleanCoupon = appliedCoupon ? appliedCoupon.trim().toUpperCase() : null;

  const insertStmt = db.prepare(`
    INSERT INTO bookings (
      order_number, ticket_id, booking_date, time_slot, quantity, 
      customer_name, customer_email, customer_phone, total_amount, 
      payment_status, fulfillment_status, simulator_name, simulator_slot, applied_coupon, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', 'Unfulfilled', ?, ?, ?, ?)
  `);

  const insertedIds: number[] = [];

  const runTransaction = db.transaction(() => {
    for (const item of items) {
      const info = insertStmt.run(
        orderNumber,
        item.ticketId,
        item.date,
        item.timeSlot,
        item.quantity,
        customerName,
        customerEmail,
        customerPhone,
        item.itemTotal,
        item.simulatorName || null,
        item.simulatorSlot || null,
        cleanCoupon,
        createdAt
      );
      insertedIds.push(Number(info.lastInsertRowid));
    }
  });

  runTransaction();

  return {
    orderNumber,
    primaryId: insertedIds[0] || orderNumber,
    insertedIds,
    createdAt
  };
}

export function addBooking(
  ticketId: number, 
  date: string, 
  timeSlot: string, 
  quantity: number, 
  customerName: string, 
  customerEmail: string, 
  customerPhone: string, 
  totalAmount: number,
  simulatorName?: string,
  simulatorSlot?: string,
  explicitOrderNumber?: number
) {
  const createdAt = new Date().toISOString();
  const orderNumber = explicitOrderNumber || getNextOrderNumber();
  const info = db.prepare(`
    INSERT INTO bookings (
      order_number, ticket_id, booking_date, time_slot, quantity, 
      customer_name, customer_email, customer_phone, total_amount, 
      payment_status, fulfillment_status, simulator_name, simulator_slot, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', 'Unfulfilled', ?, ?, ?)
  `).run(orderNumber, ticketId, date, timeSlot, quantity, customerName, customerEmail, customerPhone, totalAmount, simulatorName || null, simulatorSlot || null, createdAt);

  return { id: Number(info.lastInsertRowid), orderNumber, createdAt };
}

export function updateTicketStatus(id: number, active: boolean) {
  return db.prepare('UPDATE tickets SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

export function updateTicket(
  id: number, 
  price: number, 
  capacity: number,
  hasSimulatorPerk = false,
  perkDurationMins = 30,
  perkTitle = "",
  description = "",
  benefits = ""
) {
  return db.prepare(`
    UPDATE tickets 
    SET price = ?, capacity = ?, has_simulator_perk = ?, perk_duration_mins = ?, perk_title = ?, description = ?, benefits = ?
    WHERE id = ?
  `).run(
    price, 
    capacity, 
    hasSimulatorPerk ? 1 : 0, 
    perkDurationMins, 
    perkTitle.trim() || null, 
    description.trim() || null, 
    benefits.trim() || null, 
    id
  );
}

export function createTicket(
  name: string, 
  price: number, 
  capacity: number,
  hasSimulatorPerk = false,
  perkDurationMins = 30,
  perkTitle = "",
  description = "",
  benefits = ""
) {
  const formattedName = name.trim().toUpperCase().replace(/\s+/g, '_');
  return db.prepare(`
    INSERT INTO tickets (name, price, capacity, active, has_simulator_perk, perk_duration_mins, perk_title, description, benefits) 
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
  `).run(
    formattedName, 
    price, 
    capacity, 
    hasSimulatorPerk ? 1 : 0, 
    perkDurationMins, 
    perkTitle.trim() || null, 
    description.trim() || null, 
    benefits.trim() || null
  );
}

export function deleteTicket(id: number) {
  // If there are existing bookings associated with this ticket, either remove them or disable foreign key cascade safely
  return db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
}

// Coupon Database Methods
export function getCoupons(): CouponRow[] {
  return db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() as CouponRow[];
}

export function createCoupon(
  code: string, 
  discountType: 'percentage' | 'flat', 
  value: number, 
  maxUses: number | null, 
  expiryDate: string | null,
  isBandCoupon: boolean = false,
  bandCategory: string = 'VIP',
  bandColor: string | null = null
) {
  return db.prepare(`
    INSERT INTO coupons (code, discount_type, value, max_uses, expiry_date, is_band_coupon, band_category, band_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code.toUpperCase().trim(), 
    discountType, 
    value, 
    maxUses, 
    expiryDate || null, 
    isBandCoupon ? 1 : 0, 
    bandCategory || 'VIP', 
    bandColor || null
  );
}

export function bulkCreateCoupons(coupons: { 
  code: string; 
  discountType: 'percentage' | 'flat'; 
  value: number; 
  maxUses: number | null;
  isBandCoupon?: boolean;
  bandCategory?: string;
  bandColor?: string;
}[]) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO coupons (code, discount_type, value, max_uses, is_band_coupon, band_category, band_color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const transaction = db.transaction((list: typeof coupons) => {
    let created = 0;
    for (const c of list) {
      const result = insert.run(
        c.code.toUpperCase().trim(), 
        c.discountType, 
        c.value, 
        c.maxUses,
        c.isBandCoupon ? 1 : 0,
        c.bandCategory || 'VIP',
        c.bandColor || null
      );
      if (result.changes > 0) created++;
    }
    return created;
  });
  return transaction(coupons);
}

export function deleteCoupon(id: number) {
  return db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
}

export function deleteAllCoupons() {
  return db.prepare('DELETE FROM coupons').run();
}

export function deleteMultipleCoupons(ids: number[]) {
  if (ids.length === 0) return { changes: 0 };
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`DELETE FROM coupons WHERE id IN (${placeholders})`).run(...ids);
}

export function getCouponByCode(code: string): CouponRow | undefined {
  return db.prepare('SELECT * FROM coupons WHERE code = ?').get(code.toUpperCase().trim()) as CouponRow | undefined;
}

export function incrementCouponUsage(code: string) {
  return db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(code.toUpperCase().trim());
}

export function bulkUpdateCouponsExpiry(ids: number[], expiryDate: string | null) {
  if (ids.length === 0) return { changes: 0 };
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`UPDATE coupons SET expiry_date = ? WHERE id IN (${placeholders})`).run(expiryDate || null, ...ids);
}

export function bulkUpdateAllCouponsExpiry(expiryDate: string | null) {
  return db.prepare(`UPDATE coupons SET expiry_date = ?`).run(expiryDate || null);
}

export function bulkConvertToBandCoupons(
  ids: number[], 
  isBandCoupon: boolean = true, 
  bandCategory: string = 'VIP', 
  bandColor: string | null = '#FFD700'
) {
  if (ids.length === 0) return { changes: 0 };
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`
    UPDATE coupons 
    SET is_band_coupon = ?, 
        band_category = ?, 
        band_color = ? 
    WHERE id IN (${placeholders})
  `).run(isBandCoupon ? 1 : 0, bandCategory, bandColor, ...ids);
}

export function convertCouponToBandCoupon(
  id: number, 
  isBandCoupon: boolean = true, 
  bandCategory: string = 'VIP', 
  bandColor: string | null = '#FFD700'
) {
  return db.prepare(`
    UPDATE coupons 
    SET is_band_coupon = ?, 
        band_category = ?, 
        band_color = ? 
    WHERE id = ?
  `).run(isBandCoupon ? 1 : 0, bandCategory, bandColor, id);
}

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  role: string;
  permissions?: string;
  must_change_password?: number;
  created_at: string;
}

export function getAllAdminUsers(): Omit<AdminUser, 'password_hash'>[] {
  return db.prepare('SELECT id, username, name, role, permissions, must_change_password, created_at FROM admin_users ORDER BY id ASC').all() as Omit<AdminUser, 'password_hash'>[];
}

export function getAdminUserById(id: number): AdminUser | undefined {
  return db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as AdminUser | undefined;
}

export function getAdminUserByUsername(username: string): AdminUser | undefined {
  const clean = username.trim().toLowerCase();
  return db.prepare('SELECT * FROM admin_users WHERE LOWER(username) = ?').get(clean) as AdminUser | undefined;
}

export function createAdminStaffUser(username: string, passwordHash: string, name: string, role: string, permissions: string, mustChangePassword = 1) {
  return db.prepare(`
    INSERT INTO admin_users (username, password_hash, name, role, permissions, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username.trim().toLowerCase(), passwordHash, name.trim(), role, permissions, mustChangePassword);
}

export function updateStaffRoleAndPerms(id: number, role: string, permissions: string) {
  return db.prepare(`
    UPDATE admin_users 
    SET role = ?, permissions = ? 
    WHERE id = ?
  `).run(role, permissions, id);
}

export function resetStaffUserPassword(id: number, passwordHash: string, mustChangePassword = 1) {
  return db.prepare(`
    UPDATE admin_users 
    SET password_hash = ?, must_change_password = ? 
    WHERE id = ?
  `).run(passwordHash, mustChangePassword, id);
}

export function deleteStaffUser(id: number) {
  return db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);
}

export function updateAdminPassword(username: string, passwordHash: string) {
  return db.prepare('UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE username = ?').run(passwordHash, username.trim());
}

// VIP Perks (Simulator options for VIP Participant pass)
export interface VipPerkRow {
  id: number;
  name: string;
  category: string;
  tagline: string;
  image: string;
  active: number;
  sort_order: number;
  created_at?: string;
}

export function getVipPerks(activeOnly = false): VipPerkRow[] {
  if (activeOnly) {
    return db.prepare('SELECT * FROM vip_perks WHERE active = 1 ORDER BY sort_order ASC, id ASC').all() as VipPerkRow[];
  }
  return db.prepare('SELECT * FROM vip_perks ORDER BY sort_order ASC, id ASC').all() as VipPerkRow[];
}

export function createVipPerk(name: string, category: string, tagline: string, image: string, sortOrder = 0) {
  return db.prepare(`
    INSERT INTO vip_perks (name, category, tagline, image, active, sort_order)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(name.trim(), category.trim(), tagline.trim(), image.trim(), sortOrder);
}

export function updateVipPerk(id: number, name: string, category: string, tagline: string, image: string, sortOrder = 0) {
  return db.prepare(`
    UPDATE vip_perks 
    SET name = ?, category = ?, tagline = ?, image = ?, sort_order = ?
    WHERE id = ?
  `).run(name.trim(), category.trim(), tagline.trim(), image.trim(), sortOrder, id);
}

export function toggleVipPerkStatus(id: number, active: boolean) {
  return db.prepare('UPDATE vip_perks SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

export function deleteVipPerk(id: number) {
  return db.prepare('DELETE FROM vip_perks WHERE id = ?').run(id);
}

export function syncSimPodiumSimulators(sims: Array<{ name: string; category: string; tagline: string; image: string }>) {
  const existing = db.prepare('SELECT id, name FROM vip_perks').all() as { id: number; name: string }[];
  const existingNames = new Set(existing.map(e => e.name.trim().toLowerCase()));

  const insert = db.prepare(`
    INSERT INTO vip_perks (name, category, tagline, image, active, sort_order)
    VALUES (?, ?, ?, ?, 1, ?)
  `);

  let order = existing.length + 1;
  for (const sim of sims) {
    if (!existingNames.has(sim.name.trim().toLowerCase())) {
      insert.run(sim.name.trim(), sim.category.trim(), sim.tagline.trim(), sim.image.trim(), order++);
    }
  }
}

// Blocked Slots & Dates Management
export interface BlockedSlotRow {
  id: number;
  booking_date: string;
  time_slot: string;
  ticket_id?: number | null;
  ticket_name?: string | null;
  reason?: string | null;
  created_at?: string;
}

export function getBlockedSlots(): BlockedSlotRow[] {
  return db.prepare(`
    SELECT b.*, t.name as ticket_name 
    FROM blocked_slots b
    LEFT JOIN tickets t ON b.ticket_id = t.id
    ORDER BY b.id DESC
  `).all() as BlockedSlotRow[];
}

export function getBlockedSlotsForDate(date: string): BlockedSlotRow[] {
  return db.prepare(`
    SELECT b.*, t.name as ticket_name 
    FROM blocked_slots b
    LEFT JOIN tickets t ON b.ticket_id = t.id
    WHERE b.booking_date = ? OR b.booking_date = 'ALL'
  `).all(date.trim()) as BlockedSlotRow[];
}

export function isDateOrSlotBlocked(date: string, timeSlot?: string, ticketId?: number): boolean {
  if (timeSlot) {
    const res = db.prepare(`
      SELECT COUNT(*) as count FROM blocked_slots
      WHERE (booking_date = ? OR booking_date = 'ALL')
        AND (time_slot = ? OR time_slot = 'ALL_DAY')
        AND (ticket_id IS NULL OR ticket_id = ?)
    `).get(date.trim(), timeSlot.trim(), ticketId || null) as { count: number };
    return res.count > 0;
  } else {
    // Check if entire date is blocked
    const res = db.prepare(`
      SELECT COUNT(*) as count FROM blocked_slots
      WHERE (booking_date = ? OR booking_date = 'ALL')
        AND time_slot = 'ALL_DAY'
        AND (ticket_id IS NULL OR ticket_id = ?)
    `).get(date.trim(), ticketId || null) as { count: number };
    return res.count > 0;
  }
}

export function blockSlotOrDate(bookingDate: string, timeSlot: string, reason?: string, ticketId?: number | null) {
  // If ticketId is specified, check for existing entry with same date, slot, and ticketId
  const tid = ticketId && ticketId > 0 ? ticketId : null;
  const existing = tid
    ? db.prepare('SELECT id FROM blocked_slots WHERE booking_date = ? AND time_slot = ? AND ticket_id = ?').get(bookingDate.trim(), timeSlot.trim(), tid) as { id: number } | undefined
    : db.prepare('SELECT id FROM blocked_slots WHERE booking_date = ? AND time_slot = ? AND ticket_id IS NULL').get(bookingDate.trim(), timeSlot.trim()) as { id: number } | undefined;

  if (existing) {
    return db.prepare('UPDATE blocked_slots SET reason = ? WHERE id = ?').run(reason?.trim() || null, existing.id);
  }

  return db.prepare(`
    INSERT INTO blocked_slots (booking_date, time_slot, reason, ticket_id)
    VALUES (?, ?, ?, ?)
  `).run(bookingDate.trim(), timeSlot.trim(), reason?.trim() || null, tid);
}

export function unblockSlot(id: number) {
  return db.prepare('DELETE FROM blocked_slots WHERE id = ?').run(id);
}

export function unblockSpecificSlot(bookingDate: string, timeSlot: string, ticketId?: number | null) {
  const tid = ticketId && ticketId > 0 ? ticketId : null;
  if (tid) {
    return db.prepare(`
      DELETE FROM blocked_slots 
      WHERE booking_date = ? AND time_slot = ? AND ticket_id = ?
    `).run(bookingDate.trim(), timeSlot.trim(), tid);
  }
  return db.prepare(`
    DELETE FROM blocked_slots 
    WHERE booking_date = ? AND time_slot = ? AND ticket_id IS NULL
  `).run(bookingDate.trim(), timeSlot.trim());
}

// Time Slots Database Methods
export interface TimeSlotRow {
  id: number;
  label: string;
  start_hour: number;
  end_hour: number;
  active: number;
  sort_order: number;
  color?: string | null;
  color_name?: string | null;
  remark?: string | null;
  created_at?: string;
}

export function getTimeSlots(activeOnly = false): TimeSlotRow[] {
  if (activeOnly) {
    return db.prepare('SELECT * FROM time_slots WHERE active = 1 ORDER BY sort_order ASC, start_hour ASC').all() as TimeSlotRow[];
  }
  return db.prepare('SELECT * FROM time_slots ORDER BY sort_order ASC, start_hour ASC').all() as TimeSlotRow[];
}

export function createTimeSlot(label: string, startHour: number, endHour: number, sortOrder = 0, color?: string, colorName?: string, remark?: string) {
  return db.prepare(`
    INSERT INTO time_slots (label, start_hour, end_hour, active, sort_order, color, color_name, remark)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?)
  `).run(label.trim(), startHour, endHour, sortOrder, color?.trim() || null, colorName?.trim() || null, remark?.trim() || null);
}

export function updateTimeSlot(id: number, label: string, startHour: number, endHour: number, sortOrder = 0, color?: string, colorName?: string, remark?: string) {
  return db.prepare(`
    UPDATE time_slots 
    SET label = ?, start_hour = ?, end_hour = ?, sort_order = ?, color = ?, color_name = ?, remark = ?
    WHERE id = ?
  `).run(label.trim(), startHour, endHour, sortOrder, color?.trim() || null, colorName?.trim() || null, remark?.trim() || null, id);
}

export function getTimeSlotByLabel(label: string): TimeSlotRow | undefined {
  return db.prepare('SELECT * FROM time_slots WHERE label = ?').get(label.trim()) as TimeSlotRow | undefined;
}

export function toggleTimeSlotStatus(id: number, active: boolean) {
  return db.prepare('UPDATE time_slots SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

export function deleteTimeSlot(id: number) {
  return db.prepare('DELETE FROM time_slots WHERE id = ?').run(id);
}

// Site Settings Methods
export function getSiteSetting(key: string, defaultValue = ""): string {
  try {
    const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function setSiteSetting(key: string, value: string, description?: string) {
  return db.prepare(`
    INSERT INTO site_settings (key, value, description)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, description = COALESCE(excluded.description, site_settings.description)
  `).run(key, value, description || null);
}


