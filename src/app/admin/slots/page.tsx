"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  Ban, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Plus, 
  ShieldAlert, 
  RefreshCw,
  Search,
  Settings,
  Edit2,
  X,
  Power,
  Palette,
  Hash,
  Check,
  Package,
  Layers,
  Sparkles,
  ChevronRight,
  RotateCcw
} from "lucide-react";
import { 
  fetchBlockedSlotsAction, 
  blockSlotOrDateAction, 
  blockMultipleSlotsAction,
  unblockSlotAction,
  fetchTimeSlotsAction,
  createTimeSlotAction,
  updateTimeSlotAction,
  toggleTimeSlotStatusAction,
  deleteTimeSlotAction,
  fetchSiteSettingAction,
  updateSiteSettingAction,
  fetchOpenedSpecificDatesAction,
  toggleOpenedSpecificDateAction,
  fetchTicketsAction
} from "@/app/actions/tickets";
import {
  getColorInventoryAction,
  syncColorInventoryAction,
  updateColorStockAction,
  stockOutColorToReceptionAction,
  returnColorFromReceptionAction,
  setColorReceptionAction,
  deleteColorInventoryAction,
} from "@/app/actions/color-inventory";
import type { WristbandColorInventoryItem } from "@/lib/color-inventory-db";
import type { BlockedSlotRow, TimeSlotRow, TicketRow } from "@/lib/db";
import { WRISTBAND_PALETTE, getSlotWristbandColor, resolveColorNameToHex, getWristbandBadgeStyle } from "@/lib/slotColors";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function SlotsManagementPage() {
  const [activeTab, setActiveTab] = useState<'block_slots' | 'manage_slots' | 'color_inventory'>('block_slots');

  // Wristband Colour Inventory State
  const [colorInventory, setColorInventory] = useState<WristbandColorInventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [isSyncingInventory, setIsSyncingInventory] = useState(false);
  const [stockModalItem, setStockModalItem] = useState<WristbandColorInventoryItem | null>(null);
  const [stockAmountToAdd, setStockAmountToAdd] = useState(10);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

  // Stock Out to Reception State
  const [stockOutModalItem, setStockOutModalItem] = useState<WristbandColorInventoryItem | null>(null);
  const [stockOutAmount, setStockOutAmount] = useState(10);
  const [isStockingOut, setIsStockingOut] = useState(false);

  // Return from Reception State
  const [returnModalItem, setReturnModalItem] = useState<WristbandColorInventoryItem | null>(null);
  const [returnAmount, setReturnAmount] = useState(10);
  const [isReturningStock, setIsReturningStock] = useState(false);
  const [directSetTarget, setDirectSetTarget] = useState(0);
  const [isDirectSetReception, setIsDirectSetReception] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<WristbandColorInventoryItem | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);

  // Time Slots State
  const [timeSlots, setTimeSlots] = useState<TimeSlotRow[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [isAddingSlot, setIsAddingSlot] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlotRow | null>(null);
  const [newSlotForm, setNewSlotForm] = useState({
    label: "",
    startHour: 11.0,
    endHour: 12.0,
    sortOrder: 0,
    color: "#06B6D4",
    colorName: "Cyan / Neon Blue",
    remark: ""
  });

  // Blocked Slots State
  const [blockedList, setBlockedList] = useState<BlockedSlotRow[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(true);
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Monday Open / Closed Site Setting
  const [isMondayOpen, setIsMondayOpen] = useState(false);
  const [isTogglingMonday, setIsTogglingMonday] = useState(false);
  const [openedSpecificDates, setOpenedSpecificDates] = useState<string[]>([]);
  const [selectedSpecificMonday, setSelectedSpecificMonday] = useState("");
  const [isUpdatingSpecificDate, setIsUpdatingSpecificDate] = useState(false);

  // Tickets state for per-ticket blocking
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | "ALL">("ALL");

  // Form states for Block
  const [blockType, setBlockType] = useState<'specific_slot' | 'entire_day' | 'slot_all_dates'>('specific_slot');
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Date Generator: Today + Next 60 days
  const [quickDates, setQuickDates] = useState<{ label: string; value: string; isMonday: boolean }[]>([]);

  useEffect(() => {
    const list: { label: string; value: string; isMonday: boolean }[] = [];
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const mStr = MONTH_NAMES[d.getMonth()];
      const dayStr = d.getDate().toString().padStart(2, '0');
      const val = `${mStr} ${dayStr}`;
      const isMon = d.getDay() === 1;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      list.push({
        value: val,
        label: `${val} (${dayName})`,
        isMonday: isMon
      });
    }
    setQuickDates(list);
    if (list.length > 0 && !selectedDate) {
      setSelectedDate(list[0].value);
    }
    // Set default specific Monday dropdown to next upcoming Monday
    const nextMon = list.find(item => item.isMonday);
    if (nextMon) {
      setSelectedSpecificMonday(nextMon.value);
    }
  }, []);

  const loadColorInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const res = await getColorInventoryAction();
      if (res.success && res.data) {
        setColorInventory(res.data);
      }
    } catch (err) {
      console.error("[loadColorInventory Error]", err);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const loadAllData = async () => {
    setIsLoadingSlots(true);
    setIsLoadingBlocked(true);
    try {
      const [slotsData, blockedData, mondayVal, openedDatesList, ticketsData] = await Promise.all([
        fetchTimeSlotsAction(false),
        fetchBlockedSlotsAction(),
        fetchSiteSettingAction('monday_open', '0'),
        fetchOpenedSpecificDatesAction(),
        fetchTicketsAction()
      ]);
      const sortedSlots = [...slotsData].sort((a, b) => (a.sort_order - b.sort_order) || (a.start_hour - b.start_hour));
      setTimeSlots(sortedSlots);
      setBlockedList(blockedData);
      setTickets(ticketsData || []);
      setIsMondayOpen(mondayVal === '1' || mondayVal.toLowerCase() === 'true');
      setOpenedSpecificDates(openedDatesList || []);

      if (sortedSlots.length > 0 && selectedSlots.length === 0) {
        setSelectedSlots([sortedSlots[0].label]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSlots(false);
      setIsLoadingBlocked(false);
    }
    loadColorInventory();
  };

  const handleSyncInventory = async () => {
    setIsSyncingInventory(true);
    try {
      const res = await syncColorInventoryAction();
      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || "Inventory synchronized with slot colours successfully."
        });
        await loadColorInventory();
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to synchronize inventory."
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred during inventory synchronization."
      });
    } finally {
      setIsSyncingInventory(false);
    }
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalItem) return;
    if (stockAmountToAdd <= 0) {
      setFeedback({ type: "error", message: "Please specify a positive quantity to add." });
      return;
    }

    setIsUpdatingStock(true);
    try {
      const res = await updateColorStockAction({
        id: stockModalItem.id,
        addAmount: stockAmountToAdd
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Successfully added +${stockAmountToAdd} to '${stockModalItem.color_name}'. New available quantity is ${res.item?.quantity ?? (stockModalItem.quantity + stockAmountToAdd)}.`
        });
        setStockModalItem(null);
        setStockAmountToAdd(10);
        await loadColorInventory();
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to update stock quantity."
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An error occurred while updating stock."
      });
    } finally {
      setIsUpdatingStock(false);
    }
  };

  const handleStockOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockOutModalItem) return;
    if (stockOutAmount <= 0) {
      setFeedback({ type: "error", message: "Please specify a positive quantity to stock out." });
      return;
    }
    if (stockOutAmount > stockOutModalItem.quantity) {
      setFeedback({ type: "error", message: `Cannot stock out ${stockOutAmount}. Only ${stockOutModalItem.quantity} bands in warehouse stock.` });
      return;
    }

    setIsStockingOut(true);
    try {
      const res = await stockOutColorToReceptionAction({
        id: stockOutModalItem.id,
        amount: stockOutAmount
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Stock Out Recorded: ${stockOutAmount} '${stockOutModalItem.color_name}' bands handed over to Reception! (Reception total: ${res.item?.in_reception ?? (stockOutModalItem.in_reception || 0) + stockOutAmount})`
        });
        setStockOutModalItem(null);
        setStockOutAmount(10);
        await loadColorInventory();
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to record stock out to reception."
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An error occurred while recording stock out."
      });
    } finally {
      setIsStockingOut(false);
    }
  };

  const handleReturnFromReceptionConfirm = async () => {
    if (!returnModalItem) return;

    if (isDirectSetReception) {
      if (directSetTarget < 0) {
        setFeedback({ type: "error", message: "Target reception quantity cannot be negative." });
        return;
      }
      setIsReturningStock(true);
      try {
        const res = await setColorReceptionAction({
          id: returnModalItem.id,
          receptionAmount: directSetTarget,
          returnToWarehouse: true
        });
        if (res.success) {
          setFeedback({
            type: "success",
            message: `Reception Count Set: '${returnModalItem.color_name}' reception is now set to ${directSetTarget}. Warehouse stock adjusted to ${res.item?.quantity ?? 0}.`
          });
          setReturnModalItem(null);
          await loadColorInventory();
        } else {
          setFeedback({ type: "error", message: res.error || "Failed to set reception count." });
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || "An error occurred." });
      } finally {
        setIsReturningStock(false);
      }
      return;
    }

    if (returnAmount <= 0) {
      setFeedback({ type: "error", message: "Please specify a positive quantity to return." });
      return;
    }
    const currentRec = returnModalItem.in_reception || 0;
    if (returnAmount > currentRec) {
      setFeedback({ type: "error", message: `Cannot return ${returnAmount}. Only ${currentRec} recorded at reception.` });
      return;
    }

    setIsReturningStock(true);
    try {
      const res = await returnColorFromReceptionAction({
        id: returnModalItem.id,
        amount: returnAmount
      });
      if (res.success) {
        setFeedback({
          type: "success",
          message: `Returned to Storage: ${returnAmount} '${returnModalItem.color_name}' bands returned to warehouse stock! (Reception now: ${res.item?.in_reception ?? (currentRec - returnAmount)})`
        });
        setReturnModalItem(null);
        setReturnAmount(10);
        await loadColorInventory();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to return bands from reception." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "An error occurred while returning bands." });
    } finally {
      setIsReturningStock(false);
    }
  };

  const handleDeleteInventoryRecordConfirm = async () => {
    if (!itemToDelete) return;
    setIsDeletingRecord(true);
    try {
      const res = await deleteColorInventoryAction(itemToDelete.id);
      if (res.success) {
        setFeedback({
          type: "success",
          message: `Inventory record for '${itemToDelete.color_name}' has been permanently removed.`
        });
        setItemToDelete(null);
        await loadColorInventory();
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to delete inventory record."
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An error occurred while deleting the inventory record."
      });
    } finally {
      setIsDeletingRecord(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Multi-Slot Selection helpers
  const allActiveSlotLabels = timeSlots.filter(s => s.active === 1).map(s => s.label);

  const toggleSlotSelection = (slot: string) => {
    if (blockType === 'slot_all_dates') {
      setSelectedSlots([slot]);
      return;
    }

    setSelectedSlots(prev => {
      if (prev.includes(slot)) {
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== slot);
      } else {
        return [...prev, slot];
      }
    });
  };

  const selectAllSlots = () => {
    setSelectedSlots([...allActiveSlotLabels]);
  };

  const clearToFirstSlot = () => {
    setSelectedSlots(allActiveSlotLabels.length > 0 ? [allActiveSlotLabels[0]] : []);
  };

  // Block Submission
  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBlock(true);
    setFeedback(null);

    let targetDate = selectedDate;

    const targetTicketId = selectedTicketId === "ALL" ? null : Number(selectedTicketId);
    const ticketLabel = targetTicketId 
      ? ` for ${(tickets.find(t => t.id === targetTicketId)?.name || 'Pass').replace(/_/g, ' ')}` 
      : ' for all tickets';

    if (blockType === 'entire_day') {
      if (!targetDate) {
        setFeedback({ type: 'error', message: "Please select a date." });
        setIsSubmittingBlock(false);
        return;
      }
      try {
        const res = await blockSlotOrDateAction(targetDate, 'ALL_DAY', reason, targetTicketId);
        if (res.success) {
          setFeedback({ 
            type: 'success', 
            message: `Successfully blocked entire day for: ${targetDate}${ticketLabel}` 
          });
          setReason("");
          const freshBlocked = await fetchBlockedSlotsAction();
          setBlockedList(freshBlocked);
        } else {
          setFeedback({ type: 'error', message: res.error || "Failed to block date." });
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || "An unexpected error occurred." });
      } finally {
        setIsSubmittingBlock(false);
      }
      return;
    }

    if (blockType === 'slot_all_dates') {
      const slotToBlock = selectedSlots[0] || (timeSlots[0]?.label ?? "11AM-12PM");
      try {
        const res = await blockSlotOrDateAction('ALL', slotToBlock, reason, targetTicketId);
        if (res.success) {
          setFeedback({ 
            type: 'success', 
            message: `Successfully blocked ${slotToBlock} across all dates${ticketLabel}.` 
          });
          setReason("");
          const freshBlocked = await fetchBlockedSlotsAction();
          setBlockedList(freshBlocked);
        } else {
          setFeedback({ type: 'error', message: res.error || "Failed to block slot." });
        }
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || "An unexpected error occurred." });
      } finally {
        setIsSubmittingBlock(false);
      }
      return;
    }

    // specific_slot mode
    if (!targetDate) {
      setFeedback({ type: 'error', message: "Please select a date." });
      setIsSubmittingBlock(false);
      return;
    }

    if (selectedSlots.length === 0) {
      setFeedback({ type: 'error', message: "Please select at least one time slot." });
      setIsSubmittingBlock(false);
      return;
    }

    try {
      const res = await blockMultipleSlotsAction(targetDate, selectedSlots, reason, targetTicketId);
      if (res.success) {
        setFeedback({ 
          type: 'success', 
          message: `Successfully blocked ${selectedSlots.length} slot${selectedSlots.length > 1 ? 's' : ''} on ${targetDate} (${selectedSlots.join(', ')})${ticketLabel}` 
        });
        setReason("");
        const freshBlocked = await fetchBlockedSlotsAction();
        setBlockedList(freshBlocked);
      } else {
        setFeedback({ type: 'error', message: res.error || "Failed to block slots." });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || "An unexpected error occurred." });
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const handleUnblock = async (id: number, label: string) => {
    if (!confirm(`Are you sure you want to unblock "${label}"? Visitors will immediately be able to book this slot again.`)) {
      return;
    }

    try {
      const res = await unblockSlotAction(id);
      if (res.success) {
        setFeedback({ type: 'success', message: `Unblocked "${label}" successfully.` });
        setBlockedList(prev => prev.filter(item => item.id !== id));
      } else {
        setFeedback({ type: 'error', message: res.error || "Failed to unblock slot." });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || "Failed to unblock." });
    }
  };

  // Time Slot Management Handlers
  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotForm.label.trim()) return;

    try {
      const res = await createTimeSlotAction(
        newSlotForm.label.trim(),
        Number(newSlotForm.startHour),
        Number(newSlotForm.endHour),
        Number(newSlotForm.sortOrder),
        newSlotForm.color,
        newSlotForm.colorName,
        newSlotForm.remark
      );
      if (res.success) {
        setFeedback({ type: 'success', message: `Created slot "${newSlotForm.label}" successfully.` });
        setIsAddingSlot(false);
        setNewSlotForm({ label: "", startHour: 11.0, endHour: 12.0, sortOrder: 0, color: "#06B6D4", colorName: "Cyan / Neon Blue", remark: "" });
        const freshSlots = await fetchTimeSlotsAction(false);
        setTimeSlots([...freshSlots].sort((a, b) => (a.sort_order - b.sort_order) || (a.start_hour - b.start_hour)));
      } else {
        setFeedback({ type: 'error', message: res.error || "Failed to create slot." });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || "Error creating slot." });
    }
  };

  const handleUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;

    try {
      const res = await updateTimeSlotAction(
        editingSlot.id,
        editingSlot.label.trim(),
        Number(editingSlot.start_hour),
        Number(editingSlot.end_hour),
        Number(editingSlot.sort_order),
        editingSlot.color || undefined,
        editingSlot.color_name || undefined,
        editingSlot.remark || undefined
      );
      if (res.success) {
        setFeedback({ type: 'success', message: `Updated slot "${editingSlot.label}" successfully.` });
        setEditingSlot(null);
        const freshSlots = await fetchTimeSlotsAction(false);
        setTimeSlots([...freshSlots].sort((a, b) => (a.sort_order - b.sort_order) || (a.start_hour - b.start_hour)));
      } else {
        setFeedback({ type: 'error', message: res.error || "Failed to update slot." });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || "Error updating slot." });
    }
  };

  const handleToggleSlotStatus = async (slot: TimeSlotRow) => {
    const newActive = slot.active === 1 ? false : true;
    try {
      await toggleTimeSlotStatusAction(slot.id, newActive);
      setTimeSlots(prev => prev.map(s => s.id === slot.id ? { ...s, active: newActive ? 1 : 0 } : s));
      setFeedback({ 
        type: 'success', 
        message: `Slot "${slot.label}" is now ${newActive ? 'Active' : 'Disabled globally'}.` 
      });
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || "Failed to toggle slot." });
    }
  };

  const handleDeleteSlot = async (slot: TimeSlotRow) => {
    if (!confirm(`Are you sure you want to permanently delete slot "${slot.label}"?`)) {
      return;
    }

    try {
      const res = await deleteTimeSlotAction(slot.id);
      if (res.success) {
        setFeedback({ type: 'success', message: `Deleted slot "${slot.label}".` });
        setTimeSlots(prev => prev.filter(s => s.id !== slot.id));
      } else {
        setFeedback({ type: 'error', message: res.error || "Failed to delete slot." });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || "Error deleting slot." });
    }
  };

  const filteredBlockedList = blockedList.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.booking_date.toLowerCase().includes(q) ||
      item.time_slot.toLowerCase().includes(q) ||
      (item.ticket_name && item.ticket_name.toLowerCase().includes(q)) ||
      (item.reason && item.reason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[#ff5a1f] mb-1">
            Booking Engine Controls
          </div>
          <h1 className="text-3xl font-heading font-black text-gray-900 flex items-center gap-3">
            <Clock className="w-8 h-8 text-[#ff5a1f]" />
            Slots &amp; Dates Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure hourly operating slots, add new slot times, or temporarily block dates &amp; slots.
          </p>
        </div>

        <button 
          onClick={loadAllData} 
          disabled={isLoadingSlots || isLoadingBlocked}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-bold shadow-sm transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${(isLoadingSlots || isLoadingBlocked) ? 'animate-spin text-[#ff5a1f]' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        <button
          onClick={() => setActiveTab('block_slots')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'block_slots'
              ? 'bg-[#0d1b2a] text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Ban className="w-4 h-4 text-red-400" />
          Block Dates &amp; Slots ({blockedList.length})
        </button>

        <button
          onClick={() => setActiveTab('manage_slots')}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'manage_slots'
              ? 'bg-[#0d1b2a] text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Settings className="w-4 h-4 text-[#ff5a1f]" />
          Configure Hourly Slots ({timeSlots.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('color_inventory');
            loadColorInventory();
          }}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'color_inventory'
              ? 'bg-[#0d1b2a] text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Palette className="w-4 h-4 text-emerald-400" />
          Wristband Colour Inventory ({colorInventory.length})
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-semibold animate-in fade-in duration-200 ${
          feedback.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Monday Operations Control Card (Global Toggle + Specific Date Overrides) */}
      <div className={`p-5 rounded-2xl border transition-all space-y-4 shadow-xs ${
        isMondayOpen 
          ? 'bg-emerald-50/70 border-emerald-200' 
          : 'bg-white border-gray-200'
      }`}>
        {/* Top Bar: Global Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200/80">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isMondayOpen ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Global Monday Status: {isMondayOpen ? "ALL MONDAYS OPEN" : "CLOSED BY DEFAULT"}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isMondayOpen 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-900'
                }`}>
                  {isMondayOpen ? "All Open" : "Closed By Default"}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5">
                {isMondayOpen 
                  ? "Every Monday is currently open for online ticket and simulator bookings."
                  : "Mondays are closed by default across the calendar unless specifically unlocked below."
                }
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isTogglingMonday}
            onClick={async () => {
              const nextVal = !isMondayOpen;
              setIsTogglingMonday(true);
              const res = await updateSiteSettingAction('monday_open', nextVal ? '1' : '0');
              setIsTogglingMonday(false);
              if (res.success) {
                setIsMondayOpen(nextVal);
                setFeedback({ 
                  type: 'success', 
                  message: nextVal ? "All Mondays are now OPEN for bookings!" : "Mondays are now CLOSED by default." 
                });
              } else {
                setFeedback({ type: 'error', message: res.error || "Failed to update Monday status" });
              }
            }}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 ${
              isMondayOpen 
                ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {isTogglingMonday 
              ? "Updating..." 
              : isMondayOpen 
                ? "Switch All Mondays to CLOSED" 
                : "Open ALL Mondays"}
          </button>
        </div>

        {/* Sub-section: Open a Specific Monday */}
        <div className="pt-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <span>🎯 Open Specific Single Monday</span>
              <span className="text-[10px] font-medium text-gray-500 lowercase">(for public holidays or special events)</span>
            </h4>
            <p className="text-xs text-gray-500">
              Need to unlock only one specific Monday without opening all Mondays? Select the date and click Open.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <select
              value={selectedSpecificMonday}
              onChange={(e) => setSelectedSpecificMonday(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f]"
            >
              {quickDates.filter(d => d.isMonday).map(d => (
                <option key={d.value} value={d.value}>
                  {d.label} {openedSpecificDates.includes(d.value) ? "✓ (Already Open)" : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={isUpdatingSpecificDate || !selectedSpecificMonday || openedSpecificDates.includes(selectedSpecificMonday)}
              onClick={async () => {
                if (!selectedSpecificMonday) return;
                setIsUpdatingSpecificDate(true);
                const res = await toggleOpenedSpecificDateAction(selectedSpecificMonday, true);
                setIsUpdatingSpecificDate(false);
                if (res.success && res.dates) {
                  setOpenedSpecificDates(res.dates);
                  setFeedback({
                    type: 'success',
                    message: `Successfully opened Monday: ${selectedSpecificMonday} for bookings!`
                  });
                } else {
                  setFeedback({ type: 'error', message: res.error || "Failed to open date" });
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {isUpdatingSpecificDate ? "Saving..." : "Open This Monday"}
            </button>
          </div>
        </div>

        {/* List of currently opened specific dates */}
        {openedSpecificDates.length > 0 && (
          <div className="pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Specifically Opened Mondays:</span>
            {openedSpecificDates.map(dateStr => (
              <span
                key={dateStr}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
              >
                <span>📅 {dateStr}</span>
                <button
                  type="button"
                  title="Remove override (re-close this Monday)"
                  disabled={isUpdatingSpecificDate}
                  onClick={async () => {
                    setIsUpdatingSpecificDate(true);
                    const res = await toggleOpenedSpecificDateAction(dateStr, false);
                    setIsUpdatingSpecificDate(false);
                    if (res.success && res.dates) {
                      setOpenedSpecificDates(res.dates);
                      setFeedback({
                        type: 'success',
                        message: `Closed specific Monday: ${dateStr}.`
                      });
                    } else {
                      setFeedback({ type: 'error', message: res.error || "Failed to close date" });
                    }
                  }}
                  className="hover:text-red-600 transition-colors ml-0.5 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* TAB 1: BLOCK DATES & SLOTS */}
      {activeTab === 'block_slots' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Block Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100">
                <ShieldAlert className="w-5 h-5 text-[#ff5a1f]" />
                <h2 className="text-lg font-bold text-gray-900">Block / Disable Slot</h2>
              </div>

              <form onSubmit={handleBlockSubmit} className="space-y-5">
                {/* Scope Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    What would you like to block?
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      blockType === 'specific_slot' 
                        ? 'border-[#ff5a1f] bg-[#ff5a1f]/5 ring-1 ring-[#ff5a1f]' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input 
                        type="radio" 
                        name="blockType" 
                        checked={blockType === 'specific_slot'}
                        onChange={() => setBlockType('specific_slot')}
                        className="mt-1 text-[#ff5a1f] focus:ring-[#ff5a1f]"
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Specific Slot(s) on Date</div>
                        <div className="text-xs text-gray-500">Pick any combination of hourly slots</div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      blockType === 'entire_day' 
                        ? 'border-[#ff5a1f] bg-[#ff5a1f]/5 ring-1 ring-[#ff5a1f]' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input 
                        type="radio" 
                        name="blockType" 
                        checked={blockType === 'entire_day'}
                        onChange={() => setBlockType('entire_day')}
                        className="mt-1 text-[#ff5a1f] focus:ring-[#ff5a1f]"
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Entire Day (Close Funzone Date)</div>
                        <div className="text-xs text-gray-500">Locks all slots for that entire date</div>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      blockType === 'slot_all_dates' 
                        ? 'border-[#ff5a1f] bg-[#ff5a1f]/5 ring-1 ring-[#ff5a1f]' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <input 
                        type="radio" 
                        name="blockType" 
                        checked={blockType === 'slot_all_dates'}
                        onChange={() => setBlockType('slot_all_dates')}
                        className="mt-1 text-[#ff5a1f] focus:ring-[#ff5a1f]"
                      />
                      <div>
                        <div className="text-sm font-bold text-gray-900">Recurring Slot Across All Dates</div>
                        <div className="text-xs text-gray-500">Block a specific hour permanently</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Ticket Pass Selector (All Tickets vs Specific Pass) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center justify-between">
                    <span>Applicable Ticket Pass</span>
                    <span className="text-[10px] text-gray-400 font-semibold normal-case">Choose &ldquo;All Passes&rdquo; or a single ticket</span>
                  </label>
                  <select
                    value={selectedTicketId}
                    onChange={(e) => setSelectedTicketId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                  >
                    <option value="ALL">🌐 All Ticket Types (Entire Funzone)</option>
                    {tickets.map(t => (
                      <option key={t.id} value={t.id}>
                        🎟️ {t.name.replace(/_/g, ' ')} (₹{t.price})
                      </option>
                    ))}
                  </select>
                  {selectedTicketId !== "ALL" && (
                    <p className="text-[11px] text-[#ff5a1f] mt-1.5 font-medium">
                      🎯 Only <strong className="font-bold">{(tickets.find(t => t.id === Number(selectedTicketId))?.name || 'this pass').replace(/_/g, ' ')}</strong> will be blocked for this slot. All other ticket passes will remain open.
                    </p>
                  )}
                </div>

                {/* Date Input */}
                {blockType !== 'slot_all_dates' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                      Select Date *
                    </label>
                    <select
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                    >
                      <option value="" disabled>Choose a date</option>
                      {quickDates.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Slot Multi-Select Grid */}
                {blockType !== 'entire_day' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                        {blockType === 'specific_slot' ? "Select Time Slot(s) *" : "Select Time Slot *"}
                      </label>
                      {blockType === 'specific_slot' && allActiveSlotLabels.length > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <button 
                            type="button" 
                            onClick={selectAllSlots}
                            className="font-bold text-[#ff5a1f] hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-gray-300">•</span>
                          <button 
                            type="button" 
                            onClick={clearToFirstSlot}
                            className="text-gray-500 hover:text-gray-700 hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>

                    {blockType === 'specific_slot' ? (
                      <div className="grid grid-cols-3 gap-2 bg-gray-50/80 p-3 rounded-2xl border border-gray-200 max-h-[220px] overflow-y-auto">
                        {allActiveSlotLabels.map((slot) => {
                          const isSelected = selectedSlots.includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => toggleSlotSelection(slot)}
                              className={`p-2.5 rounded-xl text-xs font-bold transition-all border text-center flex flex-col items-center justify-center gap-1 ${
                                isSelected
                                  ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-500/20'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <span>{slot}</span>
                              <span className={`text-[9px] font-semibold uppercase ${isSelected ? 'text-white/90' : 'text-gray-400'}`}>
                                {isSelected ? "Selected" : "Available"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <select
                        value={selectedSlots[0] || (timeSlots[0]?.label ?? "")}
                        onChange={(e) => setSelectedSlots([e.target.value])}
                        required
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      >
                        {allActiveSlotLabels.map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}
                          </option>
                        ))}
                      </select>
                    )}

                    {blockType === 'specific_slot' && (
                      <p className="text-[11px] text-gray-500 mt-2 font-medium">
                        💡 Click on slots to toggle them. You have selected <strong className="text-red-600 font-bold">{selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''}</strong> to block together.
                      </p>
                    )}
                  </div>
                )}

                {/* Reason Note */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Reason / Note (Optional)
                  </label>
                  <input 
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Track cleaning, Private corporate event, Maintenance"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingBlock}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  <Ban className="w-4 h-4" />
                  {isSubmittingBlock ? "BLOCKING..." : "CONFIRM & BLOCK SLOT(S)"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Currently Blocked Slots List */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Currently Blocked Slots ({filteredBlockedList.length})
                  </h2>
                  <p className="text-xs text-gray-500">
                    These slots or dates will display as &ldquo;(Unavailable)&rdquo; on the public booking page.
                  </p>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input 
                    type="text"
                    placeholder="Filter by date or slot..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                  />
                </div>
              </div>

              {isLoadingBlocked ? (
                <div className="py-16 text-center text-gray-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#ff5a1f]" />
                  <p className="text-sm">Loading blocked dates and slots...</p>
                </div>
              ) : filteredBlockedList.length === 0 ? (
                <div className="py-16 text-center text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-base font-bold text-gray-700">No Blocked Slots Found</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    All operating slots are currently open for customer booking. Use the form on the left to disable slots anytime.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {filteredBlockedList.map((item) => {
                    const isAllDay = item.time_slot === 'ALL_DAY';
                    const isAllDates = item.booking_date === 'ALL';

                    return (
                      <div 
                        key={item.id}
                        className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-300 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            {isAllDay ? <Calendar className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-gray-900 text-sm">
                                {isAllDates ? "ALL DATES (Recurring)" : item.booking_date}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isAllDay 
                                  ? 'bg-red-600 text-white' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {isAllDay ? 'ENTIRE DAY BLOCKED' : item.time_slot}
                              </span>
                              {item.ticket_name ? (
                                <span className="px-2 py-0.5 rounded text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                                  🎟️ {item.ticket_name.replace(/_/g, ' ')} Only
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-200 text-gray-700">
                                  🌐 All Passes
                                </span>
                              )}
                            </div>
                            {item.reason && (
                              <p className="text-xs text-gray-600 mt-1 italic">
                                &ldquo;{item.reason}&rdquo;
                              </p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Blocked on {new Date(item.created_at || Date.now()).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUnblock(item.id, `${item.booking_date} - ${item.time_slot}`)}
                          className="px-3 py-1.5 rounded-xl border border-gray-300 hover:border-red-500 hover:bg-red-50 text-gray-700 hover:text-red-600 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 self-end sm:self-center"
                          title="Unblock slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Unblock
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE GLOBAL HOURLY SLOTS */}
      {activeTab === 'manage_slots' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-black font-heading text-gray-900">
                Operating Time Slots ({timeSlots.length})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                These are the baseline hourly time slots that appear on the booking product page for each open date.
              </p>
            </div>

            <button
              onClick={() => setIsAddingSlot(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff5a1f] hover:bg-[#e04812] text-white text-xs font-bold shadow-md transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Add New Slot
            </button>
          </div>

          {/* Add New Slot Modal / Inline Form */}
          {isAddingSlot && (
            <div className="p-6 bg-orange-50/60 border border-orange-200 rounded-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#ff5a1f]" />
                  Create New Operating Slot
                </h3>
                <button onClick={() => setIsAddingSlot(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSlot} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-[#ff5a1f]" />
                      Slot Number / Sequence *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newSlotForm.sortOrder}
                      onChange={(e) => setNewSlotForm({ ...newSlotForm, sortOrder: parseInt(e.target.value, 10) || 0 })}
                      placeholder="e.g. 1, 2, 3..."
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                    />
                    <span className="text-[10px] text-gray-400">Display order sequence</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Slot Label *
                    </label>
                    <input
                      type="text"
                      required
                      value={newSlotForm.label}
                      onChange={(e) => setNewSlotForm({ ...newSlotForm, label: e.target.value })}
                      placeholder="e.g. 8PM-9PM or 10AM-11AM"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                    />
                    <span className="text-[10px] text-gray-400">Display title for customers</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Start Hour (24h) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={newSlotForm.startHour}
                      onChange={(e) => setNewSlotForm({ ...newSlotForm, startHour: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 20 (for 8PM)"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                    />
                    <span className="text-[10px] text-gray-400">Time comparison value</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      End Hour (24h) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={newSlotForm.endHour}
                      onChange={(e) => setNewSlotForm({ ...newSlotForm, endHour: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 21 (for 9PM)"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                    />
                    <span className="text-[10px] text-gray-400">Slot end time</span>
                  </div>
                </div>

                {/* Wristband Color Scheme Picker + MS Paint Custom Color Box */}
                <div className="bg-white/80 p-4 rounded-2xl border border-orange-200/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="text-xs font-bold uppercase text-gray-700 flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-[#ff5a1f]" />
                      Wristband Band Color Scheme &amp; Custom Name
                    </label>

                    {/* MS Paint Custom Color Picker & Color Name Box */}
                    <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2 self-start sm:self-auto">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="newSlotColorPicker"
                          value={newSlotForm.color?.startsWith('#') && newSlotForm.color.length === 7 ? newSlotForm.color : '#06B6D4'}
                          onChange={(e) => {
                            const newHex = e.target.value.toUpperCase();
                            const matchedPreset = WRISTBAND_PALETTE.find(p => p.hex.toUpperCase() === newHex);
                            setNewSlotForm({
                              ...newSlotForm,
                              color: newHex,
                              colorName: matchedPreset ? matchedPreset.name : (newSlotForm.colorName || "Custom Band")
                            });
                          }}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                          title="Click to open MS Paint color palette"
                        />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Paint Box / HEX</span>
                          <input
                            type="text"
                            value={newSlotForm.color || ""}
                            onChange={(e) => setNewSlotForm({ ...newSlotForm, color: e.target.value })}
                            placeholder="#06B6D4"
                            className="font-mono text-xs font-bold text-gray-900 bg-transparent border-0 p-0 focus:ring-0 w-20"
                          />
                        </div>
                      </div>

                      <div className="h-6 w-[1px] bg-gray-200 mx-1 hidden sm:block" />

                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Band Color Name</span>
                        <input
                          type="text"
                          value={newSlotForm.colorName || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const matchedHex = resolveColorNameToHex(val);
                            setNewSlotForm({
                              ...newSlotForm,
                              colorName: val,
                              color: matchedHex ? matchedHex : newSlotForm.color
                            });
                          }}
                          placeholder="e.g. Yellow, Red, Pink"
                          className="text-xs font-bold text-gray-900 bg-transparent border-0 p-0 focus:ring-0 w-32"
                        />
                      </div>

                      <div className="h-6 w-[1px] bg-gray-200 mx-1 hidden sm:block" />

                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-[#ff5a1f] tracking-wider">TYPE / REMARK</span>
                        <input
                          type="text"
                          value={newSlotForm.remark || ""}
                          onChange={(e) => setNewSlotForm({ ...newSlotForm, remark: e.target.value })}
                          placeholder="e.g. VIP, Regular, Rush Hour"
                          className="text-xs font-bold text-gray-900 bg-transparent border-0 p-0 focus:ring-0 w-36"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preset quick colors */}
                  <div className="flex flex-wrap items-center gap-2">
                    {WRISTBAND_PALETTE.map((c) => {
                      const isSelected = (newSlotForm.color || "").toUpperCase() === c.hex.toUpperCase();
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setNewSlotForm({ ...newSlotForm, color: c.hex, colorName: c.name })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            isSelected
                              ? 'ring-2 ring-offset-1 ring-gray-900 border-gray-900 shadow-sm'
                              : 'border-gray-200 hover:border-gray-400 opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.hex + "15" }}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span style={{ color: c.hex }} className="font-bold">
                            {c.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingSlot(false)}
                    className="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-xl font-bold text-xs hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#ff5a1f] hover:bg-[#e04812] text-white py-2 px-5 rounded-xl font-bold text-xs shadow transition-all"
                  >
                    Save Slot
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Edit Slot Modal */}
          {editingSlot && (
            <div className="p-6 bg-blue-50/60 border border-blue-200 rounded-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                  Edit Operating Slot #{editingSlot.sort_order || editingSlot.id}
                </h3>
                <button onClick={() => setEditingSlot(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateSlot} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1 flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-blue-600" />
                      Slot Number / Sequence *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={editingSlot.sort_order || 0}
                      onChange={(e) => setEditingSlot({ ...editingSlot, sort_order: parseInt(e.target.value, 10) || 0 })}
                      placeholder="e.g. 1, 2, 3..."
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-gray-400">Controls order sequence</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Slot Label *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingSlot.label}
                      onChange={(e) => setEditingSlot({ ...editingSlot, label: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-gray-400">Display title for customers</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      Start Hour (24h) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={editingSlot.start_hour}
                      onChange={(e) => setEditingSlot({ ...editingSlot, start_hour: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-gray-400">Time comparison value</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                      End Hour (24h) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={editingSlot.end_hour}
                      onChange={(e) => setEditingSlot({ ...editingSlot, end_hour: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] text-gray-400">Slot end time</span>
                  </div>
                </div>

                {/* Wristband Color Scheme Picker + MS Paint Custom Color Box */}
                <div className="bg-white/80 p-4 rounded-2xl border border-blue-200/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="text-xs font-bold uppercase text-gray-700 flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-blue-600" />
                      Wristband Band Color Scheme &amp; Custom Name
                    </label>

                    {/* MS Paint Custom Color Picker & Color Name Box */}
                    <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2 self-start sm:self-auto">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="editSlotColorPicker"
                          value={editingSlot.color?.startsWith('#') && editingSlot.color.length === 7 ? editingSlot.color : '#06B6D4'}
                          onChange={(e) => {
                            const newHex = e.target.value.toUpperCase();
                            const matchedPreset = WRISTBAND_PALETTE.find(p => p.hex.toUpperCase() === newHex);
                            setEditingSlot({
                              ...editingSlot,
                              color: newHex,
                              color_name: matchedPreset ? matchedPreset.name : (editingSlot.color_name || "Custom Band")
                            });
                          }}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                          title="Click to open MS Paint color palette"
                        />
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Paint Box / HEX</span>
                          <input
                            type="text"
                            value={editingSlot.color || ""}
                            onChange={(e) => setEditingSlot({ ...editingSlot, color: e.target.value })}
                            placeholder="#06B6D4"
                            className="font-mono text-xs font-bold text-gray-900 bg-transparent border-0 p-0 focus:ring-0 w-20"
                          />
                        </div>
                      </div>

                      <div className="h-6 w-[1px] bg-gray-200 mx-1 hidden sm:block" />

                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-gray-400 tracking-wider">Color Nickname / Label</span>
                        <input
                          type="text"
                          value={editingSlot.color_name || ""}
                          onChange={(e) => {
                            setEditingSlot({
                              ...editingSlot,
                              color_name: e.target.value
                            });
                          }}
                          placeholder="e.g. Yellow, Red, Neon Blue"
                          className="text-xs font-bold text-gray-900 bg-transparent border-0 p-0 focus:ring-0 w-36"
                        />
                      </div>

                      <div className="h-6 w-[1px] bg-gray-200 mx-1 hidden sm:block" />

                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-blue-600 tracking-wider">TYPE / REMARK</span>
                        <input
                          type="text"
                          value={editingSlot.remark || ""}
                          onChange={(e) => setEditingSlot({ ...editingSlot, remark: e.target.value })}
                          placeholder="e.g. VIP, Regular, Rush Hour"
                          className="text-xs font-bold text-gray-900 bg-transparent border-0 p-0 focus:ring-0 w-36"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preset quick colors */}
                  <div className="flex flex-wrap items-center gap-2">
                    {WRISTBAND_PALETTE.map((c) => {
                      const isSelected = (editingSlot.color || "").toUpperCase() === c.hex.toUpperCase();
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setEditingSlot({ ...editingSlot, color: c.hex, color_name: c.name })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            isSelected
                              ? 'ring-2 ring-offset-1 ring-gray-900 border-gray-900 shadow-sm'
                              : 'border-gray-200 hover:border-gray-400 opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.hex + "15" }}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span style={{ color: c.hex }} className="font-bold">
                            {c.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingSlot(null)}
                    className="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-xl font-bold text-xs hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-5 rounded-xl font-bold text-xs shadow transition-all"
                  >
                    Update Slot
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Time Slots Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[11px] tracking-wider border-y border-gray-200">
                <tr>
                  <th className="py-3 px-4">Slot #</th>
                  <th className="py-3 px-4">Slot Display Name</th>
                  <th className="py-3 px-4">Wristband Band Color</th>
                  <th className="py-3 px-4">Type / Remark</th>
                  <th className="py-3 px-4">Start Hour</th>
                  <th className="py-3 px-4">End Hour</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {timeSlots.map((slot, index) => {
                  const isActive = slot.active === 1;
                  const band = getSlotWristbandColor(slot.label, slot.color, slot.color_name);
                  const badgeStyle = getWristbandBadgeStyle(band.hex);
                  const displayOrder = slot.sort_order > 0 ? slot.sort_order : index + 1;

                  return (
                    <tr key={slot.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-800 font-black text-xs border border-gray-200">
                          #{displayOrder}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-gray-900 text-sm">
                          {slot.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div 
                          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold shadow-xs"
                          style={{
                            backgroundColor: badgeStyle.backgroundColor,
                            borderColor: badgeStyle.borderColor,
                            color: badgeStyle.color
                          }}
                        >
                          <span 
                            className="w-3.5 h-3.5 rounded-full border shrink-0 shadow-inner"
                            style={{ 
                              backgroundColor: band.hex,
                              borderColor: badgeStyle.dotBorderColor
                            }}
                          />
                          <span className="tracking-wide uppercase text-[11px] font-bold">
                            {band.name}
                          </span>
                          <span className="font-mono text-[10px] opacity-75 ml-0.5">
                            ({band.hex})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {slot.remark ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider bg-orange-50 text-[#ff5a1f] border border-orange-200">
                            {slot.remark}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 text-xs font-medium">
                        {slot.start_hour}:00 ({slot.start_hour >= 12 ? `${slot.start_hour === 12 ? 12 : slot.start_hour - 12}PM` : `${slot.start_hour}AM`})
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 text-xs font-medium">
                        {slot.end_hour}:00 ({slot.end_hour >= 12 ? `${slot.end_hour === 12 ? 12 : slot.end_hour - 12}PM` : `${slot.end_hour}AM`})
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSlotStatus(slot)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingSlot(slot)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all"
                            title="Edit slot"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-300 transition-all"
                            title="Delete slot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: WRISTBAND COLOUR INVENTORY MANAGEMENT (POSTGRESQL) */}
      {activeTab === 'color_inventory' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
          {/* Header & Sync Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  PostgreSQL Persistent
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {colorInventory.length} distinct colour record{colorInventory.length !== 1 ? 's' : ''}
                </span>
              </div>
              <h2 className="text-xl font-black font-heading text-gray-900 mt-1 flex items-center gap-2">
                <Palette className="w-5 h-5 text-emerald-600" />
                Wristband Colour Inventory
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
                Dedicated inventory pool in PostgreSQL for slot colours. Add stock manually or synchronize newly created colours from your hourly slots. Stock quantities are preserved permanently across restarts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={loadColorInventory}
                disabled={isLoadingInventory || isSyncingInventory}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all disabled:opacity-50"
                title="Refresh inventory from PostgreSQL"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInventory ? 'animate-spin text-emerald-600' : ''}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleSyncInventory}
                disabled={isSyncingInventory || isLoadingInventory}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                title="Read slots and create records for newly added colours (initial quantity 0)"
              >
                <Sparkles className={`w-4 h-4 ${isSyncingInventory ? 'animate-spin' : ''}`} />
                {isSyncingInventory ? "Syncing..." : "Sync Inventory"}
              </button>
            </div>
          </div>

          {/* Sync Rules Notice Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <strong className="font-bold text-gray-900">Safe Sync Guarantee:</strong> Syncing reads all slot colours, identifies missing ones, and sets their initial stock to <code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-mono font-bold text-emerald-700">0</code>. Existing stock quantities are never wiped, reset, or duplicated.
              </div>
            </div>
          </div>

          {/* Table of Color Records */}
          {isLoadingInventory ? (
            <div className="py-16 text-center text-gray-400 text-sm font-medium flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              Loading inventory records from PostgreSQL...
            </div>
          ) : colorInventory.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Palette className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900">No Inventory Records in PostgreSQL Yet</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Click &ldquo;Sync Inventory&rdquo; above to read the wristband colours from your operating time slots and initialize persistent inventory records with quantity 0.
              </p>
              <button
                type="button"
                onClick={handleSyncInventory}
                disabled={isSyncingInventory}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all"
              >
                <Sparkles className="w-4 h-4" />
                {isSyncingInventory ? "Syncing..." : "Sync Inventory Now"}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 text-[11px] font-black uppercase text-gray-500 tracking-wider border-b border-gray-100">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Wristband Colour</th>
                    <th className="py-3 px-4">Colour Code (HEX)</th>
                    <th className="py-3 px-4">Configured Slot(s)</th>
                    <th className="py-3 px-4 text-center">Slot Status</th>
                    <th className="py-3 px-4 text-right">Main Stock (Warehouse)</th>
                    <th className="py-3 px-4 text-right">Reception Desk (Given Out)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs font-medium">
                  {colorInventory.map((item, idx) => {
                    const badge = getWristbandBadgeStyle(item.color_hex);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-gray-400">
                          #{idx + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <div 
                            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold shadow-xs"
                            style={{
                              backgroundColor: badge.backgroundColor,
                              borderColor: badge.borderColor,
                              color: badge.color
                            }}
                          >
                            <span 
                              className="w-3.5 h-3.5 rounded-full border shrink-0 shadow-inner"
                              style={{ 
                                backgroundColor: item.color_hex,
                                borderColor: badge.dotBorderColor
                              }}
                            />
                            <span className="tracking-wide uppercase font-bold">
                              {item.color_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-700">
                          {item.color_hex}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.slot_labels && item.slot_labels.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {item.slot_labels.map(lbl => (
                                <span key={lbl} className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 text-[11px] font-bold border border-gray-200">
                                  {lbl}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">No active slots assigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.is_active_in_slots ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3" /> In Use
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Unused
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-xl text-sm font-black font-mono border ${
                            item.quantity > 0 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-xl text-sm font-black font-mono border ${
                            (item.in_reception || 0) > 0 
                              ? 'bg-amber-50 text-amber-800 border-amber-300' 
                              : 'bg-gray-50 text-gray-400 border-gray-200'
                          }`}>
                            {item.in_reception || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setStockModalItem(item);
                                setStockAmountToAdd(10);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all shadow-xs inline-flex items-center gap-1"
                              title="Add stock to this colour"
                            >
                              <Plus className="w-3 h-3" />
                              Add Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setStockOutModalItem(item);
                                setStockOutAmount(Math.min(10, item.quantity > 0 ? item.quantity : 1));
                              }}
                              disabled={item.quantity <= 0}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-[11px] transition-all shadow-xs inline-flex items-center gap-1"
                              title="Stock out bands to Reception desk"
                            >
                              <span>Stock Out</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReturnModalItem(item);
                                setReturnAmount(Math.min(10, (item.in_reception || 0) > 0 ? (item.in_reception || 0) : 1));
                                setDirectSetTarget(0);
                                setIsDirectSetReception(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-all shadow-xs inline-flex items-center gap-1"
                              title="Return bands from Reception to Warehouse or Adjust count"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Return</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemToDelete(item)}
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all ml-1"
                              title="Explicit manual deletion (Admin only)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD STOCK TO COLOUR */}
      {stockModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span 
                  className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-sm"
                  style={{ backgroundColor: stockModalItem.color_hex }}
                />
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    Add Stock: {stockModalItem.color_name}
                  </h3>
                  <span className="text-[11px] font-mono text-gray-400 font-bold">
                    {stockModalItem.color_hex}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockModalItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStockSubmit} className="space-y-5">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-bold">Current Available Quantity:</span>
                <span className="text-lg font-black font-mono text-gray-900">
                  {stockModalItem.quantity}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-2">
                  Quantity to Add (+):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={stockAmountToAdd}
                    onChange={(e) => setStockAmountToAdd(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-base font-black font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex gap-1 shrink-0">
                    {[10, 25, 50, 100].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setStockAmountToAdd(amt)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                          stockAmountToAdd === amt
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                        }`}
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Resulting available quantity will be <strong className="text-emerald-700 font-bold font-mono">{(stockModalItem.quantity || 0) + (stockAmountToAdd || 0)}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStockModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStock}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isUpdatingStock ? "Updating..." : "Save to PostgreSQL"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK OUT TO RECEPTION */}
      {stockOutModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span 
                  className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-sm"
                  style={{ backgroundColor: stockOutModalItem.color_hex }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                      Front Desk Handover
                    </span>
                  </div>
                  <h3 className="text-base font-black text-gray-900 mt-0.5">
                    Stock Out: {stockOutModalItem.color_name}
                  </h3>
                  <span className="text-[11px] font-mono text-gray-400 font-bold">
                    {stockOutModalItem.color_hex}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStockOutModalItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStockOutSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80">
                  <span className="text-[11px] text-gray-500 font-bold block uppercase">Warehouse Stock:</span>
                  <span className="text-lg font-black font-mono text-gray-900">
                    {stockOutModalItem.quantity}
                  </span>
                </div>
                <div className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-200/80">
                  <span className="text-[11px] text-amber-800 font-bold block uppercase">At Reception:</span>
                  <span className="text-lg font-black font-mono text-amber-900">
                    {stockOutModalItem.in_reception || 0}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                  Quantity to Give to Reception:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={stockOutModalItem.quantity}
                    required
                    value={stockOutAmount}
                    onChange={(e) => setStockOutAmount(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-base font-black font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex gap-1 shrink-0">
                    {[5, 10, 25, 50].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        disabled={amt > stockOutModalItem.quantity}
                        onClick={() => setStockOutAmount(amt)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-30 ${
                          stockOutAmount === amt
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-2 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                  ℹ️ This moves <strong className="font-mono font-bold text-amber-800">{stockOutAmount}</strong> wristbands from main warehouse to Reception counter. Remaining warehouse stock will be <strong className="font-mono font-bold">{Math.max(0, stockOutModalItem.quantity - stockOutAmount)}</strong>, and Reception total will be <strong className="font-mono font-bold text-amber-800">{(stockOutModalItem.in_reception || 0) + stockOutAmount}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStockOutModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStockingOut || stockOutAmount <= 0 || stockOutAmount > stockOutModalItem.quantity}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isStockingOut ? "Recording Handover..." : "Confirm Stock Out to Reception"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RETURN FROM RECEPTION / ADJUST RECEPTION COUNT */}
      {returnModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-blue-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span 
                  className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-sm"
                  style={{ backgroundColor: returnModalItem.color_hex }}
                />
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    Reception Return &amp; Adjustment: {returnModalItem.color_name}
                  </h3>
                  <span className="text-[11px] font-mono text-gray-400 font-bold">
                    {returnModalItem.color_hex}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalItem(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setIsDirectSetReception(false)}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  !isDirectSetReception ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Return to Storage
              </button>
              <button
                type="button"
                onClick={() => setIsDirectSetReception(true)}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  isDirectSetReception ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Set / Reset Count
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleReturnFromReceptionConfirm();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200/80">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">Warehouse Stock:</span>
                  <span className="text-lg font-black font-mono text-gray-900">
                    {returnModalItem.quantity}
                  </span>
                </div>
                <div className="bg-blue-50/60 rounded-2xl p-3 border border-blue-200/80">
                  <span className="text-[10px] text-blue-800 font-bold block uppercase">Currently At Reception:</span>
                  <span className="text-lg font-black font-mono text-blue-900">
                    {returnModalItem.in_reception || 0}
                  </span>
                </div>
              </div>

              {!isDirectSetReception ? (
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-2">
                    Quantity to Return to Warehouse:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={returnModalItem.in_reception || 0}
                      required
                      value={returnAmount}
                      onChange={(e) => setReturnAmount(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-base font-black font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[5, 10, 50, (returnModalItem.in_reception || 0)].filter((amt, idx, arr) => amt > 0 && arr.indexOf(amt) === idx).map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setReturnAmount(amt)}
                          className={`px-2 py-2 rounded-xl text-xs font-bold border transition-all ${
                            returnAmount === amt
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                          }`}
                        >
                          {amt === (returnModalItem.in_reception || 0) ? 'All' : amt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 bg-blue-50/60 p-2.5 rounded-xl border border-blue-200">
                    ℹ️ Moves <strong className="font-mono font-bold text-blue-900">{returnAmount}</strong> bands from Reception back to Warehouse Stock.
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
                      value={directSetTarget}
                      onChange={(e) => setDirectSetTarget(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-base font-black font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[0, 10, 50, 100].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDirectSetTarget(amt)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                            directSetTarget === amt
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                          }`}
                        >
                          {amt === 0 ? 'Reset (0)' : amt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2 bg-blue-50/60 p-2.5 rounded-xl border border-blue-200">
                    💡 If 999 or wrong number was entered, setting to <strong className="font-mono font-bold text-blue-900">{directSetTarget}</strong> restores all excess back to Warehouse Stock automatically.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setReturnModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReturningStock}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {isReturningStock ? "Saving..." : isDirectSetReception ? "Set Reception Count" : "Confirm Return to Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXPLICIT MANUAL DELETION CONFIRMATION */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-gray-900">
                Permanently Delete Record?
              </h3>
              <p className="text-xs text-gray-500">
                Are you sure you want to delete the inventory record for <strong className="text-gray-900 font-bold">&ldquo;{itemToDelete.color_name}&rdquo;</strong> ({itemToDelete.color_hex})?
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 text-xs text-red-700 space-y-1">
              <div>• Current stock recorded: <strong className="font-mono font-bold">{itemToDelete.quantity}</strong></div>
              <div>• This will remove the inventory record from PostgreSQL.</div>
              <div>• Existing time slots configured with this colour will NOT be affected.</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteInventoryRecordConfirm}
                disabled={isDeletingRecord}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeletingRecord ? "Deleting..." : "Yes, Delete Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

