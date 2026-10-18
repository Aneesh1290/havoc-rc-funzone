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
  Search
} from "lucide-react";
import { 
  fetchBlockedSlotsAction, 
  blockSlotOrDateAction, 
  unblockSlotAction 
} from "@/app/actions/tickets";
import type { BlockedSlotRow } from "@/lib/db";

const ALL_TIME_SLOTS = [
  "11AM-12PM",
  "12PM-1PM",
  "1PM-2PM",
  "2PM-3PM",
  "3PM-4PM",
  "4PM-5PM",
  "5PM-6PM",
  "6PM-7PM",
  "7PM-8PM"
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function BlockedSlotsPage() {
  const [blockedList, setBlockedList] = useState<BlockedSlotRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form states
  const [blockType, setBlockType] = useState<'specific_slot' | 'entire_day' | 'slot_all_dates'>('specific_slot');
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(ALL_TIME_SLOTS[0]);
  const [reason, setReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Date Generator: Today + Next 60 days
  const [quickDates, setQuickDates] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    const list: { label: string; value: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const mStr = MONTH_NAMES[d.getMonth()];
      const dayStr = d.getDate().toString().padStart(2, '0');
      const val = `${mStr} ${dayStr}`;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      list.push({
        value: val,
        label: `${val} (${dayName})`
      });
    }
    setQuickDates(list);
    if (list.length > 0 && !selectedDate) {
      setSelectedDate(list[0].value);
    }
  }, []);

  const loadBlockedSlots = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBlockedSlotsAction();
      setBlockedList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBlockedSlots();
  }, []);

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    let targetDate = selectedDate;
    let targetSlot = selectedSlot;

    if (blockType === 'entire_day') {
      targetSlot = 'ALL_DAY';
    } else if (blockType === 'slot_all_dates') {
      targetDate = 'ALL';
    }

    if (!targetDate) {
      setFeedback({ type: 'error', message: "Please select a date." });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await blockSlotOrDateAction(targetDate, targetSlot, reason);
      if (res.success) {
        setFeedback({ 
          type: 'success', 
          message: `Successfully blocked: ${targetDate} • ${targetSlot === 'ALL_DAY' ? 'Entire Day' : targetSlot}` 
        });
        setReason("");
        await loadBlockedSlots();
      } else {
        setFeedback({ type: 'error', message: res.error || "Failed to block slot." });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
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

  const filteredList = blockedList.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.booking_date.toLowerCase().includes(q) ||
      item.time_slot.toLowerCase().includes(q) ||
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
            <Ban className="w-8 h-8 text-red-500" />
            Disable Slots &amp; Dates
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manually lock dates or specific hourly slots for maintenance, track private events, or VIP arena buyouts.
          </p>
        </div>

        <button 
          onClick={loadBlockedSlots} 
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-bold shadow-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#ff5a1f]' : ''}`} />
          Refresh
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

      {/* Main Grid: Form on Left, List on Right */}
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
                      <div className="text-sm font-bold text-gray-900">Specific Slot on Specific Date</div>
                      <div className="text-xs text-gray-500">e.g. Oct 18 from 3PM-4PM only</div>
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
                      <div className="text-xs text-gray-500">Locks all 9 hourly slots for that day</div>
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
                      <div className="text-xs text-gray-500">e.g. permanently block 11AM-12PM for arena setup</div>
                    </div>
                  </label>
                </div>
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

              {/* Slot Input */}
              {blockType !== 'entire_day' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Select Time Slot *
                  </label>
                  <select
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                  >
                    {ALL_TIME_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reason / Internal Note */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Reason / Note (Optional)
                </label>
                <input 
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Track cleaning, Private corporate event, Pit maintenance"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                <Ban className="w-4 h-4" />
                {isSubmitting ? "BLOCKING..." : "CONFIRM & BLOCK SLOT"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Currently Blocked Slots */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Currently Blocked Slots ({filteredList.length})
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

            {isLoading ? (
              <div className="py-16 text-center text-gray-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#ff5a1f]" />
                <p className="text-sm">Loading blocked dates and slots...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-16 text-center text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-base font-bold text-gray-700">No Blocked Slots Found</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  All dates and times are currently open for normal public reservations. Use the form on the left to disable any slot when needed.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredList.map((item) => {
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
    </div>
  );
}
