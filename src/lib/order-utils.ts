/**
 * Generates an order code matching the format:
 * #PAYDUE_FZ_33 (for Unpaid / Pay at Desk)
 * #PAID_FZ_33   (for Paid orders)
 */
export function formatOrderNumber(
  id: number, 
  dateStr?: string | null, 
  paymentStatus?: string | null
): string {
  const statusClean = (paymentStatus || '').trim().toLowerCase();
  const prefix = statusClean === 'paid' ? 'PAID' : 'PAYDUE';

  return `#${prefix}_FZ_${id}`;
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
