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
  AlertTriangle,
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
  Hash,
  Loader2,
  Zap,
  Tag,
  Shuffle
} from "lucide-react";
import { WRISTBAND_PALETTE, getSlotWristbandColor, getWristbandBadgeStyle, formatTimeSlotLabel, getSlotInfoForColor } from "@/lib/slotColors";
import { 
  BAND_SUBCATEGORIES,
  normalizeBandCategory,
} from "@/lib/band-types";
import type { 
  BandItem, 
  BandTransaction, 
  BandInventorySummary, 
  BandColorBreakdown,
  BandSubcategoryBreakdown,
  BandCategory, 
  BandStatus, 
  BandTransactionType 
} from "@/lib/band-types";
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
  quickLookupBandAction,
  previewHandoverRangeAction,
  handoverWristbandsAction,
  standardizeAllBandCategoriesAction,
  purgeOrResetColorStockAction
} from "@/app/actions/band-inventory";
import { 
  syncColorInventoryAction, 
  stockOutColorToReceptionAction,
  returnColorFromReceptionAction,
  setColorReceptionAction,
  getSubcategoryBandsAction,
  renameWristbandColorAction
} from "@/app/actions/color-inventory";
import type { SubcategoryBandItem } from "@/lib/color-inventory-db";
import { hasUserPermission } from "@/lib/permissions";
import {
  fetchCouponBandInventoryAction,
  handoverCouponBandsAction,
  fetchTimeSlotsAction,
} from "@/app/actions/tickets";
import type {
  CouponBandInventoryItem,
  CouponBandBreakdown,
  CouponBandSummary,
  TimeSlotRow,
} from "@/lib/db";
import Link from "next/link";


