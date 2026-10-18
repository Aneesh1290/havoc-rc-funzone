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
  `);
  
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
      COALESCE(t.name, 'CUSTOM_TICKET') as ticket_name, COALESCE(t.price, 0) as ticket_price
    FROM bookings b
    LEFT JOIN tickets t ON b.ticket_id = t.id
    ORDER BY b.id DESC
  `).all();
}

export function getBookingById(id: number) {
  return db.prepare(`
    SELECT 
      b.id, b.booking_date, b.time_slot, b.quantity, b.customer_name, b.customer_email, b.customer_phone, b.total_amount, 
      b.payment_status, b.fulfillment_status, b.tags, b.simulator_name, b.simulator_slot, b.created_at,
      b.ticket_id, COALESCE(t.name, 'CUSTOM_TICKET') as ticket_name, COALESCE(t.price, 0) as ticket_price
    FROM bookings b
    LEFT JOIN tickets t ON b.ticket_id = t.id
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

