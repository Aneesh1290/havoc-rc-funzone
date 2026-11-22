"use client";

import { useState } from "react";
import { 
  Link as LinkIcon, 
  X, 
  Copy, 
  Check, 
  QrCode, 
  MessageCircle, 
  ExternalLink, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  IndianRupee 
} from "lucide-react";
import { createCustomPaymentLinkAction } from "@/app/actions/custom-payment-link";

interface CustomPaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CustomPaymentLinkModal({
  isOpen,
  onClose,
  onSuccess
}: CustomPaymentLinkModalProps) {
  const [amount, setAmount] = useState<string>("60000");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("+91");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("Group / Advance Payment");
  const [notes, setNotes] = useState<string>("");
  const [sendWhatsApp, setSendWhatsApp] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    token: string;
    paymentUrl: string;
    orderCode: string;
    totalAmount: number;
    waMeUrl?: string;
    qrUrl?: string;
    waAutoSent?: boolean;
    waError?: string;
  } | null>(null);

  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleReset = () => {
    setResult(null);
    setError(null);
    setCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than ₹0.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createCustomPaymentLinkAction({
        amount: numAmount,
        customerName: customerName.trim() || "Customer",
        customerPhone: customerPhone.trim(),
        countryCode,
        customerEmail: customerEmail.trim(),
        purpose: purpose.trim() || "Custom Payment",
        notes: notes.trim(),
        sendWhatsApp: sendWhatsApp && Boolean(customerPhone.trim())
      });

      if (!res.success || !res.paymentUrl) {
        setError(res.error || "Failed to generate payment link.");
        return;
      }

      setResult({
        token: res.token!,
        paymentUrl: res.paymentUrl!,
        orderCode: res.orderCode!,
        totalAmount: res.totalAmount!,
        waMeUrl: res.waMeUrl,
        qrUrl: res.qrUrl,
        waAutoSent: res.waAutoSent,
        waError: res.waError
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!result?.paymentUrl) return;
    navigator.clipboard.writeText(result.paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden text-gray-900 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black font-heading text-gray-900">
                Create Custom Payment Link
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Generate an online ICICI payment link for any custom amount
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            /* Result View with Link, QR, WhatsApp */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold text-sm">Payment Link Created Successfully!</div>
                  <div className="text-emerald-700 mt-0.5">
                    Order <strong>{result.orderCode}</strong> for <strong>₹{result.totalAmount.toLocaleString("en-IN")}</strong> is saved and ready for online checkout.
                  </div>
                </div>
              </div>

              {/* Link Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Online Payment Link URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={result.paymentUrl}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-800 focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-gray-900 hover:bg-black text-white transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                  <a
                    href={result.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 transition-colors shrink-0"
                    title="Open link in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* WhatsApp & QR Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {result.waMeUrl && (
                  <a
                    href={result.waMeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all active:scale-[0.98]"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send via WhatsApp</span>
                  </a>
                )}

                {result.qrUrl && (
                  <div className="col-span-full flex flex-col items-center justify-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-purple-600" />
                      <span>Customer QR Code (Scan to Pay ₹{result.totalAmount.toLocaleString("en-IN")})</span>
                    </span>
                    <img
                      src={result.qrUrl}
                      alt="Payment Link QR Code"
                      className="w-44 h-44 rounded-xl border border-gray-200 shadow-sm bg-white p-1.5"
                    />
                  </div>
                )}
              </div>

              {result.waAutoSent && (
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-800 text-[11px] font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-blue-600" />
                  <span>Automated WhatsApp template notification was dispatched to the customer!</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-50 transition-colors border border-purple-200"
                >
                  Create Another Link
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-black transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 60000"
                    className="w-full bg-gray-50/70 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>
                {/* Quick select amount chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {[1000, 5000, 10000, 25000, 50000, 60000, 75000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(String(preset))}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                        amount === String(preset)
                          ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-transparent"
                      }`}
                    >
                      ₹{preset.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Customer / Group Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Aneesh / Apex Corp"
                    className="w-full bg-gray-50/70 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Phone (for WhatsApp)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-14 bg-gray-50/70 border border-gray-200 rounded-xl px-2 py-2 text-xs font-bold text-center text-gray-700"
                    />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="9876543210"
                      className="flex-1 bg-gray-50/70 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Purpose & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Purpose / Title
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Group / Advance Payment"
                    className="w-full bg-gray-50/70 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Customer Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full bg-gray-50/70 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                  Internal Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Corporate party 40 pax advance payment"
                  className="w-full bg-gray-50/70 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                />
              </div>

              {/* WhatsApp Checkbox */}
              {customerPhone.trim() && (
                <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={sendWhatsApp}
                    onChange={(e) => setSendWhatsApp(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-0 border-gray-300"
                  />
                  <span>Dispatch payment link to customer WhatsApp automatically upon creation</span>
                </label>
              )}

              {/* Actions */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Link...</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Generate Payment Link</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
