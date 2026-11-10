"use client";

import { useState, useEffect } from "react";
import { 
  BellRing, 
  X, 
  Loader2, 
  Send, 
  Check, 
  Search, 
  Calendar, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/order-utils";

interface Candidate {
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  timeSlot: string;
  totalAmount: number;
  sessionCount: number;
  bookingIds: number[];
  itemsSummary: string;
  advanceNotifiedAt: string | null;
}

interface AdvanceNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function getBookingDayLabel(bookingDate: string): { isToday: boolean; label: string } {
  if (!bookingDate) return { isToday: false, label: "" };
  const now = new Date();
  const istDateStr = now.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });
  const todayIST = new Date(istDateStr);
  todayIST.setHours(0, 0, 0, 0);

  const year = todayIST.getFullYear();
  let d: Date;
  if (/^\d{4}-\d{2}-\d{2}/.test(bookingDate.trim())) {
    d = new Date(bookingDate.trim());
  } else {
    d = new Date(`${bookingDate.trim()}, ${year}`);
    if (isNaN(d.getTime())) d = new Date(bookingDate.trim());
  }

  if (isNaN(d.getTime())) return { isToday: false, label: bookingDate };
  d.setHours(0, 0, 0, 0);

  const isToday = d.getTime() === todayIST.getTime();
  return { isToday, label: isToday ? `Today (${bookingDate})` : bookingDate };
}

