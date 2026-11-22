import crypto from 'crypto';

/**
 * Generates a tamper-proof verification token for upcoming slot roster links.
 * Enables floor staff / admins to tap WhatsApp alert links directly inside
 * WhatsApp's in-app browser without login friction.
 */
export function generateSlotRosterToken(date: string, slot: string): string {
  const secret = process.env.ICICI_SECRET_KEY || process.env.AUTH_SECRET || 'havoc-rc-slot-roster-secret-2026';
  const cleanDate = (date || '').trim();
  const cleanSlot = (slot || '').trim();
  return crypto.createHmac('sha256', secret).update(`${cleanDate}::${cleanSlot}`).digest('hex').slice(0, 16);
}

export function verifySlotRosterToken(date: string, slot: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const cleanDate = (date || '').trim();
  const cleanSlot = (slot || '').trim();
  
  // Accept exact token match
  const expected = generateSlotRosterToken(cleanDate, cleanSlot);
  if (token === expected) return true;

  // Also accept fallback token if date is 'Today' or specific ISO date
  if (cleanDate.toLowerCase() === 'today') {
    const { getCurrentIstDetails } = require('./slot-time-utils');
    const realDate = getCurrentIstDetails().todayIstStr;
    if (token === generateSlotRosterToken(realDate, cleanSlot)) return true;
  }

  return false;
}
