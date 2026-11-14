import { Pool } from 'pg';

const SIMULATOR_DATABASE_URL = process.env.SIMULATOR_DATABASE_URL || process.env.DATABASE_URL;

if (!SIMULATOR_DATABASE_URL) {
  console.warn("WARNING: SIMULATOR_DATABASE_URL is not set in environment variables.");
}

// Global singleton pool for Next.js to prevent connection exhaustion in dev/serverless
declare global {
  var _simulatorPool: Pool | undefined;
}

export const simulatorPool = 
  global._simulatorPool || 
  new Pool({
    connectionString: SIMULATOR_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

// Always store singleton on global so all server action chunks share the exact same pool
if (!global._simulatorPool) {
  global._simulatorPool = simulatorPool;
}

/**
 * Normalizes RC Fun Zone date format (e.g. "Oct 17", "October 17", "Oct 17 (Sat)")
 * to match Havoc Sim Podium's format 'Mmm DD (Ddd)' e.g. 'Oct 17 (Sat)'.
 */
export function formatToSimulatorDate(rcDate: string, targetYear?: number): string {
  if (!rcDate) return rcDate;
  const trimmed = rcDate.trim();
  
  // If already formatted like 'Oct 17 (Sat)', return as-is
  if (/^[A-Za-z]{3}\s+\d{1,2}\s+\([A-Za-z]{3}\)$/.test(trimmed)) {
    return trimmed;
  }

  // Parse strings like "Oct 17", "October 17", "2026-10-17"
  const year = targetYear || new Date().getFullYear();
  let parsedDate: Date | null = null;

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const mStr = parts[0].toLowerCase().slice(0, 3);
    const mIdx = monthNames.indexOf(mStr);
    const day = parseInt(parts[1], 10);
    if (mIdx >= 0 && !isNaN(day)) {
      parsedDate = new Date(year, mIdx, day);
    }
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) {
    parsedDate = new Date(trimmed);
  }

  if (isNaN(parsedDate.getTime())) {
    return trimmed;
  }

  const shortMonth = parsedDate.toLocaleString('en-US', { month: 'short' });
  const dayNum = parsedDate.getDate();
  const shortWeekday = parsedDate.toLocaleString('en-US', { weekday: 'short' });

  return `${shortMonth} ${dayNum} (${shortWeekday})`;
}

/**
 * Helper to split multi-slot strings into individual simulator slots.
 * E.g. "#1: Race Sim GT | #2: RC Flying Sim (#1: 12PM-12:30PM • #2: 12:30PM-1PM)"
 * or "12PM-12:30PM"
 * If a 1-hour single slot is provided (e.g. "5:00PM-6:00PM" or "5PM-6PM"),
 * it automatically expands into both 30-minute constituent slots ("5PM-5:30PM" and "5:30PM-6PM")
 * so that both corresponding 30-minute slots are locked in simulator_slot_locks.
 */
export function parseSimulatorSlotAssignments(simNameStr?: string, simSlotStr?: string): Array<{
  simulatorName: string;
  slotLabel: string;
}> {
  if (!simNameStr && !simSlotStr) return [];

  // Check if multiple sessions are encoded (e.g. #1: ... | #2: ...)
  if (simNameStr && (simNameStr.includes('#1:') || (simSlotStr && simSlotStr.includes('#1')))) {
    const results: Array<{ simulatorName: string; slotLabel: string }> = [];
    
    // Extract sim names: "#1 (P1): Race Sim GT | #2 (P2): RC Flying Sim", "#1: Race Sim GT", etc.
    const names: string[] = [];
    if (simNameStr.includes('#1:') || simNameStr.includes('#1')) {
      const nameSegments = simNameStr.split('|').map(s => s.trim());
      for (const seg of nameSegments) {
        // Strip out "#1 (Participant 1): " or "#1: " prefixes
        const clean = seg.replace(/^#\d+(?:\s*\([^)]*\))?:\s*/, '').trim();
        if (clean) names.push(clean);
      }
    } else {
      names.push(simNameStr.trim());
    }

    // Extract slot labels: "(#1 (P1 - Race Sim GT): 12PM-12:30PM • #2 (P2 - RC Flying Sim): 12:30PM-1PM)"
    const slots: string[] = [];
    if (simSlotStr) {
      const slotSegments = simSlotStr.replace(/[()]/g, '').split('•').map(s => s.trim());
      for (const seg of slotSegments) {
        const match = seg.match(/(\d{1,2}(?::\d{2})?(?:AM|PM)-\d{1,2}(?::\d{2})?(?:AM|PM))/i);
        if (match) {
          slots.push(match[1]);
        }
      }
    }

    const count = Math.max(names.length, slots.length);
    for (let i = 0; i < count; i++) {
      results.push({
        simulatorName: names[i] || names[0] || 'Race Sim GT',
        slotLabel: slots[i] || ''
      });
    }

    return results;
  }

  // Handle single simulator slot
  const baseSimName = simNameStr || 'Race Sim GT';
  const rawSlot = (simSlotStr || '').trim();

  // If slot is a 1-hour interval, split into two 30-min slots:
  // e.g. "5PM-6PM", "5:00PM-6:00PM", "11AM-12PM"
  const hourMatch = rawSlot.match(/^(\d{1,2})(?::00)?(AM|PM)\s*-\s*(\d{1,2})(?::00)?(AM|PM)$/i);
  if (hourMatch) {
    const startH = parseInt(hourMatch[1], 10);
    const startMeridiem = hourMatch[2].toUpperCase();
    const endH = parseInt(hourMatch[3], 10);
    const endMeridiem = hourMatch[4].toUpperCase();

    // Calculate duration in hours
    let s24 = startH % 12 + (startMeridiem === 'PM' ? 12 : 0);
    let e24 = endH % 12 + (endMeridiem === 'PM' ? 12 : 0);
    if (e24 <= s24) e24 += 24;

    if (e24 - s24 === 1) {
      // 1 hour span -> two 30-minute slots
      const slot1 = `${startH}${startMeridiem}-${startH}:30${startMeridiem}`;
      const slot2 = `${startH}:30${startMeridiem}-${endH}${endMeridiem}`;
      return [
        { simulatorName: baseSimName, slotLabel: slot1 },
        { simulatorName: baseSimName, slotLabel: slot2 }
      ];
    }
  }

  return [{
    simulatorName: baseSimName,
    slotLabel: rawSlot
  }];
}

/**
 * Ensures simulator_slot_locks table exists with proper unique constraint
 */
export async function initSimulatorLocksTable() {
  try {
    await simulatorPool.query(`
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
    `);
  } catch (err) {
    console.error('Error verifying/initializing simulator_slot_locks table:', err);
  }
}

// Fast in-memory cache for taken simulator slots (20-second TTL to avoid duplicate remote PG calls)
const takenSlotsCache = new Map<string, { data: string[]; timestamp: number }>();
const TAKEN_SLOTS_CACHE_TTL = 20 * 1000;

export function invalidateTakenSlotsCache() {
  takenSlotsCache.clear();
}

/**
 * Query locked/taken slots for a specific simulator and date
 */
export async function getTakenSimulatorSlots(simulatorName: string, bookingDate: string): Promise<string[]> {
  const cacheKey = `${simulatorName}:::${bookingDate}`;
  const cached = takenSlotsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TAKEN_SLOTS_CACHE_TTL) {
    return cached.data;
  }

  try {
    const formattedDate = formatToSimulatorDate(bookingDate);
    // Timeout promise (3.5s) to avoid 60s freeze if Render PostgreSQL is cold/sleeping
    const queryPromise = simulatorPool.query<{ booking_time: string }>(
      `SELECT booking_time FROM simulator_slot_locks 
       WHERE simulator_name = $1 
         AND (booking_date = $2 OR booking_date = $3)
         AND status IN ('PENDING', 'PAID', 'ATTENDED', 'CONFIRMED');`,
      [simulatorName, formattedDate, bookingDate]
    );

    const timeoutPromise = new Promise<{ rows: { booking_time: string }[] }>((resolve) =>
      setTimeout(() => resolve({ rows: [] }), 3500)
    );

    const res = await Promise.race([queryPromise, timeoutPromise]);
    const results = res.rows.map(r => r.booking_time);
    takenSlotsCache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  } catch (err) {
    console.error(`Error querying taken simulator slots for ${simulatorName} on ${bookingDate}:`, err);
    return [];
  }
}

/**
 * Lock simulator slot(s) for a booking and record the reservation in Havoc Sim Podium's bookings table
 */
export async function lockSimulatorSlot(params: {
  simulatorName: string;
  bookingDate: string;
  bookingTime: string;
  sourceOrderId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  status?: string;
}): Promise<{ success: boolean; error?: string }> {
  const {
    simulatorName,
    bookingDate,
    bookingTime,
    sourceOrderId,
    customerName,
    customerEmail,
    customerPhone,
    status = 'CONFIRMED'
  } = params;

  try {
    const formattedDate = formatToSimulatorDate(bookingDate);

    // 1. Lock slot in simulator_slot_locks table to enforce concurrency & live availability
    await simulatorPool.query(
      `INSERT INTO simulator_slot_locks 
       (simulator_name, booking_date, booking_time, source_platform, source_order_id, customer_name, customer_phone, status, created_at)
       VALUES ($1, $2, $3, 'HAVOC_RC_FUN_ZONE', $4, $5, $6, $7, NOW())
       ON CONFLICT (simulator_name, booking_date, booking_time) 
       DO UPDATE SET 
         source_platform = EXCLUDED.source_platform,
         source_order_id = EXCLUDED.source_order_id,
         customer_name = EXCLUDED.customer_name,
         customer_phone = EXCLUDED.customer_phone,
         status = EXCLUDED.status,
         created_at = NOW()
       WHERE simulator_slot_locks.status = 'CANCELLED';`,
      [simulatorName, formattedDate, bookingTime, sourceOrderId, customerName || null, customerPhone || null, status]
    );

    // 2. Also record an official booking entry in Havoc Sim Podium's `bookings` table
    // so it shows up in their dashboard/admin panel alongside regular Sim Podium reservations.
    try {
      await simulatorPool.query(
        `INSERT INTO bookings (
          order_id, name, email, phone, item_name, price, booking_date, booking_time, status, created_at, instructor_id, instructor_fee, players
        ) VALUES (
          $1, $2, $3, $4, $5, 0, $6, $7, $8, NOW(), NULL, 0, 1
        )
        ON CONFLICT (order_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          item_name = EXCLUDED.item_name,
          booking_date = EXCLUDED.booking_date,
          booking_time = EXCLUDED.booking_time,
          status = EXCLUDED.status;`,
        [
          sourceOrderId,
          customerName || 'RC Fun Zone Guest',
          customerEmail || 'havocrcfunzone@gmail.com',
          customerPhone || 'N/A',
          simulatorName,
          formattedDate,
          bookingTime,
          status === 'CONFIRMED' ? 'PAID' : status
        ]
      );
    } catch (bookingTableErr) {
      console.error('Error inserting into Sim Podium bookings table:', bookingTableErr);
    }

    invalidateTakenSlotsCache();
    return { success: true };
  } catch (err: any) {
    console.error('Error locking simulator slot in PostgreSQL:', err);
    if (err.code === '23505') {
      return { success: false, error: 'Slot is already booked or reserved on Havoc Sim Podium' };
    }
    return { success: false, error: err.message || 'Failed to lock simulator slot' };
  }
}

/**
 * Cancel or release locked slots by source order ID (updates simulator_slot_locks and bookings table)
 */
/**
 * Synchronize fulfillment and payment status changes from RC Fun Zone to Havoc Sim Podium.
 * When an order is marked Fulfilled/Attended or Paid in RC Fun Zone, this updates
 * the corresponding bookings and locks in Havoc Sim Podium's PostgreSQL database.
 */
export async function syncSimulatorOrderStatus(
  orderNumberOrId: number | string,
  fulfillmentStatus?: string,
  paymentStatus?: string
): Promise<boolean> {
  try {
    const rawNum = String(orderNumberOrId).replace(/^#+PAYDUE_FZ_/, '').replace(/^#+/, '');
    const num = parseInt(rawNum, 10);
    const orderVariants: string[] = [
      `#PAYDUE_FZ_${rawNum}`,
      `PAYDUE_FZ_${rawNum}`,
      `##PAYDUE_FZ_${rawNum}`
    ];
    if (!isNaN(num)) {
      orderVariants.push(`#PAYDUE_FZ_${num}`, `PAYDUE_FZ_${num}`, `##PAYDUE_FZ_${num}`);
    }

    // Determine target Sim Podium status
    // Sim Podium statuses: 'ATTENDED', 'PAID', 'PENDING', 'CANCELLED'
    let targetBookingStatus: string | null = null;
    let targetLockStatus: string | null = null;

    const fLower = (fulfillmentStatus || '').toLowerCase();
    const pLower = (paymentStatus || '').toLowerCase();

    if (fLower === 'fulfilled' || fLower === 'attended') {
      targetBookingStatus = 'ATTENDED';
      targetLockStatus = 'ATTENDED';
    } else if (fLower === 'canceled' || fLower === 'cancelled' || pLower === 'refunded') {
      targetBookingStatus = 'CANCELLED';
      targetLockStatus = 'CANCELLED';
    } else if (pLower === 'paid') {
      // If payment is paid but fulfillment is unfulfilled, keep PAID
      if (fLower === 'unfulfilled') {
        targetBookingStatus = 'PAID';
        targetLockStatus = 'PAID';
      }
    } else if (fLower === 'unfulfilled') {
      targetBookingStatus = 'PAID'; // In Sim Podium, UNFULFILLED active paid session is 'PAID'
      targetLockStatus = 'PAID';
    }

    if (!targetBookingStatus) {
      return true; // No status mapping needed
    }

    // 1. Update bookings table in Havoc Sim Podium
    for (const ord of orderVariants) {
      await simulatorPool.query(
        `UPDATE bookings 
         SET status = $1 
         WHERE order_id = $2 
            OR order_id LIKE $2 || '_%' 
            OR order_id LIKE '%' || $2 || '%'
            OR order_id LIKE '%FZ_' || $3 || '%'
            OR order_id LIKE '%FZ_' || $3 || '_%'`,
        [targetBookingStatus, ord, rawNum]
      );
    }

    // 2. Update simulator_slot_locks in Havoc Sim Podium
    if (targetLockStatus === 'CANCELLED') {
      for (const ord of orderVariants) {
        await simulatorPool.query(
          `UPDATE simulator_slot_locks 
           SET status = 'CANCELLED' 
           WHERE ((source_order_id = $1 OR source_order_id LIKE $1 || '_%' OR source_order_id LIKE '%' || $1 || '%')
              OR (source_order_id LIKE '%FZ_' || $2 || '%'))
             AND source_platform = 'HAVOC_RC_FUN_ZONE'`,
          [ord, rawNum]
        );
      }
    } else if (targetLockStatus) {
      for (const ord of orderVariants) {
        await simulatorPool.query(
          `UPDATE simulator_slot_locks 
           SET status = $1 
           WHERE ((source_order_id = $2 OR source_order_id LIKE $2 || '_%' OR source_order_id LIKE '%' || $2 || '%')
              OR (source_order_id LIKE '%FZ_' || $3 || '%'))
             AND source_platform = 'HAVOC_RC_FUN_ZONE'`,
          [targetLockStatus, ord, rawNum]
        );
      }
    }

    invalidateTakenSlotsCache();
    console.log(`[Simulator Sync] Synchronized status '${targetBookingStatus}' to Sim Podium for RC order #PAYDUE_FZ_${rawNum}`);
    return true;
  } catch (err) {
    console.error('Error syncing simulator order status to Sim Podium:', err);
    return false;
  }
}

export async function releaseSimulatorSlots(sourceOrderId: string, bookingId?: number): Promise<boolean> {
  try {
    const idSuffix = bookingId ? `_${bookingId}` : (sourceOrderId.includes('_') ? `_${sourceOrderId.split('_').pop()}` : '');
    
    // Release in simulator_slot_locks
    await simulatorPool.query(
      `UPDATE simulator_slot_locks 
       SET status = 'CANCELLED' 
       WHERE (source_order_id = $1 OR ($2 != '' AND source_order_id LIKE '%' || $2))
         AND source_platform = 'HAVOC_RC_FUN_ZONE'`,
      [sourceOrderId, idSuffix]
    );

    // Also update Sim Podium's bookings table to CANCELLED
    await simulatorPool.query(
      `UPDATE bookings 
       SET status = 'CANCELLED' 
       WHERE (order_id = $1 OR ($2 != '' AND order_id LIKE '%' || $2))`,
      [sourceOrderId, idSuffix]
    );

    invalidateTakenSlotsCache();
    invalidateTakenSlotsCache();
    return true;
  } catch (err) {
    console.error('Error releasing simulator slots for order:', sourceOrderId, err);
    return false;
  }
}

/**
 * Specifically release/cancel an individual simulator slot by simulatorName, bookingDate, and bookingTime.
 * Used when a specific VIP participant (e.g. P1 or P2) is eliminated/backed out.
 */
export async function releaseSpecificSimulatorSlot(params: {
  simulatorName: string;
  bookingDate: string;
  bookingTime: string;
  sourceOrderIdPrefix?: string;
}): Promise<boolean> {
  try {
    const { simulatorName, bookingDate, bookingTime, sourceOrderIdPrefix } = params;
    const formattedDate = formatToSimulatorDate(bookingDate);

    if (sourceOrderIdPrefix) {
      await simulatorPool.query(
        `UPDATE simulator_slot_locks 
         SET status = 'CANCELLED' 
         WHERE simulator_name = $1 
           AND (booking_date = $2 OR booking_date = $3)
           AND booking_time = $4
           AND (source_order_id = $5 OR source_order_id LIKE $5 || '_%')
           AND source_platform = 'HAVOC_RC_FUN_ZONE'`,
        [simulatorName, formattedDate, bookingDate, bookingTime, sourceOrderIdPrefix]
      );

      await simulatorPool.query(
        `UPDATE bookings 
         SET status = 'CANCELLED' 
         WHERE (order_id = $1 OR order_id LIKE $1 || '_%')
           AND booking_time = $2`,
        [sourceOrderIdPrefix, bookingTime]
      );
    } else {
      await simulatorPool.query(
        `UPDATE simulator_slot_locks 
         SET status = 'CANCELLED' 
         WHERE simulator_name = $1 
           AND (booking_date = $2 OR booking_date = $3)
           AND booking_time = $4
           AND source_platform = 'HAVOC_RC_FUN_ZONE'`,
        [simulatorName, formattedDate, bookingDate, bookingTime]
      );
    }

    invalidateTakenSlotsCache();
    invalidateTakenSlotsCache();
    return true;
  } catch (err) {
    console.error('Error releasing specific simulator slot:', params, err);
    return false;
  }
}

/**
 * Permanently delete temporary slot locks created for an online checkout hold (when hold expires or payment fails/cancelled)
 */
export async function deleteSimulatorSlotLocks(sourceOrderId: string): Promise<boolean> {
  try {
    await simulatorPool.query(
      `DELETE FROM simulator_slot_locks 
       WHERE (source_order_id = $1 OR source_order_id LIKE $1 || '_%')
         AND source_platform = 'HAVOC_RC_FUN_ZONE'`,
      [sourceOrderId]
    );

    await simulatorPool.query(
      `DELETE FROM bookings 
       WHERE (order_id = $1 OR order_id LIKE $1 || '_%')`,
      [sourceOrderId]
    );

    invalidateTakenSlotsCache();
    invalidateTakenSlotsCache();
    return true;
  } catch (err) {
    console.error('Error deleting simulator slot locks for order:', sourceOrderId, err);
    return false;
  }
}

/**
 * Release / delete an explicit simulator slot lock by its record ID in simulator_slot_locks
 */
export async function deleteSimulatorSlotLockById(id: number): Promise<boolean> {
  try {
    const existing = await simulatorPool.query(
      `SELECT source_order_id, booking_time FROM simulator_slot_locks WHERE id = $1`,
      [id]
    );

    await simulatorPool.query(
      `DELETE FROM simulator_slot_locks WHERE id = $1`,
      [id]
    );

    if (existing.rows.length > 0) {
      const { source_order_id, booking_time } = existing.rows[0];
      if (source_order_id) {
        await simulatorPool.query(
          `DELETE FROM bookings WHERE order_id = $1 AND booking_time = $2`,
          [source_order_id, booking_time]
        ).catch(() => {});
      }
    }

    invalidateTakenSlotsCache();
    return true;
  } catch (err) {
    console.error('Error deleting simulator slot lock by ID:', id, err);
    return false;
  }
}

/**
 * Fetch simulator slot locks (recent or filtered by date) for admin management view
 */
export async function getSimulatorSlotLocks(date?: string): Promise<Array<{
  id: number;
  simulator_name: string;
  booking_date: string;
  booking_time: string;
  source_platform: string;
  source_order_id: string;
  customer_name?: string;
  customer_phone?: string;
  status: string;
  created_at: string;
}>> {
  try {
    let query = `
      SELECT id, simulator_name, booking_date, booking_time, source_platform, 
             source_order_id, customer_name, customer_phone, status, created_at
      FROM simulator_slot_locks
      WHERE status IN ('PENDING', 'PAID', 'CONFIRMED', 'ATTENDED')
    `;
    const params: any[] = [];

    if (date) {
      const formattedDate = formatToSimulatorDate(date);
      query += ` AND (booking_date = $1 OR booking_date = $2)`;
      params.push(formattedDate, date);
    }

    query += ` ORDER BY created_at DESC LIMIT 200`;

    const res = await simulatorPool.query(query, params);
    return res.rows || [];
  } catch (err) {
    console.error('Error fetching simulator_slot_locks:', err);
    return [];
  }
}

/**
 * Confirm simulator slot locks when online payment succeeds:
 * updates source_order_id from tempTxnId (e.g. TXN_RC_123456) to official order ID (e.g. PAID_RC_58)
 * and sets status = 'CONFIRMED' / 'PAID'.
 */
export async function confirmSimulatorSlotLocks(
  tempTxnId: string, 
  finalOrderId: string, 
  customerName?: string, 
  customerPhone?: string
): Promise<boolean> {
  try {
    // 1. Update simulator_slot_locks: update base or prefix
    await simulatorPool.query(
      `UPDATE simulator_slot_locks 
       SET source_order_id = CASE 
             WHEN source_order_id = $1 THEN $2 
             ELSE $2 || SUBSTRING(source_order_id FROM LENGTH($1) + 1)
           END,
           status = 'CONFIRMED',
           customer_name = COALESCE($3, customer_name),
           customer_phone = COALESCE($4, customer_phone)
       WHERE (source_order_id = $1 OR source_order_id LIKE $1 || '_%')
         AND source_platform = 'HAVOC_RC_FUN_ZONE'`,
      [tempTxnId, finalOrderId, customerName || null, customerPhone || null]
    );

    // 2. Update bookings in Havoc Sim Podium table
    await simulatorPool.query(
      `UPDATE bookings 
       SET order_id = CASE 
             WHEN order_id = $1 THEN $2 
             ELSE $2 || SUBSTRING(order_id FROM LENGTH($1) + 1)
           END,
           status = 'PAID',
           name = COALESCE($3, name),
           phone = COALESCE($4, phone)
       WHERE (order_id = $1 OR order_id LIKE $1 || '_%')`,
      [tempTxnId, finalOrderId, customerName || null, customerPhone || null]
    );

    invalidateTakenSlotsCache();
    return true;
  } catch (err) {
    console.error('Error confirming simulator slot locks for order:', tempTxnId, '->', finalOrderId, err);
    return false;
  }
}

export interface SimPodiumProduct {
  id: number;
  name: string;
  type: string;
  price?: number;
  description?: string;
  image_url?: string;
}

// 5-minute memory cache for Sim Podium simulator list
let cachedSimulators: { data: SimPodiumProduct[]; timestamp: number } | null = null;
const SIMULATORS_CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetches all simulators/products that exist in the Havoc Sim Podium PostgreSQL database
 */
export async function getSimPodiumSimulators(): Promise<SimPodiumProduct[]> {
  if (cachedSimulators && Date.now() - cachedSimulators.timestamp < SIMULATORS_CACHE_TTL) {
    return cachedSimulators.data;
  }

  try {
    const queryPromise = simulatorPool.query(
      `SELECT id, name, type, price, description, image_url 
       FROM products 
       ORDER BY id ASC`
    );

    const timeoutPromise = new Promise<{ rows: any[] }>((resolve) =>
      setTimeout(() => resolve({ rows: [] }), 3500)
    );

    const res = await Promise.race([queryPromise, timeoutPromise]);
    if (res.rows.length > 0) {
      const data = res.rows.map(r => ({
        id: r.id,
        name: (r.name || '').trim(),
        type: (r.type || 'Simulator').trim(),
        price: r.price,
        description: r.description || '',
        image_url: r.image_url || ''
      }));
      cachedSimulators = { data, timestamp: Date.now() };
      return data;
    }
    return cachedSimulators?.data || [];
  } catch (err) {
    console.error('Error fetching simulators from Havoc Sim Podium database:', err);
    return cachedSimulators?.data || [];
  }
}

export interface SimPodiumSlot {
  id: number;
  time_range: string;
  active: number;
  sort_order: number;
  // Normalized 30-min slot label e.g. "11AM-11:30AM"
  label: string;
  // Start hour decimal for ordering and pass-filtering (e.g. 11.0, 11.5, 14.0)
  startHour: number;
}

/**
 * Parses a Sim Podium time_range string (e.g. "11:00 AM - 11:30 AM" or "02:00 PM - 02:30 PM")
 * into a compact label ("11AM-11:30AM") and numeric start hour (11.0 or 14.0).
 */
export function parseSimPodiumTimeRange(timeRange: string): { label: string; startHour: number } {
  const parts = timeRange.split('-').map(s => s.trim());
  if (parts.length < 2) {
    return { label: timeRange, startHour: 0 };
  }

  // Parse start
  const startRaw = parts[0]; // e.g. "11:00 AM" or "02:00 PM"
  const startMatch = startRaw.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  let startHour = 0;
  let startLabel = '';
  if (startMatch) {
    const rawH = parseInt(startMatch[1], 10);
    const rawM = parseInt(startMatch[2] || '0', 10);
    const meridiem = startMatch[3].toUpperCase();
    
    let h24 = rawH % 12 + (meridiem === 'PM' ? 12 : 0);
    startHour = h24 + rawM / 60;
    startLabel = rawM > 0 ? `${rawH}:${rawM < 10 ? '0' : ''}${rawM}${meridiem}` : `${rawH}${meridiem}`;
  }

  // Parse end
  const endRaw = parts[1]; // e.g. "11:30 AM" or "02:00 PM"
  const endMatch = endRaw.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  let endLabel = '';
  if (endMatch) {
    const rawH = parseInt(endMatch[1], 10);
    const rawM = parseInt(endMatch[2] || '0', 10);
    const meridiem = endMatch[3].toUpperCase();
    endLabel = rawM > 0 ? `${rawH}:${rawM < 10 ? '0' : ''}${rawM}${meridiem}` : `${rawH}${meridiem}`;
  }

  const label = startLabel && endLabel ? `${startLabel}-${endLabel}` : timeRange;
  return { label, startHour };
}

// 10-minute memory cache for Sim Podium slots
let cachedSimSlots: { data: SimPodiumSlot[]; timestamp: number } | null = null;
const SIM_SLOTS_CACHE_TTL = 10 * 60 * 1000;

/**
 * Fetches all active simulator slots from Havoc Sim Podium's PostgreSQL `slots` table
 * and ensures all daytime slots (including 11AM-2PM) are always available.
 */
export async function getSimPodiumSlots(): Promise<SimPodiumSlot[]> {
  if (cachedSimSlots && Date.now() - cachedSimSlots.timestamp < SIM_SLOTS_CACHE_TTL) {
    return cachedSimSlots.data;
  }

  const defaultBaseSlots = [
    { label: "11AM-11:30AM", startHour: 11.0 },
    { label: "11:30AM-12PM", startHour: 11.5 },
    { label: "12PM-12:30PM", startHour: 12.0 },
    { label: "12:30PM-1PM", startHour: 12.5 },
    { label: "1PM-1:30PM", startHour: 13.0 },
    { label: "1:30PM-2PM", startHour: 13.5 },
    { label: "2PM-2:30PM", startHour: 14.0 },
    { label: "2:30PM-3PM", startHour: 14.5 },
    { label: "3PM-3:30PM", startHour: 15.0 },
    { label: "3:30PM-4PM", startHour: 15.5 },
    { label: "4PM-4:30PM", startHour: 16.0 },
    { label: "4:30PM-5PM", startHour: 16.5 },
    { label: "5PM-5:30PM", startHour: 17.0 },
    { label: "5:30PM-6PM", startHour: 17.5 },
    { label: "6PM-6:30PM", startHour: 18.0 },
    { label: "6:30PM-7PM", startHour: 18.5 },
    { label: "7PM-7:30PM", startHour: 19.0 },
    { label: "7:30PM-8PM", startHour: 19.5 },
    { label: "8PM-8:30PM", startHour: 20.0 },
    { label: "8:30PM-9PM", startHour: 20.5 },
    { label: "9PM-9:30PM", startHour: 21.0 },
    { label: "9:30PM-10PM", startHour: 21.5 },
    { label: "10PM-10:30PM", startHour: 22.0 },
    { label: "10:30PM-11PM", startHour: 22.5 },
  ];

  const slotMap = new Map<string, SimPodiumSlot>();
  defaultBaseSlots.forEach((ds, idx) => {
    slotMap.set(ds.label, {
      id: 9000 + idx,
      time_range: ds.label,
      active: 1,
      sort_order: idx + 1,
      label: ds.label,
      startHour: ds.startHour
    });
  });

  try {
    const queryPromise = simulatorPool.query<{
      id: number;
      time_range: string;
      active: number;
      sort_order: number;
    }>(
      `SELECT id, time_range, active, sort_order 
       FROM slots 
       WHERE active = 1 
       ORDER BY sort_order ASC, id ASC`
    );

    const timeoutPromise = new Promise<{ rows: any[] }>((resolve) =>
      setTimeout(() => resolve({ rows: [] }), 3500)
    );

    const res = await Promise.race([queryPromise, timeoutPromise]);

    if (res.rows && res.rows.length > 0) {
      res.rows.forEach(r => {
        const parsed = parseSimPodiumTimeRange(r.time_range);
        if (parsed.label) {
          slotMap.set(parsed.label, {
            id: r.id,
            time_range: r.time_range,
            active: r.active,
            sort_order: r.sort_order,
            label: parsed.label,
            startHour: parsed.startHour
          });
        }
      });
    }

    const sortedSlots = Array.from(slotMap.values()).sort((a, b) => a.startHour - b.startHour);
    if (res.rows && res.rows.length > 0) {
      cachedSimSlots = { data: sortedSlots, timestamp: Date.now() };
    }
    return sortedSlots;
  } catch (err) {
    console.error('Error fetching slots from Havoc Sim Podium database:', err);
    return Array.from(slotMap.values()).sort((a, b) => a.startHour - b.startHour);
  }
}

