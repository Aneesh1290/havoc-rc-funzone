"use client";

import { useState, useEffect } from "react";
import { Tag, Trash2, Plus, Layers, Calendar, Check, AlertCircle } from "lucide-react";
import { 
  fetchCouponsAction, 
  createCouponAction, 
  bulkCreateCouponsAction, 
  deleteCouponAction,
  deleteAllCouponsAction,
  deleteMultipleCouponsAction
} from "@/app/actions/tickets";
import { CouponRow } from "@/lib/db";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Single coupon form state
  const [singleCode, setSingleCode] = useState("");
  const [singleType, setSingleType] = useState<"percentage" | "flat">("percentage");
  const [singleValue, setSingleValue] = useState<number>(10);
  const [singleMaxUses, setSingleMaxUses] = useState<string>("");
  const [singleExpiry, setSingleExpiry] = useState<string>("");

  // Bulk coupon form state
  const [bulkPrefix, setBulkPrefix] = useState("BAND-");
  const [bulkCount, setBulkCount] = useState<number>(50);
  const [bulkStartFrom, setBulkStartFrom] = useState<number>(1);
  const [bulkFormat, setBulkFormat] = useState<"sequential" | "random">("sequential");
  const [bulkType, setBulkType] = useState<"percentage" | "flat">("percentage");
  const [bulkValue, setBulkValue] = useState<number>(10);
  const [bulkMaxUses, setBulkMaxUses] = useState<number>(1);

  // Loading states
  const [addingSingle, setAddingSingle] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);

  const loadCoupons = async () => {
    try {
      const data = await fetchCouponsAction();
      setCoupons(data);
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const showNotification = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleCode.trim()) {
      showNotification("Please enter a coupon code", "error");
      return;
    }
    if (singleValue <= 0) {
      showNotification("Value must be greater than 0", "error");
      return;
    }

    setAddingSingle(true);
    const maxUses = singleMaxUses ? parseInt(singleMaxUses, 10) : null;
    const res = await createCouponAction(singleCode, singleType, Number(singleValue), maxUses, singleExpiry || null);
    setAddingSingle(false);

    if (res.success) {
      showNotification(`Coupon ${singleCode.toUpperCase().trim()} created successfully!`);
      setSingleCode("");
      setSingleMaxUses("");
      setSingleExpiry("");
      loadCoupons();
    } else {
      showNotification(res.error || "Failed to create coupon", "error");
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = Math.min(Math.max(Number(bulkCount) || 1, 1), 500);
    const start = Number(bulkStartFrom) || 1;

    setGeneratingBulk(true);

    const generatedList: { code: string; discountType: "percentage" | "flat"; value: number; maxUses: number | null }[] = [];
    
    for (let i = 0; i < count; i++) {
      let code = "";
      if (bulkFormat === "sequential") {
        const numStr = String(start + i).padStart(count >= 100 ? 3 : 2, "0");
        code = `${bulkPrefix}${numStr}`;
      } else {
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        code = `${bulkPrefix}${randomStr}`;
      }
      generatedList.push({
        code,
        discountType: bulkType,
        value: Number(bulkValue),
        maxUses: bulkMaxUses ? Number(bulkMaxUses) : null,
      });
    }

    const res = await bulkCreateCouponsAction(generatedList);
    setGeneratingBulk(false);

    if (res.success) {
      showNotification(`Generated ${res.count} coupons successfully!`);
      loadCoupons();
    } else {
      showNotification(res.error || "Failed to generate coupons", "error");
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (confirm(`Are you sure you want to delete coupon ${code}?`)) {
      await deleteCouponAction(id);
      showNotification(`Coupon ${code} deleted`);
      loadCoupons();
    }
  };

  const handleClearAll = async () => {
    if (coupons.length === 0) return;
    const count = coupons.length;
    if (confirm(`⚠️ ARE YOU ABSOLUTELY SURE?\n\nThis will permanently delete ALL ${count} coupons from the database. This action cannot be undone.`)) {
      setIsDeletingBulk(true);
      const res = await deleteAllCouponsAction();
      setIsDeletingBulk(false);
      if (res.success) {
        showNotification(`Cleared all ${count} coupons successfully!`);
        loadCoupons();
      } else {
        showNotification(res.error || "Failed to clear coupons", "error");
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (confirm(`Are you sure you want to delete the ${count} selected coupons?`)) {
      setIsDeletingBulk(true);
      const res = await deleteMultipleCouponsAction(selectedIds);
      setIsDeletingBulk(false);
      if (res.success) {
        showNotification(`Deleted ${count} coupons successfully!`);
        loadCoupons();
      } else {
        showNotification(res.error || "Failed to delete selected coupons", "error");
      }
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === coupons.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(coupons.map(c => c.id));
    }
  };

  const handleToggleSelectOne = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black font-heading text-gray-900 tracking-tight">Manage Coupons</h1>
          <p className="text-gray-500 text-sm mt-1">Create individual promo codes or bulk generate ticket discount vouchers.</p>
        </div>
      </div>

      {/* Notification Banner */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 transition-all ${message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {message.type === "success" ? <Check className="w-5 h-5 text-green-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {/* Section 1: Add New Coupon */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Plus className="w-5 h-5 text-[#ff5a1f]" />
          <h2 className="text-lg font-bold text-gray-900">Add New Coupon</h2>
        </div>

        <form onSubmit={handleAddSingle} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Coupon Code</label>
              <input
                type="text"
                required
                value={singleCode}
                onChange={(e) => setSingleCode(e.target.value)}
                placeholder="e.g. SUMMER20"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Discount Type</label>
              <select
                value={singleType}
                onChange={(e) => setSingleType(e.target.value as "percentage" | "flat")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Value</label>
              <input
                type="number"
                required
                min="1"
                value={singleValue}
                onChange={(e) => setSingleValue(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Expiry Date (Optional)</label>
              <input
                type="date"
                value={singleExpiry}
                onChange={(e) => setSingleExpiry(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Max Uses (Optional)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={singleMaxUses}
                onChange={(e) => setSingleMaxUses(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={addingSingle}
                className="w-full sm:w-auto px-8 py-3 bg-[#e0a93b] hover:bg-[#c9942d] text-gray-900 font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {addingSingle ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Section 2: Bulk Create Coupons (Series) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Layers className="w-5 h-5 text-[#ff5a1f]" />
          <h2 className="text-lg font-bold text-gray-900">Bulk Create Coupons (Series)</h2>
        </div>

        <form onSubmit={handleBulkGenerate} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Prefix</label>
              <input
                type="text"
                required
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                placeholder="e.g. BAND-"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Count (Max 500)</label>
              <input
                type="number"
                min="1"
                max="500"
                required
                value={bulkCount}
                onChange={(e) => setBulkCount(Number(e.target.value))}
                placeholder="e.g. 50"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Start From</label>
              <input
                type="number"
                min="1"
                required
                value={bulkStartFrom}
                onChange={(e) => setBulkStartFrom(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Format</label>
              <select
                value={bulkFormat}
                onChange={(e) => setBulkFormat(e.target.value as "sequential" | "random")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              >
                <option value="sequential">Sequential (1, 2, 3...)</option>
                <option value="random">Random Characters (A9B2, ...)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Discount Type</label>
              <select
                value={bulkType}
                onChange={(e) => setBulkType(e.target.value as "percentage" | "flat")}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Value</label>
              <input
                type="number"
                min="1"
                required
                value={bulkValue}
                onChange={(e) => setBulkValue(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Max Uses</label>
              <input
                type="number"
                min="1"
                required
                value={bulkMaxUses}
                onChange={(e) => setBulkMaxUses(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={generatingBulk}
                className="w-full sm:w-auto px-8 py-3 bg-[#e0a93b] hover:bg-[#c9942d] text-gray-900 font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {generatingBulk ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Section 3: Active Coupons Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#ff5a1f]" />
            <h2 className="text-lg font-bold text-gray-900">Active Coupons ({coupons.length})</h2>
          </div>

          {coupons.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  disabled={isDeletingBulk}
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedIds.length})
                </button>
              )}
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeletingBulk ? "Clearing..." : "Clear All Coupons"}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading coupons...</div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500">No coupons created yet</p>
            <p className="text-xs text-gray-400 mt-1">Add a coupon above or generate a batch series.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-4 px-4 w-10 text-center">
                    <input 
                      type="checkbox"
                      checked={coupons.length > 0 && selectedIds.length === coupons.length}
                      onChange={handleToggleSelectAll}
                      className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer"
                      title="Select all coupons"
                    />
                  </th>
                  <th className="py-4 px-6">Code</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Value</th>
                  <th className="py-4 px-6">Uses</th>
                  <th className="py-4 px-6">Expires</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {coupons.map((coupon) => (
                  <tr 
                    key={coupon.id} 
                    className={`hover:bg-gray-50/70 transition-colors ${selectedIds.includes(coupon.id) ? "bg-orange-50/40" : ""}`}
                  >
                    <td className="py-4 px-4 text-center">
                      <input 
                        type="checkbox"
                        checked={selectedIds.includes(coupon.id)}
                        onChange={() => handleToggleSelectOne(coupon.id)}
                        className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-gray-900">
                      <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md text-xs">
                        {coupon.code}
                      </span>
                    </td>
                    <td className="py-4 px-6 capitalize text-gray-600">
                      {coupon.discount_type === "percentage" ? "Percentage" : "Flat Amount"}
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-900">
                      {coupon.discount_type === "percentage" ? `${coupon.value}%` : `₹${coupon.value}`}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      <span className="font-medium text-gray-900">{coupon.used_count}</span>
                      <span className="text-gray-400"> / {coupon.max_uses !== null ? coupon.max_uses : "∞"}</span>
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {coupon.expiry_date ? coupon.expiry_date : "Never"}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDelete(coupon.id, coupon.code)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete coupon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
