"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  Plus, 
  Trash2, 
  KeyRound, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  Calendar, 
  Ticket, 
  Sparkles, 
  Clock, 
  Tag, 
  Settings,
  Lock,
  X
} from "lucide-react";
import { 
  fetchStaffUsersAction, 
  createStaffUserAction, 
  updateStaffRoleAndPermsAction, 
  resetStaffPasswordAction, 
  deleteStaffUserAction 
} from "@/app/actions/tickets";

interface StaffUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions?: string;
  must_change_password?: number;
  created_at?: string;
}

const AVAILABLE_PERMISSIONS = [
  { key: "bookings", label: "Bookings", icon: Calendar },
  { key: "tickets", label: "Ticket Types", icon: Ticket },
  { key: "vip-perks", label: "VIP Perks", icon: Sparkles },
  { key: "slots", label: "Slots & Dates", icon: Clock },
  { key: "coupons", label: "Coupons", icon: Tag },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function StaffManagementPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // New staff form state
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"staff" | "super_admin">("staff");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(["bookings", "slots"]);
  const [customPassword, setCustomPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal for Admin-defined password reset
  const [resetModalUser, setResetModalUser] = useState<StaffUser | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const res = await fetchStaffUsersAction();
      if (res.success && res.users) {
        setUsers(res.users);
      } else {
        showNotification(res.error || "Failed to load staff accounts", "error");
      }
    } catch (e: any) {
      showNotification("Error loading staff accounts", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      showNotification("Please provide a username", "error");
      return;
    }

    setIsSubmitting(true);
    const res = await createStaffUserAction({
      username,
      name,
      role,
      permissions: selectedPerms,
      customPassword: customPassword.trim() || undefined
    });
    setIsSubmitting(false);

    if (res.success) {
      showNotification(`Staff account '${username}' created successfully!`);
      setUsername("");
      setName("");
      setRole("staff");
      setSelectedPerms(["bookings", "slots"]);
      setCustomPassword("");
      loadStaff();
    } else {
      showNotification(res.error || "Failed to create staff account", "error");
    }
  };

  const handleTogglePerm = async (user: StaffUser, permKey: string) => {
    const currentPerms = (user.permissions || "bookings,slots").split(",").map(p => p.trim()).filter(Boolean);
    let updatedPerms: string[];
    if (currentPerms.includes(permKey)) {
      updatedPerms = currentPerms.filter(p => p !== permKey);
    } else {
      updatedPerms = [...currentPerms, permKey];
    }

    // Optimistic UI update
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, permissions: updatedPerms.join(",") } : u));

    const res = await updateStaffRoleAndPermsAction(user.id, user.role, updatedPerms);
    if (!res.success) {
      showNotification(res.error || "Failed to update permissions", "error");
      loadStaff();
    }
  };

  const handleChangeRole = async (user: StaffUser, newRole: string) => {
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    const currentPerms = (user.permissions || "").split(",").map(p => p.trim()).filter(Boolean);
    const res = await updateStaffRoleAndPermsAction(user.id, newRole, currentPerms);
    if (!res.success) {
      showNotification(res.error || "Failed to update role", "error");
      loadStaff();
    } else {
      showNotification(`Role for '${user.username}' updated to ${newRole === 'super_admin' ? 'Super Admin' : 'Staff'}`);
    }
  };

  const handleDeleteStaff = async (user: StaffUser) => {
    if (!confirm(`Are you sure you want to permanently delete staff account '${user.username}'?`)) return;

    const res = await deleteStaffUserAction(user.id);
    if (res.success) {
      showNotification(`Account '${user.username}' deleted`);
      loadStaff();
    } else {
      showNotification(res.error || "Failed to delete staff account", "error");
    }
  };

  const handleOpenResetModal = (user: StaffUser) => {
    setResetModalUser(user);
    setAdminNewPassword("");
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;

    if (!adminNewPassword.trim()) {
      showNotification("Please enter a new password for this staff member", "error");
      return;
    }

    if (adminNewPassword.trim().length < 6) {
      showNotification("Password must be at least 6 characters long", "error");
      return;
    }

    setIsResetting(true);
    const res = await resetStaffPasswordAction(resetModalUser.id, adminNewPassword.trim());
    setIsResetting(false);

    if (res.success) {
      showNotification(`Password for '${resetModalUser.username}' has been successfully set by Admin!`);
      setResetModalUser(null);
      setAdminNewPassword("");
      loadStaff();
    } else {
      showNotification(res.error || "Failed to set password", "error");
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-heading text-gray-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-[#ff5a1f]" />
            Staff Accounts
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage worker login access, assign modular tab permissions, and administer passwords.
          </p>
        </div>
      </div>

      {/* Notification banner */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 transition-all ${
          feedback.type === "success" 
            ? "bg-green-50 text-green-800 border border-green-200" 
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {feedback.type === "success" ? <Check className="w-5 h-5 text-green-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
          <span className="text-sm font-semibold">{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: Staff Accounts Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Registered Accounts</h2>
            <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {users.length} {users.length === 1 ? "user" : "users"}
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Loading staff accounts...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-gray-500">No staff accounts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-3.5 px-4 w-12 text-center">ID</th>
                    <th className="py-3.5 px-5">Username</th>
                    <th className="py-3.5 px-5">Assigned Permissions / Access</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {users.map((u) => {
                    const isMainAdmin = u.username.toLowerCase() === "admin";
                    const isSuperAdmin = u.role === "super_admin";
                    const currentPerms = (u.permissions || "bookings,slots").split(",").map(p => p.trim());

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-4 px-4 text-center font-mono text-xs text-gray-400 font-bold">
                          #{u.id}
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-bold text-gray-900 flex items-center gap-2">
                            <span>{u.username}</span>
                            {isMainAdmin && (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Primary Admin
                              </span>
                            )}
                          </div>
                          {u.name && u.name !== u.username && (
                            <div className="text-xs text-gray-500 mt-0.5">{u.name}</div>
                          )}

                          {!isMainAdmin && (
                            <select
                              value={isSuperAdmin ? "super_admin" : "staff"}
                              onChange={(e) => handleChangeRole(u, e.target.value)}
                              className="mt-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                            >
                              <option value="staff">Staff (Custom Access)</option>
                              <option value="super_admin">Super Admin (All Tabs)</option>
                            </select>
                          )}
                        </td>

                        <td className="py-4 px-5">
                          {isMainAdmin || isSuperAdmin ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                              Full Access (All Tabs)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {AVAILABLE_PERMISSIONS.map((perm) => {
                                const isChecked = currentPerms.includes(perm.key);
                                const IconComponent = perm.icon;
                                return (
                                  <label
                                    key={perm.key}
                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
                                      isChecked
                                        ? "bg-orange-50 border-orange-200 text-[#ff5a1f]"
                                        : "bg-gray-50 border-gray-200 text-gray-500 opacity-70 hover:opacity-100"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleTogglePerm(u, perm.key)}
                                      className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] w-3.5 h-3.5"
                                    />
                                    <IconComponent className="w-3 h-3" />
                                    <span>{perm.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-5 text-right">
                          {!isMainAdmin && (
                            <div className="inline-flex items-center gap-2">
                              {/* Reset Password Button - Opens Admin Password Setter */}
                              <button
                                type="button"
                                onClick={() => handleOpenResetModal(u)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#e0a93b]/15 text-[#a87618] hover:bg-[#e0a93b]/25 border border-[#e0a93b]/40 transition-all flex items-center gap-1"
                                title="Admin can directly set/reset password for this user"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                Reset
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(u)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-all flex items-center gap-1"
                                title="Delete staff account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Col: Create Staff Account Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <Plus className="w-5 h-5 text-[#ff5a1f]" />
            <h2 className="text-base font-bold text-gray-900">Create Account</h2>
          </div>

          <form onSubmit={handleCreateStaff} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Username *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. rohan"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Staff Name (Optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rohan Sharma"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "staff" | "super_admin")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              >
                <option value="staff">Custom Staff Access</option>
                <option value="super_admin">Super Admin (All Tabs)</option>
              </select>
            </div>

            {/* Admin password setting on creation */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Initial Password
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="sabharwal@65 (Default)"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Admin can specify a custom password or leave blank for default <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">sabharwal@65</code>.
              </p>
            </div>

            {/* Allowed Tabs / Permissions Checklist */}
            {role === "staff" && (
              <div className="pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Select Allowed Tabs &amp; Modules
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50/70 p-3 rounded-xl border border-gray-200/70">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = selectedPerms.includes(perm.key);
                    const IconComponent = perm.icon;
                    return (
                      <label key={perm.key} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPerms(prev => [...prev, perm.key]);
                            } else {
                              setSelectedPerms(prev => prev.filter(k => k !== perm.key));
                            }
                          }}
                          className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] w-3.5 h-3.5"
                        />
                        <IconComponent className="w-3.5 h-3.5 text-gray-500" />
                        <span>{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-3 bg-[#e0a93b] hover:bg-[#c9942d] text-gray-900 font-bold rounded-xl transition-all shadow-xs disabled:opacity-50 text-sm"
            >
              {isSubmitting ? "Creating..." : "Create Account"}
            </button>
          </form>
        </div>
      </div>

      {/* Modal: Admin Sets Password for Staff */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Set Staff Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              As Admin, you can directly set a new custom password for account <strong className="text-gray-900 font-mono">@{resetModalUser.username}</strong>.
            </p>

            <form onSubmit={handleConfirmResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  New Password (Min. 6 chars)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#ff5a1f] hover:bg-[#e04812] text-white shadow-xs transition-colors disabled:opacity-50"
                >
                  {isResetting ? "Updating..." : "Set Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
