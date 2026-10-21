"use client";

import { useEffect, useState, useMemo } from "react";
import { Filter, Search, ChevronDown, CheckSquare, Square, Download, Trash2, AlertTriangle, Loader2, FileSpreadsheet } from "lucide-react";
import { fetchAllBookingsAction, deleteBookingsAction, fetchTimeSlotsAction } from "@/app/actions/tickets";
import { formatOrderNumber, formatDateTime } from "@/lib/order-utils";
import { getSlotWristbandColor, getWristbandBadgeStyle } from "@/lib/slotColors";
import { generateBookingsExcelReport } from "@/lib/exportBookingsReport";
import type { TimeSlotRow } from "@/lib/db";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface GroupedOrder {
  orderNumber: number;
  orderCode: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_status: string;
  fulfillment_status: string;
  tags: string;
  total_amount: number;
  total_quantity: number;
  bookingIds: number[];
  primaryId: number;
  items: any[];
  slots: { slot: string; color?: string; color_name?: string; date?: string }[];
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlotRow[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const router = useRouter();

  const loadBookings = () => {
    setIsLoading(true);
    Promise.all([
      fetchAllBookingsAction(),
      fetchTimeSlotsAction()
    ])
      .then(([bookingsData, slotsData]) => {
        setBookings(bookingsData || []);
        setTimeSlots(slotsData || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  // Group bookings by order_number (or b.id if null)
  const groupedOrders = useMemo<GroupedOrder[]>(() => {
    const map = new Map<number, GroupedOrder>();

    for (const b of bookings) {
      const orderNum = b.order_number || b.id;
      if (!map.has(orderNum)) {
        const rawAmount = Number(b.total_amount || 0);
        const baseAmount = (b.ticket_price || 0) * (b.quantity || 1);
        const effectiveAmount = rawAmount > baseAmount ? rawAmount : (baseAmount > 0 ? Math.round(baseAmount * 1.18) : rawAmount);

        map.set(orderNum, {
          orderNumber: orderNum,
          orderCode: formatOrderNumber(orderNum, b.created_at, b.payment_status),
          created_at: b.created_at,
          customer_name: b.customer_name || "Guest Customer",
          customer_email: b.customer_email || "",
          customer_phone: b.customer_phone || "",
          payment_status: b.payment_status || "Unpaid",
          fulfillment_status: b.fulfillment_status || "Unfulfilled",
          tags: b.tags || "",
          total_amount: effectiveAmount,
          total_quantity: b.quantity || 1,
          bookingIds: [b.id],
          primaryId: b.id,
          items: [b],
          slots: b.time_slot ? [{ slot: b.time_slot, color: b.slot_color, color_name: b.slot_color_name, date: b.booking_date }] : []
        });
      } else {
        const existing = map.get(orderNum)!;
        const rawAmount = Number(b.total_amount || 0);
        const baseAmount = (b.ticket_price || 0) * (b.quantity || 1);
        const effectiveAmount = rawAmount > baseAmount ? rawAmount : (baseAmount > 0 ? Math.round(baseAmount * 1.18) : rawAmount);

        existing.total_amount += effectiveAmount;
        existing.total_quantity += (b.quantity || 1);
        existing.bookingIds.push(b.id);
        existing.items.push(b);
        if (b.tags && !existing.tags.includes(b.tags)) {
          existing.tags = existing.tags ? `${existing.tags}, ${b.tags}` : b.tags;
        }
        if (b.time_slot) {
          const alreadyHasSlot = existing.slots.some(s => s.slot === b.time_slot && s.date === b.booking_date);
          if (!alreadyHasSlot) {
            existing.slots.push({ slot: b.time_slot, color: b.slot_color, color_name: b.slot_color_name, date: b.booking_date });
          }
        }
      }
    }

    return Array.from(map.values());
  }, [bookings]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.primaryId));
    }
  };

  const toggleSelectOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      await deleteBookingsAction(selectedIds);
      setSelectedIds([]);
      setShowDeleteConfirm(false);
      loadBookings();
    } catch (err) {
      console.error("Failed to delete orders:", err);
      alert("Failed to delete selected orders. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Advanced Filter state
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    fulfillment: false,
    product: false,
    payment: false,
    dateCreated: false,
    bookingDate: false,
    bookingMonth: false,
  });

  const [filterDateCreated, setFilterDateCreated] = useState<string>("all"); // 'all' | '7days' | '14days' | 'lastMonth' | 'custom'
  const [customDateStart, setCustomDateStart] = useState<string>("");
  const [customDateEnd, setCustomDateEnd] = useState<string>("");
  const [filterBookingDate, setFilterBookingDate] = useState<string>(""); // yyyy-mm-dd
  const [filterBookingMonths, setFilterBookingMonths] = useState<string[]>([]);
  const [filterFulfillmentStatuses, setFilterFulfillmentStatuses] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string>("ALL");
  const [filterPaymentStatuses, setFilterPaymentStatuses] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCheckbox = (list: string[], setList: (val: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const clearAllFilters = () => {
    setFilterDateCreated("all");
    setCustomDateStart("");
    setCustomDateEnd("");
    setFilterBookingDate("");
    setFilterBookingMonths([]);
    setFilterFulfillmentStatuses([]);
    setFilterProduct("ALL");
    setFilterPaymentStatuses([]);
    setSearchQuery("");
  };

  const countActiveFilters = () => {
    let count = 0;
    if (filterDateCreated !== "all") count++;
    if (filterBookingDate) count++;
    if (filterBookingMonths.length > 0) count += filterBookingMonths.length;
    if (filterFulfillmentStatuses.length > 0) count += filterFulfillmentStatuses.length;
    if (filterProduct !== "ALL") count++;
    if (filterPaymentStatuses.length > 0) count += filterPaymentStatuses.length;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Distinct ticket product names available in current bookings
  const distinctProducts = Array.from(new Set(bookings.map(b => b.ticket_name).filter(Boolean)));

  // Filter grouped orders
  const filteredOrders = groupedOrders.filter((order) => {
    const q = searchQuery.toLowerCase();
    const orderNum = order.orderCode.toLowerCase();
    const customer = (order.customer_name || "").toLowerCase();
    const email = (order.customer_email || "").toLowerCase();
    const phone = (order.customer_phone || "").toLowerCase();
    const matchesSearch = !q || orderNum.includes(q) || customer.includes(q) || email.includes(q) || phone.includes(q);

    if (!matchesSearch) return false;

    // 1. Date Created filter
    if (filterDateCreated !== "all" && order.created_at) {
      const createdTime = new Date(order.created_at).getTime();
      const now = Date.now();
      if (filterDateCreated === "7days") {
        if (now - createdTime > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (filterDateCreated === "14days") {
        if (now - createdTime > 14 * 24 * 60 * 60 * 1000) return false;
      } else if (filterDateCreated === "lastMonth") {
        if (now - createdTime > 30 * 24 * 60 * 60 * 1000) return false;
      } else if (filterDateCreated === "custom") {
        if (customDateStart && createdTime < new Date(customDateStart).getTime()) return false;
        if (customDateEnd && createdTime > new Date(customDateEnd).getTime() + 86400000) return false;
      }
    }

    // 2. Booking Date exact match across items
    if (filterBookingDate) {
      const parsedFilter = new Date(filterBookingDate);
      const shortM = parsedFilter.toLocaleString('en-US', { month: 'short' }).toLowerCase();
      const dayNum = parsedFilter.getDate();

      const matchesAnyItemDate = order.items.some(item => {
        if (!item.booking_date) return false;
        const rawDate = item.booking_date.toLowerCase();
        const matchesDay = rawDate.includes(shortM) && (rawDate.includes(` ${dayNum}`) || rawDate.includes(` ${String(dayNum).padStart(2, '0')}`));
        return matchesDay || rawDate.includes(filterBookingDate.toLowerCase());
      });

      if (!matchesAnyItemDate) return false;
    }

    // 3. Booking Month multi-select across items
    if (filterBookingMonths.length > 0) {
      const matchesAnyItemMonth = order.items.some(item => {
        const rawDate = (item.booking_date || "").toLowerCase();
        return filterBookingMonths.some(m => {
          const fullM = m.toLowerCase();
          const shortM = fullM.slice(0, 3);
          return rawDate.includes(fullM) || rawDate.includes(shortM);
        });
      });

      if (!matchesAnyItemMonth) return false;
    }

    // 4. Product filter across items
    if (filterProduct !== "ALL") {
      const matchesProduct = order.items.some(item => 
        (item.ticket_name || "").toUpperCase() === filterProduct.toUpperCase()
      );
      if (!matchesProduct) return false;
    }

    // 5. Fulfillment status multi-select
    if (filterFulfillmentStatuses.length > 0) {
      const fStatus = (order.fulfillment_status || "Unfulfilled").toLowerCase();
      const matchesFulfillment = filterFulfillmentStatuses.some(status => {
        const s = status.toLowerCase();
        if (s === "canceled") return fStatus === "canceled" || fStatus === "cancelled";
        return fStatus === s;
      });
      if (!matchesFulfillment) return false;
    }

    // 6. Payment status multi-select
    if (filterPaymentStatuses.length > 0) {
      const pStatus = (order.payment_status || "Unpaid").toLowerCase();
      const matchesPayment = filterPaymentStatuses.some(status => {
        const s = status.toLowerCase();
        return pStatus === s;
      });
      if (!matchesPayment) return false;
    }

    return true;
  });

  const handleExportExcel = () => {
    try {
      setIsExporting(true);

      // Determine which items to export:
      // If user selected checkboxes, export only the selected orders
      // Else export the currently filtered orders
      let targetOrders = filteredOrders;
      if (selectedIds.length > 0) {
        targetOrders = filteredOrders.filter(o => selectedIds.includes(o.orderNumber));
      }

      if (targetOrders.length === 0) {
        alert("No orders available to export.");
        setIsExporting(false);
        return;
      }

      // Collect all line items from the target orders
      const exportItems: any[] = [];
      for (const order of targetOrders) {
        for (const item of order.items) {
          exportItems.push({
            ...item,
            order_number: order.orderNumber,
            order_code: order.orderCode,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            customer_email: order.customer_email,
            payment_status: order.payment_status,
            fulfillment_status: order.fulfillment_status,
            total_amount: order.total_amount
          });
        }
      }

      // Determine report title e.g. based on filterBookingDate
      let title: string | undefined = undefined;
      if (filterBookingDate) {
        const d = new Date(filterBookingDate);
        if (!isNaN(d.getTime())) {
          const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
          const monthName = d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
          const dayNum = d.getDate();
          title = `${monthName} ${dayNum} (${dayName})`;
        }
      }

      generateBookingsExcelReport(exportItems, timeSlots, title);
    } catch (err: any) {
      console.error("Failed to export Excel report:", err);
      alert(err.message || "Failed to generate Excel report.");
    } finally {
      setIsExporting(false);
    }
  };

  const totalSales = groupedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalOrders = groupedOrders.length;
  const avgOrder = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : "0.00";

  const MONTHS_LIST = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const FULFILLMENT_OPTIONS = [
    "Unfulfilled", "Fulfilled", "Partially fulfilled", "Canceled"
  ];

  const PAYMENT_OPTIONS = [
    "Paid", "Unpaid", "Refunded", "Partially refunded", "Partially paid",
    "Authorized", "Pending", "Declined", "Canceled", "Pending refund",
    "Chargeback", "Chargeback reversed"
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-black text-gray-900 tracking-tight">Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage ticket reservations, payments, and fulfillment.</p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Bulk Delete Button when items are selected */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
              <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all shadow-red-600/20"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete ({selectedIds.length})</span>
              </button>
            </div>
          )}

          {/* Export Report Excel Button */}
          <button
            type="button"
            disabled={isExporting || isLoading || filteredOrders.length === 0}
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border shadow-sm bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Excel Report matching Havoc Sim Podium format"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            )}
            <span>
              {isExporting 
                ? "Exporting..." 
                : selectedIds.length > 0 
                  ? `Export (${selectedIds.length})` 
                  : "Export Report"
              }
            </span>
          </button>

          {/* Filter button that opens the slide-over filter panel */}
          <button
            onClick={() => setIsFilterDrawerOpen(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border shadow-sm ${
              activeFilterCount > 0 
                ? "bg-[#ff5a1f] text-white border-[#ff5a1f] shadow-[#ff5a1f]/20" 
                : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Search box */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Bulk Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 text-gray-900 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Delete {selectedIds.length} {selectedIds.length === 1 ? "Order" : "Orders"}?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to permanently delete {selectedIds.length === 1 ? "this order" : "these orders"}? This will also release any linked simulator slots. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isDeleting ? "Deleting..." : "Delete Permanently"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Filter Drawer matching exact screenshots */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#161a23] text-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 border-l border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h3 className="text-xl font-bold font-heading text-white tracking-tight">
                Filter your orders
              </h3>
              <button
                onClick={() => setIsFilterDrawerOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Filter List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/10 text-sm">
              
              {/* 1. Date Created */}
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => toggleSection("dateCreated")}
                  className="w-full flex items-center justify-between text-left font-bold text-gray-200 mb-3"
                >
                  <span>Date created</span>
                  <span className="text-xs text-gray-400">
                    {collapsedSections.dateCreated ? "▶" : "▼"}
                  </span>
                </button>
                {!collapsedSections.dateCreated && (
                  <div className="space-y-2.5 pl-1">
                    {[
                      { id: "all", label: "All" },
                      { id: "7days", label: "Last 7 days" },
                      { id: "14days", label: "Last 14 days" },
                      { id: "lastMonth", label: "Last month" },
                      { id: "custom", label: "Custom" }
                    ].map((opt) => (
                      <label key={opt.id} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:text-white">
                        <input
                          type="radio"
                          name="dateCreated"
                          checked={filterDateCreated === opt.id}
                          onChange={() => setFilterDateCreated(opt.id)}
                          className="w-4 h-4 text-[#ff5a1f] bg-transparent border-gray-600 focus:ring-0"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                    {filterDateCreated === "custom" && (
                      <div className="pt-2 space-y-2">
                        <input
                          type="date"
                          value={customDateStart}
                          onChange={(e) => setCustomDateStart(e.target.value)}
                          className="w-full bg-[#202634] border border-white/10 rounded-lg p-2 text-xs text-white"
                        />
                        <input
                          type="date"
                          value={customDateEnd}
                          onChange={(e) => setCustomDateEnd(e.target.value)}
                          className="w-full bg-[#202634] border border-white/10 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Booking Date */}
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => toggleSection("bookingDate")}
                  className="w-full flex items-center justify-between text-left font-bold text-gray-200 mb-3"
                >
                  <span>Booking date</span>
                  <span className="text-xs text-gray-400">
                    {collapsedSections.bookingDate ? "▶" : "▼"}
                  </span>
                </button>
                {!collapsedSections.bookingDate && (
                  <div className="pt-1">
                    <input
                      type="date"
                      value={filterBookingDate}
                      onChange={(e) => setFilterBookingDate(e.target.value)}
                      placeholder="dd-mm-yyyy"
                      className="w-full bg-[#202634] border border-white/15 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/30"
                    />
                  </div>
                )}
              </div>

              {/* 3. Booking Month */}
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => toggleSection("bookingMonth")}
                  className="w-full flex items-center justify-between text-left font-bold text-gray-200 mb-3"
                >
                  <span>Booking month</span>
                  <span className="text-xs text-gray-400">
                    {collapsedSections.bookingMonth ? "▶" : "▼"}
                  </span>
                </button>
                {!collapsedSections.bookingMonth && (
                  <div className="max-h-48 overflow-y-auto space-y-2.5 pr-2 pl-1">
                    {MONTHS_LIST.map((m) => (
                      <label key={m} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={filterBookingMonths.includes(m)}
                          onChange={() => toggleCheckbox(filterBookingMonths, setFilterBookingMonths, m)}
                          className="w-4 h-4 rounded bg-[#202634] border-gray-600 text-[#ff5a1f] focus:ring-0"
                        />
                        <span className="text-sm">{m}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Fulfillment Status */}
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => toggleSection("fulfillment")}
                  className="w-full flex items-center justify-between text-left font-bold text-gray-200 mb-3"
                >
                  <span>Fulfillment status</span>
                  <span className="text-xs text-gray-400">
                    {collapsedSections.fulfillment ? "▶" : "▼"}
                  </span>
                </button>
                {!collapsedSections.fulfillment && (
                  <div className="space-y-2.5 pl-1">
                    {FULFILLMENT_OPTIONS.map((status) => (
                      <label key={status} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={filterFulfillmentStatuses.includes(status)}
                          onChange={() => toggleCheckbox(filterFulfillmentStatuses, setFilterFulfillmentStatuses, status)}
                          className="w-4 h-4 rounded bg-[#202634] border-gray-600 text-[#ff5a1f] focus:ring-0"
                        />
                        <span className="text-sm">{status}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Product */}
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => toggleSection("product")}
                  className="w-full flex items-center justify-between text-left font-bold text-gray-200 mb-3"
                >
                  <span>Product</span>
                  <span className="text-xs text-gray-400">
                    {collapsedSections.product ? "▶" : "▼"}
                  </span>
                </button>
                {!collapsedSections.product && (
                  <div className="pt-1">
                    <select
                      value={filterProduct}
                      onChange={(e) => setFilterProduct(e.target.value)}
                      className="w-full bg-[#202634] border border-white/15 rounded-xl px-4 py-3 text-sm font-semibold text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/30"
                    >
                      <option value="ALL">All Products</option>
                      {distinctProducts.map(p => (
                        <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 6. Payment Status */}
              <div className="p-5">
                <button
                  type="button"
                  onClick={() => toggleSection("payment")}
                  className="w-full flex items-center justify-between text-left font-bold text-gray-200 mb-3"
                >
                  <span>Payment status</span>
                  <span className="text-xs text-gray-400">
                    {collapsedSections.payment ? "▶" : "▼"}
                  </span>
                </button>
                {!collapsedSections.payment && (
                  <div className="max-h-56 overflow-y-auto space-y-2.5 pr-2 pl-1">
                    {PAYMENT_OPTIONS.map((status) => (
                      <label key={status} className="flex items-center gap-3 cursor-pointer text-gray-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={filterPaymentStatuses.includes(status)}
                          onChange={() => toggleCheckbox(filterPaymentStatuses, setFilterPaymentStatuses, status)}
                          className="w-4 h-4 rounded bg-[#202634] border-gray-600 text-[#ff5a1f] focus:ring-0"
                        />
                        <span className="text-sm">{status}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer with "Clear all" and Filter Status */}
            <div className="p-5 border-t border-white/10 flex items-center justify-between text-xs bg-[#12151d]">
              <span className="text-gray-400">
                {activeFilterCount === 0 ? "No filters applied" : `${activeFilterCount} filter(s) applied`}
              </span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="font-bold text-[#ff5a1f] hover:underline"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Orders Table Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            {/* Table Header matching exact column layout */}
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-500 select-none">
                <th className="py-4 pl-6 pr-3 w-12 text-center">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-700 transition-colors">
                    {selectedIds.length > 0 && selectedIds.length === filteredOrders.length ? (
                      <CheckSquare className="w-4 h-4 text-[#ff5a1f]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-4 px-4 whitespace-nowrap">ORDER</th>
                <th className="py-4 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                    <span>DATE CREATED</span>
                    <span className="text-xs">↓</span>
                  </div>
                </th>
                <th className="py-4 px-4 whitespace-nowrap">CUSTOMER</th>
                <th className="py-4 px-4 whitespace-nowrap">PAYMENT</th>
                <th className="py-4 px-4 whitespace-nowrap">FULFILLMENT</th>
                <th className="py-4 px-4 whitespace-nowrap">TOTAL</th>
                <th className="py-4 px-4 whitespace-nowrap">ITEMS</th>
                <th className="py-4 pr-6 pl-4 whitespace-nowrap">TAGS</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isSelected = selectedIds.includes(order.primaryId);
                  const isPaid = (order.payment_status || "Paid").toLowerCase() === "paid";
                  const isFulfilled = (order.fulfillment_status || "Fulfilled").toLowerCase() === "fulfilled";
                  const totalFormatted = order.total_amount > 0 ? `₹${order.total_amount.toFixed(2)}` : "₹0.00";

                  return (
                    <tr
                      key={order.orderNumber}
                      onClick={() => router.push(`/admin/bookings/${order.primaryId}`)}
                      className={`hover:bg-gray-50/80 transition-colors cursor-pointer group ${
                        isSelected ? "bg-orange-50/30" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 pl-6 pr-3 text-center" onClick={(e) => toggleSelectOne(order.primaryId, e)}>
                        <button className="text-gray-400 group-hover:text-gray-600 transition-colors">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#ff5a1f]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Order Code */}
                      <td className="py-4 px-4 font-mono font-bold text-gray-900 whitespace-nowrap tracking-tight group-hover:text-[#ff5a1f] transition-colors">
                        {order.orderCode}
                      </td>

                      {/* Date Created */}
                      <td className="py-4 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {formatDateTime(order.created_at)}
                      </td>

                      {/* Customer & Slot Wristbands */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900">
                          {order.customer_name}
                        </div>
                        {order.slots.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 max-w-xs">
                            {order.slots.map((s, idx) => {
                              const band = getSlotWristbandColor(s.slot, s.color, s.color_name);
                              const badgeStyle = getWristbandBadgeStyle(band.hex);
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold border"
                                  style={{
                                    backgroundColor: badgeStyle.backgroundColor,
                                    borderColor: badgeStyle.borderColor,
                                    color: badgeStyle.color
                                  }}
                                  title={`Wristband Color: ${band.name}`}
                                >
                                  <span 
                                    className="w-2 h-2 rounded-full border shrink-0"
                                    style={{ 
                                      backgroundColor: band.hex,
                                      borderColor: badgeStyle.dotBorderColor
                                    }}
                                  />
                                  <span>{s.slot}</span>
                                  {s.date && (
                                    <span className="text-[9px] opacity-75 font-normal ml-0.5">
                                      ({s.date})
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Payment Badge */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {order.payment_status?.toLowerCase() === "refunded" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Refunded
                          </span>
                        ) : isPaid ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Unpaid
                          </span>
                        )}
                      </td>

                      {/* Fulfillment Badge */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {order.fulfillment_status?.toLowerCase() === "canceled" || order.fulfillment_status?.toLowerCase() === "cancelled" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                            Canceled
                          </span>
                        ) : isFulfilled ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Fulfilled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
                            Unfulfilled
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="py-4 px-4 font-bold text-gray-900 whitespace-nowrap">
                        {totalFormatted}
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4 whitespace-nowrap text-xs font-bold text-gray-600">
                        <span className="inline-flex items-center gap-1" title={order.items.map(i => `${i.quantity}x ${i.ticket_name}`).join(", ")}>
                          <span>{order.total_quantity}</span>
                          <span className="text-[10px] text-gray-400">v</span>
                        </span>
                      </td>

                      {/* Tags */}
                      <td className="py-4 pr-6 pl-4 whitespace-nowrap text-xs text-gray-500">
                        {order.tags ? (
                          <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-semibold">
                            {order.tags}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
