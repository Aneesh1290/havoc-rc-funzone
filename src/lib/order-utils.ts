/**
 * Generates an order code matching the format:
 * #PAYDUE_FZ_18OCT26_33 (for Unpaid / Pay at Desk)
 * #PAID_FZ_18OCT26_33   (for Paid orders)
 */
export function formatOrderNumber(
  id: number, 
  dateStr?: string | null, 
  paymentStatus?: string | null
): string {
  let d = new Date();
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }

  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[d.getMonth()] || 'OCT';
  const year = String(d.getFullYear()).slice(-2);

  const statusClean = (paymentStatus || '').trim().toLowerCase();
  const prefix = statusClean === 'paid' ? 'PAID' : 'PAYDUE';

  return `#${prefix}_FZ_${day}${month}${year}_${id}`;
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "Just now";
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
