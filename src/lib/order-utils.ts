/**
 * Generates the permanent order code format:
 * - #PAID_FZ_33 (for direct Online Payment Gateway orders)
 * - #PAYDUE_FZ_33 (for Pay at Desk orders, permanently preserved even if later paid)
 */
export function formatOrderNumber(
  id: number, 
  prefixOrDate?: string | null, 
  paymentStatus?: string | null
): string {
  const p1 = String(prefixOrDate || '').trim().toUpperCase();
  if (p1 === 'PAID') return `#PAID_FZ_${id}`;
  if (p1 === 'PAYDUE') return `#PAYDUE_FZ_${id}`;

  const p2 = String(paymentStatus || '').trim().toUpperCase();
  if (p2 === 'PAID_GATEWAY' || p2 === 'PAID_ONLINE') return `#PAID_FZ_${id}`;

  return `#PAYDUE_FZ_${id}`;
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