// Helper to parse multiple barcodes from pasted text, commas, newlines, and ranges (e.g. 016001-016010)
function parseBarcodeInputs(text: string): string[] {
  const parts = text.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
  const result: string[] = [];
  for (const part of parts) {
    const dashMatch = part.match(/^([A-Za-z0-9_#-]+)-([A-Za-z0-9_#-]+)$/);
    if (dashMatch) {
      const from = dashMatch[1];
      const to = dashMatch[2];
      if (/^\d+$/.test(from) && /^\d+$/.test(to)) {
        const startNum = parseInt(from, 10);
        const endNum = parseInt(to, 10);
        const padLen = Math.max(from.length, to.length);
        if (startNum <= endNum && endNum - startNum <= 200) {
          for (let i = startNum; i <= endNum; i++) {
            result.push(String(i).padStart(padLen, '0'));
          }
          continue;
        }
      }
    }
    result.push(part.toUpperCase());
  }
  return Array.from(new Set(result));
}

export default function BandInventoryPage() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "coupon_bands" | "master" | "movements" | "reports">("summary");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingSlots, setIsSyncingSlots] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Dedicated Coupon Band Inventory States
  const [couponInventory, setCouponInventory] = useState<{
    summary: CouponBandSummary;
    breakdown: CouponBandBreakdown[];
    items: CouponBandInventoryItem[];
  } | null>(null);
  const [couponSearch, setCouponSearch] = useState("");
  const [couponStatusFilter, setCouponStatusFilter] = useState<"all" | "warehouse" | "reception" | "redeemed" | "expired">("all");
  const [couponOfferFilter, setCouponOfferFilter] = useState("all");
  const [couponPage, setCouponPage] = useState(1);
  const [couponPageSize, setCouponPageSize] = useState(50);
  const [selectedCouponIds, setSelectedCouponIds] = useState<number[]>([]);

  // Coupon Handover Modal States
  const [isCouponHandoverModalOpen, setIsCouponHandoverModalOpen] = useState(false);
  const [handoverOfferCategory, setHandoverOfferCategory] = useState<string>("");
  const [handoverOfferColor, setHandoverOfferColor] = useState<string>("");
  const [handoverOfferName, setHandoverOfferName] = useState<string>("");
  const [handoverAmount, setHandoverAmount] = useState<number>(10);
  const [handoverDirection, setHandoverDirection] = useState<"to_reception" | "to_warehouse">("to_reception");
  const [isSubmittingCouponHandover, setIsSubmittingCouponHandover] = useState(false);

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
  const [configuredSubcategories, setConfiguredSubcategories] = useState<SubcategoryBandItem[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlotRow[]>([]);
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
  const [stockInError, setStockInError] = useState<string | null>(null);

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
  const [isRenamingColor, setIsRenamingColor] = useState(false);
  const [renameFormColorName, setRenameFormColorName] = useState("");
  const [renameFormCategory, setRenameFormCategory] = useState("");
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  // Stock Reset & Purge Modal States
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeTargetColor, setPurgeTargetColor] = useState<BandColorBreakdown | null>(null);
  const [purgeActionType, setPurgeActionType] = useState<"reset_to_zero" | "delete_pool" | "purge_unissued_bands" | "delete_everything">("reset_to_zero");
  const [isSubmittingPurge, setIsSubmittingPurge] = useState(false);
  const [isCleanInventoryModalOpen, setIsCleanInventoryModalOpen] = useState(false);
  const [customColorToPurge, setCustomColorToPurge] = useState("");

  // Quick Stock Out to Reception Modal from Color Cards
  const [isStockOutModalForColorOpen, setIsStockOutModalForColorOpen] = useState(false);
  const [colorStockOutAmount, setColorStockOutAmount] = useState(10);
  const [handoverCategoryFilter, setHandoverCategoryFilter] = useState<string>("all");
  const [isSubmittingColorStockOut, setIsSubmittingColorStockOut] = useState(false);
  const [stockOutPreview, setStockOutPreview] = useState<{
    isLoading: boolean;
    startCode?: string;
    endCode?: string;
    count: number;
    totalAvailable: number;
    bandCodes?: string[];
    invalidCodes?: string[];
  }>({ isLoading: false, count: 0, totalAvailable: 0 });

  // Handover Allotment Mode: 'auto' | 'series' | 'random'
  const [handoverMode, setHandoverMode] = useState<"auto" | "series" | "random">("auto");
  const [manualSeriesStart, setManualSeriesStart] = useState("");
  const [manualSeriesEnd, setManualSeriesEnd] = useState("");
  const [manualBarcodeScan, setManualBarcodeScan] = useState("");
  const [manualCodesList, setManualCodesList] = useState<string[]>([]);
  const [isManualBatchOpen, setIsManualBatchOpen] = useState(false);
  const [manualBatchText, setManualBatchText] = useState("");

  // Live query preview of wristbands to be stocked out
  useEffect(() => {
    if (!isStockOutModalForColorOpen || !selectedColorForAction) {
      setStockOutPreview({ isLoading: false, count: 0, totalAvailable: 0 });
      return;
    }

    let isMounted = true;
    setStockOutPreview(prev => ({ ...prev, isLoading: true }));

    const timer = setTimeout(async () => {
      try {
        const previewParams: any = {
          color_name: selectedColorForAction.color_name,
          color_hex: selectedColorForAction.color_hex,
          category: handoverCategoryFilter === "all" ? undefined : handoverCategoryFilter,
        };

        if (handoverMode === "auto") {
          previewParams.amount = colorStockOutAmount;
        } else if (handoverMode === "series") {
          previewParams.start_code = manualSeriesStart.trim() ? manualSeriesStart.trim().toUpperCase() : undefined;
          previewParams.end_code = manualSeriesEnd.trim() ? manualSeriesEnd.trim().toUpperCase() : undefined;
          previewParams.amount = 0; // Don't limit to let backend fetch entire series range
        } else if (handoverMode === "random") {
          previewParams.specific_codes = manualCodesList;
          previewParams.amount = manualCodesList.length;
        }

        const res = await previewHandoverRangeAction(previewParams);

        if (isMounted) {
          if (res.success) {
            setStockOutPreview({
              isLoading: false,
              startCode: res.startCode,
              endCode: res.endCode,
              count: res.count,
              totalAvailable: res.totalAvailable,
              bandCodes: res.bandCodes,
              invalidCodes: res.invalidCodes
            });
          } else {
            setStockOutPreview({
              isLoading: false,
              count: 0,
              totalAvailable: 0
            });
          }
        }
      } catch {
        if (isMounted) {
          setStockOutPreview({
            isLoading: false,
            count: 0,
            totalAvailable: 0
          });
        }
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    isStockOutModalForColorOpen, 
    selectedColorForAction, 
    colorStockOutAmount, 
    handoverCategoryFilter,
    handoverMode,
    manualSeriesStart,
    manualSeriesEnd,
    manualCodesList
  ]);

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

  // Support direct linking via ?tab=coupon_bands
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam === "coupon_bands" || 
        tabParam === "master" || 
        tabParam === "movements" || 
        tabParam === "reports" || 
        tabParam === "summary"
      ) {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  const handleTabSwitch = (tab: "summary" | "coupon_bands" | "master" | "movements" | "reports") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const canManageStock = hasUserPermission(sessionUser, "bands:manage_stock");
  const canAssignBands = hasUserPermission(sessionUser, "bands:assign");

  // Load all initial data
  const loadData = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const itemsLimit = pageSize === -1 ? 50000 : pageSize;
      const itemsOffset = pageSize === -1 ? 0 : Math.max(0, (currentPage - 1) * pageSize);

      const [summaryRes, itemsRes, txRes, subcatRes, couponBandRes, timeSlotsRes] = await Promise.all([
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
        getSubcategoryBandsAction(),
        fetchCouponBandInventoryAction(),
        fetchTimeSlotsAction().catch(() => []),
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
      if (subcatRes.success && subcatRes.data) {
        setConfiguredSubcategories(subcatRes.data);
      }
      if (couponBandRes.success && couponBandRes.data) {
        setCouponInventory(couponBandRes.data);
      }
      if (Array.isArray(timeSlotsRes)) {
        setTimeSlots(timeSlotsRes);
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

  // Arrange colors chronologically by time slot and isolate subcategories
  const { generalSlotColors, subcategoryColors } = useMemo(() => {
    const rawBreakdown = summary?.colorBreakdown || [];

    const subcatConfigByHex = new Map<string, SubcategoryBandItem>();
    const subcatConfigByName = new Map<string, SubcategoryBandItem>();
    for (const sub of configuredSubcategories) {
      if (sub.color_hex) subcatConfigByHex.set(sub.color_hex.trim().toUpperCase(), sub);
      if (sub.color_name) subcatConfigByName.set(sub.color_name.trim().toUpperCase(), sub);
    }

    const slotColorByHex = new Map<string, { color_name?: string }>();
    for (const ts of timeSlots) {
      if (ts.color) {
        slotColorByHex.set(ts.color.trim().toUpperCase(), { color_name: ts.color_name || undefined });
      }
    }

    const findMatchedSubcat = (hex?: string, name?: string): SubcategoryBandItem | undefined => {
      const hUpper = (hex || "").trim().toUpperCase();
      const nUpper = (name || "").trim().toUpperCase();
      if (hUpper && subcatConfigByHex.has(hUpper)) return subcatConfigByHex.get(hUpper);
      if (nUpper && subcatConfigByName.has(nUpper)) return subcatConfigByName.get(nUpper);

      // Fuzzy matching: handles "Pink" matching "VISITOR PINK", "Crystal Blue" matching "CRYSTAL BLUE EXCAVATOR"
      return configuredSubcategories.find(sc => {
        const scHex = (sc.color_hex || "").trim().toUpperCase();
        const scName = (sc.color_name || "").trim().toUpperCase();
        if (scHex && hUpper && scHex === hUpper) return true;
        if (scName && nUpper && (scName.includes(nUpper) || nUpper.includes(scName))) return true;
        const cleanSc = scName.replace(/[^A-Z0-9]/g, '');
        const cleanN = nUpper.replace(/[^A-Z0-9]/g, '');
        if (cleanSc && cleanN && (cleanSc.includes(cleanN) || cleanN.includes(cleanSc))) return true;
        return false;
      });
    };

    const isSubcategory = (c: BandColorBreakdown, matched?: SubcategoryBandItem) => {
      if (matched) return true;
      const nameUpper = (c.color_name || "").toUpperCase();
      const hexUpper = (c.color_hex || "").toUpperCase();
      const inConfigured = subcatConfigByHex.has(hexUpper) || subcatConfigByName.has(nameUpper);
      const hasSpecialKeyword = 
        nameUpper.includes("VIP") || 
        nameUpper.includes("VISITOR") || 
        nameUpper.includes("STAFF") || 
        nameUpper.includes("MARSHAL") || 
        nameUpper.includes("CHILD") ||
        nameUpper.includes("SPECIAL");
      return inConfigured || hasSpecialKeyword;
    };

    const general: (BandColorBreakdown & { slotInfo: ReturnType<typeof getSlotInfoForColor>; matchedConfig?: SubcategoryBandItem })[] = [];
    const subcats: (BandColorBreakdown & { slotInfo: ReturnType<typeof getSlotInfoForColor>; matchedConfig?: SubcategoryBandItem })[] = [];

    for (const c of rawBreakdown) {
      const hexUpper = (c.color_hex || "").trim().toUpperCase();
      const matchedConfig = findMatchedSubcat(c.color_hex, c.color_name);
      const matchedSlot = slotColorByHex.get(hexUpper);

      const resolvedColorName = matchedConfig?.color_name || matchedSlot?.color_name || c.color_name;
      const resolvedColorHex = matchedConfig?.color_hex || c.color_hex;

      const enrichedColor = {
        ...c,
        color_name: resolvedColorName,
        color_hex: resolvedColorHex,
        slotInfo: getSlotInfoForColor(resolvedColorHex, resolvedColorName, timeSlots),
        matchedConfig
      };

      if (isSubcategory(c, matchedConfig)) {
        // Strict deduplication: check if already exists by matched subcategory id, hex, or resolved name
        const existingIdx = subcats.findIndex(
          s => (matchedConfig && s.matchedConfig && s.matchedConfig.id === matchedConfig.id) ||
               (s.color_hex && s.color_hex.trim().toUpperCase() === resolvedColorHex) ||
               (s.color_name && s.color_name.trim().toUpperCase() === resolvedColorName.trim().toUpperCase())
        );

        if (existingIdx >= 0) {
          const target = subcats[existingIdx];
          // If the new item has real issued bands (from band_items), prioritize its physical inventory
          if (enrichedColor.issued > 0 || (enrichedColor.total > 0 && target.issued === 0)) {
            subcats[existingIdx] = {
              ...enrichedColor,
              color_inventory_id: target.color_inventory_id || enrichedColor.color_inventory_id,
              subcategories: enrichedColor.subcategories || target.subcategories,
              matchedConfig: matchedConfig || target.matchedConfig,
            };
          } else {
            // Keep target, but link color_inventory_id if missing
            if (!target.color_inventory_id && enrichedColor.color_inventory_id) {
              target.color_inventory_id = enrichedColor.color_inventory_id;
            }
          }
        } else {
          subcats.push(enrichedColor);
        }
      } else {
        // Deduplicate general slot colors
        const existingGenIdx = general.findIndex(
          g => (g.color_hex && g.color_hex.trim().toUpperCase() === resolvedColorHex) ||
               (g.color_name && g.color_name.trim().toUpperCase() === resolvedColorName.trim().toUpperCase())
        );

        if (existingGenIdx >= 0) {
          const target = general[existingGenIdx];
          if (enrichedColor.issued > 0 || (enrichedColor.total > 0 && target.issued === 0)) {
            general[existingGenIdx] = {
              ...enrichedColor,
              color_inventory_id: target.color_inventory_id || enrichedColor.color_inventory_id,
            };
          }
        } else {
          general.push(enrichedColor);
        }
      }
    }

    // Ensure every configured subcategory appears even if 0 bands exist
    for (const sc of configuredSubcategories) {
      const scHex = (sc.color_hex || "").trim().toUpperCase();
      const scName = (sc.color_name || "").trim().toUpperCase();
      const exists = subcats.some(
        s => (s.matchedConfig && s.matchedConfig.id === sc.id) ||
             (s.color_hex && s.color_hex.trim().toUpperCase() === scHex) ||
             (s.color_name && s.color_name.trim().toUpperCase() === scName)
      );

      if (!exists) {
        subcats.push({
          color_name: sc.color_name,
          color_hex: sc.color_hex,
          total: (sc.warehouse_stock || 0) + (sc.reception_stock || 0),
          available: sc.warehouse_stock || 0,
          issued: 0,
          damaged: 0,
          lost: 0,
          retired: 0,
          in_reception: sc.reception_stock || 0,
          slotInfo: getSlotInfoForColor(sc.color_hex, sc.color_name, timeSlots),
          matchedConfig: sc
        });
      }
    }

    // Sort general slot colors chronologically by track time slot (11-12, 12-1, 1-2, etc.)
    general.sort((a, b) => {
      const orderA = a.slotInfo?.startHour ?? (a.slotInfo?.sortOrder ?? 999);
      const orderB = b.slotInfo?.startHour ?? (b.slotInfo?.sortOrder ?? 999);
      if (orderA !== orderB) return orderA - orderB;
      return a.color_name.localeCompare(b.color_name);
    });

    // Sort subcategories alphabetically
    subcats.sort((a, b) => a.color_name.localeCompare(b.color_name));

    return { generalSlotColors: general, subcategoryColors: subcats };
  }, [summary?.colorBreakdown, configuredSubcategories, timeSlots]);

  // Dynamic list of all band colors from database items, configured subcategories, and palette
  const availableFilterColors = useMemo(() => {
    const colorSet = new Set<string>();
    (summary?.colorBreakdown || []).forEach(c => {
      if (c.color_name && c.color_name.trim()) colorSet.add(c.color_name.trim());
    });
    configuredSubcategories.forEach(sc => {
      if (sc.color_name && sc.color_name.trim()) colorSet.add(sc.color_name.trim());
    });
    timeSlots.forEach(ts => {
      if (ts.color_name && ts.color_name.trim()) colorSet.add(ts.color_name.trim());
    });
    WRISTBAND_PALETTE.forEach(p => colorSet.add(p.name));
    return Array.from(colorSet).sort((a, b) => a.localeCompare(b));
  }, [summary?.colorBreakdown, configuredSubcategories, timeSlots]);

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
    setStockInError(null);
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
          setStockInError(null);
          setIsStockInModalOpen(false);
          loadData();
        } else {
          const errMsg = res.error || "Failed to generate bands.";
          setStockInError(errMsg);
          setFeedback({ type: "error", message: errMsg });
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
          setStockInError(null);
          setIsStockInModalOpen(false);
          setNewBandCode("");
          loadData();
        } else {
          const errMsg = res.error || "Failed to create band.";
          setStockInError(errMsg);
          setFeedback({ type: "error", message: errMsg });
        }
      }
    } catch (err: any) {
      const errMsg = err.message || "An error occurred.";
      setStockInError(errMsg);
      setFeedback({ type: "error", message: errMsg });
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

  const handleColorCardPress = (color: BandColorBreakdown & { matchedConfig?: SubcategoryBandItem }) => {
    setSelectedColorForAction(color);
    setIsRenamingColor(false);
    setRenameFormColorName(color.color_name || "");
    setRenameFormCategory(color.matchedConfig?.category_name || (color.subcategories?.[0]?.category) || "Standard");
    setIsColorManageModalOpen(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColorForAction) return;
    if (!renameFormColorName.trim()) {
      setFeedback({ type: "error", message: "Please provide a valid colour name." });
      return;
    }

    setIsSubmittingRename(true);
    try {
      const res = await renameWristbandColorAction({
        oldColorName: selectedColorForAction.color_name,
        newColorName: renameFormColorName.trim(),
        colorHex: selectedColorForAction.color_hex,
        categoryName: renameFormCategory.trim() || undefined
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Successfully renamed "${selectedColorForAction.color_name}" to "${renameFormColorName.trim()}" across all inventory!`
        });
        setIsRenamingColor(false);
        setIsColorManageModalOpen(false);
        await loadData(true);
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to rename wristband." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to rename wristband." });
    } finally {
      setIsSubmittingRename(false);
    }
  };

  const handleExecutePurge = async () => {
    if (!purgeTargetColor) return;
    setIsSubmittingPurge(true);
    try {
      const res = await purgeOrResetColorStockAction({
        colorHex: purgeTargetColor.color_hex,
        colorName: purgeTargetColor.color_name,
        colorInventoryId: purgeTargetColor.color_inventory_id,
        subcategoryId: (purgeTargetColor as any).matchedConfig?.id,
        actionType: purgeActionType,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || "Successfully purged / reset stock!",
        });
        setIsPurgeModalOpen(false);
        setPurgeTargetColor(null);
        setIsColorManageModalOpen(false);
        await loadData(true);
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to execute stock purge." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to purge stock." });
    } finally {
      setIsSubmittingPurge(false);
    }
  };

  const handleQuickStockOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColorForAction || !selectedColorForAction.color_inventory_id) {
      setFeedback({ type: "error", message: "Color inventory record ID not found. Please sync from slots first." });
      return;
    }

    let finalAmount = colorStockOutAmount;
    let start_code: string | undefined = undefined;
    let end_code: string | undefined = undefined;
    let specific_codes: string[] | undefined = undefined;

    if (handoverMode === "auto") {
      if (colorStockOutAmount <= 0) {
        setFeedback({ type: "error", message: "Please specify a positive quantity to stock out." });
        return;
      }
      finalAmount = colorStockOutAmount;
    } else if (handoverMode === "series") {
      if (!manualSeriesStart.trim()) {
        setFeedback({ type: "error", message: "Please enter a Start Code for the manual series." });
        return;
      }
      start_code = manualSeriesStart.trim().toUpperCase();
      end_code = manualSeriesEnd.trim() ? manualSeriesEnd.trim().toUpperCase() : undefined;
      finalAmount = stockOutPreview.count;
      if (finalAmount <= 0) {
        setFeedback({ type: "error", message: "No warehouse wristbands found matching this series range." });
        return;
      }
    } else if (handoverMode === "random") {
      if (manualCodesList.length === 0) {
        setFeedback({ type: "error", message: "Please add or scan at least one wristband barcode." });
        return;
      }
      const validCodes = stockOutPreview.bandCodes && stockOutPreview.bandCodes.length > 0
        ? stockOutPreview.bandCodes
        : manualCodesList;
      if (validCodes.length === 0) {
        setFeedback({ type: "error", message: "None of the entered codes exist in warehouse stock for this color." });
        return;
      }
      specific_codes = validCodes;
      finalAmount = validCodes.length;
    }

    setIsSubmittingColorStockOut(true);
    try {
      const notes = handoverMode === "auto"
        ? `Auto Handover of ${finalAmount} ${selectedColorForAction.color_name} bands to Reception`
        : handoverMode === "series"
        ? `Manual Series Handover of ${finalAmount} ${selectedColorForAction.color_name} bands (${start_code}${end_code ? ` to ${end_code}` : ""}) to Reception`
        : `Random Handover of ${finalAmount} specific ${selectedColorForAction.color_name} bands to Reception`;

      if (handoverCategoryFilter !== "all" || handoverMode !== "auto") {
        const res = await handoverWristbandsAction({
          color_name: selectedColorForAction.color_name,
          color_hex: selectedColorForAction.color_hex,
          category: handoverCategoryFilter === "all" ? undefined : handoverCategoryFilter,
          amount: finalAmount,
          start_code,
          end_code,
          specific_codes,
          notes
        });
        if (res.success && res.movedCount > 0) {
          const rangeText = res.startCode && res.endCode
            ? ` (Wristbands: ${res.startCode}${res.startCode !== res.endCode ? ` to ${res.endCode}` : ''})`
            : '';
          const catText = handoverCategoryFilter !== "all" ? ` - ${handoverCategoryFilter}` : "";
          setFeedback({
            type: "success",
            message: `Handover Recorded: ${res.movedCount} '${selectedColorForAction.color_name}${catText}' bands transferred to Reception Desk!${rangeText}`
          });
          setIsStockOutModalForColorOpen(false);
          setColorStockOutAmount(10);
          setManualSeriesStart("");
          setManualSeriesEnd("");
          setManualCodesList([]);
          setManualBarcodeScan("");
          setIsManualBatchOpen(false);
          setManualBatchText("");
          await loadData();
          return;
        } else {
          setFeedback({ type: "error", message: res.error || "Failed to handover bands." });
          return;
        }
      }

      const res = await stockOutColorToReceptionAction({
        id: selectedColorForAction.color_inventory_id,
        amount: finalAmount,
        start_code,
        end_code,
        specific_codes,
        notes
      });
      if (res.success) {
        const rangeText = res.startCode && res.endCode
          ? ` (Wristbands: ${res.startCode}${res.startCode !== res.endCode ? ` to ${res.endCode}` : ''})`
          : '';
        setFeedback({
          type: "success",
          message: `Stock Out Recorded: ${finalAmount} '${selectedColorForAction.color_name}' bands handed over to Reception!${rangeText} (Reception Total: ${res.item?.in_reception ?? (selectedColorForAction.in_reception || 0) + finalAmount})`
        });
        setIsStockOutModalForColorOpen(false);
        setColorStockOutAmount(10);
        setManualSeriesStart("");
        setManualSeriesEnd("");
        setManualCodesList([]);
        setManualBarcodeScan("");
        setIsManualBatchOpen(false);
        setManualBatchText("");
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

  // Memoized Filtering for Coupon Bands
  const filteredCouponItems = useMemo(() => {
    if (!couponInventory?.items) return [];
    const today = new Date().toISOString().split("T")[0];
    return couponInventory.items.filter((item) => {
      // Search query filter
      if (couponSearch.trim()) {
        const q = couponSearch.toLowerCase().trim();
        const matchCode = item.code.toLowerCase().includes(q);
        const matchCategory = (item.band_category || "").toLowerCase().includes(q);
        const matchCustomer = (item.redeemed_by || item.booking_customer || "").toLowerCase().includes(q);
        const matchBooking = item.redeemed_booking_id?.toString().includes(q);
        if (!matchCode && !matchCategory && !matchCustomer && !matchBooking) return false;
      }

      // Status filter
      if (couponStatusFilter === "warehouse") {
        if (item.location !== "warehouse" || item.used_count > 0) return false;
      } else if (couponStatusFilter === "reception") {
        if (item.location !== "reception" || item.used_count > 0) return false;
      } else if (couponStatusFilter === "redeemed") {
        if (item.used_count === 0) return false;
      } else if (couponStatusFilter === "expired") {
        if (!item.expiry_date || item.expiry_date >= today || item.used_count > 0) return false;
      }

      // Offer category filter
      if (couponOfferFilter !== "all") {
        if (item.band_category !== couponOfferFilter) return false;
      }

      return true;
    });
  }, [couponInventory, couponSearch, couponStatusFilter, couponOfferFilter]);

  const totalCouponPages = useMemo(() => {
    if (couponPageSize === -1) return 1;
    return Math.max(1, Math.ceil(filteredCouponItems.length / couponPageSize));
  }, [filteredCouponItems.length, couponPageSize]);

  const paginatedCouponItems = useMemo(() => {
    if (couponPageSize === -1) return filteredCouponItems;
    const start = (Math.min(couponPage, totalCouponPages) - 1) * couponPageSize;
    return filteredCouponItems.slice(start, start + couponPageSize);
  }, [filteredCouponItems, couponPage, couponPageSize, totalCouponPages]);

  // Handlers for Coupon Bands Inventory
  const handleOpenCouponHandoverModal = (params?: {
    category?: string;
    color?: string;
    name?: string;
    defaultDirection?: "to_reception" | "to_warehouse";
    defaultAmount?: number;
  }) => {
    setHandoverOfferCategory(params?.category || couponInventory?.breakdown[0]?.band_category || "");
    setHandoverOfferColor(params?.color || couponInventory?.breakdown[0]?.band_color || "");
    setHandoverOfferName(params?.name || params?.category || "Promotional Band");
    setHandoverDirection(params?.defaultDirection || "to_reception");
    setHandoverAmount(params?.defaultAmount || 10);
    setIsCouponHandoverModalOpen(true);
  };

  const handleCouponOfferHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverOfferCategory) return;
    setIsSubmittingCouponHandover(true);
    try {
      const targetLoc = handoverDirection === "to_reception" ? "reception" : "warehouse";
      const res = await handoverCouponBandsAction({
        band_category: handoverOfferCategory,
        band_color: handoverOfferColor || undefined,
        amount: Number(handoverAmount),
        targetLocation: targetLoc,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || `Successfully transferred ${res.count} coupon bands!`
        });
        setIsCouponHandoverModalOpen(false);
        await loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to handover coupon bands." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred." });
    } finally {
      setIsSubmittingCouponHandover(false);
    }
  };

  const handleBulkCouponLocationUpdate = async (targetLocation: "reception" | "warehouse") => {
    if (selectedCouponIds.length === 0) return;
    setIsSubmittingCouponHandover(true);
    try {
      const res = await handoverCouponBandsAction({
        ids: selectedCouponIds,
        targetLocation,
      });
      if (res.success) {
        setFeedback({
          type: "success",
          message: `Successfully transferred ${res.count} selected coupon bands to ${targetLocation === "reception" ? "Reception Desk" : "Warehouse Storage"}!`
        });
        setSelectedCouponIds([]);
        await loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to update locations" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred." });
    } finally {
      setIsSubmittingCouponHandover(false);
    }
  };

  const handleSingleCouponLocationToggle = async (item: CouponBandInventoryItem) => {
    const nextLoc = item.location === "reception" ? "warehouse" : "reception";
    try {
      const res = await handoverCouponBandsAction({
        ids: [item.id],
        targetLocation: nextLoc,
      });
      if (res.success) {
        setFeedback({
          type: "success",
          message: `Moved coupon band ${item.code} to ${nextLoc === "reception" ? "Reception Desk" : "Warehouse Storage"}`
        });
        await loadData();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to toggle location" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred." });
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
                type="button"
                onClick={() => setIsCleanInventoryModalOpen(true)}
                className="bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Review, reset extra stock numbers, and purge duplicate or unwanted color inventory"
              >
                <Trash2 className="w-4 h-4 text-amber-300" />
                <span>🧹 Clean Extra Stock</span>
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
          onClick={() => handleTabSwitch("summary")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "summary"
              ? "bg-[#0d1b2a] text-white shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Stock Summary &amp; Overview</span>
        </button>

        {/* Dedicated Coupon Bands Tab Button */}
        <button
          onClick={() => handleTabSwitch("coupon_bands")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "coupon_bands"
              ? "bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white shadow-md shadow-purple-500/25 ring-2 ring-purple-400"
              : "text-purple-700 hover:text-purple-900 hover:bg-purple-50 border border-purple-200/80 bg-purple-50/40"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span>⭐ Coupon Bands ({couponInventory?.summary?.total || 0})</span>
          {Boolean(couponInventory?.summary?.reception) && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-emerald-500 text-white font-black tracking-wider uppercase">
              {couponInventory?.summary?.reception} at Desk
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabSwitch("master")}
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
          onClick={() => handleTabSwitch("movements")}
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
          onClick={() => handleTabSwitch("reports")}
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

          {/* Dedicated Coupon & VIP Promotional Bands Overview Banner */}
          <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-purple-800/60 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                    Dedicated Inventory
                  </span>
                  <span className="text-purple-200 text-xs">Completely Segregated from 15-min Slot Colors</span>
                </div>
                <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                  <span>⭐ Promotional &amp; Coupon Bands Inventory</span>
                </h3>
                <p className="text-purple-200/80 text-xs mt-1 max-w-xl leading-relaxed">
                  Dedicated serial tracking for VIP promotional coupon wristbands (Pink 100%, Green 50%, etc.). Track physical inventory between warehouse reserve, reception desk distribution, and booking redemptions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="grid grid-cols-4 gap-2 bg-black/40 backdrop-blur-sm p-2 rounded-xl border border-white/10 text-center">
                  <div className="px-3 py-1">
                    <div className="text-[10px] uppercase font-bold text-gray-400">Total</div>
                    <div className="text-lg font-black font-mono text-white">{couponInventory?.summary?.total || 0}</div>
                  </div>
                  <div className="px-3 py-1 border-l border-white/10">
                    <div className="text-[10px] uppercase font-bold text-blue-300">Warehouse</div>
                    <div className="text-lg font-black font-mono text-blue-300">{couponInventory?.summary?.warehouse || 0}</div>
                  </div>
                  <div className="px-3 py-1 border-l border-white/10">
                    <div className="text-[10px] uppercase font-bold text-emerald-300">Reception</div>
                    <div className="text-lg font-black font-mono text-emerald-300">{couponInventory?.summary?.reception || 0}</div>
                  </div>
                  <div className="px-3 py-1 border-l border-white/10">
                    <div className="text-[10px] uppercase font-bold text-purple-300">Redeemed</div>
                    <div className="text-lg font-black font-mono text-purple-300">{couponInventory?.summary?.redeemed || 0}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTabSwitch("coupon_bands")}
                  className="bg-amber-400 hover:bg-amber-300 text-gray-950 font-black px-4 py-3 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-400/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Open Coupon Bands Tab</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Color Breakdown Section: Ordered by Time Slot + Subcategories Separated */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#ff5a1f]" />
                  <span>Time-Slot Wristband Availability &amp; Stock Levels</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Chronologically arranged according to daily track rotation slots (11:00 AM - 12:00 PM, 12:00 PM - 01:00 PM, etc.).
                </p>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
                {canManageStock && (
                  <>
                    <button
                      type="button"
                      onClick={handleSyncSlots}
                      disabled={isSyncingSlots || isRefreshing}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
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
                      className="text-xs font-bold text-[#ff5a1f] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>+ Batch Generate Bands</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Low Stock Reorder Notification Banner */}
            {generalSlotColors.some(c => c.total > 0 && c.available <= 250) && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-red-900 font-semibold">
                    <strong>Low Stock Alert:</strong> {generalSlotColors.filter(c => c.total > 0 && c.available <= 250).length} time slot color(s) have dropped to <strong>250 or below</strong> in stock. Please reorder stock soon.
                  </span>
                </div>
                <span className="self-start sm:self-auto px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-bold border border-red-300 text-[11px] font-mono shrink-0">
                  ⚠️ Reorder Alert: ≤250 Left
                </span>
              </div>
            )}

            {/* General Track Slot Wristbands Grid (Arranged chronologically by time slot) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generalSlotColors.map((color) => {
                const badgeStyle = getWristbandBadgeStyle(color.color_hex);
                const isLowStock = color.total > 0 && color.available <= 250;
                return (
                  <div
                    key={color.color_name}
                    onClick={() => handleColorCardPress(color)}
                    role="button"
                    tabIndex={0}
                    className={`p-4 rounded-xl border ${
                      isLowStock 
                        ? "border-red-300 bg-red-50/20 shadow-red-100/40" 
                        : "border-gray-200 bg-white"
                    } hover:border-[#ff5a1f] hover:shadow-md transition-all shadow-sm flex flex-col justify-between cursor-pointer group relative overflow-hidden`}
                  >
                    <div 
                      className={`absolute top-0 right-0 left-0 h-1 ${
                        isLowStock 
                          ? "bg-gradient-to-r from-red-500 via-rose-500 to-red-500" 
                          : "bg-gradient-to-r from-transparent via-[#ff5a1f]/0 to-transparent group-hover:via-[#ff5a1f]"
                      } transition-all`} 
                    />

                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full border shadow-xs shrink-0"
                            style={{ backgroundColor: color.color_hex }}
                          />
                          <span className="font-bold text-sm text-gray-900 group-hover:text-[#ff5a1f] transition-colors">
                            {color.color_name}
                          </span>
                          {/* Time Slot Badge Beside Color */}
                          {color.slotInfo?.formattedSlot && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs">
                              <Clock className="w-3 h-3 text-blue-600" />
                              <span>{color.slotInfo.formattedSlot}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700 border border-red-300 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              <span>REORDER</span>
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                              color.total === 0 ? "bg-gray-50 text-gray-500 border-dashed border-gray-300" : ""
                            }`}
                            style={color.total > 0 ? badgeStyle : undefined}
                          >
                            {color.total > 0 ? `${color.total} Total` : "No Stock Yet"}
                          </span>
                        </div>
                      </div>

                      {/* Stock Bar */}
                      {color.total > 0 ? (
                        <div className={`w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex my-2 ${isLowStock ? "ring-1 ring-red-400/50" : ""}`}>
                          <div
                            className={`h-full transition-all duration-300 ${
                              isLowStock 
                                ? "bg-red-500 shadow-sm shadow-red-500/50 animate-pulse" 
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${(color.available / color.total) * 100}%` }}
                            title={`In Stock: ${color.available}${isLowStock ? " (LOW STOCK - REORDER)" : ""}`}
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
                        <div className="w-full bg-gray-100/80 border border-dashed border-gray-200 h-2.5 rounded-full my-2" title="No bands in inventory yet" />
                      )}

                      {/* Low Stock Alert Message to Reorder */}
                      {isLowStock && (
                        <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 mb-2 rounded-lg bg-red-50 border border-red-200/90 text-red-800 text-[11px] font-bold animate-pulse">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span className="truncate">
                              {color.available === 0 ? "Out of Stock!" : `Low Stock: Only ${color.available} Left`}
                            </span>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-700 bg-red-100 border border-red-300 px-1.5 py-0.5 rounded shrink-0">
                            ⚠️ Reorder Now
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-gray-100 text-center">
                      <div>
                        <span className={`block text-[10px] uppercase font-bold ${isLowStock ? "text-red-500 font-extrabold" : "text-gray-400"}`}>
                          In Stock
                        </span>
                        <span className={`font-mono font-bold text-xs ${
                          isLowStock 
                            ? "text-red-600 font-black animate-pulse" 
                            : color.available > 0 
                            ? "text-emerald-700" 
                            : "text-gray-400"
                        }`}>
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

                    {/* Subcategories Breakdown if any exist */}
                    {color.subcategories && color.subcategories.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-wrap gap-1">
                        {color.subcategories.map((sub) => {
                          return (
                            <span
                              key={sub.category}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-gray-50 border-gray-200 text-gray-700"
                              title={`${sub.category}: ${sub.available} in warehouse, ${sub.in_reception} in reception, ${sub.issued} issued`}
                            >
                              <span>🎫 {sub.category}:</span>
                              <strong className="font-mono text-gray-900">{sub.available} avail</strong>
                              {sub.in_reception > 0 && (
                                <span className="font-mono text-amber-800 font-bold">({sub.in_reception} rec)</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}

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

            {/* Sub-Category Bands Section (Kept completely separate from general slot colors) */}
            {subcategoryColors.length > 0 && (
              <div className="mt-8 pt-6 border-t-2 border-purple-100 bg-gradient-to-b from-purple-50/40 via-purple-50/15 to-transparent -mx-6 -mb-6 p-6 rounded-b-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Sub-Category &amp; Special Universal Wristbands</span>
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                        {subcategoryColors.length} special types
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Promotional, VIP, Visitor, and Staff passes kept separate from the hourly track slot rotation colors.
                    </p>
                  </div>
                </div>

                {/* Low Stock Reorder Banner for Sub-Categories */}
                {subcategoryColors.some(c => c.total > 0 && c.available <= 250) && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span className="text-red-900 font-semibold">
                        <strong>Low Stock Alert:</strong> {subcategoryColors.filter(c => c.total > 0 && c.available <= 250).length} sub-category pass(es) have dropped to <strong>250 or below</strong> in stock. Please reorder stock soon.
                      </span>
                    </div>
                    <span className="self-start sm:self-auto px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-bold border border-red-300 text-[11px] font-mono shrink-0">
                      ⚠️ Reorder Alert: ≤250 Left
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subcategoryColors.map((color) => {
                    const badgeStyle = getWristbandBadgeStyle(color.color_hex);
                    const isSubLowStock = color.total > 0 && color.available <= 250;
                    return (
                      <div
                        key={color.color_name}
                        onClick={() => handleColorCardPress(color)}
                        role="button"
                        tabIndex={0}
                        className={`p-4 rounded-xl border ${
                          isSubLowStock 
                            ? "border-red-300 bg-red-50/20 shadow-red-100/40" 
                            : "border-purple-200 bg-white"
                        } hover:border-purple-400 hover:shadow-md transition-all shadow-xs flex flex-col justify-between cursor-pointer group relative overflow-hidden`}
                      >
                        <div 
                          className={`absolute top-0 right-0 left-0 h-1 ${
                            isSubLowStock 
                              ? "bg-gradient-to-r from-red-500 via-rose-500 to-red-500" 
                              : "bg-gradient-to-r from-transparent via-purple-500/0 to-transparent group-hover:via-purple-500"
                          } transition-all`} 
                        />

                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full border shadow-xs shrink-0"
                                style={{ backgroundColor: color.color_hex }}
                              />
                              <span className="font-bold text-sm text-gray-900 group-hover:text-purple-700 transition-colors">
                                {color.color_name}
                              </span>
                              {(() => {
                                const cat = (color as any).matchedConfig?.category_name || (color.subcategories?.[0]?.category) || "Sub-Category Pass";
                                const catUpper = cat.toUpperCase();
                                const badgeClass = catUpper.includes("VIP")
                                  ? "bg-purple-100 text-purple-800 border-purple-200"
                                  : catUpper.includes("VISITOR")
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  : catUpper.includes("PARTICIPANT")
                                  ? "bg-blue-100 text-blue-800 border-blue-200"
                                  : catUpper.includes("ADDON")
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : "bg-slate-100 text-slate-800 border-slate-200";

                                return (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${badgeClass}`}>
                                    <Sparkles className="w-3 h-3" />
                                    <span>{cat}</span>
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSubLowStock && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-700 border border-red-300 animate-pulse">
                                  <AlertTriangle className="w-3 h-3 text-red-600" />
                                  <span>REORDER</span>
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                                  color.total === 0 ? "bg-gray-50 text-gray-500 border-dashed border-gray-300" : ""
                                }`}
                                style={color.total > 0 ? badgeStyle : undefined}
                              >
                                {color.total > 0 ? `${color.total} Total` : "No Stock Yet"}
                              </span>
                            </div>
                          </div>

                          {/* Stock Bar */}
                          {color.total > 0 ? (
                            <div className={`w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex my-2 ${isSubLowStock ? "ring-1 ring-red-400/50" : ""}`}>
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isSubLowStock 
                                    ? "bg-red-500 shadow-sm shadow-red-500/50 animate-pulse" 
                                    : "bg-emerald-500"
                                }`}
                                style={{ width: `${(color.available / color.total) * 100}%` }}
                                title={`Warehouse Stock: ${color.available}${isSubLowStock ? " (LOW STOCK - REORDER)" : ""}`}
                              />
                              <div
                                className="bg-amber-400 h-full transition-all duration-300"
                                style={{ width: `${((color.in_reception || 0) / color.total) * 100}%` }}
                                title={`At Reception: ${color.in_reception || 0}`}
                              />
                              <div
                                className="bg-blue-400 h-full transition-all duration-300"
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
                            <div className="w-full bg-gray-100/80 border border-dashed border-gray-200 h-2.5 rounded-full my-2" title="No bands in inventory yet" />
                          )}

                          {/* Low Stock Alert Message to Reorder */}
                          {isSubLowStock && (
                            <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 mb-2 rounded-lg bg-red-50 border border-red-200/90 text-red-800 text-[11px] font-bold animate-pulse">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span className="truncate">
                                  {color.available === 0 ? "Out of Stock!" : `Low Stock: Only ${color.available} Left`}
                                </span>
                              </div>
                              <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-700 bg-red-100 border border-red-300 px-1.5 py-0.5 rounded shrink-0">
                                ⚠️ Reorder Now
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-gray-100 text-center">
                          <div>
                            <span className={`block text-[10px] uppercase font-bold ${isSubLowStock ? "text-red-500 font-extrabold" : "text-gray-400"}`}>
                              Warehouse
                            </span>
                            <span className={`font-mono font-bold text-xs ${
                              isSubLowStock 
                                ? "text-red-600 font-black animate-pulse" 
                                : color.available > 0 
                                ? "text-emerald-700" 
                                : "text-gray-400"
                            }`}>
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

                        <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-400 group-hover:text-purple-600 font-medium transition-colors">
                          <span className="flex items-center gap-1 font-semibold">
                            {canManageStock ? (
                              <>
                                <Plus className="w-3 h-3 text-purple-600" />
                                {color.total > 0 ? "Manage & Add Series" : "Add Inventory Now"}
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3 text-purple-600" />
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
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: DEDICATED COUPON BANDS INVENTORY                                   */}
      {/* ========================================================================= */}
      {activeTab === "coupon_bands" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Header Card */}
          <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-lg border border-purple-800/60 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="absolute -top-10 -right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  VIP &amp; Promotional Wristbands
                </span>
                <span className="text-purple-300 text-xs">Separate physical stock pool</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-heading tracking-tight flex items-center gap-3">
                <span>Coupon Wristbands Inventory</span>
              </h2>
              <p className="text-purple-200/80 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                Physical serial number tracking for VIP promotional coupon bands. Completely segregated from regular 15-minute slot rotation colors, with warehouse-to-reception desk handover and booking redemption audit.
              </p>
            </div>

            <div className="relative z-10 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenCouponHandoverModal({ defaultDirection: "to_reception" })}
                className="bg-amber-400 hover:bg-amber-300 text-gray-950 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-amber-400/20 transition-all active:scale-[0.98]"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Handover to Desk</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenCouponHandoverModal({ defaultDirection: "to_warehouse" })}
                className="bg-purple-800/80 hover:bg-purple-800 text-purple-100 border border-purple-600/50 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all active:scale-[0.98]"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Return to Warehouse</span>
              </button>

              <Link
                href="/admin/coupons"
                className="bg-white/10 hover:bg-white/15 text-white border border-white/20 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all"
              >
                <Tag className="w-4 h-4" />
                <span>Coupons &amp; Offers</span>
              </Link>
            </div>
          </div>

          {/* 5 Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Total Coupon Bands */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                Total Coupon Bands
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-gray-900 font-mono">
                  {couponInventory?.summary?.total || 0}
                </span>
                <span className="text-xs text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-md">
                  {couponInventory?.summary?.distinctOffers || 0} Offers
                </span>
              </div>
              <div className="mt-2 text-[11px] text-gray-500">All registered promo bands</div>
            </div>

            {/* Warehouse Stock */}
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                In Warehouse
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-blue-700 font-mono">
                  {couponInventory?.summary?.warehouse || 0}
                </span>
                <span className="text-xs text-blue-800 font-semibold">Reserve Storage</span>
              </div>
              <div className="mt-2 text-[11px] text-blue-700">Available to stock desk</div>
            </div>

            {/* Reception Desk Active */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                At Reception Desk
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
                  {couponInventory?.summary?.reception || 0}
                </span>
                <span className="text-xs text-emerald-800 font-semibold">Ready to Issue</span>
              </div>
              <div className="mt-2 text-[11px] text-emerald-700">Currently in front desk box</div>
            </div>

            {/* Redeemed / Used */}
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-purple-600" />
                Redeemed on Bookings
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-purple-700 font-mono">
                  {couponInventory?.summary?.redeemed || 0}
                </span>
                <span className="text-xs text-purple-800 font-semibold">Tracked</span>
              </div>
              <div className="mt-2 text-[11px] text-purple-700">Linked to customer bookings</div>
            </div>

            {/* Expired Bands */}
            <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                Expired Bands
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-black text-red-700 font-mono">
                  {couponInventory?.summary?.expired || 0}
                </span>
                <span className="text-xs text-red-800 font-semibold">Past Validity</span>
              </div>
              <div className="mt-2 text-[11px] text-red-700">Past offer end date</div>
            </div>
          </div>

          {/* Offer Categories Breakdown Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>Promotional Band Offers &amp; Batch Balances</span>
              </h3>
              <span className="text-xs text-gray-500">
                {(couponInventory?.breakdown || []).length} Distinct Band Offers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(couponInventory?.breakdown || []).map((b) => (
                <div
                  key={`${b.band_category}-${b.band_color}-${b.value}`}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-purple-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Category & Discount Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-xs"
                          style={{ backgroundColor: b.band_color || "#FFD700" }}
                        />
                        <div>
                          <h4 className="font-extrabold text-sm text-gray-900 leading-snug">
                            {b.band_category}
                          </h4>
                          <span className="text-[11px] text-gray-500 font-medium">
                            {b.discount_type === "percentage" ? `${b.value}% Discount Offer` : `₹${b.value} Flat Off`}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 shrink-0">
                        {b.value}{b.discount_type === "percentage" ? "% OFF" : " ₹ OFF"}
                      </span>
                    </div>

                    {/* Stock Counts Matrix */}
                    <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100 text-center mb-3">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-400">Total</span>
                        <span className="font-mono font-black text-sm text-gray-900">{b.total}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-blue-600">Whouse</span>
                        <span className="font-mono font-black text-sm text-blue-700">{b.warehouse}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-emerald-600">Desk</span>
                        <span className="font-mono font-black text-sm text-emerald-700">{b.reception}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-purple-600">Redeemed</span>
                        <span className="font-mono font-black text-sm text-purple-700">{b.redeemed}</span>
                      </div>
                    </div>

                    {/* Sample Code Series */}
                    {b.sampleCodes.length > 0 && (
                      <div className="text-[11px] text-gray-500 mb-4 bg-purple-50/50 px-2.5 py-1.5 rounded-lg border border-purple-100 flex items-center justify-between">
                        <span className="font-semibold text-purple-900">Serials:</span>
                        <span className="font-mono text-purple-700 truncate max-w-[200px]" title={b.sampleCodes.join(", ")}>
                          {b.sampleCodes.slice(0, 3).join(", ")}{b.sampleCodes.length > 3 ? "..." : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions for this Offer */}
                  <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCouponHandoverModal({
                        category: b.band_category,
                        color: b.band_color,
                        name: `${b.band_category} (${b.value}${b.discount_type === "percentage" ? "%" : "₹"})`,
                        defaultDirection: "to_reception",
                        defaultAmount: Math.min(b.warehouse, 10) || 10,
                      })}
                      disabled={b.warehouse <= 0}
                      className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
                      <span>Send to Desk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCouponHandoverModal({
                        category: b.band_category,
                        color: b.band_color,
                        name: `${b.band_category} (${b.value}${b.discount_type === "percentage" ? "%" : "₹"})`,
                        defaultDirection: "to_warehouse",
                        defaultAmount: Math.min(b.reception, 10) || 10,
                      })}
                      disabled={b.reception <= 0}
                      className="bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1 transition-all disabled:opacity-40"
                      title="Return from desk to warehouse"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>To Whouse</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Master Table of Coupon Bands */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Table Filters Header */}
            <div className="p-4 sm:p-5 border-b border-gray-200 bg-gray-50/80 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={couponSearch}
                    onChange={(e) => {
                      setCouponSearch(e.target.value);
                      setCouponPage(1);
                    }}
                    placeholder="Search by Barcode / Serial (e.g. F003281), Category, Guest name..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-xs sm:text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={couponStatusFilter}
                  onChange={(e) => {
                    setCouponStatusFilter(e.target.value as any);
                    setCouponPage(1);
                  }}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  <option value="all">All Statuses ({couponInventory?.summary?.total || 0})</option>
                  <option value="warehouse">🏢 In Warehouse Reserve ({couponInventory?.summary?.warehouse || 0})</option>
                  <option value="reception">🛎️ At Reception Desk ({couponInventory?.summary?.reception || 0})</option>
                  <option value="redeemed">🎟️ Redeemed on Booking ({couponInventory?.summary?.redeemed || 0})</option>
                  <option value="expired">⌛ Expired ({couponInventory?.summary?.expired || 0})</option>
                </select>

                {/* Offer Category Filter */}
                <select
                  value={couponOfferFilter}
                  onChange={(e) => {
                    setCouponOfferFilter(e.target.value);
                    setCouponPage(1);
                  }}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  <option value="all">All Offers ({(couponInventory?.breakdown || []).length})</option>
                  {(couponInventory?.breakdown || []).map((b) => (
                    <option key={b.band_category} value={b.band_category}>
                      {b.band_category} ({b.total})
                    </option>
                  ))}
                </select>

                {/* Per Page */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white border border-gray-300 rounded-xl px-2.5 py-1">
                  <span className="text-gray-500 font-semibold text-xs whitespace-nowrap">Per Page:</span>
                  <select
                    value={couponPageSize}
                    onChange={(e) => {
                      setCouponPageSize(Number(e.target.value));
                      setCouponPage(1);
                    }}
                    className="bg-transparent text-gray-900 text-xs font-bold py-1 focus:outline-none cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={-1}>All ({filteredCouponItems.length})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bulk Selection Bar */}
            {selectedCouponIds.length > 0 && (
              <div className="bg-purple-50 border-y border-purple-200 px-4 py-2.5 flex items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>{selectedCouponIds.length} coupon wristbands selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkCouponLocationUpdate("reception")}
                    disabled={isSubmittingCouponHandover}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Move to Reception Desk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkCouponLocationUpdate("warehouse")}
                    disabled={isSubmittingCouponHandover}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Move to Warehouse</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCouponIds([])}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold text-xs transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={
                          paginatedCouponItems.length > 0 &&
                          paginatedCouponItems.every((item) => selectedCouponIds.includes(item.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newIds = Array.from(
                              new Set([...selectedCouponIds, ...paginatedCouponItems.map((item) => item.id)])
                            );
                            setSelectedCouponIds(newIds);
                          } else {
                            const pageIds = new Set(paginatedCouponItems.map((item) => item.id));
                            setSelectedCouponIds(selectedCouponIds.filter((id) => !pageIds.has(id)));
                          }
                        }}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="py-3.5 px-4">Band Serial / Barcode</th>
                    <th className="py-3.5 px-4">Promotional Offer</th>
                    <th className="py-3.5 px-4">Current Physical Location</th>
                    <th className="py-3.5 px-4">Lifecycle Status</th>
                    <th className="py-3.5 px-4">Redemption / Customer Audit</th>
                    <th className="py-3.5 px-4">Expiry</th>
                    <th className="py-3.5 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedCouponItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <span className="block font-medium">No coupon wristbands found matching your filter.</span>
                        <span className="text-xs text-gray-400 mt-1 block">
                          Configure promo bands in <Link href="/admin/coupons" className="text-purple-600 underline">Manage Coupons</Link>.
                        </span>
                      </td>
                    </tr>
                  ) : (
                    paginatedCouponItems.map((item) => {
                      const isRedeemed = item.used_count > 0;
                      const today = new Date().toISOString().split("T")[0];
                      const isExpired = item.expiry_date && item.expiry_date < today && !isRedeemed;
                      const isChecked = selectedCouponIds.includes(item.id);

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-purple-50/30 transition-colors ${
                            isChecked ? "bg-purple-50/50" : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCouponIds([...selectedCouponIds, item.id]);
                                } else {
                                  setSelectedCouponIds(selectedCouponIds.filter((id) => id !== item.id));
                                }
                              }}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                            />
                          </td>

                          {/* Serial / Barcode */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                                style={{ backgroundColor: item.band_color || "#FFD700" }}
                              />
                              <span className="font-mono font-black text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 tracking-wider">
                                {item.code}
                              </span>
                            </div>
                          </td>

                          {/* Promotional Offer */}
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-bold text-gray-900">{item.band_category || "VIP"}</div>
                              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800">
                                {item.discount_type === "percentage" ? `${item.value}% Discount` : `₹${item.value} Flat`}
                              </span>
                            </div>
                          </td>

                          {/* Location */}
                          <td className="py-3 px-4">
                            {item.location === "reception" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                🛎️ Reception Desk
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                <Package className="w-3.5 h-3.5 text-blue-600" />
                                🏢 Warehouse Reserve
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {isRedeemed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
                                <Receipt className="w-3 h-3 text-purple-600" />
                                Redeemed / Used
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                <AlertCircle className="w-3 h-3 text-red-600" />
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                <Check className="w-3 h-3 text-green-600" />
                                Available
                              </span>
                            )}
                          </td>

                          {/* Redemption details */}
                          <td className="py-3 px-4">
                            {isRedeemed ? (
                              <div>
                                <span className="font-semibold text-gray-900 block">
                                  {item.redeemed_by || item.booking_customer || "Online Guest"}
                                </span>
                                <span className="text-[11px] font-mono text-purple-700">
                                  {item.redeemed_booking_id ? `Booking #${item.redeemed_booking_id}` : ""}
                                  {item.redeemed_at ? ` • ${new Date(item.redeemed_at).toLocaleDateString()}` : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs italic">Not yet redeemed</span>
                            )}
                          </td>

                          {/* Expiry */}
                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                            {item.expiry_date || <span className="text-gray-400">Never</span>}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            {isRedeemed ? (
                              <span className="text-[11px] text-gray-400 font-medium">Locked</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSingleCouponLocationToggle(item)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                  item.location === "reception"
                                    ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                }`}
                              >
                                {item.location === "reception" ? "⬅️ Whouse" : "➡️ Desk"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredCouponItems.length > 0 && couponPageSize !== -1 && (
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
                <div>
                  Showing <strong>{(couponPage - 1) * couponPageSize + 1}</strong> to{" "}
                  <strong>{Math.min(couponPage * couponPageSize, filteredCouponItems.length)}</strong> of{" "}
                  <strong>{filteredCouponItems.length}</strong> coupon wristbands
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCouponPage((p) => Math.max(1, p - 1))}
                    disabled={couponPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 py-1 font-bold text-gray-700 font-mono">
                    Page {couponPage} / {totalCouponPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCouponPage((p) => Math.min(totalCouponPages, p + 1))}
                    disabled={couponPage >= totalCouponPages}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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
                <option value="all">All Band Colors ({availableFilterColors.length})</option>
                {availableFilterColors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
              >
                <option value="all">All Subcategories</option>
                <option value="Standard">🎫 Standard (Default)</option>
                <option value="Participant">🏎️ Participant</option>
                <option value="Visitor">☕ Visitor</option>
                <option value="VIP Participant">👑 VIP Participant</option>
                <option value="VIP Visitor">⭐ VIP Visitor</option>
                <option value="Staff / Marshal">🛡️ Staff / Marshal</option>
                <option value="Child">🧒 Child</option>
                {configuredSubcategories
                  .filter(c => !["Participant", "Visitor", "VIP Participant", "VIP Visitor", "Staff / Marshal", "Standard", "Child"].includes(c.category_name))
                  .map(c => (
                    <option key={c.id} value={c.category_name}>🏷️ {c.category_name}</option>
                  ))}
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

              {/* Standardize All Categories Button */}
              {canManageStock && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await standardizeAllBandCategoriesAction();
                    if (res.success) {
                      setFeedback({
                        type: "success",
                        message: `Successfully standardized wristbands to category 'Standard'!`
                      });
                      loadData(true);
                    } else {
                      setFeedback({ type: "error", message: res.error || "Failed to standardize categories" });
                    }
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
                  title="Make all wristbands category Standard from backend"
                >
                  <span>🏷️ Standardize All to Standard</span>
                </button>
              )}
            </div>
          </div>

          {/* Color Filter Quick Purge Banner */}
          {colorFilter !== "all" && totalItemsCount > 0 && canManageStock && (
            <div className="bg-red-50 border-y border-red-200 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-red-950 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  Filter Active: Viewing <strong>{totalItemsCount}</strong> wristbands for <strong>&ldquo;{colorFilter}&rdquo;</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`Are you sure you want to permanently delete ALL ${totalItemsCount} wristbands for "${colorFilter}" from the catalog? This will delete unissued bands completely.`)) return;
                  setIsDeletingBulk(true);
                  try {
                    const res = await purgeOrResetColorStockAction({
                      colorName: colorFilter,
                      actionType: "delete_everything"
                    });
                    if (res.success) {
                      setFeedback({
                        type: "success",
                        message: `Successfully deleted all ${colorFilter} wristbands from inventory!`
                      });
                      setColorFilter("all");
                      await loadData(true);
                    } else {
                      setFeedback({ type: "error", message: res.error || "Failed to delete bands." });
                    }
                  } catch (e: any) {
                    setFeedback({ type: "error", message: e.message || "Failed to delete bands." });
                  } finally {
                    setIsDeletingBulk(false);
                  }
                }}
                disabled={isDeletingBulk}
                className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All &ldquo;{colorFilter}&rdquo; Wristbands ({totalItemsCount})</span>
              </button>
            </div>
          )}

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
                        <td className="py-3 px-4">
                          {(() => {
                            const norm = normalizeBandCategory(item.category);
                            if (norm === "Participant") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  🏎️ Participant
                                </span>
                              );
                            }
                            if (norm === "Visitor") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ☕ Visitor
                                </span>
                              );
                            }
                            if (norm === "VIP Participant") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  👑 VIP Participant
                                </span>
                              );
                            }
                            if (norm === "VIP Visitor") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  ⭐ VIP Visitor
                                </span>
                              );
                            }
                            if (norm === "Staff / Marshal") {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
                                  🛡️ Staff / Marshal
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                {item.category || "Standard"}
                              </span>
                            );
                          })()}
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

              {/* Category / Subcategory */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Wristband Subcategory (Pass Type)
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const newCat = e.target.value as BandCategory;
                    setSelectedCategory(newCat);
                    if (isBulkMode) {
                      const colorPart = selectedColor.name.split("/")[0].trim().slice(0, 3).toUpperCase();
                      const catMeta = BAND_SUBCATEGORIES.find(s => s.id === newCat);
                      const catCode = catMeta ? catMeta.codePrefix : "BND";
                      // If user is typing pre-printed codes, keep whatever format they prefer
                      setBulkPrefix(`BND-${colorPart}-${catCode}`);
                    }
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                >
                  <option value="Standard">🎫 Standard (General Entry)</option>
                  <option value="Participant">🏎️ Participant (Full RC Zone Pass)</option>
                  <option value="Visitor">☕ Visitor (Companion / Lounge)</option>
                  <option value="VIP Participant">👑 VIP Participant (RC + Simulator)</option>
                  <option value="VIP Visitor">⭐ VIP Visitor (Simulator Pass)</option>
                  <option value="Staff / Marshal">🛡️ Staff / Track Marshal</option>
                  <option value="Child">🧒 Child / Junior Racer</option>
                  {configuredSubcategories
                    .filter(c => !["Participant", "Visitor", "VIP Participant", "VIP Visitor", "Staff / Marshal", "Standard", "Child"].includes(c.category_name))
                    .map(c => (
                      <option key={c.id} value={c.category_name}>🏷️ {c.category_name} (Universal Band)</option>
                    ))}
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

              {/* Inline Error Alert inside Modal */}
              {stockInError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-semibold">{stockInError}</div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsStockInModalOpen(false);
                    setStockInError(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStockIn}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {isSubmittingStockIn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isBulkMode ? "Generating Bands..." : "Adding Stock..."}</span>
                    </>
                  ) : isBulkMode ? (
                    `Generate ${bulkCount} Bands`
                  ) : (
                    "Stock In Band"
                  )}
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

            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                  style={{ backgroundColor: selectedColorForAction.color_hex }}
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff5a1f] bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                  Color Stock Quick Hub
                </span>
              </div>
              {canManageStock && (
                <button
                  type="button"
                  onClick={() => setIsRenamingColor(!isRenamingColor)}
                  className="text-xs px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>✏️ Rename / Edit Details</span>
                </button>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <span>{selectedColorForAction.color_name} Wristbands</span>
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {canManageStock
                ? "Manage stock levels, batch generate a new band series, or view and edit individual items."
                : "View wristband stock levels and filter the catalog to inspect wristbands."}
            </p>

            {/* Inline Rename Form */}
            {isRenamingColor && (
              <form onSubmit={handleRenameSubmit} className="mb-4 p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Wristband Colour Name</label>
                  <input
                    type="text"
                    value={renameFormColorName}
                    onChange={(e) => setRenameFormColorName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    placeholder="e.g. Royal Blue"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Pass Category (Subcategory / Type)</label>
                  <input
                    type="text"
                    value={renameFormCategory}
                    onChange={(e) => setRenameFormCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    placeholder="e.g. VIP Participant, Visitor, Child, etc."
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsRenamingColor(false)}
                    className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRename}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingRename ? "Saving..." : "Save & Sync Everywhere"}
                  </button>
                </div>
              </form>
            )}

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-5 gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200 mb-4 text-center text-xs">
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

            {/* Subcategories Breakdown in Quick Hub */}
            {selectedColorForAction.subcategories && selectedColorForAction.subcategories.length > 0 && (
              <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-2">
                  Pass Subcategory Breakdown:
                </span>
                <div className="space-y-1.5">
                  {selectedColorForAction.subcategories.map((sub) => {
                    const norm = normalizeBandCategory(sub.category);
                    return (
                      <div key={sub.category} className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                        <span className="font-bold text-gray-800 flex items-center gap-1.5">
                          <span>{norm === "Participant" ? "🏎️" : norm === "Visitor" ? "☕" : norm === "VIP Participant" ? "👑" : norm === "VIP Visitor" ? "⭐" : "🎫"}</span>
                          <span>{sub.category}</span>
                        </span>
                        <div className="flex items-center gap-3 font-mono text-[11px]">
                          <span className="text-emerald-700 font-bold">{sub.available} wh</span>
                          <span className="text-amber-700 font-bold">{sub.in_reception} rec</span>
                          <span className="text-blue-700 font-bold">{sub.issued} iss</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Cards Grid */}
            <div className="space-y-3">
              {canManageStock ? (
                <>
                  {/* Option: Stock Out to Reception */}
                  <button
                    onClick={() => {
                      setIsColorManageModalOpen(false);
                      setColorStockOutAmount(10);
                      setHandoverMode("auto");
                      setManualSeriesStart("");
                      setManualSeriesEnd("");
                      setManualCodesList([]);
                      setManualBarcodeScan("");
                      setIsManualBatchOpen(false);
                      setManualBatchText("");
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

              {/* Option 4: Danger Zone - Reset / Purge Extra Inventory */}
              {canManageStock && (
                <div className="pt-2 border-t border-red-100">
                  <button
                    type="button"
                    onClick={() => {
                      setPurgeTargetColor(selectedColorForAction);
                      setPurgeActionType("reset_to_zero");
                      setIsPurgeModalOpen(true);
                    }}
                    className="w-full text-left p-3.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100/70 transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500 text-white group-hover:scale-105 transition-transform">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="block text-xs font-bold text-red-900 group-hover:text-red-800 transition-colors">
                          Reset Stock / Purge Extra Inventory
                        </strong>
                        <span className="text-[11px] text-red-700">
                          Reset phantom counts to 0, purge unissued bands, or delete this color pool safely
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-500 group-hover:translate-x-1 transition-all" />
                  </button>
                </div>
              )}
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
      {/* MODAL: RESET & PURGE STOCK MODAL (PER COLOR)                             */}
      {/* ========================================================================= */}
      {isPurgeModalOpen && purgeTargetColor && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-red-200 relative my-auto">
            <button
              onClick={() => {
                setIsPurgeModalOpen(false);
                setPurgeTargetColor(null);
              }}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-lg bg-red-100 text-red-600">
                <Trash2 className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                Reset / Delete Inventory
              </span>
            </div>

            <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full border shrink-0"
                style={{ backgroundColor: purgeTargetColor.color_hex }}
              />
              <span>{purgeTargetColor.color_name}</span>
            </h3>

            <p className="text-xs text-gray-600 mt-1 mb-4">
              Choose how to clean up or reset this color's inventory.
              <strong className="text-emerald-700 block mt-0.5">
                🛡️ Safe: Active player bookings and issued bands ({purgeTargetColor.issued} issued) are NEVER deleted or affected.
              </strong>
            </p>

            {/* Current Stock Snapshot */}
            <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200 mb-5 text-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Total</span>
                <span className="font-mono font-bold text-gray-900">{purgeTargetColor.total}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Warehouse</span>
                <span className="font-mono font-bold text-emerald-700">{purgeTargetColor.available}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600 block">Reception</span>
                <span className="font-mono font-bold text-amber-700">{purgeTargetColor.in_reception || 0}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 block">Issued</span>
                <span className="font-mono font-bold text-blue-700">{purgeTargetColor.issued}</span>
              </div>
            </div>

            {/* Action Selection Radio Cards */}
            <div className="space-y-2.5 mb-6">
              <label 
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  purgeActionType === "reset_to_zero" 
                    ? "border-amber-400 bg-amber-50/60 ring-2 ring-amber-400/20" 
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="purgeAction"
                  checked={purgeActionType === "reset_to_zero"}
                  onChange={() => setPurgeActionType("reset_to_zero")}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div className="text-xs">
                  <strong className="block font-bold text-gray-900">
                    Reset Stock Numbers to 0 (Keep Color in Rotation)
                  </strong>
                  <span className="text-gray-500">
                    Resets warehouse stock and reception count to 0 in the color pool. Fixes script-added phantom stock numbers immediately.
                  </span>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  purgeActionType === "purge_unissued_bands" 
                    ? "border-orange-400 bg-orange-50/60 ring-2 ring-orange-400/20" 
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="purgeAction"
                  checked={purgeActionType === "purge_unissued_bands"}
                  onChange={() => setPurgeActionType("purge_unissued_bands")}
                  className="mt-0.5 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <div className="text-xs">
                  <strong className="block font-bold text-gray-900">
                    Purge Unissued Bands ({purgeTargetColor.available + (purgeTargetColor.in_reception || 0)} Bands)
                  </strong>
                  <span className="text-gray-500">
                    Permanently deletes all unissued individual bands for this color from the catalog. Preserves all {purgeTargetColor.issued} issued bands.
                  </span>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  purgeActionType === "delete_everything" 
                    ? "border-red-400 bg-red-50/60 ring-2 ring-red-400/20" 
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="purgeAction"
                  checked={purgeActionType === "delete_everything"}
                  onChange={() => setPurgeActionType("delete_everything")}
                  className="mt-0.5 text-red-600 focus:ring-red-500 cursor-pointer"
                />
                <div className="text-xs">
                  <strong className="block font-bold text-red-900">
                    Completely Delete Color Pool &amp; Unissued Inventory
                  </strong>
                  <span className="text-red-700">
                    Removes the color pool record completely and clears all unissued stock. Use this to delete extra or unwanted test colors like duplicate VIP passes or test entries.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsPurgeModalOpen(false);
                  setPurgeTargetColor(null);
                }}
                disabled={isSubmittingPurge}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={isSubmittingPurge}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPurge ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Execute</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GLOBAL INVENTORY CLEANER & DUPLICATE STOCK PURGE                    */}
      {/* ========================================================================= */}
      {isCleanInventoryModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-amber-200 relative my-auto">
            <button
              onClick={() => setIsCleanInventoryModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <Trash2 className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Inventory Cleaner &amp; Phantom Stock Purge
              </span>
            </div>

            <h3 className="text-lg font-extrabold text-gray-900">
              Clean Up Extra &amp; Duplicate Inventory
            </h3>

            <p className="text-xs text-gray-600 mt-1 mb-4">
              Here you can inspect every wristband color pool and immediately reset or delete phantom numbers, extra series, or duplicate test entries. 
              <span className="font-semibold text-emerald-700 ml-1">
                Issued bands with player bookings are protected.
              </span>
            </p>

            {/* Quick Purge by Color Name input */}
            <div className="mb-4 p-3.5 bg-red-50/70 border border-red-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="text-xs">
                <strong className="block text-red-950 font-bold">Purge Specific Color by Name:</strong>
                <span className="text-red-700">Type any color name (e.g. Crystal Blue) to wipe its 300 unissued bands &amp; reset stock to 0:</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customColorToPurge}
                  onChange={(e) => setCustomColorToPurge(e.target.value)}
                  placeholder="e.g. Crystal Blue"
                  className="px-3 py-1.5 text-xs font-bold border border-red-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 w-44"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const name = customColorToPurge.trim();
                    if (!name) return;
                    if (!confirm(`Are you sure you want to permanently delete ALL unissued bands and reset stock for "${name}"?`)) return;
                    setIsSubmittingPurge(true);
                    try {
                      const res = await purgeOrResetColorStockAction({
                        colorName: name,
                        actionType: "delete_everything"
                      });
                      if (res.success) {
                        setFeedback({ type: "success", message: `Successfully purged all inventory for "${name}"!` });
                        setCustomColorToPurge("");
                        setIsCleanInventoryModalOpen(false);
                        await loadData(true);
                      } else {
                        setFeedback({ type: "error", message: res.error || "Failed to purge color." });
                      }
                    } catch (err: any) {
                      setFeedback({ type: "error", message: err.message || "Failed to purge color." });
                    } finally {
                      setIsSubmittingPurge(false);
                    }
                  }}
                  disabled={!customColorToPurge.trim() || isSubmittingPurge}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {isSubmittingPurge ? "Purging..." : "Purge Color"}
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
              {(summary?.colorBreakdown || []).map((col) => {
                const isZeroIssued = col.issued === 0 && col.total > 0;
                return (
                  <div key={col.color_hex + col.color_name} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full border shadow-2xs shrink-0"
                        style={{ backgroundColor: col.color_hex }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-xs font-bold text-gray-900 truncate">
                            {col.color_name}
                          </strong>
                          <span className="text-[10px] font-mono text-gray-400">{col.color_hex}</span>
                          {isZeroIssued && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              ⚡ 0 Issued (Possible Test/Extra Stock)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono mt-0.5 text-gray-500">
                          <span>Total: <strong className="text-gray-900">{col.total}</strong></span>
                          <span>Warehouse: <strong className="text-emerald-700">{col.available}</strong></span>
                          <span>Reception: <strong className="text-amber-700">{col.in_reception || 0}</strong></span>
                          <span>Issued: <strong className="text-blue-700">{col.issued}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setPurgeTargetColor(col);
                          setPurgeActionType("reset_to_zero");
                          setIsPurgeModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors cursor-pointer"
                        title="Reset warehouse & reception counts to 0"
                      >
                        Reset to 0
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPurgeTargetColor(col);
                          setPurgeActionType("purge_unissued_bands");
                          setIsPurgeModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-800 transition-colors cursor-pointer"
                        title="Delete unissued individual bands for this color"
                      >
                        Purge Unissued
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPurgeTargetColor(col);
                          setPurgeActionType("delete_everything");
                          setIsPurgeModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer"
                        title="Completely remove color pool and unissued stock"
                      >
                        Delete Pool
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                Total Colors Tracked: <strong>{summary?.colorBreakdown?.length || 0}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsCleanInventoryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
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
                  Subcategory (Pass Type)
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as BandCategory)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                >
                  <option value="Standard">🎫 Standard</option>
                  <option value="Participant">🏎️ Participant</option>
                  <option value="Visitor">☕ Visitor</option>
                  <option value="VIP Participant">👑 VIP Participant</option>
                  <option value="VIP Visitor">⭐ VIP Visitor</option>
                  <option value="Staff / Marshal">🛡️ Staff / Marshal</option>
                  <option value="Child">🧒 Child</option>
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

              {/* Subcategory Filter for Handover */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>Pass Subcategory:</span>
                  <span className="text-[10px] font-semibold text-amber-700 font-sans normal-case">Target specific ticket type</span>
                </label>
                <select
                  value={handoverCategoryFilter}
                  onChange={(e) => setHandoverCategoryFilter(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">📦 All Subcategories (Any Available)</option>
                  <option value="Participant">🏎️ Participant Bands Only</option>
                  <option value="Visitor">☕ Visitor Bands Only</option>
                  <option value="VIP Participant">👑 VIP Participant Bands Only</option>
                  <option value="VIP Visitor">⭐ VIP Visitor Bands Only</option>
                  <option value="Staff / Marshal">🛡️ Staff / Marshal Bands Only</option>
                  <option value="Standard">🎫 Standard Bands Only</option>
                </select>
              </div>

              {/* Handover Mode Switcher */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5 flex items-center justify-between">
                  <span>Handover Method:</span>
                  <span className="text-[10px] font-semibold text-gray-500 font-sans normal-case">Select how bands are allotted</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100/90 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setHandoverMode("auto")}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      handoverMode === "auto"
                        ? "bg-white text-gray-900 shadow-xs border border-gray-200/80"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Auto Allotment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHandoverMode("series")}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      handoverMode === "series"
                        ? "bg-white text-gray-900 shadow-xs border border-gray-200/80"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5 text-blue-500" />
                    <span>Manual Series</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHandoverMode("random")}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      handoverMode === "random"
                        ? "bg-white text-gray-900 shadow-xs border border-gray-200/80"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5 text-purple-500" />
                    <span>Random / Specific</span>
                  </button>
                </div>
              </div>

              {/* Mode 1: Auto Allotment */}
              {handoverMode === "auto" && (
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
                </div>
              )}

              {/* Mode 2: Manual Series (Start Code to End Code) */}
              {handoverMode === "series" && (
                <div className="space-y-2 bg-blue-50/40 p-3.5 rounded-2xl border border-blue-200">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-xs font-bold uppercase text-blue-900 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      Specify Band Series Range:
                    </label>
                    <span className="text-[10px] text-blue-700 font-semibold">e.g. 016001 to 016025</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-gray-600 uppercase block mb-1">Start Code:</span>
                      <input
                        type="text"
                        placeholder="e.g. 016001"
                        value={manualSeriesStart}
                        onChange={(e) => setManualSeriesStart(e.target.value)}
                        className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-600 uppercase block mb-1">End Code (Optional):</span>
                      <input
                        type="text"
                        placeholder="e.g. 016025"
                        value={manualSeriesEnd}
                        onChange={(e) => setManualSeriesEnd(e.target.value)}
                        className="w-full bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-800 leading-tight">
                    💡 Directly allots a sleeve or box of sequentially numbered warehouse wristbands to the reception desk.
                  </p>
                </div>
              )}

              {/* Mode 3: Specific / Random Bands */}
              {handoverMode === "random" && (
                <div className="space-y-2.5 bg-purple-50/40 p-3.5 rounded-2xl border border-purple-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase text-purple-900 flex items-center gap-1.5">
                      <Shuffle className="w-3.5 h-3.5 text-purple-600" />
                      Enter / Scan Loose Bands:
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsManualBatchOpen(!isManualBatchOpen)}
                      className="text-[10px] font-bold text-purple-700 hover:text-purple-900 underline"
                    >
                      {isManualBatchOpen ? "Single Scan Mode" : "Paste Batch / Ranges"}
                    </button>
                  </div>

                  {!isManualBatchOpen ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Type or scan barcode and press Enter..."
                          value={manualBarcodeScan}
                          onChange={(e) => setManualBarcodeScan(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "," || e.key === " ") {
                              e.preventDefault();
                              const clean = manualBarcodeScan.trim();
                              if (clean) {
                                const parsed = parseBarcodeInputs(clean);
                                setManualCodesList(prev => Array.from(new Set([...prev, ...parsed])));
                                setManualBarcodeScan("");
                              }
                            }
                          }}
                          className="w-full bg-white border border-purple-300 rounded-xl pl-3 pr-8 py-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                        />
                        {manualBarcodeScan && (
                          <button
                            type="button"
                            onClick={() => setManualBarcodeScan("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const clean = manualBarcodeScan.trim();
                          if (clean) {
                            const parsed = parseBarcodeInputs(clean);
                            setManualCodesList(prev => Array.from(new Set([...prev, ...parsed])));
                            setManualBarcodeScan("");
                          }
                        }}
                        disabled={!manualBarcodeScan.trim()}
                        className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold transition-all shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <textarea
                        rows={3}
                        placeholder="Paste codes separated by commas, spaces, or lines.&#10;e.g. 016001, 016005, 016010-016015"
                        value={manualBatchText}
                        onChange={(e) => setManualBatchText(e.target.value)}
                        className="w-full bg-white border border-purple-300 rounded-xl p-2.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-purple-700">Supports ranges like 016010-016015</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (manualBatchText.trim()) {
                              const parsed = parseBarcodeInputs(manualBatchText);
                              setManualCodesList(prev => Array.from(new Set([...prev, ...parsed])));
                              setManualBatchText("");
                              setIsManualBatchOpen(false);
                            }
                          }}
                          disabled={!manualBatchText.trim()}
                          className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-[11px] font-bold"
                        >
                          Add All To List
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Chip Cloud of Added Codes */}
                  {manualCodesList.length > 0 && (
                    <div className="p-2.5 bg-white/90 rounded-xl border border-purple-200 max-h-36 overflow-y-auto space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">
                          {manualCodesList.length} {manualCodesList.length === 1 ? "Code" : "Codes"} Entered:
                        </span>
                        <button
                          type="button"
                          onClick={() => setManualCodesList([])}
                          className="text-[10px] text-red-600 hover:text-red-800 font-bold"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {manualCodesList.map((code) => {
                          const isInvalid = stockOutPreview.invalidCodes?.includes(code.toUpperCase());
                          return (
                            <span
                              key={code}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold transition-all ${
                                isInvalid
                                  ? "bg-red-100 text-red-800 border border-red-300 line-through"
                                  : "bg-purple-100 text-purple-900 border border-purple-200"
                              }`}
                            >
                              {code}
                              <button
                                type="button"
                                onClick={() => setManualCodesList(prev => prev.filter(c => c !== code))}
                                className="hover:text-red-600 ml-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Preview of Wristbands to be Handed Over */}
              <div className={`rounded-2xl border p-3.5 transition-all ${
                stockOutPreview.count > 0 ? 'bg-emerald-50/70 border-emerald-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    Wristbands To Be Stocked Out:
                  </span>
                  {stockOutPreview.isLoading ? (
                    <span className="text-[10px] font-bold text-emerald-600 animate-pulse">Checking warehouse...</span>
                  ) : stockOutPreview.count > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800">
                      {stockOutPreview.count} {stockOutPreview.count === 1 ? 'Band' : 'Bands'} Ready
                    </span>
                  ) : null}
                </div>

                {stockOutPreview.isLoading ? (
                  <div className="h-9 flex items-center gap-2 text-xs text-emerald-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Verifying available warehouse band IDs...
                  </div>
                ) : stockOutPreview.count > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-mono font-black text-emerald-950 bg-white/80 px-3 py-2 rounded-xl border border-emerald-300 shadow-xs flex-wrap">
                      {handoverMode === "random" ? (
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto w-full">
                          {stockOutPreview.bandCodes?.map(code => (
                            <span key={code} className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-xs">
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-xs">
                            {stockOutPreview.startCode}
                          </span>
                          {stockOutPreview.startCode !== stockOutPreview.endCode && (
                            <>
                              <span className="text-emerald-500 font-bold">→</span>
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-xs">
                                {stockOutPreview.endCode}
                              </span>
                            </>
                          )}
                        </>
                      )}
                      <span className="text-[11px] font-sans font-semibold text-emerald-700 ml-auto shrink-0">
                        ({stockOutPreview.count} {stockOutPreview.count === 1 ? "item" : "items"})
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-700 font-medium">
                      ✓ These warehouse bands will immediately transition to <strong>Reception</strong> status upon confirmation.
                    </p>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-800 bg-amber-50/90 p-2.5 rounded-xl border border-amber-200">
                    {handoverMode === "auto" && "⚠️ No individual wristband records found in warehouse storage for this color. Handover will update the reception counter balance."}
                    {handoverMode === "series" && (manualSeriesStart ? "⚠️ No available warehouse wristbands match this series range." : "👉 Enter a Start Code above to preview matching warehouse wristbands.")}
                    {handoverMode === "random" && (manualCodesList.length > 0 ? "⚠️ None of the entered codes exist in warehouse stock for this color." : "👉 Type or scan wristband barcodes above.")}
                  </div>
                )}

                {/* Warning for invalid / unmatched codes in random mode */}
                {handoverMode === "random" && stockOutPreview.invalidCodes && stockOutPreview.invalidCodes.length > 0 && (
                  <div className="mt-2 text-[10px] text-red-800 bg-red-50 p-2 rounded-lg border border-red-200">
                    ⚠️ <strong>{stockOutPreview.invalidCodes.length} code(s) not in warehouse:</strong> {stockOutPreview.invalidCodes.join(", ")} (these will be skipped)
                  </div>
                )}
              </div>

              {/* Reception Counter Impact Helper */}
              <p className="text-[11px] text-gray-500 mt-2 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200 leading-relaxed">
                ℹ️ This directly adds <strong className="font-mono font-bold text-amber-800">
                  {stockOutPreview.count || (handoverMode === "auto" ? colorStockOutAmount : 0)}
                </strong> wristbands to the Reception counter for staff to hand out. Reception total will be <strong className="font-mono font-bold text-amber-800">
                  {(selectedColorForAction.in_reception || 0) + (stockOutPreview.count || (handoverMode === "auto" ? colorStockOutAmount : 0))}
                </strong>.
              </p>

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
                  disabled={
                    isSubmittingColorStockOut || 
                    (handoverMode === "auto" && colorStockOutAmount <= 0) ||
                    (handoverMode === "series" && stockOutPreview.count <= 0) ||
                    (handoverMode === "random" && stockOutPreview.count <= 0)
                  }
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmittingColorStockOut 
                    ? "Recording Handover..." 
                    : `Confirm Stock Out to Reception (${stockOutPreview.count || (handoverMode === "auto" ? colorStockOutAmount : 0)})`}
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

      {/* ========================================================================= */}
      {/* MODAL: COUPON BANDS HANDOVER / TRANSFER                                   */}
      {/* ========================================================================= */}
      {isCouponHandoverModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-purple-200 relative my-auto">
            <button
              onClick={() => setIsCouponHandoverModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-xl text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-sm"
                style={{ backgroundColor: handoverOfferColor || "#FFD700" }}
              />
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800">
                  Stock Handover &amp; Movement
                </span>
                <h3 className="text-base font-black text-gray-900 mt-0.5">
                  Coupon Bands: {handoverOfferName || handoverOfferCategory}
                </h3>
              </div>
            </div>

            <form onSubmit={handleCouponOfferHandoverSubmit} className="space-y-4">
              {/* Select Offer Category */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Promotional Band Offer
                </label>
                <select
                  value={handoverOfferCategory}
                  onChange={(e) => {
                    setHandoverOfferCategory(e.target.value);
                    const found = couponInventory?.breakdown.find(b => b.band_category === e.target.value);
                    if (found) {
                      setHandoverOfferColor(found.band_color);
                      setHandoverOfferName(`${found.band_category} (${found.value}${found.discount_type === "percentage" ? "%" : "₹"})`);
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {(couponInventory?.breakdown || []).map((b) => (
                    <option key={b.band_category} value={b.band_category}>
                      {b.band_category} (Whouse: {b.warehouse}, Desk: {b.reception})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer Direction */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Transfer Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHandoverDirection("to_reception")}
                    className={`p-3 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition-all ${
                      handoverDirection === "to_reception"
                        ? "bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-400"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-amber-600" />
                    <span>Whouse ➡️ Reception</span>
                    <span className="text-[10px] font-normal text-gray-500">For active daily handover</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHandoverDirection("to_warehouse")}
                    className={`p-3 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition-all ${
                      handoverDirection === "to_warehouse"
                        ? "bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-400"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-blue-600" />
                    <span>Reception ➡️ Whouse</span>
                    <span className="text-[10px] font-normal text-gray-500">Return to safe storage</span>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Number of Wristbands to Transfer
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={handoverAmount}
                    onChange={(e) => setHandoverAmount(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-base font-black font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex gap-1 shrink-0">
                    {[5, 10, 25, 50].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setHandoverAmount(amt)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                          handoverAmount === amt
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200"
                        }`}
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCouponHandoverModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCouponHandover}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md shadow-purple-500/20 transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isSubmittingCouponHandover ? "Transferring..." : "Confirm Handover"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

