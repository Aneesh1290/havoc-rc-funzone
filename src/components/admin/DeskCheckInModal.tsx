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
  Sparkles,
  Car,
  ChevronRight,
  Info,
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

export default function DeskCheckInModal({
  isOpen,
  onClose,
  onSuccess,
}: DeskCheckInModalProps) {
  // Stepper: 1 = Phone Lookup, 2 = OTP Entry, 3 = Verification & Payment
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1 State
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
  const [otpError, setOtpError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState<string | null>(null);

  // Step 3 State
  const [verifiedSessions, setVerifiedSessions] = useState<SessionBooking[]>([]);
  const [deskTransactionRef, setDeskTransactionRef] = useState("");
  const [deskAmountCollected, setDeskAmountCollected] = useState("");
  const [isCollectingPayment, setIsCollectingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

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
      setOtpError(null);
      setDevOtp(null);
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

  if (!isOpen) return null;

  // Clean phone string (10 digits only)
  const cleanPhoneInput = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length <= 10) {
      setPhoneNumber(digits);
      setLookupError(null);
    }
  };

  // Step 1: Handle Phone Lookup
  const handlePhoneLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phoneNumber.length !== 10) {
      setLookupError("Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);

    try {
      const res = await fetch("/api/admin/verify/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber }),
      });

      const data = await res.json();

      if (!res.ok || !data.found) {
        setLookupError(data.error || "No active bookings found for today.");
        setFoundSessions([]);
        setFoundCustomerName("");
        return;
      }

      setFoundCustomerName(data.customer_name || "Guest Customer");
      setFoundSessions(data.bookings || []);
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
    setDevOtp(null);

    try {
      const res = await fetch("/api/admin/verify/generate-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setOtpError(data.error || "Failed to dispatch verification code.");
        return;
      }

      if (data.dev_otp) {
        setDevOtp(data.dev_otp);
      }
      setOtpSuccessMessage(data.message || "OTP code sent via WhatsApp.");
      setCurrentStep(2);
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setOtpError("Network error sending OTP. Please try again.");
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
        body: JSON.stringify({ phone: phoneNumber, otp: cleanOtp }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setOtpError(data.error || "Invalid or expired OTP. Please check the code.");
        return;
      }

      // Step 2 successful! Update state and move to Step 3
      setVerifiedSessions(data.bookings || []);
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

    if (isNaN(enteredAmount) || enteredAmount !== totalDue) {
      setPaymentError(`Collected amount must equal exactly ₹${totalDue.toLocaleString("en-IN")}.`);
      return;
    }

    setIsCollectingPayment(true);
    setPaymentError(null);

    try {
      // Find all unpaid order IDs in verified sessions
      const unpaidIds = verifiedSessions
        .filter((s) => (s.payment_status || "").toLowerCase() !== "paid")
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
      // Mark all sessions locally as Paid & ATTENDED
      setVerifiedSessions((prev) =>
        prev.map((s) => ({
          ...s,
          payment_status: "Paid",
          fulfillment_status: "ATTENDED",
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

  // Format currency
  const formatInr = (amt: number) => `₹${amt.toLocaleString("en-IN")}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#1c1d26] text-white border border-[#2e3144] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Top Accent Gold/Orange Glow Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#e5b869] via-[#ff5a1f] to-[#10B981]" />

        {/* Modal Header */}
        <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-[#2a2c3d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#e5b869]/20 to-[#ff5a1f]/20 border border-[#e5b869]/40 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-[#e5b869]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#e5b869]/15 text-[#e5b869] border border-[#e5b869]/30 uppercase">
                  Reception Desk
                </span>
                <span className="text-[11px] text-gray-400 font-medium">Havoc RC Fun Zone</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-heading text-white tracking-tight mt-0.5">
                Customer Desk Check-In & Verification
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-5 sm:px-7 py-3 bg-[#161720] border-b border-[#2a2c3d] flex items-center justify-between text-xs font-semibold">
          <div
            className={`flex items-center gap-2 ${
              currentStep === 1
                ? "text-[#e5b869]"
                : currentStep > 1
                ? "text-emerald-400"
                : "text-gray-500"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 1
                  ? "bg-[#e5b869] text-black"
                  : currentStep > 1
                  ? "bg-emerald-500 text-black"
                  : "bg-gray-800 text-gray-400"
              }`}
            >
              {currentStep > 1 ? "✓" : "1"}
            </div>
            <span>1. Phone Lookup</span>
          </div>

          <div className="w-8 sm:w-16 h-0.5 bg-[#2a2c3d]" />

          <div
            className={`flex items-center gap-2 ${
              currentStep === 2
                ? "text-[#e5b869]"
                : currentStep > 2
                ? "text-emerald-400"
                : "text-gray-500"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 2
                  ? "bg-[#e5b869] text-black"
                  : currentStep > 2
                  ? "bg-emerald-500 text-black"
                  : "bg-gray-800 text-gray-400"
              }`}
            >
              {currentStep > 2 ? "✓" : "2"}
            </div>
            <span>2. WhatsApp OTP</span>
          </div>

          <div className="w-8 sm:w-16 h-0.5 bg-[#2a2c3d]" />

          <div
            className={`flex items-center gap-2 ${
              currentStep === 3 ? "text-emerald-400" : "text-gray-500"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 3 ? "bg-emerald-500 text-black" : "bg-gray-800 text-gray-400"
              }`}
            >
              3
            </div>
            <span>3. Check-In & Payment</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 max-h-[75vh] overflow-y-auto">
          {/* ========================================================================= */}
          {/* STEP 1: PHONE LOOKUP                                                      */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-gray-300 mb-2">
                  Customer Mobile Number
                </label>
                <form onSubmit={handlePhoneLookup} className="flex gap-2 sm:gap-3">
                  <div className="relative flex-1">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-gray-300 pointer-events-none border-r border-[#3a3d52] pr-2.5">
                      <span className="text-base">🇮🇳</span>
                      <span className="font-mono font-bold text-sm text-white">+91</span>
                    </div>
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      inputMode="numeric"
                      value={phoneNumber}
                      onChange={(e) => cleanPhoneInput(e.target.value)}
                      placeholder="98765 43210"
                      maxLength={10}
                      className="w-full bg-[#12131a] text-white font-mono font-bold text-base sm:text-lg pl-24 pr-4 py-3 rounded-xl border border-[#34374a] focus:border-[#e5b869] focus:outline-none focus:ring-2 focus:ring-[#e5b869]/20 transition-all placeholder:text-gray-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLookingUp || phoneNumber.length !== 10}
                    className="px-4 sm:px-6 py-3 rounded-xl font-semibold text-xs sm:text-sm bg-gradient-to-r from-[#e5b869] to-[#d4a34b] text-black hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-[#e5b869]/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {isLookingUp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Phone className="w-4 h-4 text-black" />
                        <span>Verify Customer Number</span>
                      </>
                    )}
                  </button>
                </form>
                <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-[#e5b869]" />
                  <span>Strict filter: Only displays sessions scheduled for <strong>TODAY</strong>.</span>
                </p>
              </div>

              {/* Error Message Alert */}
              {lookupError && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold text-red-300">No Eligible Bookings Found</strong>
                    <span className="text-red-200/90 leading-relaxed">{lookupError}</span>
                  </div>
                </div>
              )}

              {/* Result Preview (Customer Found) */}
              {foundSessions.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-[#2a2c3d] animate-in fade-in slide-in-from-bottom-2 duration-200">
                  {/* Customer Meta Banner */}
                  <div className="p-4 rounded-2xl bg-[#14151e] border border-[#2a2d3f] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs uppercase font-mono font-bold tracking-wider text-emerald-400">
                          Active Customer Found
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                        {foundCustomerName}
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        +91 {phoneNumber} • {foundSessions.length} Session(s) Scheduled Today
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {unpaidCount > 0 ? (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                          Desk Pay Due: <strong className="font-mono text-white ml-1">{formatInr(totalDue)}</strong>
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                          All Sessions Paid Online
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sessions List */}
                  <div className="space-y-2.5">
                    <div className="text-xs uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#e5b869]" />
                      <span>Today&apos;s Booked Vehicles & Slots</span>
                    </div>

                    <div className="space-y-2">
                      {foundSessions.map((session) => {
                        const isPaid = (session.payment_status || "").toLowerCase() === "paid";
                        const isFulfilled =
                          (session.fulfillment_status || "").toUpperCase() === "ATTENDED" ||
                          (session.fulfillment_status || "").toLowerCase() === "fulfilled";

                        // Get wristband styling
                        const wristband = getSlotWristbandColor(session.time_slot, session.slot_color, session.slot_color_name);
                        const bandStyle = getWristbandBadgeStyle(wristband.hex);

                        return (
                          <div
                            key={session.id}
                            className="p-3 sm:p-3.5 rounded-xl bg-[#12131b] border border-[#2a2c3d] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 hover:border-[#3d4057] transition-colors"
                          >
                            <div className="flex items-start sm:items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-[#1f212f] border border-[#34374a] flex items-center justify-center shrink-0">
                                <Car className="w-4 h-4 text-[#e5b869]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm text-white">
                                    {session.ticket_name}
                                  </span>
                                  <span className="text-xs text-gray-400 font-mono">
                                    x {session.quantity}
                                  </span>
                                  {/* Wristband badge */}
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
                                    style={bandStyle}
                                  >
                                    {wristband.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mt-0.5">
                                  <span className="text-gray-300 font-semibold">{session.time_slot}</span>
                                  {session.simulator_name && (
                                    <>
                                      <span>•</span>
                                      <span className="text-[#e5b869]">
                                        {session.simulator_name} ({session.simulator_slot || "Auto"})
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                              <span className="font-mono font-bold text-sm text-white">
                                {formatInr(session.total_amount)}
                              </span>

                              {/* Payment Badge */}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  isPaid
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                }`}
                              >
                                {isPaid ? "PAID" : "UNPAID"}
                              </span>

                              {/* Fulfillment Badge */}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  isFulfilled
                                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                    : "bg-gray-800 text-gray-400 border border-gray-700"
                                }`}
                              >
                                {isFulfilled ? "ATTENDED" : "UNFULFILLED"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Send WhatsApp OTP Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={isSendingOtp}
                      onClick={handleSendOtp}
                      className="w-full py-3.5 sm:py-4 rounded-xl font-bold text-sm sm:text-base bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
                    >
                      {isSendingOtp ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-black" />
                          <span>Generating WhatsApp OTP...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 text-black" />
                          <span>📲 Customer Found — Send WhatsApp OTP</span>
                        </>
                      )}
                    </button>
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
              {/* Dev Test Banner (if dev_otp is provided or in dev mode) */}
              {devOtp && (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg shadow-amber-900/10">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-amber-300">
                        🧪 Development Testing Mode Active
                      </strong>
                      <span className="text-amber-200/90 text-xs">
                        WhatsApp API key is not configured in .env. Use generated code below:
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-black px-3 py-1 bg-amber-400 text-black rounded-lg tracking-widest shadow">
                      {devOtp}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtpCode(devOtp)}
                      className="text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors whitespace-nowrap"
                    >
                      Auto-fill
                    </button>
                  </div>
                </div>
              )}

              {/* Top Banner showing target phone */}
              <div className="p-4 rounded-2xl bg-[#14151f] border border-[#2a2d3f] text-center">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold block mb-1">
                  WhatsApp Verification
                </span>
                <p className="text-sm text-gray-300">
                  Enter the 4-digit verification code sent to customer:
                </p>
                <div className="text-lg font-mono font-black text-white mt-1">
                  +91 {phoneNumber}
                </div>
              </div>

              {/* 4-Digit OTP Input Form */}
              <form onSubmit={handleConfirmOtp} className="space-y-5">
                <div>
                  <label className="block text-center text-xs uppercase tracking-wider font-bold text-gray-400 mb-2">
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
                      className="w-full bg-[#12131a] text-white font-mono font-bold text-3xl sm:text-4xl text-center py-4 rounded-2xl border-2 border-[#34374a] focus:border-[#e5b869] focus:outline-none focus:ring-4 focus:ring-[#e5b869]/20 tracking-[0.4em] sm:tracking-[0.6em] transition-all placeholder:text-gray-700"
                    />
                  </div>
                </div>

                {otpError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs sm:text-sm text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
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
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-[#1e202c] hover:bg-[#252837] text-gray-300 border border-[#34374a] flex items-center justify-center gap-2 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>← Change Number</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isVerifyingOtp || otpCode.length !== 4}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Verifying Code...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-black" />
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
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                      OTP Confirmed
                    </span>
                    <span className="text-xs text-emerald-200/80 font-mono">
                      {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    Customer Verified ✅
                  </h3>
                  <p className="text-xs text-gray-300 mt-0.5 font-medium">
                    {foundCustomerName} • +91 {phoneNumber}
                  </p>
                  <p className="text-xs text-emerald-400 mt-1 font-semibold">
                    ✓ Online-paid sessions automatically marked as ATTENDED.
                  </p>
                </div>
              </div>

              {/* Verified Sessions Preview */}
              <div className="space-y-2">
                <div className="text-xs uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-[#e5b869]" />
                  <span>Verified Sessions Status</span>
                </div>

                <div className="space-y-2">
                  {verifiedSessions.map((session) => {
                    const isPaid = (session.payment_status || "").toLowerCase() === "paid";
                    const isFulfilled =
                      (session.fulfillment_status || "").toUpperCase() === "ATTENDED" ||
                      (session.fulfillment_status || "").toLowerCase() === "fulfilled";

                    const wristband = getSlotWristbandColor(session.time_slot, session.slot_color, session.slot_color_name);
                    const bandStyle = getWristbandBadgeStyle(wristband.hex);

                    return (
                      <div
                        key={session.id}
                        className="p-3 rounded-xl bg-[#12131b] border border-[#2a2c3d] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Car className="w-4 h-4 text-[#e5b869]" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{session.ticket_name}</span>
                              <span className="text-gray-400 font-mono">x {session.quantity}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded" style={bandStyle}>
                                {wristband.name}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              {session.time_slot} {session.payment_ref ? `(Ref: ${session.payment_ref})` : ""}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <span className="font-mono font-bold text-white">{formatInr(session.total_amount)}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isPaid
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {isPaid ? "PAID" : "UNPAID"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isFulfilled
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-gray-800 text-gray-400"
                            }`}
                          >
                            {isFulfilled ? "ATTENDED" : "UNFULFILLED"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DESK PAYMENT COLLECTION BOX (if any session is UNPAID / Cash / Pay at Desk) */}
              {totalDue > 0 && !paymentSuccess ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#201c18] to-[#17151a] border-2 border-amber-500/40 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-400" />
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-white">
                          Desk Payment Collection Required
                        </h4>
                        <p className="text-xs text-amber-200/80">
                          Customer has unpaid / pay-at-desk sessions today.
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] uppercase tracking-wider font-mono text-amber-300 font-bold block">
                        Total Amount Due
                      </span>
                      <span className="text-xl sm:text-2xl font-mono font-black text-amber-400">
                        {formatInr(totalDue)}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleCollectAndFulfill} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {/* Input 1: Transaction Ref / Note */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider font-bold text-gray-300 mb-1.5">
                          Transaction Ref / Note <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={deskTransactionRef}
                          onChange={(e) => setDeskTransactionRef(e.target.value)}
                          placeholder="e.g. UPI Ref / Cash / POS Slip #"
                          className="w-full bg-[#12131a] text-white font-medium text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#3a3d52] focus:border-[#e5b869] focus:outline-none focus:ring-2 focus:ring-[#e5b869]/20 transition-all placeholder:text-gray-600"
                        />
                        <span className="text-[10px] text-gray-400 mt-1 block">
                          Required for audit reconciliation.
                        </span>
                      </div>

                      {/* Input 2: Amount Collected */}
                      <div>
                        <label className="block text-xs uppercase tracking-wider font-bold text-gray-300 mb-1.5">
                          Amount Collected (₹) <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          value={deskAmountCollected}
                          onChange={(e) => setDeskAmountCollected(e.target.value)}
                          placeholder={String(totalDue)}
                          className="w-full bg-[#12131a] text-white font-mono font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#3a3d52] focus:border-[#e5b869] focus:outline-none focus:ring-2 focus:ring-[#e5b869]/20 transition-all placeholder:text-gray-600"
                        />
                        <div className="text-[10px] mt-1">
                          {deskAmountCollected === "" ? (
                            <span className="text-gray-400">
                              Must exactly match {formatInr(totalDue)}.
                            </span>
                          ) : Number(deskAmountCollected) === totalDue ? (
                            <span className="text-emerald-400 font-semibold">
                              ✓ Exact match! Ready to confirm.
                            </span>
                          ) : (
                            <span className="text-red-400 font-semibold">
                              ⚠️ Amount must equal {formatInr(totalDue)} (Diff: {formatInr(Math.abs(Number(deskAmountCollected) - totalDue))})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {paymentError && (
                      <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{paymentError}</span>
                      </div>
                    )}

                    {/* Validation Guard: Disabled until amount collected matches total due and note is filled */}
                    <button
                      type="submit"
                      disabled={
                        isCollectingPayment ||
                        !deskTransactionRef.trim() ||
                        Number(deskAmountCollected) !== totalDue
                      }
                      className="w-full py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-[#e5b869] to-[#d4a34b] text-black hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-[#e5b869]/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isCollectingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-black" />
                          <span>Fulfilling & Recording Payment...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-black" />
                          <span>Confirm & Mark as Paid & Fulfilled ({formatInr(totalDue)})</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* All Paid Banner */
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-white">
                    Track Entry Authorized! 🎉
                  </h4>
                  <p className="text-xs text-emerald-200/90 max-w-md mx-auto">
                    All sessions for this customer are verified, fully paid, and marked ATTENDED in the system. Customer is cleared to receive wristbands and enter the track.
                  </p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-black hover:bg-gray-100 transition-colors shadow-sm"
                    >
                      Done / Close Modal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-7 py-3.5 bg-[#14151e] border-t border-[#2a2c3d] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#e5b869]" />
            <span>Havoc Sim Podium Desk Verification Engine</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
