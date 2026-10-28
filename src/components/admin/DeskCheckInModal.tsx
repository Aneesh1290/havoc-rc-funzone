"use client";

import { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Phone,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowLeft,
  Send,
  CreditCard,
  Receipt,
  Loader2,
  Calendar,
  Clock,
  Car,
  ChevronRight,
  ChevronDown,
  Info,
  Star,
  Layers,
  UserMinus,
  Trash2,
  Minus,
  Plus,
  Edit3,
} from "lucide-react";
import { getSlotWristbandColor, getWristbandBadgeStyle } from "@/lib/slotColors";

interface DeskCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Trigger reload of bookings table
}

interface SessionBooking {
  id: number;
  order_number: number;
  booking_date: string;
  time_slot: string;
  quantity: number;
  ticket_name: string;
  ticket_price: number;
  total_amount: number;
  payment_status: string;
  fulfillment_status: string;
  payment_ref?: string | null;
  simulator_name?: string | null;
  simulator_slot?: string | null;
  slot_color?: string | null;
  slot_color_name?: string | null;
}

import { 
  COUNTRY_CODES, 
  validatePhoneNumber, 
  getExpectedPhoneDigits, 
  getCountryByDialCode 
} from "@/lib/countries";

export default function DeskCheckInModal({
  isOpen,
  onClose,
  onSuccess,
}: DeskCheckInModalProps) {
  // Stepper: 1 = Phone Lookup, 2 = OTP Entry, 3 = Verification & Payment
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1 State
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundCustomerName, setFoundCustomerName] = useState<string>("");
  const [foundSessions, setFoundSessions] = useState<SessionBooking[]>([]);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [totalDue, setTotalDue] = useState(0);

  // Step 2 State
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [sendOtpError, setSendOtpError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState<string | null>(null);

  // Step 3 State
  const [verifiedSessions, setVerifiedSessions] = useState<SessionBooking[]>([]);
  const [deskTransactionRef, setDeskTransactionRef] = useState("");
  const [deskAmountCollected, setDeskAmountCollected] = useState("");
  const [isCollectingPayment, setIsCollectingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Selective Check-in & Walkout States
  const [activeSessionIds, setActiveSessionIds] = useState<number[]>([]);
  const [isCancelingWalkout, setIsCancelingWalkout] = useState(false);
  const [walkoutNotice, setWalkoutNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Review resend state
  const [isResendingReview, setIsResendingReview] = useState(false);
  const [reviewResendMsg, setReviewResendMsg] = useState<string | null>(null);

  const handleResendReviewWhatsApp = async () => {
    setIsResendingReview(true);
    setReviewResendMsg(null);
    try {
      const res = await fetch("/api/admin/verify/send-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber.trim(),
          customerName: foundCustomerName,
          countryCode: countryCode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReviewResendMsg("Review message sent to customer via WhatsApp!");
        setTimeout(() => setReviewResendMsg(null), 4000);
      } else {
        setReviewResendMsg(data.error || "Failed to send review message.");
        setTimeout(() => setReviewResendMsg(null), 4000);
      }
    } catch (e: any) {
      setReviewResendMsg("Failed to connect to review delivery API.");
      setTimeout(() => setReviewResendMsg(null), 4000);
    } finally {
      setIsResendingReview(false);
    }
  };

  // Refs for auto-focus
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Reset all state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setPhoneNumber("");
      setLookupError(null);
      setFoundCustomerName("");
      setFoundSessions([]);
      setUnpaidCount(0);
      setTotalDue(0);
      setOtpCode("");
      setSendOtpError(null);
      setOtpError(null);
      setOtpSuccessMessage(null);
      setDeskTransactionRef("");
      setDeskAmountCollected("");
      setPaymentError(null);
      setPaymentSuccess(false);

      setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Auto-focus OTP input when reaching step 2
  useEffect(() => {
    if (currentStep === 2) {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
    }
  }, [currentStep]);

  const handleClose = () => {
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  // Dynamic country rule lookup based on current country code
  const selectedCountry = COUNTRY_CODES.find((c) => c.dialCode === countryCode || c.code === countryCode) || COUNTRY_CODES[0];
  const { min: expectedMin, max: expectedMax, placeholder: expectedPlaceholder } = getExpectedPhoneDigits(selectedCountry);

  // Clean phone string (strictly numbers only, capped to selected country's max digits)
  const cleanPhoneInput = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, expectedMax);
    setPhoneNumber(digits);
    setFoundSessions([]);
    setFoundCustomerName("");
    setUnpaidCount(0);
    setTotalDue(0);
    setLookupError(null);
    setSendOtpError(null);
  };

  // Step 1: Handle Phone Lookup
  const handlePhoneLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const check = validatePhoneNumber(phoneNumber, selectedCountry);
    if (!check.valid) {
      setLookupError(check.error || "Please enter a valid mobile number.");
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setSendOtpError(null);

    try {
      const res = await fetch("/api/admin/verify/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, countryCode }),
      });

      const data = await res.json();

      if (!res.ok || !data.found) {
        setLookupError(data.error || "No active bookings found for today.");
        setFoundSessions([]);
        setFoundCustomerName("");
        return;
      }

      setFoundCustomerName(data.customer_name || "Guest Customer");
      const list = data.bookings || [];
      setFoundSessions(list);
      setActiveSessionIds(list.map((s: SessionBooking) => s.id));
      setUnpaidCount(data.unpaid_count || 0);
      setTotalDue(data.total_due || 0);
    } catch (err: any) {
      console.error("Lookup error:", err);
      setLookupError("Network error while searching bookings. Please retry.");
    } finally {
      setIsLookingUp(false);
    }
  };

  // Step 1 -> Step 2: Generate & Send OTP
  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    setOtpError(null);
    setSendOtpError(null);

    try {
      const res = await fetch("/api/admin/verify/generate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, countryCode }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSendOtpError(data.error || "Failed to dispatch verification code.");
        return;
      }

      setOtpSuccessMessage(data.message || "OTP code sent via WhatsApp.");
      setCurrentStep(2);
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setSendOtpError("Network error sending OTP. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Confirm OTP
  const handleConfirmOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanOtp = otpCode.trim();

    if (cleanOtp.length !== 4) {
      setOtpError("Please enter the complete 4-digit OTP.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    try {
      const res = await fetch("/api/admin/verify/confirm-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, countryCode, otp: cleanOtp }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setOtpError(data.error || "Invalid or expired OTP. Please check the code.");
        return;
      }

      // Step 2 successful! Update state and move to Step 3
      const vList = data.bookings || [];
      setVerifiedSessions(vList);
      setActiveSessionIds(vList.map((s: SessionBooking) => s.id));
      setTotalDue(data.total_due || 0);
      setUnpaidCount(data.unpaid_count || 0);
      setCurrentStep(3);

      // Trigger background reload so dashboard stays fresh
      onSuccess();
    } catch (err: any) {
      console.error("Confirm OTP error:", err);
      setOtpError("Verification failed due to network error.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Step 3: Handle Desk Payment Collection & Fulfillment
  const handleCollectAndFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredAmount = Number(deskAmountCollected);

    if (!deskTransactionRef.trim()) {
      setPaymentError("Please enter a Transaction Ref / Note (e.g. UPI Ref, Cash, POS slip).");
      return;
    }

    const effectiveDue = getComputedTotalDue(verifiedSessions);

    if (isNaN(enteredAmount) || enteredAmount !== effectiveDue) {
      setPaymentError(`Collected amount must equal exactly ₹${effectiveDue.toLocaleString("en-IN")}.`);
      return;
    }

    setIsCollectingPayment(true);
    setPaymentError(null);

    try {
      // Find all active unpaid order IDs in verified sessions
      const unpaidIds = verifiedSessions
        .filter((s) => activeSessionIds.includes(s.id) && (s.payment_status || "").toLowerCase() !== "paid")
        .map((s) => s.id);

      const res = await fetch("/api/admin/verify/collect-and-fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: unpaidIds,
          amount_collected: enteredAmount,
          transaction_ref: deskTransactionRef.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setPaymentError(data.error || "Failed to record payment.");
        return;
      }

      setPaymentSuccess(true);
      // Mark all sessions locally as Paid & Fulfilled
      setVerifiedSessions((prev) =>
        prev.map((s) => ({
          ...s,
          payment_status: "Paid",
          fulfillment_status: "Fulfilled",
          payment_ref: deskTransactionRef.trim(),
        }))
      );
      setTotalDue(0);
      setUnpaidCount(0);

      // Refresh admin bookings table
      onSuccess();
    } catch (err: any) {
      console.error("Payment collection error:", err);
      setPaymentError("Network error while recording payment.");
    } finally {
      setIsCollectingPayment(false);
    }
  };

  // Toggle active/interested status for an individual session
  const toggleSessionActive = (sessionId: number) => {
    setActiveSessionIds((prev) => {
      const isCurrentlyActive = prev.includes(sessionId);
      const next = isCurrentlyActive ? prev.filter((id) => id !== sessionId) : [...prev, sessionId];
      return next;
    });
  };

  // Compute dynamic total due based only on active/checked sessions
  const getComputedTotalDue = (sessions: SessionBooking[]) => {
    return sessions
      .filter((s) => activeSessionIds.includes(s.id) && (s.payment_status || "").toLowerCase() !== "paid")
      .reduce((sum, s) => sum + s.total_amount, 0);
  };

  // Handler: Drop 1 participant from a multi-quantity ticket (e.g. 1 of 4 backed out)
  const handleReduceParticipant = async (sessionId: number) => {
    const list = currentStep === 3 ? verifiedSessions : foundSessions;
    const session = list.find((s) => s.id === sessionId);
    if (!session) return;

    const currentQty = session.quantity;
    if (currentQty <= 1) {
      // If only 1, standard walkout / cancellation
      return handleCancelWalkout([sessionId], "Player Backed Out at Desk");
    }

    const confirmMsg = `Remove 1 player from "${session.ticket_name}" (Current: ${currentQty} → New: ${currentQty - 1})?\nThis will adjust the amount due immediately.`;
    if (!confirm(confirmMsg)) return;

    await executeQuantityAdjustment(sessionId, currentQty - 1, `Removed 1 player from ${session.ticket_name}`);
  };

  // Handler: Add 1 player back to the ticket (e.g. player changed mind or arrived late)
  const handleIncreaseParticipant = async (sessionId: number) => {
    const list = currentStep === 3 ? verifiedSessions : foundSessions;
    const session = list.find((s) => s.id === sessionId);
    if (!session) return;

    const currentQty = session.quantity;
    const newQty = currentQty + 1;
    await executeQuantityAdjustment(sessionId, newQty, `Added 1 player back to ${session.ticket_name}`);
  };

  // Handler: Set exact participant count (e.g. remove 2, 3, or set to specific number)
  const handleCustomParticipantCount = async (sessionId: number) => {
    const list = currentStep === 3 ? verifiedSessions : foundSessions;
    const session = list.find((s) => s.id === sessionId);
    if (!session) return;

    const currentQty = session.quantity;
    const input = prompt(
      `Set number of playing participants for "${session.ticket_name}":\n(Current: ${currentQty})\nEnter 0 to cancel this session entirely.`,
      String(currentQty)
    );
    if (input === null) return; // User cancelled prompt

    const parsed = parseInt(input.trim(), 10);
    if (isNaN(parsed) || parsed < 0) {
      alert("Please enter a valid number of players (0 or greater).");
      return;
    }

    if (parsed === currentQty) return;

    if (parsed === 0) {
      return handleCancelWalkout([sessionId], "All Players Backed Out at Desk");
    }

    await executeQuantityAdjustment(sessionId, parsed, `Adjusted ${session.ticket_name} to ${parsed} players`);
  };

  // Helper executing API call and state sync
  const executeQuantityAdjustment = async (sessionId: number, targetQty: number, actionDescription: string) => {
    setIsCancelingWalkout(true);
    setWalkoutNotice(null);

    try {
      const res = await fetch("/api/admin/verify/cancel-walkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: [sessionId],
          target_quantity: targetQty,
          reason: actionDescription,
          release_slots: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setWalkoutNotice({ type: "error", message: data.error || "Failed to adjust player count." });
        return;
      }

      setWalkoutNotice({
        type: "success",
        message: `${actionDescription}. Updated quantity: ${data.new_quantity}.`,
      });

      // Update state in both Step 1 or Step 3
      const updater = (prev: SessionBooking[]) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          if (data.canceled) {
            return { ...s, fulfillment_status: "Canceled", quantity: 0, total_amount: 0 };
          }
          return {
            ...s,
            quantity: data.new_quantity,
            total_amount: data.new_total,
            fulfillment_status: s.fulfillment_status === "Canceled" ? "Unfulfilled" : s.fulfillment_status,
          };
        });

      if (currentStep === 3) {
        setVerifiedSessions(updater);
      } else {
        setFoundSessions(updater);
      }

      // Ensure active session IDs includes this session if quantity > 0
      if (targetQty > 0) {
        setActiveSessionIds((prev) => (prev.includes(sessionId) ? prev : [...prev, sessionId]));
      } else {
        setActiveSessionIds((prev) => prev.filter((id) => id !== sessionId));
      }

      onSuccess();
    } catch (err: any) {
      console.error("Execute quantity adjustment error:", err);
      setWalkoutNotice({ type: "error", message: "Network error while updating participant count." });
    } finally {
      setIsCancelingWalkout(false);
    }
  };

  // Handler: Customer Walkout / Not Interested (Single or All)
  const handleCancelWalkout = async (targetSessionIds?: number[], reasonText = "Customer Not Interested / Walkout") => {
    const idsToCancel = targetSessionIds && targetSessionIds.length > 0 
      ? targetSessionIds 
      : (currentStep === 3 ? verifiedSessions.map((s) => s.id) : foundSessions.map((s) => s.id));

    if (idsToCancel.length === 0) return;

    const isFull = idsToCancel.length === (currentStep === 3 ? verifiedSessions.length : foundSessions.length);
    const confirmMsg = isFull
      ? `Release ALL ${idsToCancel.length} session(s) as 'Not Interested / Walkout'? This will free up the slot for walk-in players immediately.`
      : `Mark this player as 'Not Interested / Backed Out' and release their slot?`;

    if (!confirm(confirmMsg)) return;

    setIsCancelingWalkout(true);
    setWalkoutNotice(null);

    try {
      const res = await fetch("/api/admin/verify/cancel-walkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: idsToCancel,
          reason: reasonText,
          release_slots: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setWalkoutNotice({ type: "error", message: data.error || "Failed to cancel sessions." });
        return;
      }

      setWalkoutNotice({
        type: "success",
        message: isFull
          ? "All sessions canceled and slots released successfully."
          : `Selected session canceled and slot released.`,
      });

      // Update local sessions
      if (currentStep === 3) {
        setVerifiedSessions((prev) =>
          prev.map((s) =>
            idsToCancel.includes(s.id) ? { ...s, fulfillment_status: "Canceled" } : s
          )
        );
      } else {
        setFoundSessions((prev) =>
          prev.map((s) =>
            idsToCancel.includes(s.id) ? { ...s, fulfillment_status: "Canceled" } : s
          )
        );
      }

      setActiveSessionIds((prev) => prev.filter((id) => !idsToCancel.includes(id)));

      // If all were canceled, trigger success reload and offer to close
      if (isFull) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Cancel walkout error:", err);
      setWalkoutNotice({ type: "error", message: "Network error while releasing slots." });
    } finally {
      setIsCancelingWalkout(false);
    }
  };

  // Format currency
  const formatInr = (amt: number) => `₹${amt.toLocaleString("en-IN")}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white text-gray-900 border border-gray-200 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Top Accent Orange/Gold Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-[#ff5a1f] to-emerald-500" />

        {/* Modal Header */}
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shadow-sm text-amber-700">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                  Reception Desk
                </span>
                <span className="text-[11px] text-gray-500 font-medium">Havoc RC Fun Zone</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-heading text-gray-900 tracking-tight mt-0.5">
                Customer Desk Check-In & Verification
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-5 sm:px-7 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between text-xs font-semibold">
          <div
            className={`flex items-center gap-2 ${
              currentStep === 1
                ? "text-amber-800 font-bold"
                : currentStep > 1
                ? "text-emerald-700 font-bold"
                : "text-gray-400"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 1
                  ? "bg-amber-500 text-white shadow-sm"
                  : currentStep > 1
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {currentStep > 1 ? "✓" : "1"}
            </div>
            <span>1. Phone Lookup</span>
          </div>

          <div className="w-8 sm:w-16 h-0.5 bg-gray-200" />

          <div
            className={`flex items-center gap-2 ${
              currentStep === 2
                ? "text-amber-800 font-bold"
                : currentStep > 2
                ? "text-emerald-700 font-bold"
                : "text-gray-400"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 2
                  ? "bg-amber-500 text-white shadow-sm"
                  : currentStep > 2
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {currentStep > 2 ? "✓" : "2"}
            </div>
            <span>2. WhatsApp OTP</span>
          </div>

          <div className="w-8 sm:w-16 h-0.5 bg-gray-200" />

          <div
            className={`flex items-center gap-2 ${
              currentStep === 3 ? "text-emerald-700 font-bold" : "text-gray-400"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 3 ? "bg-emerald-600 text-white shadow-sm" : "bg-gray-200 text-gray-500"
              }`}
            >
              3
            </div>
            <span>3. Check-In & Payment</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 max-h-[75vh] overflow-y-auto bg-white">
          {/* ========================================================================= */}
          {/* STEP 1: PHONE LOOKUP                                                      */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gray-700 mb-2">
                  Customer Mobile Number
                </label>
                <form onSubmit={handlePhoneLookup} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <div className="flex-1 flex rounded-xl border border-gray-300 bg-white focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 shadow-sm transition-all overflow-hidden">
                    <div className="relative flex items-center bg-gray-50/90 border-r border-gray-200 px-3 hover:bg-gray-100 transition-colors shrink-0 cursor-pointer">
                      <div className="flex items-center gap-1.5 pointer-events-none select-none">
                        <span className="text-base leading-none">{selectedCountry.flag}</span>
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold font-mono tracking-wider bg-gray-200/80 text-gray-700 uppercase">
                          {selectedCountry.code}
                        </span>
                        <span className="font-mono font-bold text-sm text-gray-900 tracking-tight">
                          {selectedCountry.dialCode}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <select
                        value={countryCode}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          setCountryCode(newCode);
                          setPhoneNumber(""); // Reset on country change to prevent invalid length
                          setFoundSessions([]);
                          setFoundCustomerName("");
                          setUnpaidCount(0);
                          setTotalDue(0);
                          setLookupError(null);
                          setSendOtpError(null);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
                        title="Select Country Code"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.dialCode} className="text-gray-900 font-sans font-medium">
                            {c.flag} {c.code} ({c.dialCode}) — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 flex flex-col justify-center px-3.5 py-1.5">
                      <input
                        ref={phoneInputRef}
                        type="tel"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={(e) => cleanPhoneInput(e.target.value)}
                        placeholder={`e.g. ${expectedPlaceholder}`}
                        maxLength={expectedMax}
                        className="w-full bg-white text-gray-900 font-mono font-bold text-base sm:text-lg focus:outline-none placeholder:text-gray-400"
                      />
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>
                          {expectedMin === expectedMax
                            ? `Requires ${expectedMin} digits`
                            : `${expectedMin}–${expectedMax} digits`}
                        </span>
                        <span className={phoneNumber.length === expectedMax ? "text-emerald-600 font-bold" : ""}>
                          {phoneNumber.length} / {expectedMax}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLookingUp || phoneNumber.length < expectedMin}
                    className="px-4 sm:px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white active:scale-[0.98] transition-all shadow-md shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap self-stretch sm:self-auto"
                  >
                    {isLookingUp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4 text-white" />
                        <span>Verify Customer Number</span>
                      </>
                    )}
                  </button>
                </form>
                <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span>Strict filter: Only displays sessions scheduled for <strong>TODAY</strong>.</span>
                </p>
              </div>

              {/* Error Message Alert */}
              {lookupError && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold text-red-900">No Eligible Bookings Found</strong>
                    <span className="text-red-800/90 leading-relaxed">{lookupError}</span>
                  </div>
                </div>
              )}

              {/* Result Preview (Customer Found) */}
              {foundSessions.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {/* Customer Meta Banner */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs uppercase font-mono font-bold tracking-wider text-emerald-700">
                          Active Customer Found
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                        {foundCustomerName}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        {countryCode} {phoneNumber} • {foundSessions.length} Session(s) Scheduled Today
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {unpaidCount > 0 ? (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-900 text-xs font-semibold">
                          Desk Pay Due: <strong className="font-mono text-amber-950 ml-1">{formatInr(totalDue)}</strong>
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-xs font-semibold">
                          All Sessions Paid Online
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Walkout Notification Banner */}
                  {walkoutNotice && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in ${
                        walkoutNotice.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-red-50 text-red-800 border-red-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {walkoutNotice.type === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span>{walkoutNotice.message}</span>
                      </div>
                      <button onClick={() => setWalkoutNotice(null)} className="text-gray-400 hover:text-gray-700">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Sessions List with Check-In Toggles & Single Walkout */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase font-bold tracking-wider text-gray-600 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Today&apos;s Booked Vehicles &amp; Slots</span>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {activeSessionIds.length} of {foundSessions.length} playing
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Group sessions by time slot so sessions are neat & clean */}
                      {Array.from(new Set(foundSessions.map((s) => s.time_slot))).map((slotTime) => {
                        const slotSessions = foundSessions.filter((s) => s.time_slot === slotTime);
                        const firstSession = slotSessions[0];
                        const slotWristband = getSlotWristbandColor(slotTime, firstSession.slot_color, firstSession.slot_color_name);
                        const slotBadgeStyle = getWristbandBadgeStyle(slotWristband.hex);

                        return (
                          <div key={slotTime} className="rounded-2xl border border-gray-200/90 bg-gray-50/50 p-3 sm:p-3.5 space-y-2.5">
                            {/* Slot Group Header */}
                            <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/70">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-gray-900 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{slotTime}</span>
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-xs" style={slotBadgeStyle}>
                                  {slotWristband.name} Wristband
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-gray-500">
                                {slotSessions.reduce((sum, s) => sum + (s.fulfillment_status === "Canceled" ? 0 : s.quantity), 0)} Player(s)
                              </span>
                            </div>

                            {/* Sessions for this slot */}
                            <div className="space-y-2">
                              {slotSessions.map((session) => {
                                const isPaid = (session.payment_status || "").toLowerCase() === "paid";
                                const isCanceled = (session.fulfillment_status || "").toLowerCase() === "canceled";
                                const isFulfilled =
                                  (session.fulfillment_status || "").toUpperCase() === "ATTENDED" ||
                                  (session.fulfillment_status || "").toLowerCase() === "fulfilled";
                                const isSelected = activeSessionIds.includes(session.id) && !isCanceled;

                                return (
                                  <div
                                    key={session.id}
                                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 transition-all ${
                                      isCanceled
                                        ? "bg-red-50/40 border-red-200 opacity-60"
                                        : isSelected
                                        ? "bg-white border-gray-200 shadow-sm"
                                        : "bg-gray-100/60 border-gray-200/80 opacity-75"
                                    }`}
                                  >
                                    <div className="flex items-start sm:items-center gap-2.5">
                                      {/* Checkbox for partial participation */}
                                      {!isCanceled && (
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleSessionActive(session.id)}
                                          className="w-4 h-4 mt-1 sm:mt-0 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                                          title="Check if this player is attending"
                                        />
                                      )}

                                      <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
                                        <Car className="w-3.5 h-3.5 text-amber-700" />
                                      </div>

                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`font-bold text-sm ${isCanceled ? "line-through text-gray-500" : "text-gray-900"}`}>
                                            {session.ticket_name}
                                          </span>
                                          <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                            × {session.quantity}
                                          </span>
                                          {session.order_number && (
                                            <span className="text-[10px] text-gray-400 font-mono">
                                              #FZ_{session.order_number}
                                            </span>
                                          )}
                                        </div>
                                        {session.simulator_name && (
                                          <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                                            {session.simulator_name} ({session.simulator_slot || "Auto"})
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                      <span className={`font-mono font-bold text-sm ${isCanceled ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                        {formatInr(session.total_amount)}
                                      </span>

                                      {/* Payment Badge */}
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                          isPaid
                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                            : "bg-amber-50 text-amber-700 border border-amber-200"
                                        }`}
                                      >
                                        {isPaid ? "PAID" : "UNPAID"}
                                      </span>

                                      {/* Status Badge */}
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                          isCanceled
                                            ? "bg-red-50 text-red-700 border border-red-200"
                                            : isFulfilled
                                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                                            : "bg-gray-100 text-gray-600 border border-gray-200"
                                        }`}
                                      >
                                        {isCanceled ? "CANCELED" : isFulfilled ? "ATTENDED" : "UNFULFILLED"}
                                      </span>

                                      {/* Per-ticket Actions: Stepper (- / +), Custom Count & Release Slot */}
                                      {!isCanceled && (
                                        <div className="flex items-center gap-1.5 ml-1">
                                          {/* Stepper Pill */}
                                          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
                                            <button
                                              type="button"
                                              onClick={() => handleReduceParticipant(session.id)}
                                              disabled={isCancelingWalkout}
                                              className="px-2 py-1 text-gray-600 hover:text-amber-700 hover:bg-amber-100 transition-colors flex items-center justify-center disabled:opacity-40"
                                              title={session.quantity > 1 ? `Remove 1 player (-1)` : `Cancel this session`}
                                            >
                                              <Minus className="w-3 h-3" />
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleCustomParticipantCount(session.id)}
                                              disabled={isCancelingWalkout}
                                              className="px-2 py-1 text-[11px] font-mono font-bold text-gray-800 hover:bg-gray-200 transition-colors border-x border-gray-200 flex items-center gap-1"
                                              title="Click to enter exact player count or remove multiple"
                                            >
                                              <span>{session.quantity}</span>
                                              <Edit3 className="w-2.5 h-2.5 text-gray-400" />
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleIncreaseParticipant(session.id)}
                                              disabled={isCancelingWalkout}
                                              className="px-2 py-1 text-gray-600 hover:text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center justify-center disabled:opacity-40"
                                              title="Add 1 player back (+1)"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </button>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => handleCancelWalkout([session.id], "Player Backed Out at Desk")}
                                            disabled={isCancelingWalkout}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            title="Release entire slot / backed out"
                                          >
                                            <UserMinus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Bar: Send OTP vs Full Walkout Cancellation */}
                  <div className="pt-2 space-y-2.5">
                    {sendOtpError && (
                      <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <strong className="block font-bold text-red-900">WhatsApp Delivery Failed:</strong>
                          <span className="text-red-700 break-words">{sendOtpError}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <button
                        type="button"
                        disabled={isSendingOtp || activeSessionIds.length === 0}
                        onClick={handleSendOtp}
                        className="w-full sm:flex-1 py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {isSendingOtp ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Generating OTP...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 text-white" />
                            <span>Send OTP for {activeSessionIds.length} Playing Player(s)</span>
                          </>
                        )}
                      </button>

                      {/* Full Walkout Cancellation Button */}
                      <button
                        type="button"
                        disabled={isCancelingWalkout || foundSessions.every((s) => s.fulfillment_status === "Canceled")}
                        onClick={() => handleCancelWalkout(undefined, "Customer Not Interested / Entire Group Walkout")}
                        className="w-full sm:w-auto px-4 py-3.5 rounded-xl font-bold text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        title="Customer changed mind / not playing: release slot and cancel booking"
                      >
                        <UserMinus className="w-4 h-4" />
                        <span>Customer Not Interested (Release Slot)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: OTP ENTRY                                                         */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Top Banner showing target phone */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-center">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-700 font-bold block mb-1">
                  WhatsApp Verification
                </span>
                <p className="text-sm text-gray-600">
                  Enter the 4-digit verification code sent to customer:
                </p>
                <div className="text-lg font-mono font-black text-gray-900 mt-1">
                  {countryCode} {phoneNumber}
                </div>
              </div>

              {/* 4-Digit OTP Input Form */}
              <form onSubmit={handleConfirmOtp} className="space-y-5">
                <div>
                  <label className="block text-center text-xs uppercase tracking-wider font-bold text-gray-600 mb-2">
                    4-Digit Verification Code
                  </label>
                  <div className="max-w-xs mx-auto">
                    <input
                      ref={otpInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={otpCode}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        if (digits.length <= 4) {
                          setOtpCode(digits);
                          setOtpError(null);
                        }
                      }}
                      placeholder="• • • •"
                      className="w-full bg-white text-gray-900 font-mono font-bold text-3xl sm:text-4xl text-center py-4 rounded-2xl border-2 border-gray-300 focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-500/15 tracking-[0.4em] sm:tracking-[0.6em] transition-all placeholder:text-gray-300 shadow-sm"
                    />
                  </div>
                </div>

                {otpError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                {/* Buttons: Change Number vs Confirm & Check-In */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(1);
                      setOtpCode("");
                      setOtpError(null);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>← Change Number</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isVerifyingOtp || otpCode.length !== 4}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>✓ Verify & Check-In</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: VERIFICATION RESULT & PAYMENT COLLECTION                           */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Success Header */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 mt-0.5 text-emerald-700">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      OTP Confirmed
                    </span>
                    <span className="text-xs text-emerald-800 font-mono">
                      {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">
                    Customer Verified ✅
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5 font-medium">
                    {foundCustomerName} • {countryCode} {phoneNumber}
                  </p>
                  <p className="text-xs text-emerald-700 mt-1 font-semibold">
                    ✓ Online-paid sessions automatically marked as ATTENDED.
                  </p>
                </div>
              </div>

              {/* Google Review WhatsApp Message Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-amber-950 font-medium">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                  <span>Google Review request sent to customer via WhatsApp!</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {reviewResendMsg && (
                    <span className="text-[11px] font-semibold text-emerald-700 animate-in fade-in">
                      {reviewResendMsg}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleResendReviewWhatsApp}
                    disabled={isResendingReview}
                    className="px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs transition-colors disabled:opacity-50"
                  >
                    {isResendingReview ? "Sending..." : "Resend Review Link"}
                  </button>
                </div>
              </div>

              {/* Walkout Notification Banner in Step 3 */}
              {walkoutNotice && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in ${
                    walkoutNotice.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {walkoutNotice.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                    <span>{walkoutNotice.message}</span>
                  </div>
                  <button onClick={() => setWalkoutNotice(null)} className="text-gray-400 hover:text-gray-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Verified Sessions Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase font-bold tracking-wider text-gray-600 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-amber-600" />
                    <span>Verified Sessions Status</span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-mono">
                    {verifiedSessions.filter((s) => activeSessionIds.includes(s.id) && s.fulfillment_status !== "Canceled").length} of {verifiedSessions.length} playing
                  </span>
                </div>

                <div className="space-y-4">
                  {Array.from(new Set(verifiedSessions.map((s) => s.time_slot))).map((slotTime) => {
                    const slotSessions = verifiedSessions.filter((s) => s.time_slot === slotTime);
                    const firstSession = slotSessions[0];
                    const slotWristband = getSlotWristbandColor(slotTime, firstSession.slot_color, firstSession.slot_color_name);
                    const slotBadgeStyle = getWristbandBadgeStyle(slotWristband.hex);

                    return (
                      <div key={slotTime} className="rounded-2xl border border-gray-200/90 bg-gray-50/50 p-3 sm:p-3.5 space-y-2.5">
                        {/* Slot Group Header */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-gray-200/70">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-gray-900 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>{slotTime}</span>
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-xs" style={slotBadgeStyle}>
                              {slotWristband.name} Wristband
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-gray-500">
                            {slotSessions.reduce((sum, s) => sum + (s.fulfillment_status === "Canceled" ? 0 : s.quantity), 0)} Player(s)
                          </span>
                        </div>

                        {/* Sessions for this slot */}
                        <div className="space-y-2">
                          {slotSessions.map((session) => {
                            const isPaid = (session.payment_status || "").toLowerCase() === "paid";
                            const isCanceled = (session.fulfillment_status || "").toLowerCase() === "canceled";
                            const isFulfilled =
                              (session.fulfillment_status || "").toUpperCase() === "ATTENDED" ||
                              (session.fulfillment_status || "").toLowerCase() === "fulfilled";
                            const isSelected = activeSessionIds.includes(session.id) && !isCanceled;

                            return (
                              <div
                                key={session.id}
                                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs transition-all ${
                                  isCanceled
                                    ? "bg-red-50/40 border-red-200 opacity-60"
                                    : isSelected
                                    ? "bg-white border-gray-200 shadow-sm"
                                    : "bg-gray-100/60 border-gray-200/80 opacity-75"
                                }`}
                              >
                                <div className="flex items-start sm:items-center gap-2.5">
                                  {/* Attending Checkbox */}
                                  {!isCanceled && !isPaid && (
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSessionActive(session.id)}
                                      className="w-4 h-4 mt-0.5 sm:mt-0 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                                      title="Check if this player is playing and paying"
                                    />
                                  )}

                                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
                                    <Car className="w-3.5 h-3.5 text-amber-700" />
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`font-bold ${isCanceled ? "line-through text-gray-400" : "text-gray-900"}`}>
                                        {session.ticket_name}
                                      </span>
                                      <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                        × {session.quantity}
                                      </span>
                                      {session.order_number && (
                                        <span className="text-[10px] text-gray-400 font-mono">
                                          #FZ_{session.order_number}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                                      {session.payment_ref ? `Ref: ${session.payment_ref}` : ""}
                                      {session.simulator_name ? ` • ${session.simulator_name} (${session.simulator_slot || "Auto"})` : ""}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2">
                                  <span className={`font-mono font-bold ${isCanceled ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                    {formatInr(session.total_amount)}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      isPaid
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}
                                  >
                                    {isPaid ? "PAID" : "UNPAID"}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      isCanceled
                                        ? "bg-red-50 text-red-700 border border-red-200"
                                        : isFulfilled
                                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                                        : "bg-gray-100 text-gray-600 border border-gray-200"
                                    }`}
                                  >
                                    {isCanceled ? "CANCELED" : isFulfilled ? "ATTENDED" : "UNFULFILLED"}
                                  </span>

                                  {/* Individual Walkout / Participant Reduction button */}
                                  {!isCanceled && (
                                    <div className="flex items-center gap-1.5 ml-1">
                                      {/* Stepper Pill */}
                                      <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
                                        <button
                                          type="button"
                                          onClick={() => handleReduceParticipant(session.id)}
                                          disabled={isCancelingWalkout}
                                          className="px-2 py-1 text-gray-600 hover:text-amber-700 hover:bg-amber-100 transition-colors flex items-center justify-center disabled:opacity-40"
                                          title={session.quantity > 1 ? `Remove 1 player (-1)` : `Cancel this session`}
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleCustomParticipantCount(session.id)}
                                          disabled={isCancelingWalkout}
                                          className="px-2 py-1 text-[11px] font-mono font-bold text-gray-800 hover:bg-gray-200 transition-colors border-x border-gray-200 flex items-center gap-1"
                                          title="Click to enter exact player count or remove multiple"
                                        >
                                          <span>{session.quantity}</span>
                                          <Edit3 className="w-2.5 h-2.5 text-gray-400" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleIncreaseParticipant(session.id)}
                                          disabled={isCancelingWalkout}
                                          className="px-2 py-1 text-gray-600 hover:text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center justify-center disabled:opacity-40"
                                          title="Add 1 player back (+1)"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleCancelWalkout([session.id], "Player Backed Out at Desk")}
                                        disabled={isCancelingWalkout}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        title="Player not interested / backed out (Release slot)"
                                      >
                                        <UserMinus className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Due calculation */}
              {(() => {
                const effectiveDue = getComputedTotalDue(verifiedSessions);
                const hasPendingDue = effectiveDue > 0;

                if (!hasPendingDue && !paymentSuccess) {
                  return (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-emerald-900 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>All selected active sessions are paid &amp; cleared for track entry!</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCancelWalkout(undefined, "Customer Changed Mind / Full Group Walkout")}
                          disabled={isCancelingWalkout}
                          className="px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-100 bg-red-50 border border-red-200 font-bold text-xs transition-colors"
                        >
                          Cancel All / Walkout
                        </button>
                      </div>
                    </div>
                  );
                }

                if (hasPendingDue && !paymentSuccess) {
                  return (
                    <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border-2 border-amber-300 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-amber-200">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-amber-700" />
                          <div>
                            <h4 className="text-sm sm:text-base font-bold text-gray-900">
                              Desk Payment Collection Required
                            </h4>
                            <p className="text-xs text-amber-800">
                              Customer has unpaid / pay-at-desk sessions today.
                            </p>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[11px] uppercase tracking-wider font-mono text-amber-800 font-bold block">
                            Total Due ({verifiedSessions.filter((s) => activeSessionIds.includes(s.id) && (s.payment_status || "").toLowerCase() !== "paid").length} Player(s))
                          </span>
                          <span className="text-xl sm:text-2xl font-mono font-black text-amber-900">
                            {formatInr(effectiveDue)}
                          </span>
                        </div>
                      </div>

                      <form onSubmit={handleCollectAndFulfill} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          {/* Input 1: Transaction Ref / Note */}
                          <div>
                            <label className="block text-xs uppercase tracking-wider font-bold text-gray-700 mb-1.5">
                              Transaction Ref / Note <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={deskTransactionRef}
                              onChange={(e) => setDeskTransactionRef(e.target.value)}
                              placeholder="e.g. UPI Ref / Cash / POS Slip #"
                              className="w-full bg-white text-gray-900 font-medium text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-gray-400 shadow-sm"
                            />
                            <span className="text-[10px] text-gray-500 mt-1 block">
                              Required for audit reconciliation.
                            </span>
                          </div>

                          {/* Input 2: Amount Collected */}
                          <div>
                            <label className="block text-xs uppercase tracking-wider font-bold text-gray-700 mb-1.5">
                              Amount Collected (₹) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              required
                              value={deskAmountCollected}
                              onChange={(e) => setDeskAmountCollected(e.target.value)}
                              placeholder={String(effectiveDue)}
                              className="w-full bg-white text-gray-900 font-mono font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-gray-400 shadow-sm"
                            />
                            <div className="text-[10px] mt-1">
                              {deskAmountCollected === "" ? (
                                <span className="text-gray-500">
                                  Must exactly match {formatInr(effectiveDue)}.
                                </span>
                              ) : Number(deskAmountCollected) === effectiveDue ? (
                                <span className="text-emerald-700 font-semibold">
                                  ✓ Exact match! Ready to confirm.
                                </span>
                              ) : (
                                <span className="text-red-600 font-semibold">
                                  ⚠️ Amount must equal {formatInr(effectiveDue)} (Diff: {formatInr(Math.abs(Number(deskAmountCollected) - effectiveDue))})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {paymentError && (
                          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <span>{paymentError}</span>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <button
                            type="submit"
                            disabled={
                              isCollectingPayment ||
                              !deskTransactionRef.trim() ||
                              Number(deskAmountCollected) !== effectiveDue
                            }
                            className="w-full sm:flex-1 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white active:scale-[0.99] transition-all shadow-md shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isCollectingPayment ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Fulfilling &amp; Recording Payment...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-white" />
                                <span>Confirm &amp; Mark as Paid &amp; Fulfilled ({formatInr(effectiveDue)})</span>
                              </>
                            )}
                          </button>

                          {/* Step 3 Full Walkout Option */}
                          <button
                            type="button"
                            disabled={isCancelingWalkout}
                            onClick={() => handleCancelWalkout(undefined, "Customer Decided Not to Play After Verification")}
                            className="w-full sm:w-auto px-4 py-3 sm:py-3.5 rounded-xl font-bold text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                            title="Release remaining slots and cancel booking"
                          >
                            <UserMinus className="w-4 h-4" />
                            <span>Release Slots (Walkout)</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                }

                return (
                  /* All Paid / Attended Banner */
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-300">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-gray-900">
                      Track Entry Authorized! 🎉
                    </h4>
                    <p className="text-xs text-gray-600 max-w-md mx-auto">
                      All selected sessions for this customer are verified, fully paid, and marked ATTENDED in the system. Customer is cleared to receive wristbands and enter the track.
                    </p>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                      <a
                        href="/admin/bands"
                        target="_blank"
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#ff5a1f] text-white hover:bg-[#e04812] transition-colors shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Layers className="w-4 h-4" />
                        <span>Issue Wristbands in Inventory →</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleClose}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Done / Close Modal
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-7 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Havoc RC Fun Zone Desk Verification Engine</span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-800 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
