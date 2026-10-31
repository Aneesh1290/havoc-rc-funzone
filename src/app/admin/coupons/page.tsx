"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Tag, 
  Trash2, 
  Plus, 
  Layers, 
  Calendar, 
  Check, 
  AlertCircle,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Table as TableIcon
} from "lucide-react";
import { 
  fetchCouponsAction, 
  createCouponAction, 
  bulkCreateCouponsAction, 
  deleteCouponAction,
  deleteAllCouponsAction,
  deleteMultipleCouponsAction,
  bulkUpdateCouponsExpiryAction,
  bulkUpdateAllCouponsExpiryAction
} from "@/app/actions/tickets";
import { CouponRow } from "@/lib/db";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Single coupon form state
  const [singleCode, setSingleCode] = useState("");
  const [singleType, setSingleType] = useState<"percentage" | "flat">("percentage");
  const [singleValue, setSingleValue] = useState<number>(10);
  const [singleMaxUses, setSingleMaxUses] = useState<string>("");
  const [singleExpiry, setSingleExpiry] = useState<string>("");
  const [singleIsBandCoupon, setSingleIsBandCoupon] = useState<boolean>(false);
  const [singleBandCategory, setSingleBandCategory] = useState<string>("VIP");
  const [singleBandColor, setSingleBandColor] = useState<string>("#FFD700");

  // Bulk coupon form state
  const [bulkPrefix, setBulkPrefix] = useState("BAND-");
  const [bulkCount, setBulkCount] = useState<number>(50);
  const [bulkStartFrom, setBulkStartFrom] = useState<number>(1);
  const [bulkFormat, setBulkFormat] = useState<"sequential" | "random">("sequential");
  const [bulkType, setBulkType] = useState<"percentage" | "flat">("percentage");
  const [bulkValue, setBulkValue] = useState<number>(10);
  const [bulkMaxUses, setBulkMaxUses] = useState<number>(1);
  const [bulkIsBandCoupon, setBulkIsBandCoupon] = useState<boolean>(false);
  const [bulkBandCategory, setBulkBandCategory] = useState<string>("VIP");
  const [bulkBandColor, setBulkBandColor] = useState<string>("#FFD700");

  // Filter, Category, Sort & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL"); // 'ALL', 'VIP_BANDS', 'PREFIX:XYZ', 'PERCENTAGE', 'FLAT', 'USED', 'UNUSED', 'EXPIRED', 'ACTIVE'
  const [valueFilter, setValueFilter] = useState<string>("ALL"); // 'ALL', or exact value like '100', '50', '20'
  const [sortField, setSortField] = useState<"id" | "code" | "value" | "used_count" | "expiry_date">("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 50, 100, 250, 500, ALL (-1)

  // Bulk Expiry Update States
  const [bulkExpiryInput, setBulkExpiryInput] = useState("");
  const [isUpdatingExpiry, setIsUpdatingExpiry] = useState(false);
  const [showBulkExpiryBar, setShowBulkExpiryBar] = useState(false);

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
    const res = await createCouponAction(
      singleCode, 
      singleType, 
      Number(singleValue), 
      maxUses, 
      singleExpiry || null,
      singleIsBandCoupon,
      singleIsBandCoupon ? singleBandCategory : undefined,
      singleIsBandCoupon ? singleBandColor : undefined
    );
    setAddingSingle(false);

    if (res.success) {
      showNotification(`Coupon ${singleCode.toUpperCase().trim()} created successfully!`);
      setSingleCode("");
      setSingleMaxUses("");
      setSingleExpiry("");
      setSingleIsBandCoupon(false);
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

    const generatedList: { 
      code: string; 
      discountType: "percentage" | "flat"; 
      value: number; 
      maxUses: number | null;
      isBandCoupon?: boolean;
      bandCategory?: string;
      bandColor?: string;
    }[] = [];
    
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
        isBandCoupon: bulkIsBandCoupon,
        bandCategory: bulkIsBandCoupon ? bulkBandCategory : undefined,
        bandColor: bulkIsBandCoupon ? bulkBandColor : undefined,
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

  const handleBulkApplyExpiry = async (targetIds: number[], dateVal: string | null) => {
    if (targetIds.length === 0) {
      showNotification("Please select at least one coupon", "error");
      return;
    }
    const label = dateVal ? `set expiry to ${dateVal}` : `remove expiry date (Never)`;
    if (!confirm(`Are you sure you want to ${label} for ${targetIds.length} coupons?`)) {
      return;
    }

    setIsUpdatingExpiry(true);
    const res = await bulkUpdateCouponsExpiryAction(targetIds, dateVal);
    setIsUpdatingExpiry(false);

    if (res.success) {
      showNotification(`Successfully updated expiry date for ${res.count} coupons!`);
      setShowBulkExpiryBar(false);
      setBulkExpiryInput("");
      loadCoupons();
    } else {
      showNotification(res.error || "Failed to update expiry date", "error");
    }
  };

  const handleApplyExpiryToCurrentFiltered = async (dateVal: string | null) => {
    const targetIds = filteredAndSortedCoupons.map(c => c.id);
    if (targetIds.length === 0) {
      showNotification("No coupons match the current filter", "error");
      return;
    }

    const label = dateVal ? `set expiry to ${dateVal}` : `remove expiry date (Never)`;
    if (!confirm(`Are you sure you want to ${label} for ALL ${targetIds.length} currently filtered/displayed coupons?`)) {
      return;
    }

    setIsUpdatingExpiry(true);
    const res = await bulkUpdateCouponsExpiryAction(targetIds, dateVal);
    setIsUpdatingExpiry(false);

    if (res.success) {
      showNotification(`Successfully updated expiry date for ${res.count} coupons!`);
      setShowBulkExpiryBar(false);
      setBulkExpiryInput("");
      loadCoupons();
    } else {
      showNotification(res.error || "Failed to update expiry date", "error");
    }
  };


  const handleToggleSelectOne = (id: number, shiftKey: boolean = false) => {
    if (shiftKey && lastSelectedId !== null && lastSelectedId !== id) {
      // Find range between lastSelectedId and current id in paginatedCoupons (or filteredAndSortedCoupons)
      const list = paginatedCoupons;
      const lastIndex = list.findIndex(c => c.id === lastSelectedId);
      const currentIndex = list.findIndex(c => c.id === id);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = list.slice(start, end + 1).map(c => c.id);

        setSelectedIds(prev => Array.from(new Set([...prev, ...rangeIds])));
        setLastSelectedId(id);
        return;
      }
    }

    // Normal toggle
    setSelectedIds(prev => {
      const isAlreadySelected = prev.includes(id);
      if (isAlreadySelected) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
    setLastSelectedId(id);
  };

  // Helper to extract series prefix or category
  // e.g. "F003281" -> "F-Series", "BAND-01" -> "BAND-Series", "004837" -> "Numeric / General"
  const getCouponCategory = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean.includes("-")) {
      const p = clean.split("-")[0];
      return `${p}-Series`;
    }
    // If starts with letters followed by digits, e.g. "F003281"
    const match = clean.match(/^([A-Z]+)\d+/);
    if (match && match[1]) {
      return `${match[1]}-Series`;
    }
    // Pure digits
    if (/^\d+$/.test(clean)) {
      return "Numeric Series";
    }
    return "Custom Promo Codes";
  };

  // Dynamic Categories and Counts
  const categoriesList = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: coupons.length,
      VIP_BANDS: 0,
      PERCENTAGE: 0,
      FLAT: 0,
      ACTIVE: 0,
      USED: 0,
      EXPIRED: 0
    };

    const prefixCounts: Record<string, number> = {};
    const valueCounts: Record<number, number> = {};

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    for (const c of coupons) {
      if (c.is_band_coupon === 1) counts.VIP_BANDS++;
      if (c.discount_type === "percentage") counts.PERCENTAGE++;
      if (c.discount_type === "flat") counts.FLAT++;

      const isUsedUp = c.max_uses !== null && c.used_count >= c.max_uses;
      const isExpired = Boolean(c.expiry_date && c.expiry_date < todayStr);

      if (isUsedUp) counts.USED++;
      if (isExpired) counts.EXPIRED++;
      if (!isUsedUp && !isExpired) counts.ACTIVE++;

      const catName = getCouponCategory(c.code);
      prefixCounts[catName] = (prefixCounts[catName] || 0) + 1;

      valueCounts[c.value] = (valueCounts[c.value] || 0) + 1;
    }

    return { counts, prefixCounts, valueCounts };
  }, [coupons]);

  // Filter & Sort Pipeline
  const filteredAndSortedCoupons = useMemo(() => {
    let result = [...coupons];
    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Category Filter
    if (categoryFilter !== "ALL") {
      if (categoryFilter === "VIP_BANDS") {
        result = result.filter(c => c.is_band_coupon === 1);
      } else if (categoryFilter === "PERCENTAGE") {
        result = result.filter(c => c.discount_type === "percentage");
      } else if (categoryFilter === "FLAT") {
        result = result.filter(c => c.discount_type === "flat");
      } else if (categoryFilter === "ACTIVE") {
        result = result.filter(c => {
          const isUsedUp = c.max_uses !== null && c.used_count >= c.max_uses;
          const isExpired = Boolean(c.expiry_date && c.expiry_date < todayStr);
          return !isUsedUp && !isExpired;
        });
      } else if (categoryFilter === "USED") {
        result = result.filter(c => c.max_uses !== null && c.used_count >= c.max_uses);
      } else if (categoryFilter === "EXPIRED") {
        result = result.filter(c => Boolean(c.expiry_date && c.expiry_date < todayStr));
      } else if (categoryFilter.startsWith("CAT:")) {
        const targetCat = categoryFilter.replace("CAT:", "");
        result = result.filter(c => getCouponCategory(c.code) === targetCat);
      }
    }

    // 2. Value Filter
    if (valueFilter !== "ALL") {
      const targetVal = Number(valueFilter);
      result = result.filter(c => c.value === targetVal);
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => 
        c.code.toLowerCase().includes(q) || 
        String(c.value).includes(q) ||
        (c.expiry_date && c.expiry_date.toLowerCase().includes(q))
      );
    }

    // 4. Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === "id") {
        comparison = a.id - b.id;
      } else if (sortField === "code") {
        comparison = a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === "value") {
        comparison = a.value - b.value;
      } else if (sortField === "used_count") {
        comparison = a.used_count - b.used_count;
      } else if (sortField === "expiry_date") {
        const expA = a.expiry_date || "9999-99-99";
        const expB = b.expiry_date || "9999-99-99";
        comparison = expA.localeCompare(expB);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [coupons, categoryFilter, valueFilter, searchQuery, sortField, sortOrder]);

  // Pagination Slice
  const totalItems = filteredAndSortedCoupons.length;
  const effectivePageSize = pageSize === -1 ? totalItems : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / (effectivePageSize || 1)));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCoupons = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedCoupons;
    const start = (validCurrentPage - 1) * pageSize;
    return filteredAndSortedCoupons.slice(start, start + pageSize);
  }, [filteredAndSortedCoupons, validCurrentPage, pageSize]);

  // Toggle sort direction or field
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleSelectVisible = () => {
    const pageIds = paginatedCoupons.map(c => c.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
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

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="single-is-band"
                type="checkbox"
                checked={singleIsBandCoupon}
                onChange={(e) => setSingleIsBandCoupon(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300 cursor-pointer"
              />
              <label htmlFor="single-is-band" className="text-xs font-bold text-gray-900 cursor-pointer flex items-center gap-1.5">
                <span>⭐ VIP Offer Wristband Coupon</span>
                <span className="text-[10px] font-normal text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full">
                  Auto-issues VIP wristband & updates stock on checkout
                </span>
              </label>
            </div>

            {singleIsBandCoupon && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Band Category / Tier
                  </label>
                  <input
                    type="text"
                    value={singleBandCategory}
                    onChange={(e) => setSingleBandCategory(e.target.value)}
                    placeholder="e.g. VIP, GOLD, PREMIUM"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Wristband Color (for stock pool)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={singleBandColor}
                      onChange={(e) => setSingleBandColor(e.target.value)}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={singleBandColor}
                      onChange={(e) => setSingleBandColor(e.target.value)}
                      placeholder="#FFD700"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-gray-900 uppercase"
                    />
                  </div>
                </div>
              </div>
            )}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="bulk-is-band"
                type="checkbox"
                checked={bulkIsBandCoupon}
                onChange={(e) => setBulkIsBandCoupon(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300 cursor-pointer"
              />
              <label htmlFor="bulk-is-band" className="text-xs font-bold text-gray-900 cursor-pointer flex items-center gap-1.5">
                <span>⭐ Bulk VIP Offer Wristband Series</span>
                <span className="text-[10px] font-normal text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full">
                  Link series to VIP Wristband stock tracking
                </span>
              </label>
            </div>

            {bulkIsBandCoupon && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Band Category / Tier
                  </label>
                  <input
                    type="text"
                    value={bulkBandCategory}
                    onChange={(e) => setBulkBandCategory(e.target.value)}
                    placeholder="e.g. VIP, GOLD, PREMIUM"
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Wristband Color (for stock pool)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bulkBandColor}
                      onChange={(e) => setBulkBandColor(e.target.value)}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={bulkBandColor}
                      onChange={(e) => setBulkBandColor(e.target.value)}
                      placeholder="#FFD700"
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-gray-900 uppercase"
                    />
                  </div>
                </div>
              </div>
            )}
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
        </form>
      </div>

      {/* Section 3: Active Coupons Table with Categories, Search, Sort & Pagination */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden space-y-4">
        {/* Header bar */}
        <div className="p-6 pb-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#ff5a1f] flex items-center justify-center font-bold">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Active Coupons</h2>
                <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {filteredAndSortedCoupons.length} {filteredAndSortedCoupons.length !== coupons.length ? `of ${coupons.length}` : ""}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Filter, sort, and manage all voucher codes in the system.</p>
            </div>
          </div>

          {coupons.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => setShowBulkExpiryBar(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  showBulkExpiryBar
                    ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
                    : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200 shadow-2xs"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                {showBulkExpiryBar ? "Hide Expiry Tool" : "Bulk Set / Update Expiry"}
              </button>

              {selectedIds.length > 0 && (
                <button
                  type="button"
                  disabled={isDeletingBulk}
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedIds.length})
                </button>
              )}
              <button
                type="button"
                disabled={isDeletingBulk}
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeletingBulk ? "Clearing..." : "Clear All Coupons"}
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Bulk Expiry Update Bar */}
        {showBulkExpiryBar && (
          <div className="mx-6 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 shadow-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Bulk Assign / Change Expiry Date
                </span>
              </div>
              <span className="text-[11px] text-amber-800">
                Pick a date to update selected coupons or all currently filtered coupons at once.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-700 whitespace-nowrap">Target Expiry:</label>
                <input
                  type="date"
                  value={bulkExpiryInput}
                  onChange={(e) => setBulkExpiryInput(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Apply to Selected */}
                <button
                  type="button"
                  disabled={isUpdatingExpiry || !bulkExpiryInput || selectedIds.length === 0}
                  onClick={() => handleBulkApplyExpiry(selectedIds, bulkExpiryInput)}
                  className="px-3.5 py-1.5 bg-[#ff5a1f] hover:bg-[#e04812] text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isUpdatingExpiry ? "Updating..." : `Apply to Selected (${selectedIds.length})`}
                </button>

                {/* Apply to All Filtered / Displayed */}
                <button
                  type="button"
                  disabled={isUpdatingExpiry || !bulkExpiryInput || filteredAndSortedCoupons.length === 0}
                  onClick={() => handleApplyExpiryToCurrentFiltered(bulkExpiryInput)}
                  className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isUpdatingExpiry ? "Updating..." : `Apply to All Filtered (${filteredAndSortedCoupons.length})`}
                </button>

                {/* Remove Expiry (Set to Never) */}
                <button
                  type="button"
                  disabled={isUpdatingExpiry || selectedIds.length === 0}
                  onClick={() => handleBulkApplyExpiry(selectedIds, null)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Remove expiry date from selected coupons"
                >
                  Remove Expiry (Never)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Tabs & Quick Filters */}
        <div className="px-6 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <span className="font-bold text-gray-500 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" /> Filter by Category:
            </span>
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <span>Showing:</span>
              <strong className="text-gray-700">{filteredAndSortedCoupons.length} items</strong>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-gray-100">
            {/* Primary Status & Type filters */}
            <button
              type="button"
              onClick={() => { setCategoryFilter("ALL"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                categoryFilter === "ALL"
                  ? "bg-[#0d1b2a] text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All ({categoriesList.counts.ALL})
            </button>

            <button
              type="button"
              onClick={() => { setCategoryFilter("ACTIVE"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                categoryFilter === "ACTIVE"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
              }`}
            >
              Active / Ready ({categoriesList.counts.ACTIVE})
            </button>

            {categoriesList.counts.VIP_BANDS > 0 && (
              <button
                type="button"
                onClick={() => { setCategoryFilter("VIP_BANDS"); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  categoryFilter === "VIP_BANDS"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300"
                }`}
              >
                ⭐ VIP Offer Bands ({categoriesList.counts.VIP_BANDS})
              </button>
            )}

            <button
              type="button"
              onClick={() => { setCategoryFilter("PERCENTAGE"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                categoryFilter === "PERCENTAGE"
                  ? "bg-[#ff5a1f] text-white shadow-xs"
                  : "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200/60"
              }`}
            >
              Percentage (%) ({categoriesList.counts.PERCENTAGE})
            </button>

            <button
              type="button"
              onClick={() => { setCategoryFilter("FLAT"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                categoryFilter === "FLAT"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60"
              }`}
            >
              Flat ₹ ({categoriesList.counts.FLAT})
            </button>

            <button
              type="button"
              onClick={() => { setCategoryFilter("USED"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                categoryFilter === "USED"
                  ? "bg-gray-700 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Exhausted / Used ({categoriesList.counts.USED})
            </button>

            {categoriesList.counts.EXPIRED > 0 && (
              <button
                type="button"
                onClick={() => { setCategoryFilter("EXPIRED"); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  categoryFilter === "EXPIRED"
                    ? "bg-red-600 text-white shadow-xs"
                    : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60"
                }`}
              >
                Expired ({categoriesList.counts.EXPIRED})
              </button>
            )}

            {/* Prefix / Series Categories */}
            {Object.entries(categoriesList.prefixCounts).map(([catName, count]) => {
              const filterKey = `CAT:${catName}`;
              const isSelected = categoryFilter === filterKey;
              return (
                <button
                  key={catName}
                  type="button"
                  onClick={() => { setCategoryFilter(filterKey); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60"
                  }`}
                >
                  📁 {catName} ({count})
                </button>
              );
            })}
          </div>

          {/* Value Filter Pills Row */}
          {Object.keys(categoriesList.valueCounts).length > 0 && (
            <div className="pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mr-1 flex items-center gap-1 shrink-0">
                <span>Value:</span>
              </span>
              <button
                type="button"
                onClick={() => { setValueFilter("ALL"); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  valueFilter === "ALL"
                    ? "bg-[#ff5a1f] text-white shadow-xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                }`}
              >
                All Values
              </button>

              {Object.entries(categoriesList.valueCounts)
                .sort(([valA], [valB]) => Number(valA) - Number(valB))
                .map(([valStr, count]) => {
                  const isSelected = valueFilter === valStr;
                  return (
                    <button
                      key={valStr}
                      type="button"
                      onClick={() => { setValueFilter(isSelected ? "ALL" : valStr); setCurrentPage(1); }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-purple-700 text-white shadow-xs"
                          : "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/70"
                      }`}
                    >
                      <span>{valStr}% / ₹{valStr}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isSelected ? "bg-white/20 text-white" : "bg-purple-200/80 text-purple-900"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}

          {/* Search Bar & Page Size Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search coupon code or value..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto text-xs">
              {/* View Mode Toggle: Table vs Cards */}
              <div className="inline-flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                    viewMode === "table"
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  title="Table View"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                    viewMode === "cards"
                      ? "bg-white text-[#ff5a1f] shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  title="Cards Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-semibold">Per Page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-gray-50 border border-gray-200 text-gray-900 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={-1}>All ({filteredAndSortedCoupons.length})</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading coupons...</div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-gray-500">No coupons created yet</p>
            <p className="text-xs text-gray-400 mt-1">Add a coupon above or generate a batch series.</p>
          </div>
        ) : filteredAndSortedCoupons.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Filter className="w-10 h-10 mx-auto mb-2 opacity-30 text-gray-400" />
            <p className="font-semibold text-gray-700">No matching coupons found</p>
            <p className="text-xs text-gray-400 mt-1">Try clearing your search query or selecting a different category filter.</p>
            <button
              type="button"
              onClick={() => { setCategoryFilter("ALL"); setValueFilter("ALL"); setSearchQuery(""); setCurrentPage(1); }}
              className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-700 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500 select-none">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input 
                      type="checkbox"
                      checked={
                        paginatedCoupons.length > 0 && 
                        paginatedCoupons.every(c => selectedIds.includes(c.id))
                      }
                      onChange={handleSelectVisible}
                      className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer"
                      title="Select all on current page"
                    />
                  </th>
                  
                  {/* Sortable Code */}
                  <th 
                    onClick={() => handleSort("code")}
                    className="py-3.5 px-6 cursor-pointer hover:text-gray-900 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Code</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === "code" ? "text-[#ff5a1f]" : "text-gray-400 group-hover:text-gray-600"}`} />
                      {sortField === "code" && (
                        <span className="text-[10px] text-[#ff5a1f]">{sortOrder === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>

                  <th className="py-3.5 px-6">Category / Series</th>
                  <th className="py-3.5 px-6">Type</th>
                  
                  {/* Sortable Value */}
                  <th 
                    onClick={() => handleSort("value")}
                    className="py-3.5 px-6 cursor-pointer hover:text-gray-900 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Value</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === "value" ? "text-[#ff5a1f]" : "text-gray-400 group-hover:text-gray-600"}`} />
                      {sortField === "value" && (
                        <span className="text-[10px] text-[#ff5a1f]">{sortOrder === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>

                  {/* Sortable Uses */}
                  <th 
                    onClick={() => handleSort("used_count")}
                    className="py-3.5 px-6 cursor-pointer hover:text-gray-900 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Uses</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === "used_count" ? "text-[#ff5a1f]" : "text-gray-400 group-hover:text-gray-600"}`} />
                      {sortField === "used_count" && (
                        <span className="text-[10px] text-[#ff5a1f]">{sortOrder === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>

                  {/* Sortable Expiry */}
                  <th 
                    onClick={() => handleSort("expiry_date")}
                    className="py-3.5 px-6 cursor-pointer hover:text-gray-900 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Expires</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === "expiry_date" ? "text-[#ff5a1f]" : "text-gray-400 group-hover:text-gray-600"}`} />
                      {sortField === "expiry_date" && (
                        <span className="text-[10px] text-[#ff5a1f]">{sortOrder === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>

                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {paginatedCoupons.map((coupon) => {
                  const isUsedUp = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses;
                  const isExpired = Boolean(coupon.expiry_date && coupon.expiry_date < new Date().toISOString().split("T")[0]);
                  const cat = getCouponCategory(coupon.code);

                  return (
                    <tr 
                      key={coupon.id} 
                      className={`hover:bg-gray-50/70 transition-colors ${selectedIds.includes(coupon.id) ? "bg-orange-50/40" : ""}`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input 
                          type="checkbox"
                          checked={selectedIds.includes(coupon.id)}
                          onClick={(e) => handleToggleSelectOne(coupon.id, e.shiftKey)}
                          onChange={() => {}} // Controlled via onClick with shiftKey
                          className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-6 font-mono font-bold text-gray-900">
                        <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1.5 flex-wrap">
                          {coupon.code}
                          {coupon.is_band_coupon === 1 && (
                            <span 
                              className="text-[9px] font-sans font-black px-2 py-0.5 rounded-full text-amber-950 bg-amber-100 border border-amber-300 inline-flex items-center gap-1 shadow-2xs"
                              title={coupon.band_color ? `Wristband Color: ${coupon.band_color}` : "VIP Offer Band"}
                            >
                              {coupon.band_color && (
                                <span 
                                  className="w-2 h-2 rounded-full border border-black/20" 
                                  style={{ backgroundColor: coupon.band_color }}
                                />
                              )}
                              <span>⭐ {coupon.band_category || "VIP"} BAND</span>
                            </span>
                          )}
                          {isUsedUp && (
                            <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-gray-200 text-gray-600 uppercase tracking-tight">Used</span>
                          )}
                          {isExpired && (
                            <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-600 uppercase tracking-tight">Expired</span>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                          {coupon.is_band_coupon === 1 ? `⭐ ${coupon.band_category || "VIP"} Band Offer` : cat}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 capitalize text-xs text-gray-600">
                        {coupon.discount_type === "percentage" ? "Percentage" : "Flat Amount"}
                      </td>
                      <td className="py-3.5 px-6 font-bold text-gray-900 text-xs">
                        {coupon.discount_type === "percentage" ? `${coupon.value}%` : `₹${coupon.value}`}
                      </td>
                      <td className="py-3.5 px-6 text-gray-600 text-xs">
                        <span className="font-bold text-gray-900">{coupon.used_count}</span>
                        <span className="text-gray-400"> / {coupon.max_uses !== null ? coupon.max_uses : "∞"}</span>
                      </td>
                      <td className="py-3.5 px-6 text-gray-500 text-xs">
                        {coupon.expiry_date ? coupon.expiry_date : "Never"}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => handleDelete(coupon.id, coupon.code)}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete coupon"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards Grid View */
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedCoupons.map((coupon) => {
                const isUsedUp = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses;
                const isExpired = Boolean(coupon.expiry_date && coupon.expiry_date < new Date().toISOString().split("T")[0]);
                const isSelected = selectedIds.includes(coupon.id);
                const cat = getCouponCategory(coupon.code);

                return (
                  <div 
                    key={coupon.id}
                    className={`relative rounded-2xl border transition-all p-4 flex flex-col justify-between select-none ${
                      isSelected 
                        ? "bg-gradient-to-br from-orange-50/90 to-amber-50/60 border-[#ff5a1f] ring-2 ring-[#ff5a1f]/20 shadow-md" 
                        : "bg-white hover:bg-gray-50/80 border-gray-200/80 hover:border-gray-300 shadow-xs"
                    }`}
                  >
                    {/* Top Row: Checkbox, Code & Delete */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => handleToggleSelectOne(coupon.id, e.shiftKey)}
                            onChange={() => {}}
                            className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer w-4 h-4 mt-0.5"
                          />
                          <span className="font-mono font-extrabold text-sm text-gray-900 tracking-wider">
                            {coupon.code}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(coupon.id, coupon.code);
                          }}
                          className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete coupon"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-3">
                        {coupon.is_band_coupon === 1 && (
                          <span 
                            className="text-[10px] font-black px-2 py-0.5 rounded-md text-amber-950 bg-amber-100 border border-amber-300 inline-flex items-center gap-1"
                            title={coupon.band_color ? `Wristband Color: ${coupon.band_color}` : "VIP Offer Band"}
                          >
                            {coupon.band_color && (
                              <span 
                                className="w-2 h-2 rounded-full border border-black/20" 
                                style={{ backgroundColor: coupon.band_color }}
                              />
                            )}
                            <span>⭐ {coupon.band_category || "VIP"} BAND</span>
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200/60">
                          {cat}
                        </span>
                        {isUsedUp && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 uppercase tracking-tight">
                            Exhausted
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase tracking-tight">
                            Expired
                          </span>
                        )}
                        {!isUsedUp && !isExpired && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-tight">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Value Banner */}
                    <div className="py-2.5 px-3 rounded-xl bg-gray-50 border border-gray-100 mb-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium">Discount</span>
                      <span className="font-extrabold text-base text-[#ff5a1f]">
                        {coupon.discount_type === "percentage" ? `${coupon.value}% OFF` : `₹${coupon.value} FLAT`}
                      </span>
                    </div>

                    {/* Bottom Metadata: Uses & Expiry */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                      <div>
                        <span className="text-gray-400">Uses: </span>
                        <strong className="text-gray-900 font-bold">{coupon.used_count}</strong>
                        <span className="text-gray-400"> / {coupon.max_uses !== null ? coupon.max_uses : "∞"}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Expires: </span>
                        <strong className="text-gray-700 font-medium">{coupon.expiry_date || "Never"}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        {pageSize !== -1 && totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              Showing <strong className="text-gray-900">{(validCurrentPage - 1) * pageSize + 1}</strong> to{" "}
              <strong className="text-gray-900">{Math.min(validCurrentPage * pageSize, totalItems)}</strong> of{" "}
              <strong className="text-gray-900">{totalItems}</strong> coupons
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-bold text-gray-800">
                Page {validCurrentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