export default function AdvanceNotificationsModal({
  isOpen,
  onClose,
  onSuccess
}: AdvanceNotificationsModalProps) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [hoursBefore, setHoursBefore] = useState<number>(24);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [sendingIds, setSendingIds] = useState<number[]>([]);
  const [isBulkSending, setIsBulkSending] = useState<boolean>(false);
  const [resultNotice, setResultNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadCandidates = async () => {
    setIsLoading(true);
    setResultNotice(null);
    try {
      const res = await fetch("/api/admin/advance-notifications");
      const data = await res.json();
      if (data.success) {
        setIsEnabled(data.enabled !== false);
        setHoursBefore(data.hours_before || 24);
        setCandidates(data.candidates || []);
      }
    } catch (err: any) {
      console.error("Failed to load advance candidates:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCandidates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendSingle = async (candidate: Candidate) => {
    setSendingIds(prev => [...prev, candidate.orderNumber]);
    setResultNotice(null);

    try {
      const res = await fetch("/api/admin/advance-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_numbers: [candidate.orderNumber],
          booking_ids: candidate.bookingIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResultNotice({
          type: "success",
          message: `Advance payment notification sent to ${candidate.customerName} (${candidate.customerPhone}).`,
        });

        // Update local candidate state
        setCandidates(prev => prev.map(c => 
          c.orderNumber === candidate.orderNumber
            ? { ...c, advanceNotifiedAt: new Date().toISOString() }
            : c
        ));

        if (onSuccess) onSuccess();
      } else {
        setResultNotice({
          type: "error",
          message: data.error || "Failed to send notification.",
        });
      }
    } catch (err: any) {
      setResultNotice({
        type: "error",
        message: err.message || "Network error while sending notification.",
      });
    } finally {
      setSendingIds(prev => prev.filter(id => id !== candidate.orderNumber));
    }
  };

  const handleSendBulk = async () => {
    const unnotified = candidates.filter(c => !c.advanceNotifiedAt);
    if (unnotified.length === 0) return;

    if (!confirm(`Send advance WhatsApp payment links to all ${unnotified.length} pending customer(s)?`)) {
      return;
    }

    setIsBulkSending(true);
    setResultNotice(null);

    try {
      const res = await fetch("/api/admin/advance-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_numbers: unnotified.map(c => c.orderNumber),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResultNotice({
          type: "success",
          message: data.message || `Successfully dispatched ${data.sent_count || unnotified.length} notifications.`,
        });

        // Mark all as notified in local state
        const notifiedOrderNums = new Set(unnotified.map(c => c.orderNumber));
        setCandidates(prev => prev.map(c => 
          notifiedOrderNums.has(c.orderNumber)
            ? { ...c, advanceNotifiedAt: new Date().toISOString() }
            : c
        ));

        if (onSuccess) onSuccess();
      } else {
        setResultNotice({
          type: "error",
          message: data.error || "Failed to dispatch bulk notifications.",
        });
      }
    } catch (err: any) {
      setResultNotice({
        type: "error",
        message: err.message || "Network error during bulk dispatch.",
      });
    } finally {
      setIsBulkSending(false);
    }
  };

  const filteredCandidates = candidates.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.customerName.toLowerCase().includes(q) ||
      c.customerPhone.toLowerCase().includes(q) ||
      String(c.orderNumber).includes(q) ||
      c.bookingDate.toLowerCase().includes(q) ||
      c.itemsSummary.toLowerCase().includes(q)
    );
  });

  const pendingCount = candidates.filter(c => !c.advanceNotifiedAt).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between gap-4 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-white">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
              <BellRing className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                  Advance Booking Notifications
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide border ${
                  isEnabled 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-gray-100 text-gray-500 border-gray-300"
                }`}>
                  {isEnabled ? "Feature Active" : "Feature Disabled"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Send WhatsApp reminder with online payment link to prior bookings before arrival.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadCandidates}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              title="Refresh candidate list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature Disabled Notice */}
        {!isEnabled && (
          <div className="p-4 mx-6 mt-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Feature Disabled:</strong> Advance booking notifications are currently turned off in Settings. You can enable them anytime.
              </span>
            </div>
            <Link
              href="/admin/settings"
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shrink-0 transition-colors shadow-xs"
              onClick={onClose}
            >
              Open Settings
            </Link>
          </div>
        )}

        {/* Notice Banner */}
        {resultNotice && (
          <div className={`p-3.5 mx-6 mt-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            resultNotice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <span>{resultNotice.message}</span>
            <button onClick={() => setResultNotice(null)} className="p-0.5 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Controls Bar: Search & Bulk Action */}
        <div className="p-4 sm:p-6 pb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, phone, order #..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {pendingCount > 0 && isEnabled && (
              <button
                type="button"
                onClick={handleSendBulk}
                disabled={isBulkSending}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-blue-600/20 transition-all disabled:opacity-50"
              >
                {isBulkSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Bulk...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send All Pending ({pendingCount})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Candidates List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Finding advance prior bookings...</span>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-16 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
              <p className="text-sm font-bold text-gray-600">No prior bookings eligible for advance notification</p>
              <p className="text-xs text-gray-400 mt-1">
                All upcoming bookings are either already paid or there are currently no unpaid bookings.
              </p>
            </div>
          ) : (
            filteredCandidates.map((candidate) => {
              const isSending = sendingIds.includes(candidate.orderNumber);
              const isNotified = Boolean(candidate.advanceNotifiedAt);

              return (
                <div
                  key={candidate.orderNumber}
                  className={`p-4 rounded-2xl border transition-all ${
                    isNotified 
                      ? "bg-gray-50/60 border-gray-200" 
                      : "bg-white border-blue-200 shadow-xs hover:border-blue-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                          #PAYDUE_FZ_{candidate.orderNumber}
                        </span>
                        <strong className="text-sm text-gray-900 font-extrabold truncate">
                          {candidate.customerName}
                        </strong>
                        <span className="text-xs font-semibold text-gray-500 font-mono">
                          {candidate.customerPhone}
                        </span>

                        {isNotified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-teal-50 text-teal-700 border border-teal-200">
                            <Check className="w-3 h-3 text-teal-600" />
                            <span>Notified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                            <span>Pending Link</span>
                          </span>
                        )}
                      </div>

                      {(() => {
                        const dayInfo = getBookingDayLabel(candidate.bookingDate);
                        return (
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                            <span className={`inline-flex items-center gap-1.5 ${dayInfo.isToday ? 'px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-extrabold border border-blue-200' : 'font-semibold'}`}>
                              <Calendar className={`w-3.5 h-3.5 ${dayInfo.isToday ? 'text-blue-600' : 'text-gray-400'}`} />
                              <span>{dayInfo.label}</span>
                            </span>
                            <span className="flex items-center gap-1 font-semibold">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              <span>{candidate.timeSlot}</span>
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500 truncate max-w-xs" title={candidate.itemsSummary}>
                              {candidate.itemsSummary}
                            </span>
                          </div>
                        );
                      })()}

                      {isNotified && candidate.advanceNotifiedAt && (
                        <p className="text-[11px] text-teal-700 font-medium">
                          Last notified on {formatDateTime(candidate.advanceNotifiedAt)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase text-gray-400">Amount Due</div>
                        <div className="text-sm font-black text-gray-900">
                          ₹{candidate.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSendSingle(candidate)}
                        disabled={isSending || isBulkSending || !isEnabled}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs active:scale-95 disabled:opacity-50 ${
                          isNotified
                            ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                        }`}
                        title={isNotified ? "Re-send payment link" : "Send advance payment link via WhatsApp"}
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            <span>{isNotified ? "Resend Link" : "Send Link"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            Showing <strong className="text-gray-700 font-bold">{filteredCandidates.length}</strong> prior booking candidate(s)
            {pendingCount > 0 && (
              <span> • <strong className="text-amber-700 font-bold">{pendingCount}</strong> pending notification</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-100 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

