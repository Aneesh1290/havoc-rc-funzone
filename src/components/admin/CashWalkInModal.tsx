"use client";

import { useState } from "react";
import {
  Banknote,
  Phone,
  User,
  Send,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { COUNTRY_CODES, CountryCode, getExpectedPhoneDigits } from "@/lib/countries";
import { createCashWalkinSessionAction } from "@/app/actions/cash-walkin";

interface CashWalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTickets?: any[];
  availableSlots?: any[];
}

export default function CashWalkInModal({
  isOpen,
  onClose,
}: CashWalkInModalProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]);
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<{
    token: string;
    checkoutUrl: string;
    waMeUrl: string;
    qrUrl: string;
    whatsappSent: boolean;
    whatsappError?: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const { min, max, placeholder } = getExpectedPhoneDigits(selectedCountry);
  const isPhoneComplete = phone.length >= min;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < min) {
      setErrorMsg(`Please enter a valid phone number (${min}-${max} digits).`);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await createCashWalkinSessionAction({
        phone: cleanPhone,
        countryCode: selectedCountry.dialCode,
        customerName: customerName.trim(),
      });

      if (!res.success || !res.checkoutUrl) {
        setErrorMsg(res.error || "Failed to generate cash walk-in booking link.");
        setIsSubmitting(false);
        return;
      }

      setResult({
        token: res.token!,
        checkoutUrl: res.checkoutUrl,
        waMeUrl: res.waMeUrl!,
        qrUrl: res.qrUrl!,
        whatsappSent: Boolean(res.whatsappSent),
        whatsappError: res.whatsappError,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create booking link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!result?.checkoutUrl) return;
    navigator.clipboard.writeText(result.checkoutUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReset = () => {
    setResult(null);
    setPhone("");
    setCustomerName("");
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-6 relative overflow-hidden">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-[#ff5a1f]" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shadow-xs">
              <Banknote className="w-6 h-6 stroke-[2.2]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-gray-900 text-lg sm:text-xl">
                  Cash Walk-In Booking
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  Desk Counter
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Customer opens passes page, selects passes &amp; slots, and checkout is locked exclusively to <strong>Pay at Desk</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!result ? (
          /* STEP 1: FORM INPUT */
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Phone Number Input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1.5">
                Customer WhatsApp Number *
              </label>
              <div className="flex rounded-2xl border border-gray-300 bg-gray-50/70 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500 focus-within:bg-white transition-all shadow-2xs">
                {/* Country Code Picker */}
                <select
                  value={selectedCountry.dialCode}
                  onChange={(e) => {
                    const found = COUNTRY_CODES.find((c) => c.dialCode === e.target.value);
                    if (found) setSelectedCountry(found);
                  }}
                  className="bg-transparent text-xs font-bold text-gray-800 px-3 py-3 border-r border-gray-200 focus:outline-none cursor-pointer"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.dialCode}>
                      {c.flag} {c.dialCode} ({c.name})
                    </option>
                  ))}
                </select>

                {/* Number Field */}
                <div className="flex-1 relative flex items-center">
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    placeholder={`e.g. ${placeholder}`}
                    value={phone}
                    maxLength={max}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, max))}
                    className="w-full bg-transparent px-3.5 py-3 text-xs font-semibold text-gray-900 font-mono tracking-wide focus:outline-none placeholder:font-sans placeholder:text-gray-400"
                  />
                  <div className="pr-3 text-[10px] font-mono font-bold text-gray-400">
                    {phone.length}/{max}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Name Input (Optional) */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1.5">
                Customer Name <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-gray-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-gray-50/70 border border-gray-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !isPhoneComplete}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating & Sending Link...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send WhatsApp Cash Booking Link</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2: RESULT (QR CODE + WHATSAPP STATUS + ACTIONS) */
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Status Pill */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 stroke-[3]" />
                </span>
                <div>
                  <div className="text-xs font-bold">Cash Booking Link Generated!</div>
                  <div className="text-[11px] text-emerald-700">
                    {result.whatsappSent 
                      ? "Dispatched to customer's WhatsApp successfully." 
                      : "Ready for scan or 1-click WhatsApp dispatch."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            {/* Instant Counter QR Code */}
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <div className="text-xs font-black text-amber-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-600" />
                <span>Scan QR Code at Counter</span>
              </div>
              <p className="text-[11px] text-amber-800 max-w-xs mb-3">
                Customer can point their phone camera right at this screen to open passes with cash checkout mode:
              </p>
              <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-amber-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.qrUrl}
                  alt="Counter QR Code"
                  width={200}
                  height={200}
                  className="rounded-xl w-48 h-48"
                />
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {/* Copy Link Button */}
              <button
                type="button"
                onClick={handleCopyLink}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 shadow-2xs ${
                  copied
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                <span>{copied ? "Link Copied!" : "Copy Booking Link"}</span>
              </button>

              {/* Open in WhatsApp Web / App */}
              <a
                href={result.waMeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white transition-all flex items-center justify-center gap-2 shadow-2xs"
              >
                <Send className="w-3.5 h-3.5 text-white" />
                <span>Open in WhatsApp</span>
              </a>
            </div>

            {/* Direct Open Link */}
            <div className="text-center pt-1">
              <a
                href={result.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-gray-500 hover:text-amber-700 underline inline-flex items-center gap-1"
              >
                <span>Open passes booking page in new tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
