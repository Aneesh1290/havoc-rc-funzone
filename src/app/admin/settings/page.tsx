"use client";

import { useState } from "react";
import { Settings, KeyRound, Check, AlertCircle } from "lucide-react";
import { changePasswordAction } from "@/app/login/actions";

export default function SettingsPage() {
  const [passwordState, setPasswordState] = useState<{
    isLoading: boolean;
    error: string | null;
    success: string | null;
  }>({
    isLoading: false,
    error: null,
    success: null,
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordState({ isLoading: true, error: null, success: null });

    const formData = new FormData();
    formData.append("currentPassword", currentPassword);
    formData.append("newPassword", newPassword);
    formData.append("confirmPassword", confirmPassword);

    try {
      const res = await changePasswordAction(formData);
      if (res?.error) {
        setPasswordState({ isLoading: false, error: res.error, success: null });
      } else {
        setPasswordState({
          isLoading: false,
          error: null,
          success: "Password successfully updated and securely hashed!",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setPasswordState({
        isLoading: false,
        error: "Failed to update password. Please try again.",
        success: null,
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-black text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your Havoc RC Funzone platform security and details.</p>
      </div>

      <div className="space-y-8">
        {/* Profile Settings */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Business Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" defaultValue="Havoc RC Funzone & Miniature World" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]" />
            </div>
            <button className="bg-[#ff5a1f] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#e04812] transition-colors mt-2">
              Save Changes
            </button>
          </div>
        </div>

        {/* Security / Password Management */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-5 h-5 text-[#ff5a1f]" />
            <h3 className="text-lg font-bold text-gray-900">Change Admin Password</h3>
          </div>
          <p className="text-sm text-gray-500 mb-6 border-b border-gray-100 pb-3">
            All passwords are protected with salted bcrypt hashing in the database.
          </p>

          {passwordState.error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordState.error}</span>
            </div>
          )}

          {passwordState.success && (
            <div className="mb-5 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-green-600" />
              <span>{passwordState.success}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">New Password (Min. 8 characters)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              />
            </div>

            <button
              type="submit"
              disabled={passwordState.isLoading}
              className="bg-[#0d1b2a] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-colors mt-2 disabled:opacity-60"
            >
              {passwordState.isLoading ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
