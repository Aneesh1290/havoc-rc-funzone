import { Pool } from 'pg';

const SIMULATOR_DATABASE_URL = 
  process.env.SIMULATOR_DATABASE_URL || 
  'postgresql://slots_db_yqvv_user:REDACTED_PASSWORD@dpg-db941hft5n8s73e7qt1g-a.singapore-postgres.render.com/slots_db_yqvv';

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

if (process.env.NODE_ENV !== 'production') {
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

/**
 * Query locked/taken slots for a specific simulator and date
 */
export async function getTakenSimulatorSlots(simulatorName: string, bookingDate: string): Promise<string[]> {
  try {
    const formattedDate = formatToSimulatorDate(bookingDate);
    // Also include raw bookingDate in query so whether Sim Podium has 'Oct 17 (Sat)' or 'Oct 17', both match
    const res = await simulatorPool.query<{ booking_time: string }>(
      `SELECT booking_time FROM simulator_slot_locks 
       WHERE simulator_name = $1 
         AND (booking_date = $2 OR booking_date = $3)
         AND status IN ('PENDING', 'PAID', 'ATTENDED', 'CONFIRMED');`,
      [simulatorName, formattedDate, bookingDate]
    );
    return res.rows.map(r => r.booking_time);
  } catch (err) {
    console.error(`Error querying taken simulator slots for ${simulatorName} on ${bookingDate}:`, err);
    return [];
  }
}

/**
 * Lock simulator slot(s) for a booking
 */
export async function lockSimulatorSlot(params: {
  simulatorName: string;
  bookingDate: string;
  bookingTime: string;
  sourceOrderId: string;
  customerName?: string;
  customerPhone?: string;
  status?: string;
}): Promise<{ success: boolean; error?: string }> {
  const {
    simulatorName,
    bookingDate,
    bookingTime,
    sourceOrderId,
    customerName,
    customerPhone,
    status = 'CONFIRMED'
  } = params;

  try {
    const formattedDate = formatToSimulatorDate(bookingDate);

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
 * Cancel or release locked slots by source order ID
 */
export async function releaseSimulatorSlots(sourceOrderId: string, bookingId?: number): Promise<boolean> {
  try {
    const idSuffix = bookingId ? `_${bookingId}` : (sourceOrderId.includes('_') ? `_${sourceOrderId.split('_').pop()}` : '');
    await simulatorPool.query(
      `UPDATE simulator_slot_locks 
       SET status = 'CANCELLED' 
       WHERE (source_order_id = $1 OR ($2 != '' AND source_order_id LIKE '%' || $2))
         AND source_platform = 'HAVOC_RC_FUN_ZONE'`,
      [sourceOrderId, idSuffix]
    );
    return true;
  } catch (err) {
    console.error('Error releasing simulator slots for order:', sourceOrderId, err);
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

/**
 * Fetches all simulators/products that exist in the Havoc Sim Podium PostgreSQL database
 */
export async function getSimPodiumSimulators(): Promise<SimPodiumProduct[]> {
  try {
    const res = await simulatorPool.query(
      `SELECT id, name, type, price, description, image_url 
       FROM products 
       ORDER BY id ASC`
    );
    return res.rows.map(r => ({
      id: r.id,
      name: (r.name || '').trim(),
      type: (r.type || 'Simulator').trim(),
      price: r.price,
      description: r.description || '',
      image_url: r.image_url || ''
    }));
  } catch (err) {
    console.error('Error fetching simulators from Havoc Sim Podium database:', err);
    return [];
  }
}

