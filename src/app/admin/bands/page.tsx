"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Layers, 
  Plus, 
  Search, 
  Filter, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User, 
  Receipt, 
  ShieldAlert, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Download, 
  Printer, 
  Sparkles, 
  X, 
  Edit3, 
  Trash2, 
  ChevronRight, 
  RefreshCw, 
  Check, 
  FileSpreadsheet, 
  BarChart3, 
  Package, 
  Eye,
  SlidersHorizontal,
  Hash
} from "lucide-react";
import { WRISTBAND_PALETTE, getSlotWristbandColor, getWristbandBadgeStyle } from "@/lib/slotColors";
import { 
  BandItem, 
  BandTransaction, 
  BandInventorySummary, 
  BandCategory, 
  BandStatus, 
  BandTransactionType 
} from "@/lib/band-inventory-db";
import {
  getBandInventorySummaryAction,
  getBandItemsAction,
  getBandTransactionsAction,
  createBandItemAction,
  bulkCreateBandItemsAction,
  issueBandAction,
  returnBandAction,
  stockOutBandAction,
  restoreBandAction,
  updateBandItemAction,
  deleteBandItemAction,
  quickLookupBandAction
} from "@/app/actions/band-inventory";

export default function BandInventoryPage() {
  const [activeTab, setActiveTab] = useState<"summary" | "master" | "movements" | "reports">("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Data States
  const [summary, setSummary] = useState<BandInventorySummary | null>(null);
  const [items, setItems] = useState<BandItem[]>([]);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [transactions, setTransactions] = useState<BandTransaction[]>([]);
  const [totalTransactionsCount, setTotalTransactionsCount] = useState(0);

  // Filters for Master List
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Filters for Movement Log
  const [movementSearch, setMovementSearch] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");

  // Modals
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BandItem | null>(null);

  // Form States: Single Stock In
  const [newBandCode, setNewBandCode] = useState("");
  const [selectedColor, setSelectedColor] = useState(WRISTBAND_PALETTE[0]);
  const [selectedCategory, setSelectedCategory] = useState<BandCategory>("Standard");
  const [newBandNotes, setNewBandNotes] = useState("");
  const [isSubmittingStockIn, setIsSubmittingStockIn] = useState(false);

  // Form States: Bulk Generator
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState("BND-YEL");
  const [bulkStartNum, setBulkStartNum] = useState(1);
  const [bulkCount, setBulkCount] = useState(10);

  // Form States: Quick Issue
  const [issueBandCode, setIssueBandCode] = useState("");
  const [issueCustomerName, setIssueCustomerName] = useState("");
  const [issueOrderNumber, setIssueOrderNumber] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  // Form States: Quick Return
  const [returnBandCode, setReturnBandCode] = useState("");
  const [returnCondition, setReturnCondition] = useState<"good" | "damaged" | "lost">("good");
  const [returnNotes, setReturnNotes] = useState("");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Auto-clear feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load all initial data
  const loadData = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [summaryRes, itemsRes, txRes] = await Promise.all([
        getBandInventorySummaryAction(),
        getBandItemsAction({
          search: searchQuery,
          status: statusFilter,
          color_name: colorFilter,
          category: categoryFilter,
          limit: 200,
        }),
        getBandTransactionsAction({
          search: movementSearch,
          type: movementTypeFilter,
          limit: 100,
        }),
      ]);

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
      if (itemsRes.success && itemsRes.data) {
        setItems(itemsRes.data.items);
        setTotalItemsCount(itemsRes.data.totalCount);
      }
      if (txRes.success && txRes.data) {
        setTransactions(txRes.data.transactions);
        setTotalTransactionsCount(txRes.data.totalCount);
      }
    } catch (err: any) {
      console.error("Failed to load inventory data:", err);
      setFeedback({ type: "error", message: "Failed to load band inventory data." });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, statusFilter, colorFilter, categoryFilter, movementSearch, movementTypeFilter]);

  // Quick Action: Pre-fill Issue Modal for a specific row
  const handleOpenIssueModal = (item?: BandItem) => {
    if (item) {
      setIssueBandCode(item.band_code);
    } else {
      setIssueBandCode("");
    }
    setIssueCustomerName("");
    setIssueOrderNumber("");
    setIssueNotes("");
    setIsIssueModalOpen(true);
  };

  // Quick Action: Pre-fill Return Modal for a specific row
  const handleOpenReturnModal = (item?: BandItem) => {
    if (item) {
      setReturnBandCode(item.band_code);
    } else {
      setReturnBandCode("");
    }
    setReturnCondition("good");
    setReturnNotes("");
    setIsReturnModalOpen(true);
  };

  // Submit Stock In (Single or Bulk)
  const handleSubmitStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingStockIn(true);
    setFeedback(null);

    try {
      if (isBulkMode) {
        const res = await bulkCreateBandItemsAction({
          prefix: bulkPrefix,
          startingNumber: bulkStartNum,
          count: bulkCount,
          color_name: selectedColor.name,
          color_hex: selectedColor.hex,
          category: selectedCategory,
          notes: newBandNotes || undefined,
        });

        if (res.success) {
          setFeedback({ 
            type: "success", 
            message: `Successfully generated and stocked in ${res.createdCount} wristbands!` 
          });
          setIsStockInModalOpen(false);
          loadData();
        } else {
          setFeedback({ type: "error", message: res.error || "Failed to generate bands." });
        }
      } else {
        const res = await createBandItemAction({
          band_code: newBandCode,
          color_name: selectedColor.name,
          color_hex: selectedColor.hex,
          category: selectedCategory,
          notes: newBandNotes || undefined,
        });

        if (res.success) {
          setFeedback({ type: "success", message: `Wristband ${newBandCode.toUpperCase()} stocked in successfully!` });
          setIsStockInModalOpen(false);
          setNewBandCode("");
          loadData();
        } else {
          setFeedback({ type: "error", message: res.error || "Failed to create band." });
        }
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred." });
    } finally {
      setIsSubmittingStockIn(false);
    }
  };

  // Submit Issue Band
  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueBandCode.trim()) {
      setFeedback({ type: "error", message: "Please specify a Band ID to issue." });
      return;
    }

    setIsSubmittingIssue(true);
    setFeedback(null);

    try {
      const res = await issueBandAction({
        band_code: issueBandCode.trim(),
        customer_name: issueCustomerName.trim() || undefined,
        order_number: issueOrderNumber.trim() || undefined,
        notes: issueNotes.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ 
          type: "success", 
          message: `Wristband ${issueBandCode.toUpperCase()} successfully issued to ${issueCustomerName || "Player"}!` 
        });
        setIsIssueModalOpen(false);
        loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to issue wristband." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred." });
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  // Submit Return Band
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnBandCode.trim()) {
      setFeedback({ type: "error", message: "Please enter the Band ID being returned." });
      return;
    }

    setIsSubmittingReturn(true);
    setFeedback(null);

    try {
      const res = await returnBandAction({
        band_code: returnBandCode.trim(),
        condition: returnCondition,
        notes: returnNotes.trim() || undefined,
      });

      if (res.success) {
        setFeedback({ 
          type: "success", 
          message: `Wristband ${returnBandCode.toUpperCase()} recorded as returned (${returnCondition.toUpperCase()})!` 
        });
        setIsReturnModalOpen(false);
        loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to return wristband." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred." });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Action: Mark Damaged / Lost / Repaired
  const handleRestoreBand = async (item: BandItem) => {
    try {
      const res = await restoreBandAction({ band_id: item.id });
      if (res.success) {
        setFeedback({ type: "success", message: `Wristband ${item.band_code} restored back to available stock!` });
        loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to restore band." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  const handleStockOutBand = async (item: BandItem) => {
    if (!confirm(`Are you sure you want to write-off / retire ${item.band_code} from active inventory?`)) return;
    try {
      const res = await stockOutBandAction({ band_id: item.id, reason: "Manual stock write-off / retired" });
      if (res.success) {
        setFeedback({ type: "success", message: `Wristband ${item.band_code} retired from inventory.` });
        loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to retire band." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  const handleDeleteBand = async (item: BandItem) => {
    if (!confirm(`Permanently delete ${item.band_code} and all its audit logs? This cannot be undone.`)) return;
    try {
      const res = await deleteBandItemAction(item.id);
      if (res.success) {
        setFeedback({ type: "success", message: `Wristband ${item.band_code} deleted.` });
        loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to delete band." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  // Helper for Status Badge
  const getStatusBadge = (status: BandStatus) => {
    switch (status) {
      case "available":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        );
      case "issued":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Issued (On Track)
          </span>
        );
      case "damaged":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-500" />
            Damaged
          </span>
        );
      case "lost":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">
            Lost
          </span>
        );
      case "retired":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-300">
            Retired
          </span>
        );
    }
  };

  // Helper for Transaction Type Badge
  const getTxBadge = (type: BandTransactionType) => {
    switch (type) {
      case "STOCK_IN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ArrowDownLeft className="w-3 h-3 text-blue-600" /> Stock In
          </span>
        );
      case "ISSUE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <ArrowUpRight className="w-3 h-3 text-amber-600" /> Issued
          </span>
        );
      case "RETURN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Returned
          </span>
        );
      case "DAMAGED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" /> Damaged
          </span>
        );
      case "LOST":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            Lost
          </span>
        );
      case "STOCK_OUT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
            Stock Out
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-gray-50 text-gray-600 border border-gray-200">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-[#0d1b2a] via-[#1a2f4c] to-[#0d1b2a] text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Background glow & accents */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#ff5a1f]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#ff5a1f]/20 border border-[#ff5a1f]/40 text-[#ff5a1f] text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              RC FunZone Track Ops
            </span>
            <span className="text-gray-400 text-xs">Live Arena Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight flex items-center gap-3">
            <Layers className="w-7 h-7 text-[#ff5a1f]" />
            <span>Band Inventory Management</span>
          </h1>
          <p className="text-gray-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Unique ID wristband catalog, live stock availability, desk issue &amp; return records, condition tracking, and loss reports.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenIssueModal()}
            className="bg-[#ff5a1f] hover:bg-[#e04812] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#ff5a1f]/20 transition-all active:scale-[0.98]"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Quick Issue Band</span>
          </button>

          <button
            onClick={() => handleOpenReturnModal()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Quick Return Band</span>
          </button>

          <button
            onClick={() => {
              setIsBulkMode(false);
              setIsStockInModalOpen(true);
            }}
            className="bg-white/10 hover:bg-white/15 text-white border border-white/20 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Stock In</span>
          </button>

          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#ff5a1f]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between gap-3 shadow-md border animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "summary"
              ? "bg-[#0d1b2a] text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Stock Summary &amp; Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("master")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "master"
              ? "bg-[#0d1b2a] text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Master Items Catalog ({totalItemsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab("movements")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "movements"
              ? "bg-[#0d1b2a] text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Issue &amp; Return Movement Log</span>
        </button>

        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "reports"
              ? "bg-[#0d1b2a] text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Reports &amp; Stock Count Sheet</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STOCK SUMMARY & OVERVIEW                                           */}
      {/* ========================================================================= */}
      {activeTab === "summary" && summary && (
        <div className="space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total Master Bands */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Total Master Bands
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-gray-900 font-mono">
                  {summary.totalBands}
                </span>
                <span className="text-xs text-gray-400 font-medium">Bands</span>
              </div>
              <div className="mt-2 text-[11px] text-gray-500">
                Active pool: <strong className="text-gray-800">{summary.activeInventory}</strong>
              </div>
            </div>

            {/* In-Stock Available */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Available In Stock
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
                  {summary.available}
                </span>
                <span className="text-xs text-emerald-800 font-bold">{summary.availabilityRate}%</span>
              </div>
              <div className="mt-2 text-[11px] text-emerald-700">Ready for desk issuance</div>
            </div>

            {/* Currently Issued (On Track) */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Currently Issued
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-amber-700 font-mono">
                  {summary.issued}
                </span>
                <span className="text-xs text-amber-800 font-medium">On Track</span>
              </div>
              <div className="mt-2 text-[11px] text-amber-700">Active with players</div>
            </div>

            {/* Returned Today */}
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                Returned Today
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-blue-700 font-mono">
                  {summary.returnedToday}
                </span>
                <span className="text-xs text-blue-800 font-medium">Today</span>
              </div>
              <div className="mt-2 text-[11px] text-blue-700">Checked back in</div>
            </div>

            {/* Damaged / Quarantine */}
            <div className="p-4 rounded-2xl bg-red-50/60 border border-red-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-800">
                Damaged / Quarantine
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-red-700 font-mono">
                  {summary.damaged}
                </span>
                <span className="text-xs text-red-800 font-medium">Bands</span>
              </div>
              <div className="mt-2 text-[11px] text-red-700">Requires repair/discard</div>
            </div>

            {/* Lost / Missing */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Reported Lost
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-gray-700 font-mono">
                  {summary.lost}
                </span>
                <span className="text-xs text-gray-500 font-medium">Unreturned</span>
              </div>
              <div className="mt-2 text-[11px] text-gray-500">Shrinkage count</div>
            </div>
          </div>

          {/* Low Stock Warning Alert if any color is low */}
          {summary.lowStockColors.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-xs font-bold uppercase tracking-wider text-amber-900">
                  Low Stock Warning (Under 3 Available)
                </strong>
                <p className="text-xs text-amber-800 mt-0.5">
                  The following wristband colors have low available stock:{" "}
                  {summary.lowStockColors.map((c) => `${c.color_name} (${c.available} left)`).join(", ")}. Consider stocking in more bands.
                </p>
              </div>
            </div>
          )}

          {/* Color Breakdown Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#ff5a1f]" />
                  <span>Color-Wise Wristband Availability &amp; Stock Levels</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Matches your track time slot color schemes for quick visual verification.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsBulkMode(true);
                  setIsStockInModalOpen(true);
                }}
                className="text-xs font-bold text-[#ff5a1f] hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                <span>+ Batch Generate Bands</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.colorBreakdown.map((color) => {
                const badgeStyle = getWristbandBadgeStyle(color.color_hex);
                const availPct = color.total > 0 ? Math.round((color.available / color.total) * 100) : 0;

                return (
                  <div
                    key={color.color_name}
                    className="p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-all shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border shadow-xs"
                            style={{ backgroundColor: color.color_hex }}
                          />
                          <span className="font-bold text-sm text-gray-900">{color.color_name}</span>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
                          style={badgeStyle}
                        >
                          {color.total} Total
                        </span>
                      </div>

                      {/* Stock Bar */}
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex my-2.5">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${(color.available / color.total) * 100}%` }}
                          title={`Available: ${color.available}`}
                        />
                        <div
                          className="bg-amber-400 h-full transition-all duration-300"
                          style={{ width: `${(color.issued / color.total) * 100}%` }}
                          title={`Issued: ${color.issued}`}
                        />
                        <div
                          className="bg-red-400 h-full transition-all duration-300"
                          style={{ width: `${(color.damaged / color.total) * 100}%` }}
                          title={`Damaged: ${color.damaged}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-center">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">In Stock</span>
                        <span className="font-mono font-bold text-xs text-emerald-700">
                          {color.available}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">Issued</span>
                        <span className="font-mono font-bold text-xs text-amber-700">{color.issued}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">Damaged</span>
                        <span className="font-mono font-bold text-xs text-red-600">{color.damaged}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER ITEMS LIST                                                  */}
      {/* ========================================================================= */}
      {activeTab === "master" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50/70 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Unique Band ID, Holder, Order # or notes..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              >
                <option value="all">All Statuses</option>
                <option value="available">🟢 Available Only</option>
                <option value="issued">🟡 Issued (On Track)</option>
                <option value="damaged">🔴 Damaged</option>
                <option value="lost">⚪ Lost</option>
                <option value="retired">⚫ Retired</option>
              </select>

              {/* Color Filter */}
              <select
                value={colorFilter}
                onChange={(e) => setColorFilter(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              >
                <option value="all">All Band Colors</option>
                {WRISTBAND_PALETTE.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              >
                <option value="all">All Categories</option>
                <option value="Standard">Standard</option>
                <option value="VIP">VIP</option>
                <option value="Child">Child</option>
                <option value="Staff / Marshal">Staff / Marshal</option>
              </select>
            </div>
          </div>

          {/* Master Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Unique Band ID</th>
                  <th className="py-3.5 px-4">Color / Scheme</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Current Status</th>
                  <th className="py-3.5 px-4">Current Holder / Order</th>
                  <th className="py-3.5 px-4 text-center">Uses</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      No wristbands found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const badgeStyle = getWristbandBadgeStyle(item.color_hex);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                        {/* Unique Band ID */}
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">
                          <span className="bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                            {item.band_code}
                          </span>
                        </td>

                        {/* Color */}
                        <td className="py-3 px-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold"
                            style={badgeStyle}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-black/10"
                              style={{ backgroundColor: item.color_hex }}
                            />
                            {item.color_name}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 text-gray-700 font-medium">
                          {item.category}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">{getStatusBadge(item.status)}</td>

                        {/* Current Holder / Order */}
                        <td className="py-3 px-4">
                          {item.current_holder_name ? (
                            <div className="font-semibold text-gray-900">
                              <span>{item.current_holder_name}</span>
                              {item.current_order_number && (
                                <span className="ml-1 text-[11px] text-amber-700 font-mono">
                                  ({item.current_order_number})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">None (In Counter)</span>
                          )}
                        </td>

                        {/* Total Uses */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-gray-700">
                          {item.total_uses}
                        </td>

                        {/* Notes */}
                        <td className="py-3 px-4 text-gray-500 text-[11px] max-w-xs truncate">
                          {item.notes || "-"}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {item.status === "available" && (
                              <button
                                onClick={() => handleOpenIssueModal(item)}
                                className="px-2.5 py-1 rounded-lg bg-[#ff5a1f] hover:bg-[#e04812] text-white font-bold text-[11px] transition-colors"
                                title="Issue this band"
                              >
                                Issue
                              </button>
                            )}

                            {item.status === "issued" && (
                              <button
                                onClick={() => handleOpenReturnModal(item)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                                title="Return this band"
                              >
                                Return
                              </button>
                            )}

                            {(item.status === "damaged" || item.status === "lost") && (
                              <button
                                onClick={() => handleRestoreBand(item)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold text-[11px] transition-colors"
                                title="Restore to Available"
                              >
                                Restore
                              </button>
                            )}

                            {item.status !== "retired" && (
                              <button
                                onClick={() => handleStockOutBand(item)}
                                className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 transition-colors"
                                title="Retire / Stock Out"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
            <span>Showing {items.length} of {totalItemsCount} wristbands in master catalog</span>
            <span className="font-mono text-gray-400">Unique ID Master Database</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ISSUE & RETURN MOVEMENT LOG                                        */}
      {/* ========================================================================= */}
      {activeTab === "movements" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50/70 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={movementSearch}
                onChange={(e) => setMovementSearch(e.target.value)}
                placeholder="Search movements by Band ID, Customer, Staff or order #..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              />
            </div>

            <select
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
            >
              <option value="all">All Movement Types</option>
              <option value="ISSUE">Issue Operations</option>
              <option value="RETURN">Return Operations</option>
              <option value="STOCK_IN">Stock In Operations</option>
              <option value="STOCK_OUT">Stock Out / Write-off</option>
              <option value="DAMAGED">Damaged Reports</option>
              <option value="LOST">Lost Reports</option>
            </select>

            <a
              href="/api/admin/bands/export?type=movements"
              download
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Export Log</span>
            </a>
          </div>

          {/* Movements Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Date &amp; Time</th>
                  <th className="py-3.5 px-4">Band ID</th>
                  <th className="py-3.5 px-4">Color</th>
                  <th className="py-3.5 px-4">Movement Type</th>
                  <th className="py-3.5 px-4">Customer Name / Order</th>
                  <th className="py-3.5 px-4">Staff Member</th>
                  <th className="py-3.5 px-4">Remarks / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No transaction records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-600">
                        {new Date(tx.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        {tx.band_code}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
                          <span
                            className="w-2.5 h-2.5 rounded-full border"
                            style={{ backgroundColor: tx.color_hex }}
                          />
                          {tx.color_name}
                        </span>
                      </td>
                      <td className="py-3 px-4">{getTxBadge(tx.transaction_type)}</td>
                      <td className="py-3 px-4">
                        {tx.customer_name ? (
                          <div>
                            <span className="font-semibold text-gray-900">{tx.customer_name}</span>
                            {tx.order_number && (
                              <span className="ml-1 text-[11px] text-amber-700 font-mono">
                                ({tx.order_number})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-medium">{tx.staff_name || "Admin"}</td>
                      <td className="py-3 px-4 text-gray-500 text-[11px] max-w-sm truncate">
                        {tx.notes || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 text-xs text-gray-500">
            Total recorded transactions: {totalTransactionsCount}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: REPORTS & STOCK SUMMARY SHEET                                      */}
      {/* ========================================================================= */}
      {activeTab === "reports" && summary && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
              <div>
                <span className="text-[11px] font-bold text-[#ff5a1f] uppercase tracking-wider">
                  Official Store Record
                </span>
                <h2 className="text-xl font-extrabold text-gray-900 mt-0.5">
                  RC FunZone Wristband Inventory &amp; Loss Summary
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Ready for physical counter audits, reconciliation, and managerial reporting.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <a
                  href="/api/admin/bands/export?type=summary"
                  download
                  className="bg-[#0d1b2a] hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV Summary</span>
                </a>

                <button
                  onClick={() => window.print()}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Sheet</span>
                </button>
              </div>
            </div>

            {/* Printable Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50 border-b border-gray-200 font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Band Color Scheme</th>
                    <th className="py-3 px-4 text-center">Total Master</th>
                    <th className="py-3 px-4 text-center bg-emerald-50 text-emerald-800">Available In Stock</th>
                    <th className="py-3 px-4 text-center bg-amber-50 text-amber-800">Issued On Track</th>
                    <th className="py-3 px-4 text-center bg-red-50 text-red-800">Damaged</th>
                    <th className="py-3 px-4 text-center">Lost</th>
                    <th className="py-3 px-4 text-center">Retired</th>
                    <th className="py-3 px-4 text-right">Availability %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {summary.colorBreakdown.map((c) => {
                    const availPct = c.total > 0 ? Math.round((c.available / c.total) * 100) : 0;
                    return (
                      <tr key={c.color_name} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-bold text-gray-900 flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-gray-300"
                            style={{ backgroundColor: c.color_hex }}
                          />
                          <span>{c.color_name}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-gray-900">
                          {c.total}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700 bg-emerald-50/30">
                          {c.available}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-amber-700 bg-amber-50/30">
                          {c.issued}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-red-600 bg-red-50/30">
                          {c.damaged}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-gray-600">{c.lost}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{c.retired}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-800">
                          {availPct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 text-gray-900">
                  <tr>
                    <td className="py-3 px-4 uppercase tracking-wider">Grand Total</td>
                    <td className="py-3 px-4 text-center font-mono">{summary.totalBands}</td>
                    <td className="py-3 px-4 text-center font-mono text-emerald-800">{summary.available}</td>
                    <td className="py-3 px-4 text-center font-mono text-amber-800">{summary.issued}</td>
                    <td className="py-3 px-4 text-center font-mono text-red-800">{summary.damaged}</td>
                    <td className="py-3 px-4 text-center font-mono">{summary.lost}</td>
                    <td className="py-3 px-4 text-center font-mono">{summary.retired}</td>
                    <td className="py-3 px-4 text-right font-mono">{summary.availabilityRate}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: STOCK IN / BULK GENERATOR                                       */}
      {/* ========================================================================= */}
      {isStockInModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-200 relative my-auto">
            <button
              onClick={() => setIsStockInModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Inventory Inflow
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900">
              {isBulkMode ? "Batch Stock In Generator" : "Stock In New Wristband"}
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              {isBulkMode
                ? "Auto-generate multiple unique sequential band IDs in one click."
                : "Register a single unique wristband into the master inventory."}
            </p>

            {/* Toggle Mode Button */}
            <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
              <button
                type="button"
                onClick={() => setIsBulkMode(false)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  !isBulkMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Single Item Add
              </button>
              <button
                type="button"
                onClick={() => setIsBulkMode(true)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  isBulkMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Batch Auto-Generator
              </button>
            </div>

            <form onSubmit={handleSubmitStockIn} className="space-y-4">
              {isBulkMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Code Prefix
                      </label>
                      <input
                        type="text"
                        required
                        value={bulkPrefix}
                        onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())}
                        placeholder="e.g. BND-CYAN"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Starting #
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={bulkStartNum}
                        onChange={(e) => setBulkStartNum(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Quantity to Generate (1 to 200)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      required
                      value={bulkCount}
                      onChange={(e) => setBulkCount(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Preview: {bulkPrefix}-{String(bulkStartNum).padStart(3, "0")} to{" "}
                      {bulkPrefix}-{String(bulkStartNum + bulkCount - 1).padStart(3, "0")}
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Unique Band ID / Serial Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newBandCode}
                    onChange={(e) => setNewBandCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BND-RED-045 or Barcode / RFID"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                  />
                </div>
              )}

              {/* Color Scheme Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Wristband Color &amp; Slot Match
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-gray-200 rounded-xl">
                  {WRISTBAND_PALETTE.map((c) => {
                    const isSelected = selectedColor.name === c.name;
                    return (
                      <div
                        key={c.name}
                        onClick={() => {
                          setSelectedColor(c);
                          if (isBulkMode) {
                            const shortCode = c.name.split("/")[0].trim().slice(0, 4).toUpperCase();
                            setBulkPrefix(`BND-${shortCode}`);
                          }
                        }}
                        className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center gap-2 transition-all ${
                          isSelected
                            ? "border-[#ff5a1f] bg-orange-50/40 font-bold"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="truncate text-gray-800">{c.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as BandCategory)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                >
                  <option value="Standard">Standard Arena Participant</option>
                  <option value="VIP">VIP Participant / Simulator Access</option>
                  <option value="Child">Child / Junior Racer</option>
                  <option value="Staff / Marshal">Staff / Track Marshal</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Notes / Supplier Lot (Optional)
                </label>
                <input
                  type="text"
                  value={newBandNotes}
                  onChange={(e) => setNewBandNotes(e.target.value)}
                  placeholder="e.g. Lot #2026-A Silicone reusable"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsStockInModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStockIn}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmittingStockIn ? "Adding Stock..." : isBulkMode ? `Generate ${bulkCount} Bands` : "Stock In Band"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: QUICK ISSUE WRISTBAND                                            */}
      {/* ========================================================================= */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-gray-200 relative my-auto">
            <button
              onClick={() => setIsIssueModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Desk Issuance
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900">Issue Wristband to Player</h2>
            <p className="text-xs text-gray-500 mb-5">
              Link a physical band to the customer before they enter the track arena.
            </p>

            <form onSubmit={handleSubmitIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Band Unique ID / Code *
                </label>
                <input
                  type="text"
                  required
                  value={issueBandCode}
                  onChange={(e) => setIssueBandCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BND-CYAN-001"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Customer / Player Name
                </label>
                <input
                  type="text"
                  required
                  value={issueCustomerName}
                  onChange={(e) => setIssueCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Order / Booking # (Optional)
                </label>
                <input
                  type="text"
                  value={issueOrderNumber}
                  onChange={(e) => setIssueOrderNumber(e.target.value)}
                  placeholder="e.g. #32 or #PAYDUE_FZ_105"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="e.g. Issued at Track Entry Gate"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIssue}
                  className="bg-[#ff5a1f] hover:bg-[#e04812] text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#ff5a1f]/20 disabled:opacity-50"
                >
                  {isSubmittingIssue ? "Issuing..." : "Confirm & Issue Band"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK RETURN WRISTBAND                                           */}
      {/* ========================================================================= */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-gray-200 relative my-auto">
            <button
              onClick={() => setIsReturnModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Track Return / Inflow
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900">Return Wristband to Stock</h2>
            <p className="text-xs text-gray-500 mb-5">
              Record player return and check band physical condition.
            </p>

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Band Unique ID / Code *
                </label>
                <input
                  type="text"
                  required
                  value={returnBandCode}
                  onChange={(e) => setReturnBandCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BND-CYAN-001"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Physical Condition
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      returnCondition === "good"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      className="sr-only"
                      checked={returnCondition === "good"}
                      onChange={() => setReturnCondition("good")}
                    />
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    <span className="text-xs block">Good (Reuse)</span>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      returnCondition === "damaged"
                        ? "border-red-500 bg-red-50 text-red-800 font-bold"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      className="sr-only"
                      checked={returnCondition === "damaged"}
                      onChange={() => setReturnCondition("damaged")}
                    />
                    <AlertCircle className="w-4 h-4 text-red-600 mx-auto mb-1" />
                    <span className="text-xs block">Damaged</span>
                  </label>

                  <label
                    className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                      returnCondition === "lost"
                        ? "border-purple-500 bg-purple-50 text-purple-800 font-bold"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="condition"
                      className="sr-only"
                      checked={returnCondition === "lost"}
                      onChange={() => setReturnCondition("lost")}
                    />
                    <ShieldAlert className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                    <span className="text-xs block">Lost</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Condition Notes (Optional)
                </label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Clasp loose, sanitized and restocked"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmittingReturn ? "Recording..." : "Record Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
