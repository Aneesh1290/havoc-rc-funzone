"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Clock, 
  Calendar, 
  Car,
  ArrowRight,
  ExternalLink
} from "lucide-react";

interface PaymentLinkDetails {
  token: string;
  customer_name: string;
  customer_phone: string;
  country_code: string;
  total_amount: number;
  status: "pending" | "completed" | "expired";
  paid_at?: string | null;
  payment_ref?: string | null;
  bookings: {
    id: number;
    order_number: number;
    ticket_name: string;
    date: string;
    time_slot: string;
    quantity: number;
    total_amount: number;
    payment_status: string;
    fulfillment_status: string;
    simulator_name?: string | null;
    simulator_slot?: string | null;
  }[];
}

export default function PayTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [details, setDetails] = useState<PaymentLinkDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/pay/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Payment link not found or expired");
        setDetails(data);
      })
      .catch((err) => {
        console.error("Failed to load payment details:", err);
        setError(err.message || "Failed to load payment details");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const handlePayNow = async () => {
    if (!token || !details) return;
    setIsPaying(true);
    setPayError(null);

    try {
      const res = await fetch(`/api/pay/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate online payment");
      }

      if (data.redirectURI && data.tranCtx) {
        window.location.href = `${data.redirectURI}?tranCtx=${data.tranCtx}`;
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("Invalid response from payment gateway");
      }
    } catch (err: any) {
      console.error("Payment initiation error:", err);
      setPayError(err.message || "Failed to initiate online payment");
      setIsPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#ff5a1f] mx-auto" />
          <p className="text-gray-300 font-medium text-sm">Loading your secure payment session...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-4 backdrop-blur-md shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center border border-red-500/30">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-white">Payment Link Expired or Invalid</h2>
          <p className="text-gray-400 text-sm">{error || "This payment link is no longer valid."}</p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = details.status === "completed" || details.bookings.every(b => b.payment_status.toLowerCase() === "paid");

  return (
    <div className="min-h-screen bg-[#0d1b2a] text-white flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full bg-white rounded-3xl text-gray-900 shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Brand Banner Header */}
        <div className="bg-gradient-to-r from-[#ff5a1f] to-[#ff8447] p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <span className="inline-block text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full bg-black/20 text-white mb-2">
            Havoc RC Fun Zone Desk Pay
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Complete Your Payment
          </h1>
          <p className="text-white/90 text-xs sm:text-sm mt-1">
            Hi {details.customer_name}, please pay below to confirm your track pass.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Amount Due Card */}
          <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-5 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-800">
              Total Amount Payable
            </span>
            <div className="text-4xl sm:text-5xl font-black font-mono text-gray-900 mt-1">
              ₹{Number(details.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] font-semibold text-gray-500 mt-1.5 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Includes 18% GST • 256-Bit Bank Level Encryption</span>
            </p>
          </div>

          {/* Bookings / Sessions List */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase font-extrabold text-gray-500 tracking-wider">
              Selected Passes &amp; Sessions ({details.bookings.length})
            </h3>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {details.bookings.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <span>{item.ticket_name}</span>
                      <span className="text-xs font-mono font-bold text-gray-500">× {item.quantity}</span>
                    </div>
                    <div className="text-gray-500 flex items-center gap-2 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {item.date}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {item.time_slot}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-gray-900 block">
                      ₹{Number(item.total_amount).toLocaleString("en-IN")}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      item.payment_status.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.payment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {payError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{payError}</span>
            </div>
          )}

          {/* Action Button */}
          {isCompleted ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-gray-900">
                Payment Completed! 🎉
              </h4>
              <p className="text-xs text-gray-600">
                This session is fully paid and verified. Show your screen at the check-in desk to receive your wristbands.
              </p>
              {details.payment_ref && (
                <div className="text-[11px] font-mono font-bold text-gray-500 pt-1">
                  Ref: {details.payment_ref}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePayNow}
              disabled={isPaying}
              className="w-full py-4 rounded-2xl font-black text-sm sm:text-base bg-[#ff5a1f] hover:bg-[#ff723b] text-white shadow-xl shadow-orange-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPaying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>Redirecting to ICICI Secure Gateway...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Pay ₹{Number(details.total_amount).toLocaleString("en-IN")} via UPI / Card / NetBanking</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          )}

          {/* Security & Customer Details footer */}
          <div className="pt-2 border-t border-gray-100 text-center text-[11px] text-gray-400 space-y-1">
            <p>Customer: {details.customer_name} ({details.country_code} {details.customer_phone})</p>
            <p className="text-[10px]">Havoc Hobby Center Pvt. Ltd. • ICICI Bank Secure Payment Gateway</p>
          </div>

        </div>
      </div>
    </div>
  );
}

