/**
 * Generates the permanent order code format: #PAYDUE_FZ_33
 * Stays permanently consistent regardless of payment status changes.
 */
export function formatOrderNumber(
  id: number, 
  dateStr?: string | null, 
  paymentStatus?: string | null
): string {
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
