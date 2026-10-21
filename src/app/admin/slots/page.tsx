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
  Check
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
import type { BlockedSlotRow, TimeSlotRow, TicketRow } from "@/lib/db";
import { WRISTBAND_PALETTE, getSlotWristbandColor, resolveColorNameToHex, getWristbandBadgeStyle } from "@/lib/slotColors";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function SlotsManagementPage() {
  const [activeTab, setActiveTab] = useState<'block_slots' | 'manage_slots'>('block_slots');

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
    </div>
  );
}
