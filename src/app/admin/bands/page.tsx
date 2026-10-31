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
  ChevronLeft,
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
  BandColorBreakdown,
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
  bulkDeleteBandItemsAction,
  deleteAllBandInventoryAction,
  quickLookupBandAction
} from "@/app/actions/band-inventory";
import { 
  syncColorInventoryAction, 
  stockOutColorToReceptionAction,
  returnColorFromReceptionAction,
  setColorReceptionAction
} from "@/app/actions/color-inventory";
import { hasUserPermission } from "@/lib/permissions";

export default function BandInventoryPage() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "master" | "movements" | "reports">("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingSlots, setIsSyncingSlots] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Data States
  const [summary, setSummary] = useState<BandInventorySummary | null>(null);
  const [items, setItems] = useState<BandItem[]>([]);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [transactions, setTransactions] = useState<BandTransaction[]>([]);
  const [totalTransactionsCount, setTotalTransactionsCount] = useState(0);

  // Filters & Pagination for Master List
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

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
  const [bulkStartNum, setBulkStartNum] = useState("001");
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkSeparator, setBulkSeparator] = useState<"-" | "" | "auto">("auto");

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

  // Selection States for Bulk Actions
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Color Quick Action Modal (when pressing color card in summary)
  const [selectedColorForAction, setSelectedColorForAction] = useState<BandColorBreakdown | null>(null);
  const [isColorManageModalOpen, setIsColorManageModalOpen] = useState(false);

  // Quick Stock Out to Reception Modal from Color Cards
  const [isStockOutModalForColorOpen, setIsStockOutModalForColorOpen] = useState(false);
  const [colorStockOutAmount, setColorStockOutAmount] = useState(10);
  const [isSubmittingColorStockOut, setIsSubmittingColorStockOut] = useState(false);

  // Return from Reception / Adjust Reception Modal from Color Cards
  const [isReturnModalForColorOpen, setIsReturnModalForColorOpen] = useState(false);
  const [colorReturnAmount, setColorReturnAmount] = useState(10);
  const [isSubmittingColorReturn, setIsSubmittingColorReturn] = useState(false);
  const [directReceptionTarget, setDirectReceptionTarget] = useState(0);
  const [isDirectSetMode, setIsDirectSetMode] = useState(false);

  // Clear / Reset All Inventory Modal
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearResetStarterStock, setClearResetStarterStock] = useState(false);

  // Edit Single Band Modal
  const [isEditBandModalOpen, setIsEditBandModalOpen] = useState(false);
  const [editingBand, setEditingBand] = useState<BandItem | null>(null);
  const [editStatus, setEditStatus] = useState<BandStatus>("available");
  const [editCategory, setEditCategory] = useState<BandCategory>("Standard");
  const [editNotes, setEditNotes] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Auto-clear feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Load session user for permission checks
  useEffect(() => {
    fetch("/api/auth/session")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) setSessionUser(data.user);
      })
      .catch(() => {});
  }, []);

  const canManageStock = hasUserPermission(sessionUser, "bands:manage_stock");
  const canAssignBands = hasUserPermission(sessionUser, "bands:assign");

  // Load all initial data
  const loadData = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const itemsLimit = pageSize === -1 ? 50000 : pageSize;
      const itemsOffset = pageSize === -1 ? 0 : Math.max(0, (currentPage - 1) * pageSize);

      const [summaryRes, itemsRes, txRes] = await Promise.all([
        getBandInventorySummaryAction(),
        getBandItemsAction({
          search: searchQuery,
          status: statusFilter,
          location: locationFilter,
          color_name: colorFilter,
          category: categoryFilter,
          limit: itemsLimit,
          offset: itemsOffset,
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

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, locationFilter, colorFilter, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [searchQuery, statusFilter, locationFilter, colorFilter, categoryFilter, pageSize, currentPage, movementSearch, movementTypeFilter]);

  const handleSyncSlots = async () => {
    setIsSyncingSlots(true);
    setFeedback(null);
    try {
      const res = await syncColorInventoryAction();
      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || "Successfully synchronized slot colours to inventory.",
        });
        await loadData();
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to synchronize slot colours.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred during slot synchronization.",
      });
    } finally {
      setIsSyncingSlots(false);
    }
  };

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
        const rawStart = String(bulkStartNum || "1").trim();
        const parsedStartNum = parseInt(rawStart, 10) || 1;
        const padLen = rawStart.length > 0 ? rawStart.length : 3;
        const effectiveSep = bulkSeparator === "auto"
          ? (bulkPrefix.endsWith("-") || !bulkPrefix ? "" : (/^\d+$/.test(bulkPrefix) && /^\d+$/.test(rawStart) ? "" : "-"))
          : bulkSeparator;

        const res = await bulkCreateBandItemsAction({
          prefix: bulkPrefix,
          startingNumber: parsedStartNum,
          count: bulkCount,
          color_name: selectedColor.name,
          color_hex: selectedColor.hex,
          category: selectedCategory,
          notes: newBandNotes || undefined,
          separator: effectiveSep,
          padLength: padLen,
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
        setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
        loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to delete band." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedItemIds.length} selected wristbands and their transaction logs? This action cannot be undone.`)) {
      return;
    }
    setIsDeletingBulk(true);
    try {
      const res = await bulkDeleteBandItemsAction(selectedItemIds);
      if (res.success) {
        setFeedback({ type: "success", message: `Successfully deleted ${res.count} wristbands from inventory.` });
        setSelectedItemIds([]);
        loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to bulk delete bands." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleClearAllInventory = async () => {
    setIsClearingAll(true);
    try {
      const res = await deleteAllBandInventoryAction({ resetStarterStock: clearResetStarterStock });
      if (res.success) {
        setFeedback({
          type: "success",
          message: clearResetStarterStock
            ? "All inventory cleared and reset to 10 starter bands per slot color."
            : "All wristband inventory and logs permanently deleted.",
        });
        setIsClearAllModalOpen(false);
        setSelectedItemIds([]);
        loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to clear inventory." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleOpenEditBand = (item: BandItem) => {
    setEditingBand(item);
    setEditStatus(item.status);
    setEditCategory(item.category);
    setEditNotes(item.notes || "");
    setIsEditBandModalOpen(true);
  };

  const handleSaveEditBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBand) return;
    setIsSubmittingEdit(true);
    try {
      const res = await updateBandItemAction(editingBand.id, {
        band_code: editingBand.band_code,
        color_name: editingBand.color_name,
        color_hex: editingBand.color_hex,
        status: editStatus,
        category: editCategory,
        notes: editNotes,
      });
      if (res.success) {
        setFeedback({ type: "success", message: `Wristband ${editingBand.band_code} updated.` });
        setIsEditBandModalOpen(false);
        setEditingBand(null);
        loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to update band." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleColorCardPress = (color: BandColorBreakdown) => {
    setSelectedColorForAction(color);
    setIsColorManageModalOpen(true);
  };

  const handleQuickStockOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColorForAction || !selectedColorForAction.color_inventory_id) {
      setFeedback({ type: "error", message: "Color inventory record ID not found. Please sync from slots first." });
      return;
    }
    if (colorStockOutAmount <= 0) {
      setFeedback({ type: "error", message: "Please specify a positive quantity to stock out." });
      return;
    }

    setIsSubmittingColorStockOut(true);
    try {
      const res = await stockOutColorToReceptionAction({
        id: selectedColorForAction.color_inventory_id,
        amount: colorStockOutAmount
      });
      if (res.success) {
        const rangeText = res.startCode && res.endCode
          ? ` (Wristbands: ${res.startCode}${res.startCode !== res.endCode ? ` to ${res.endCode}` : ''})`
          : '';
        setFeedback({
          type: "success",
          message: `Stock Out Recorded: ${colorStockOutAmount} '${selectedColorForAction.color_name}' bands handed over to Reception!${rangeText} (Reception Total: ${res.item?.in_reception ?? (selectedColorForAction.in_reception || 0) + colorStockOutAmount})`
        });
        setIsStockOutModalForColorOpen(false);
        setColorStockOutAmount(10);
        await loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to record stock out." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred while stocking out." });
    } finally {
      setIsSubmittingColorStockOut(false);
    }
  };

  const handleQuickReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColorForAction || !selectedColorForAction.color_inventory_id) {
      setFeedback({ type: "error", message: "Color inventory record ID not found. Please sync from slots first." });
      return;
    }

    if (isDirectSetMode) {
      if (directReceptionTarget < 0) {
        setFeedback({ type: "error", message: "Target reception quantity cannot be negative." });
        return;
      }
      setIsSubmittingColorReturn(true);
      try {
        const res = await setColorReceptionAction({
          id: selectedColorForAction.color_inventory_id,
          receptionAmount: directReceptionTarget,
          returnToWarehouse: true
        });
        if (res.success) {
          setFeedback({
            type: "success",
            message: `Reception Count Corrected: '${selectedColorForAction.color_name}' reception is now set to ${directReceptionTarget}. Warehouse stock adjusted to ${res.item?.quantity ?? 0}.`
          });
          setIsReturnModalForColorOpen(false);
          await loadData();
        } else {
          setFeedback({ type: "error", message: res.error || "Failed to set reception count." });
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "An error occurred." });
      } finally {
        setIsSubmittingColorReturn(false);
      }
      return;
    }

    if (colorReturnAmount <= 0) {
      setFeedback({ type: "error", message: "Please specify a positive quantity to return." });
      return;
    }
    const currentAtReception = selectedColorForAction.in_reception || 0;
    if (colorReturnAmount > currentAtReception) {
      setFeedback({ type: "error", message: `Cannot return ${colorReturnAmount}. Only ${currentAtReception} recorded at reception.` });
      return;
    }

    setIsSubmittingColorReturn(true);
    try {
      const res = await returnColorFromReceptionAction({
        id: selectedColorForAction.color_inventory_id,
        amount: colorReturnAmount
      });
      if (res.success) {
        setFeedback({
          type: "success",
          message: `Returned to Storage: ${colorReturnAmount} '${selectedColorForAction.color_name}' bands returned to warehouse stock! (Reception now: ${res.item?.in_reception ?? (currentAtReception - colorReturnAmount)})`
        });
        setIsReturnModalForColorOpen(false);
        setColorReturnAmount(10);
        await loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to return bands from reception." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred while returning bands." });
    } finally {
      setIsSubmittingColorReturn(false);
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
      case "HANDOVER":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
            📍 Handover
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

          {canManageStock && (
            <>
              <button
                onClick={handleSyncSlots}
                disabled={isSyncingSlots || isRefreshing}
                className="bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                title="Read slot colours and sync inventory records with 0 initial quantity"
              >
                <Sparkles className={`w-4 h-4 text-emerald-400 ${isSyncingSlots ? "animate-spin" : ""}`} />
                <span>{isSyncingSlots ? "Syncing..." : "Sync Slot Colours"}</span>
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
                onClick={() => {
                  setClearResetStarterStock(false);
                  setIsClearAllModalOpen(true);
                }}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all"
                title="Wipe or reset entire inventory"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Clear / Reset All</span>
              </button>
            </>
          )}

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
              <div className="flex items-center gap-3 self-start sm:self-auto">
                {canManageStock && (
                  <>
                    <button
                      type="button"
                      onClick={handleSyncSlots}
                      disabled={isSyncingSlots || isRefreshing}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                      title="Sync colours from configured slots (initial stock 0)"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingSlots ? "animate-spin" : ""}`} />
                      <span>{isSyncingSlots ? "Syncing..." : "Sync from Slots"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsBulkMode(true);
                        setIsStockInModalOpen(true);
                      }}
                      className="text-xs font-bold text-[#ff5a1f] hover:underline flex items-center gap-1"
                    >
                      <span>+ Batch Generate Bands</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.colorBreakdown.map((color) => {
                const badgeStyle = getWristbandBadgeStyle(color.color_hex);
                const availPct = color.total > 0 ? Math.round((color.available / color.total) * 100) : 0;

                return (
                  <div
                    key={color.color_name}
                    onClick={() => handleColorCardPress(color)}
                    role="button"
                    tabIndex={0}
                    className="p-4 rounded-xl border border-gray-200 bg-white hover:border-[#ff5a1f] hover:shadow-md transition-all shadow-sm flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-[#ff5a1f]/0 to-transparent group-hover:via-[#ff5a1f] transition-all" />

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border shadow-xs"
                            style={{ backgroundColor: color.color_hex }}
                          />
                          <span className="font-bold text-sm text-gray-900 group-hover:text-[#ff5a1f] transition-colors">
                            {color.color_name}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            color.total === 0 ? "bg-gray-50 text-gray-500 border-dashed border-gray-300" : ""
                          }`}
                          style={color.total > 0 ? badgeStyle : undefined}
                        >
                          {color.total > 0 ? `${color.total} Total` : "No Stock Yet"}
                        </span>
                      </div>

                      {/* Stock Bar */}
                      {color.total > 0 ? (
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
                      ) : (
                        <div className="w-full bg-gray-100/80 border border-dashed border-gray-200 h-2 rounded-full my-2.5" title="No bands in inventory yet" />
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-gray-100 text-center">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">In Stock</span>
                        <span className={`font-mono font-bold text-xs ${color.available > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                          {color.available}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-amber-600">Reception</span>
                        <span className={`font-mono font-bold text-xs ${(color.in_reception || 0) > 0 ? "text-amber-700 font-black" : "text-gray-400"}`}>
                          {color.in_reception || 0}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">Issued</span>
                        <span className={`font-mono font-bold text-xs ${color.issued > 0 ? "text-blue-700" : "text-gray-400"}`}>
                          {color.issued}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">Damaged</span>
                        <span className={`font-mono font-bold text-xs ${color.damaged > 0 ? "text-red-600" : "text-gray-400"}`}>
                          {color.damaged}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-400 group-hover:text-[#ff5a1f] font-medium transition-colors">
                      <span className="flex items-center gap-1 font-semibold">
                        {canManageStock ? (
                          <>
                            <Plus className="w-3 h-3 text-[#ff5a1f]" />
                            {color.total > 0 ? "Manage & Add Series" : "Add Inventory Now"}
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 text-[#ff5a1f]" />
                            <span>View Bands &amp; Details</span>
                          </>
                        )}
                      </span>
                      <span className="flex items-center gap-0.5 font-bold">
                        Options <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
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

              {/* Location Filter */}
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              >
                <option value="all">All Locations</option>
                <option value="reception">📍 At Reception Counter</option>
                <option value="warehouse">📦 In Warehouse / Storage</option>
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

              {/* Per Page Selector */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white border border-gray-300 rounded-xl px-2.5 py-1">
                <span className="text-gray-500 font-semibold text-xs whitespace-nowrap">Per Page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-gray-900 text-xs font-bold py-1 focus:outline-none cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                  <option value={-1}>All ({totalItemsCount})</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bulk Selection Action Bar */}
          {selectedItemIds.length > 0 && (
            <div className="bg-orange-50 border-y border-orange-200 px-4 py-2.5 flex items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-orange-900">
                <span className="w-5 h-5 rounded-full bg-[#ff5a1f] text-white inline-flex items-center justify-center text-[11px]">
                  {selectedItemIds.length}
                </span>
                <span>wristband(s) selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedItemIds([])}
                  className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-900 font-semibold"
                >
                  Deselect All
                </button>
                {canManageStock && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={isDeletingBulk}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeletingBulk ? "Deleting..." : `Delete Selected (${selectedItemIds.length})`}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Master Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedItemIds.length === items.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItemIds(items.map((i) => i.id));
                        } else {
                          setSelectedItemIds([]);
                        }
                      }}
                      className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer"
                      title="Select all on this page"
                    />
                  </th>
                  <th className="py-3.5 px-4">Unique Band ID</th>
                  <th className="py-3.5 px-4">Color / Scheme</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Location</th>
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
                    <td colSpan={10} className="py-12 text-center text-gray-500">
                      No wristbands found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const badgeStyle = getWristbandBadgeStyle(item.color_hex);
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                      <tr key={item.id} className={`hover:bg-gray-50/80 transition-colors ${isSelected ? "bg-orange-50/40" : ""}`}>
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItemIds((prev) => [...prev, item.id]);
                              } else {
                                setSelectedItemIds((prev) => prev.filter((id) => id !== item.id));
                              }
                            }}
                            className="rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer"
                          />
                        </td>

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

                        {/* Location */}
                        <td className="py-3 px-4">
                          {item.location === "reception" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                              📍 Reception
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200">
                              📦 Storage
                            </span>
                          )}
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
                            {canAssignBands && item.status === "available" && (
                              <button
                                onClick={() => handleOpenIssueModal(item)}
                                className="px-2.5 py-1 rounded-lg bg-[#ff5a1f] hover:bg-[#e04812] text-white font-bold text-[11px] transition-colors"
                                title="Issue this band"
                              >
                                Issue
                              </button>
                            )}

                            {canAssignBands && item.status === "issued" && (
                              <button
                                onClick={() => handleOpenReturnModal(item)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                                title="Return this band"
                              >
                                Return
                              </button>
                            )}

                            {canManageStock && (item.status === "damaged" || item.status === "lost" || item.status === "retired") && (
                              <button
                                onClick={() => handleRestoreBand(item)}
                                className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold text-[11px] transition-colors"
                                title="Restore to Available"
                              >
                                Restore
                              </button>
                            )}

                            {canManageStock && (
                              <>
                                {/* Edit Band Details */}
                                <button
                                  onClick={() => handleOpenEditBand(item)}
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                  title="Edit Band"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Band Directly */}
                                <button
                                  onClick={() => handleDeleteBand(item)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Permanently Delete Band"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
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

          {/* Table Footer with Pagination Controls */}
          {pageSize !== -1 && totalItemsCount > pageSize ? (
            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
              <div>
                Showing <strong className="text-gray-900 font-mono">{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                <strong className="text-gray-900 font-mono">{Math.min(currentPage * pageSize, totalItemsCount)}</strong> of{" "}
                <strong className="text-gray-900 font-mono">{totalItemsCount}</strong> wristbands
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 py-1 font-bold text-gray-800">
                  Page {currentPage} of {Math.ceil(totalItemsCount / pageSize)}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= Math.ceil(totalItemsCount / pageSize)}
                  onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(totalItemsCount / pageSize), prev + 1))}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
              <span>
                Showing <strong className="font-mono text-gray-900">{items.length}</strong> of{" "}
                <strong className="font-mono text-gray-900">{totalItemsCount}</strong> wristbands in master catalog
              </span>
              <span className="font-mono text-gray-400">Unique ID Master Database</span>
            </div>
          )}
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
              <option value="HANDOVER">📍 Handover to Reception</option>
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
                        value={bulkPrefix}
                        onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())}
                        placeholder="e.g. 017 or BND-CYAN"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Starting #
                      </label>
                      <input
                        type="text"
                        required
                        value={bulkStartNum}
                        onChange={(e) => setBulkStartNum(e.target.value)}
                        placeholder="e.g. 001"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      />
                    </div>
                  </div>

                  {/* Format Separator Selector */}
                  <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700">Code Format:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBulkSeparator("auto")}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all border ${
                          bulkSeparator === "auto"
                            ? "bg-[#0d1b2a] text-white border-[#0d1b2a]"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                        title="Auto-detect: Direct sequence for numbers (017001), dash for words (BND-RED-001)"
                      >
                        Auto (Smart)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkSeparator("")}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all border ${
                          bulkSeparator === ""
                            ? "bg-[#ff5a1f] text-white border-[#ff5a1f]"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                        title="Direct (No Dash, e.g. 017001)"
                      >
                        Direct (017001)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkSeparator("-")}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all border ${
                          bulkSeparator === "-"
                            ? "bg-[#ff5a1f] text-white border-[#ff5a1f]"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                        title="With Dash (e.g. 017-001)"
                      >
                        Dash (017-001)
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Quantity to Generate (1 to 50,000)
                      </label>
                      <div className="flex gap-1">
                        {[50, 100, 500, 1000, 3000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setBulkCount(preset)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                              bulkCount === preset
                                ? "bg-[#ff5a1f] text-white border-[#ff5a1f]"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200"
                            }`}
                          >
                            +{preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={50000}
                      required
                      value={bulkCount}
                      onChange={(e) => setBulkCount(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                    />
                    {(() => {
                      const cleanPrefix = (bulkPrefix || "").trim();
                      const rawStart = String(bulkStartNum || "1").trim();
                      const numStart = parseInt(rawStart, 10) || 1;
                      const padLen = rawStart.length > 0 ? rawStart.length : 3;
                      const sep = bulkSeparator === "auto"
                        ? (cleanPrefix.endsWith("-") || !cleanPrefix ? "" : (/^\d+$/.test(cleanPrefix) && /^\d+$/.test(rawStart) ? "" : "-"))
                        : bulkSeparator;

                      const formatCode = (val: number) => {
                        const isNumConcat = sep === "" && /^\d+$/.test(cleanPrefix) && /^\d+$/.test(rawStart);
                        if (isNumConcat) {
                          // e.g. Prefix '017', Start '001' (combined 17001), count 1000 -> 17001 to 18000
                          const combinedStart = parseInt(cleanPrefix + rawStart, 10);
                          const totalLen = cleanPrefix.length + padLen;
                          return String(combinedStart + (val - numStart)).padStart(totalLen, "0");
                        }
                        const formattedNum = String(val).padStart(padLen, "0");
                        if (!cleanPrefix) return formattedNum;
                        if (cleanPrefix.endsWith("-") && sep === "-") return `${cleanPrefix}${formattedNum}`;
                        return `${cleanPrefix}${sep}${formattedNum}`;
                      };

                      const startCode = formatCode(numStart);
                      const endCode = formatCode(numStart + bulkCount - 1);

                      return (
                        <div className="mt-2 p-2.5 rounded-xl bg-orange-50/70 border border-orange-200/80 text-xs">
                          <span className="font-bold text-orange-950 block">Live Range Preview:</span>
                          <span className="font-mono font-black text-[#ff5a1f] text-sm mt-0.5 block">
                            {startCode} &nbsp;➔&nbsp; {endCode}
                          </span>
                          <span className="text-[11px] text-gray-500 mt-1 block">
                            Generates exactly {bulkCount} unique wristbands in sequence.
                          </span>
                        </div>
                      );
                    })()}
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
      {/* ========================================================================= */}
      {/* MODAL 4: COLOR-WISE MANAGEMENT & NEW SERIES (FROM CLICKING CARD)           */}
      {/* ========================================================================= */}
      {isColorManageModalOpen && selectedColorForAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-200 relative my-auto">
            <button
              onClick={() => {
                setIsColorManageModalOpen(false);
                setSelectedColorForAction(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                style={{ backgroundColor: selectedColorForAction.color_hex }}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff5a1f] bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                Color Stock Quick Hub
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <span>{selectedColorForAction.color_name} Wristbands</span>
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              {canManageStock
                ? "Manage stock levels, batch generate a new band series, or view and edit individual items."
                : "View wristband stock levels and filter the catalog to inspect wristbands."}
            </p>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-5 gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200 mb-6 text-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Total</span>
                <span className="font-mono font-bold text-gray-900">{selectedColorForAction.total}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Warehouse</span>
                <span className="font-mono font-bold text-emerald-700">{selectedColorForAction.available}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600 block">Reception</span>
                <span className="font-mono font-bold text-amber-700">{selectedColorForAction.in_reception || 0}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 block">Issued</span>
                <span className="font-mono font-bold text-blue-700">{selectedColorForAction.issued}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-red-600 block">Damaged/Lost</span>
                <span className="font-mono font-bold text-red-600">{selectedColorForAction.damaged + selectedColorForAction.lost}</span>
              </div>
            </div>

            {/* Action Cards Grid */}
            <div className="space-y-3">
              {canManageStock ? (
                <>
                  {/* Option: Stock Out to Reception */}
                  <button
                    onClick={() => {
                      setIsColorManageModalOpen(false);
                      setColorStockOutAmount(10);
                      setIsStockOutModalForColorOpen(true);
                    }}
                    className="w-full text-left p-4 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-100/50 hover:border-amber-400 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-amber-500 text-white group-hover:scale-105 transition-transform">
                        <ArrowDownLeft className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="block text-xs font-bold text-amber-900 group-hover:text-amber-800 transition-colors">
                          Stock Out to Reception (Front Desk)
                        </strong>
                        <span className="text-[11px] text-amber-700">
                          Record handover of {selectedColorForAction.color_name} bands to front desk staff for active distribution
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-all" />
                  </button>

                  {/* Option: Return from Reception back to Stock / Adjust Reception Count */}
                  <button
                    onClick={() => {
                      setIsColorManageModalOpen(false);
                      setColorReturnAmount(Math.min(10, (selectedColorForAction.in_reception || 0) > 0 ? (selectedColorForAction.in_reception || 0) : 1));
                      setDirectReceptionTarget(0);
                      setIsDirectSetMode(false);
                      setIsReturnModalForColorOpen(true);
                    }}
                    className="w-full text-left p-4 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-100/50 hover:border-blue-400 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-blue-600 text-white group-hover:scale-105 transition-transform">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="block text-xs font-bold text-blue-950 group-hover:text-blue-900 transition-colors">
                          Return from Reception / Adjust Reception Stock
                        </strong>
                        <span className="text-[11px] text-blue-700">
                          Currently at Reception: <strong className="font-mono font-bold">{selectedColorForAction.in_reception || 0}</strong>. Return to warehouse or reset count.
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-all" />
                  </button>

                  {/* Option 1: Add New Band Series */}
                  <button
                    onClick={() => {
                      const matchedPalette = WRISTBAND_PALETTE.find(
                        (p) => p.name.toLowerCase() === selectedColorForAction.color_name.toLowerCase()
                      ) || {
                        hex: selectedColorForAction.color_hex,
                        name: selectedColorForAction.color_name,
                        bgClass: "bg-gray-100",
                        textClass: "text-gray-800",
                        borderClass: "border-gray-300",
                        ringClass: "ring-gray-400",
                      };
                      setSelectedColor(matchedPalette);
                      const short = selectedColorForAction.color_name.split("/")[0].trim().slice(0, 4).toUpperCase();
                      setBulkPrefix(`BND-${short}`);
                      setBulkStartNum(String(selectedColorForAction.total + 1).padStart(3, "0"));
                      setBulkCount(10);
                      setBulkSeparator("auto");
                      setIsBulkMode(true);
                      setIsColorManageModalOpen(false);
                      setIsStockInModalOpen(true);
                    }}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-[#ff5a1f] hover:bg-orange-50/30 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-orange-100 text-[#ff5a1f] group-hover:scale-105 transition-transform">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="block text-xs font-bold text-gray-900 group-hover:text-[#ff5a1f] transition-colors">
                          + Add New Band Series
                        </strong>
                        <span className="text-[11px] text-gray-500">
                          Batch generate BND-{selectedColorForAction.color_name.slice(0, 3).toUpperCase()}-... bands into inventory
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#ff5a1f] group-hover:translate-x-1 transition-all" />
                  </button>
                </>
              ) : (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500 text-center">
                  🔒 Stock and series modifications are restricted to Admin. You can view bands and issue them to players below.
                </div>
              )}

              {/* Option 2: View in Master Catalog */}
              <button
                onClick={() => {
                  setColorFilter(selectedColorForAction.color_name);
                  setStatusFilter("all");
                  setActiveTab("master");
                  setIsColorManageModalOpen(false);
                }}
                className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 text-blue-600 group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {canManageStock ? `View & Edit All ${selectedColorForAction.color_name} Bands` : `View All ${selectedColorForAction.color_name} Bands`}
                    </strong>
                    <span className="text-[11px] text-gray-500">
                      {canManageStock 
                        ? "Filter Master Items Catalog to edit status, notes, or delete bands"
                        : "Filter Master Items Catalog to view wristband details"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </button>

              {/* Option 3: Quick Issue a Band from this Color */}
              <button
                onClick={() => {
                  setIsColorManageModalOpen(false);
                  handleOpenIssueModal();
                }}
                className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-600 group-hover:scale-105 transition-transform">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
                      Quick Issue Wristband
                    </strong>
                    <span className="text-[11px] text-gray-500">
                      Assign an available {selectedColorForAction.color_name} band to an active player
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsColorManageModalOpen(false);
                  setSelectedColorForAction(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: EDIT SINGLE BAND DETAILS                                         */}
      {/* ========================================================================= */}
      {isEditBandModalOpen && editingBand && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-gray-200 relative my-auto">
            <button
              onClick={() => {
                setIsEditBandModalOpen(false);
                setEditingBand(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full border border-black/10"
                style={{ backgroundColor: editingBand.color_hex }}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Edit Band Details
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 font-mono">
              {editingBand.band_code}
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              Modify inventory status, category, or audit notes for this wristband.
            </p>

            <form onSubmit={handleSaveEditBand} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Current Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as BandStatus)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                >
                  <option value="available">🟢 Available (In Counter)</option>
                  <option value="issued">🟡 Issued (Active with player)</option>
                  <option value="damaged">🔴 Damaged (Quarantine)</option>
                  <option value="lost">⚪ Lost (Missing)</option>
                  <option value="retired">⚫ Retired (Written off)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as BandCategory)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                >
                  <option value="Standard">Standard</option>
                  <option value="VIP">VIP</option>
                  <option value="Child">Child</option>
                  <option value="Staff / Marshal">Staff / Marshal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Starter stock, clasp verified"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditBandModalOpen(false);
                    handleDeleteBand(editingBand);
                  }}
                  className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Band</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditBandModalOpen(false);
                      setEditingBand(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="bg-[#ff5a1f] hover:bg-[#e04812] text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#ff5a1f]/20 disabled:opacity-50"
                  >
                    {isSubmittingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CLEAR / RESET ALL INVENTORY                                      */}
      {/* ========================================================================= */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-red-200 relative my-auto">
            <button
              onClick={() => setIsClearAllModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-red-100 text-red-600">
                <AlertCircle className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                Danger Zone
              </span>
            </div>

            <h2 className="text-xl font-extrabold text-gray-900">Clear All Band Inventory?</h2>
            <p className="text-xs text-gray-600 mt-1 mb-5 leading-relaxed">
              This will permanently delete all wristbands and transaction audit logs. Please select how you want to proceed:
            </p>

            <div className="space-y-3 mb-6">
              <label
                className={`p-3.5 rounded-xl border block cursor-pointer transition-all ${
                  !clearResetStarterStock
                    ? "border-red-500 bg-red-50/50 text-red-900 font-medium"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="clearMode"
                    checked={!clearResetStarterStock}
                    onChange={() => setClearResetStarterStock(false)}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-gray-900">
                      Wipe Everything Completely
                    </strong>
                    <span className="text-[11px] text-gray-500 block mt-0.5">
                      Empty inventory to 0 bands. You can create your own custom band codes manually or in bulk later.
                    </span>
                  </div>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-xl border block cursor-pointer transition-all ${
                  clearResetStarterStock
                    ? "border-[#ff5a1f] bg-orange-50/50 text-orange-950 font-medium"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="clearMode"
                    checked={clearResetStarterStock}
                    onChange={() => setClearResetStarterStock(true)}
                    className="mt-0.5 text-[#ff5a1f] focus:ring-[#ff5a1f]"
                  />
                  <div>
                    <strong className="block text-xs font-bold text-gray-900">
                      Clear &amp; Reset to Clean Starter Stock
                    </strong>
                    <span className="text-[11px] text-gray-500 block mt-0.5">
                      Wipes all current items and generates exactly 10 fresh, available bands for each of the 10 slot colors (BND-XXX-001 to 010).
                    </span>
                  </div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllInventory}
                disabled={isClearingAll}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-600/20 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingAll ? "Clearing..." : clearResetStarterStock ? "Reset Starter Stock" : "Wipe Everything"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL 7: STOCK OUT TO RECEPTION (COLOR INVENTORY POOL)                    */}
      {/* ========================================================================= */}
      {isStockOutModalForColorOpen && selectedColorForAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-amber-200 relative my-auto">
            <button
              onClick={() => setIsStockOutModalForColorOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span 
                className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-sm"
                style={{ backgroundColor: selectedColorForAction.color_hex }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                    Front Desk Handover
                  </span>
                </div>
                <h3 className="text-base font-black text-gray-900 mt-0.5">
                  Stock Out: {selectedColorForAction.color_name}
                </h3>
                <span className="text-[11px] font-mono text-gray-400 font-bold">
                  {selectedColorForAction.color_hex}
                </span>
              </div>
            </div>

            <form onSubmit={handleQuickStockOutSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80">
                  <span className="text-[11px] text-gray-500 font-bold block uppercase">Warehouse Stock:</span>
                  <span className="text-lg font-black font-mono text-gray-900">
                    {selectedColorForAction.available}
                  </span>
                </div>
                <div className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-200/80">
                  <span className="text-[11px] text-amber-800 font-bold block uppercase">At Reception:</span>
                  <span className="text-lg font-black font-mono text-amber-900">
                    {selectedColorForAction.in_reception || 0}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                  Quantity to Hand Over to Reception:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={colorStockOutAmount}
                    onChange={(e) => setColorStockOutAmount(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-base font-black font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex gap-1 shrink-0">
                    {[5, 10, 25, 50].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setColorStockOutAmount(amt)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                          colorStockOutAmount === amt
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200 leading-relaxed">
                  ℹ️ This directly adds <strong className="font-mono font-bold text-amber-800">{colorStockOutAmount}</strong> wristbands to the Reception counter for staff to hand out. Reception total will be <strong className="font-mono font-bold text-amber-800">{(selectedColorForAction.in_reception || 0) + colorStockOutAmount}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsStockOutModalForColorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingColorStockOut || colorStockOutAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmittingColorStockOut ? "Recording Handover..." : "Confirm Stock Out to Reception"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7B: RETURN FROM RECEPTION / ADJUST RECEPTION COUNT                  */}
      {/* ========================================================================= */}
      {isReturnModalForColorOpen && selectedColorForAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-blue-200 relative my-auto">
            <button
              onClick={() => setIsReturnModalForColorOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span 
                className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-sm"
                style={{ backgroundColor: selectedColorForAction.color_hex }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                    Front Desk Return &amp; Adjustment
                  </span>
                </div>
                <h3 className="text-base font-black text-gray-900 mt-0.5">
                  Reception Stock: {selectedColorForAction.color_name}
                </h3>
                <span className="text-[11px] font-mono text-gray-400 font-bold">
                  {selectedColorForAction.color_hex}
                </span>
              </div>
            </div>

            {/* Mode Toggle: Return Specific Amount vs Set Direct Number */}
            <div className="flex rounded-xl bg-gray-100 p-1 mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setIsDirectSetMode(false)}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  !isDirectSetMode ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Return to Storage
              </button>
              <button
                type="button"
                onClick={() => setIsDirectSetMode(true)}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  isDirectSetMode ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Set / Reset Count
              </button>
            </div>

            <form onSubmit={handleQuickReturnSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200/80">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">Warehouse Stock:</span>
                  <span className="text-lg font-black font-mono text-gray-900">
                    {selectedColorForAction.available}
                  </span>
                </div>
                <div className="bg-blue-50/60 rounded-2xl p-3 border border-blue-200/80">
                  <span className="text-[10px] text-blue-800 font-bold block uppercase">Currently At Reception:</span>
                  <span className="text-lg font-black font-mono text-blue-900">
                    {selectedColorForAction.in_reception || 0}
                  </span>
                </div>
              </div>

              {!isDirectSetMode ? (
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                    Quantity to Return back to Warehouse:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={selectedColorForAction.in_reception || 0}
                      required
                      value={colorReturnAmount}
                      onChange={(e) => setColorReturnAmount(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-base font-black font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[5, 10, 50, (selectedColorForAction.in_reception || 0)].filter((amt, idx, arr) => amt > 0 && arr.indexOf(amt) === idx).map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setColorReturnAmount(amt)}
                          className={`px-2 py-2 rounded-xl text-xs font-bold border transition-all ${
                            colorReturnAmount === amt
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                          }`}
                        >
                          {amt === (selectedColorForAction.in_reception || 0) ? 'All' : amt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 bg-blue-50/60 p-2.5 rounded-xl border border-blue-200 leading-relaxed">
                    ℹ️ Moves <strong className="font-mono font-bold text-blue-900">{colorReturnAmount}</strong> bands from Reception back into Warehouse Stock.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                    Directly Set Reception Count To:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      required
                      value={directReceptionTarget}
                      onChange={(e) => setDirectReceptionTarget(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-base font-black font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[0, 10, 50, 100].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDirectReceptionTarget(amt)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                            directReceptionTarget === amt
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                          }`}
                        >
                          {amt === 0 ? 'Reset (0)' : amt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 bg-blue-50/60 p-2.5 rounded-xl border border-blue-200 leading-relaxed">
                    💡 Perfect if a count was entered by mistake (like 999). Setting to <strong className="font-mono font-bold text-blue-900">{directReceptionTarget}</strong> will restore any surplus back to Warehouse Stock automatically.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsReturnModalForColorOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingColorReturn}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {isSubmittingColorReturn ? "Saving..." : isDirectSetMode ? "Set Reception Count" : "Confirm Return to Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
