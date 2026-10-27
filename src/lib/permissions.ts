export interface PermissionDefinition {
  key: string;
  label: string;
  category: "page" | "booking_action";
  description?: string;
}

export const PERMISSION_GROUPS = {
  pages: [
    { key: "bookings", label: "Bookings", description: "Access the Bookings dashboard and order lists" },
    { key: "tickets", label: "Ticket Types", description: "Manage ticket pricing and inventory" },
    { key: "vip-perks", label: "VIP Perks (Sims)", description: "Manage simulator perks and combos" },
    { key: "slots", label: "Slots & Dates", description: "Manage slot schedules, colors, and dates" },
    { key: "bands", label: "Band Inventory", description: "Manage wristband master list, stock tracking, and issue/return records" },
    { key: "coupons", label: "Coupons", description: "Manage promotional discount codes" },
    { key: "settings", label: "Settings", description: "Access store configurations and parameters" },
  ],
  bookingActions: [
    { key: "bookings:delete", label: "Delete Orders", description: "Can delete single or bulk orders from the bookings list" },
    { key: "bookings:payment", label: "Collect Payment", description: "Can mark orders as Paid / Unpaid in order details" },
    { key: "bookings:status", label: "Order Actions (Fulfill / Cancel)", description: "Can mark orders as Fulfilled / Unfulfilled or Cancel orders" },
    { key: "bookings:checkin", label: "Customer Desk Check-In", description: "Can initiate customer OTP desk check-in" },
    { key: "bookings:export", label: "Export Excel Reports", description: "Can download Excel reports of orders" },
  ],
};

/**
 * Checks if a user has a specific permission.
 * Super Admin or primary admin always returns true.
 */
export function hasUserPermission(
  user: { role?: string; username?: string; permissions?: string } | null | undefined,
  requiredPerm: string
): boolean {
  if (!user) return false;

  const uname = (user.username || "").toLowerCase();
  const urole = (user.role || "").toLowerCase();

  // Only the primary 'admin' account and 'super_admin' role have full bypass
  if (uname === "admin" || urole === "super_admin") {
    return true;
  }

  const perms = (user.permissions || "").split(",").map(p => p.trim());

  // If user is not staff and has 'all', allow
  if (urole !== "staff" && (user.permissions === "all" || perms.includes("all"))) {
    return true;
  }

  return perms.includes(requiredPerm);
}
