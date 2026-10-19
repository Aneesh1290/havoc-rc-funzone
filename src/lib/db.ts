import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });

// Initialize database schema
export function initDB() {
  db.exec(`
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
  `);
  
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
  created_at: string;
}

export function getTickets(): TicketRow[] {
  return db.prepare('SELECT * FROM tickets').all() as TicketRow[];
}

export function getBookedQuantities(date: string, timeSlot: string): { ticket_id: number, total_booked: number }[] {
  return db.prepare(`
    SELECT ticket_id, SUM(quantity) as total_booked 
    FROM bookings 
    WHERE booking_date = ? AND time_slot = ?
      AND LOWER(COALESCE(fulfillment_status, '')) NOT IN ('canceled', 'cancelled')
      AND LOWER(COALESCE(payment_status, '')) NOT IN ('refunded', 'canceled', 'cancelled')
    GROUP BY ticket_id
  `).all(date, timeSlot) as { ticket_id: number, total_booked: number }[];
}

export function getAllBookings() {
  return db.prepare(`
    SELECT 
      b.id, b.booking_date, b.time_slot, b.quantity, b.customer_name, b.customer_email, b.customer_phone, b.total_amount, 
      b.payment_status, b.fulfillment_status, b.tags, b.simulator_name, b.simulator_slot, b.created_at,
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
      b.id, b.booking_date, b.time_slot, b.quantity, b.customer_name, b.customer_email, b.customer_phone, b.total_amount, 
      b.payment_status, b.fulfillment_status, b.tags, b.simulator_name, b.simulator_slot, b.created_at,
      b.ticket_id, COALESCE(t.name, 'CUSTOM_TICKET') as ticket_name, COALESCE(t.price, 0) as ticket_price,
      s.color as slot_color, s.color_name as slot_color_name
    FROM bookings b
    LEFT JOIN tickets t ON b.ticket_id = t.id
    LEFT JOIN time_slots s ON b.time_slot = s.label
    WHERE b.id = ?
  `).get(id);
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

export function deleteBookings(ids: number[]) {
  if (!ids || ids.length === 0) return { changes: 0 };
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`DELETE FROM bookings WHERE id IN (${placeholders})`).run(...ids);
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
  simulatorSlot?: string
) {
  const createdAt = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO bookings (
      ticket_id, booking_date, time_slot, quantity, 
      customer_name, customer_email, customer_phone, total_amount, 
      payment_status, fulfillment_status, simulator_name, simulator_slot, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Unpaid', 'Unfulfilled', ?, ?, ?)
  `).run(ticketId, date, timeSlot, quantity, customerName, customerEmail, customerPhone, totalAmount, simulatorName || null, simulatorSlot || null, createdAt);

  return { id: Number(info.lastInsertRowid), createdAt };
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

export function createCoupon(code: string, discountType: 'percentage' | 'flat', value: number, maxUses: number | null, expiryDate: string | null) {
  return db.prepare(`
    INSERT INTO coupons (code, discount_type, value, max_uses, expiry_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(code.toUpperCase().trim(), discountType, value, maxUses, expiryDate || null);
}

export function bulkCreateCoupons(coupons: { code: string; discountType: 'percentage' | 'flat'; value: number; maxUses: number | null }[]) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO coupons (code, discount_type, value, max_uses)
    VALUES (?, ?, ?, ?)
  `);
  const transaction = db.transaction((list: typeof coupons) => {
    let created = 0;
    for (const c of list) {
      const result = insert.run(c.code.toUpperCase().trim(), c.discountType, c.value, c.maxUses);
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

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  role: string;
  created_at: string;
}

export function getAdminUserByUsername(username: string): AdminUser | undefined {
  return db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username.trim()) as AdminUser | undefined;
}

export function updateAdminPassword(username: string, passwordHash: string) {
  return db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(passwordHash, username.trim());
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
  reason?: string | null;
  created_at?: string;
}

export function getBlockedSlots(): BlockedSlotRow[] {
  return db.prepare('SELECT * FROM blocked_slots ORDER BY id DESC').all() as BlockedSlotRow[];
}

export function getBlockedSlotsForDate(date: string): BlockedSlotRow[] {
  return db.prepare(`
    SELECT * FROM blocked_slots 
    WHERE booking_date = ? OR booking_date = 'ALL'
  `).all(date.trim()) as BlockedSlotRow[];
}

export function isDateOrSlotBlocked(date: string, timeSlot?: string): boolean {
  if (timeSlot) {
    const res = db.prepare(`
      SELECT COUNT(*) as count FROM blocked_slots
      WHERE (booking_date = ? OR booking_date = 'ALL')
        AND (time_slot = ? OR time_slot = 'ALL_DAY')
    `).get(date.trim(), timeSlot.trim()) as { count: number };
    return res.count > 0;
  } else {
    // Check if entire date is blocked
    const res = db.prepare(`
      SELECT COUNT(*) as count FROM blocked_slots
      WHERE (booking_date = ? OR booking_date = 'ALL')
        AND time_slot = 'ALL_DAY'
    `).get(date.trim()) as { count: number };
    return res.count > 0;
  }
}

export function blockSlotOrDate(bookingDate: string, timeSlot: string, reason?: string) {
  return db.prepare(`
    INSERT INTO blocked_slots (booking_date, time_slot, reason)
    VALUES (?, ?, ?)
    ON CONFLICT(booking_date, time_slot) DO UPDATE SET reason = excluded.reason
  `).run(bookingDate.trim(), timeSlot.trim(), reason?.trim() || null);
}

export function unblockSlot(id: number) {
  return db.prepare('DELETE FROM blocked_slots WHERE id = ?').run(id);
}

export function unblockSpecificSlot(bookingDate: string, timeSlot: string) {
  return db.prepare(`
    DELETE FROM blocked_slots 
    WHERE booking_date = ? AND time_slot = ?
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


