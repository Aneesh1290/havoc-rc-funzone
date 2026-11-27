"use client";

import { useState, useEffect } from "react";
import { 
  Link as LinkIcon, 
  RefreshCw, 
  Copy, 
  Check, 
  MessageCircle, 
  ExternalLink, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Zap,
  Phone,
  User,
  Mail,
  FileText,
  IndianRupee,
  Calendar
} from "lucide-react";
import { 
  createCustomPaymentLinkAction, 
  fetchCustomPaymentLinksAction 
} from "@/app/actions/custom-payment-link";

interface PaymentLinkItem {
  id: number;
  token: string;
  customer_name: string;
  customer_phone: string;
  country_code: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  created_at: string;
  paid_at?: string | null;
  payment_ref?: string | null;
  order_code: string;
  purpose?: string;
  notes?: string;
  payment_url: string;
  wa_url: string;
}

export default function AdminPaymentLinksPage() {
  // Form State
  const [amount, setAmount] = useState<string>("500");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("+91");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [purpose, setPurpose] = useState<string>("General Booking / Advance");
  const [notes, setNotes] = useState<string>("");
  const [sendWhatsApp, setSendWhatsApp] = useState<boolean>(true);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<{
    token: string;
    paymentUrl: string;
    orderCode: string;
    waMeUrl?: string;
    waAutoSent?: boolean;
    waError?: string;
  } | null>(null);

  // History State
  const [links, setLinks] = useState<PaymentLinkItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetchCustomPaymentLinksAction(100);
      if (res.success && res.links) {
        setLinks(res.links as PaymentLinkItem[]);
      }
    } catch (e) {
      console.error("Failed to load payment links history:", e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError("Please enter a valid amount greater than ₹0.");
      return;
    }

    if (!customerPhone.trim()) {
      setFormError("Please enter the customer phone / WhatsApp number.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const res = await createCustomPaymentLinkAction({
        amount: numAmount,
        customerName: customerName.trim() || "Customer",
        customerPhone: customerPhone.trim(),
        countryCode,
        customerEmail: customerEmail.trim(),
        purpose: purpose.trim() || "Custom Payment",
        notes: notes.trim(),
        sendWhatsApp
      });

      if (res.success && res.paymentUrl) {
        setFormSuccess({
          token: res.token!,
          paymentUrl: res.paymentUrl,
          orderCode: res.orderCode!,
          waMeUrl: res.waMeUrl,
          waAutoSent: res.waAutoSent,
          waError: res.waError
        });
        // Reload list immediately so new link appears on right
        loadHistory();
      } else {
        setFormError(res.error || "Failed to generate payment link.");
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, token: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(token);
    setTimeout(() => {
      setCopiedToken((prev) => (prev === token ? null : prev));
    }, 2500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#ff5a1f]">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-[#0d1b2a] tracking-tight">
              Payment Links
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Generate custom payment links with any amount and send them directly via WhatsApp or copy link.
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid (Identical to Sim Podium layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Generator Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-7 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
            <Zap className="w-5 h-5 text-[#ff5a1f] fill-[#ff5a1f]" />
            <h2 className="text-lg font-bold text-[#0d1b2a]">Generate Payment Link</h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Amount to Charge (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 font-bold text-lg">
                  ₹
                </div>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  className="w-full pl-9 pr-4 py-3 bg-gray-50/70 border border-gray-200 rounded-xl text-lg font-bold text-[#0d1b2a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all"
                />
              </div>
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Customer Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm font-medium text-[#0d1b2a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Phone / WhatsApp Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-24 px-2 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all shrink-0"
                >
                  <option value="+91">IN +91</option>
                  <option value="+1">US +1</option>
                  <option value="+971">AE +971</option>
                  <option value="+44">UK +44</option>
                  <option value="+65">SG +65</option>
                </select>
                <div className="relative flex-grow">
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm font-medium text-[#0d1b2a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Email Address (Receives Receipt)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g. customer@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm font-medium text-[#0d1b2a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all"
                />
              </div>
            </div>

            {/* Purpose / Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                Payment Purpose / Notes
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Group Booking / Balance / Advance"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm font-medium text-[#0d1b2a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all"
                />
              </div>
            </div>

            {/* WhatsApp Auto Send Checkbox */}
            <div className="pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={sendWhatsApp}
                  onChange={(e) => setSendWhatsApp(e.target.checked)}
                  className="w-4 h-4 text-[#ff5a1f] rounded border-gray-300 focus:ring-[#ff5a1f]"
                />
                <span>Automatically dispatch official WhatsApp message</span>
              </label>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-[#ff5a1f] hover:bg-[#e04810] text-white font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Link...</span>
                </>
              ) : (
                <span>Generate Link &rsaquo;</span>
              )}
            </button>
          </form>

          {/* Quick Success Box on Left */}
          {formSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Payment Link Created! ({formSuccess.orderCode})</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={formSuccess.paymentUrl}
                  className="flex-grow bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-700 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(formSuccess.paymentUrl, "form-success")}
                  className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-bold text-emerald-700 flex items-center gap-1 transition-colors"
                >
                  {copiedToken === "form-success" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
              {formSuccess.waMeUrl && (
                <a
                  href={formSuccess.waMeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send via WhatsApp Web</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Generated Payment Links List */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-[#0d1b2a]">Generated Payment Links</h2>
            <button
              type="button"
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin text-[#ff5a1f]" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#ff5a1f]" />
              <span>Loading payment links...</span>
            </div>
          ) : links.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No payment links created yet. Fill the details on the left to generate one.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[750px] overflow-y-auto pr-1">
              {links.map((pl) => {
                const isPaid = pl.status === "PAID";
                const isExpired = pl.status === "EXPIRED";
                const statusBadgeBg = isPaid 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isExpired 
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-amber-50 text-amber-700 border-amber-200";

                const dateStr = pl.created_at ? new Intl.DateTimeFormat("en-IN", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true
                }).format(new Date(pl.created_at)) : "-";

                return (
                  <div
                    key={pl.id}
                    className="p-4 sm:p-4.5 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                  >
                    {/* Left side details */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-heading font-black text-lg text-[#0d1b2a]">
                          ₹{pl.amount.toFixed(2)}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${statusBadgeBg}`}>
                          {pl.status}
                        </span>
                      </div>

                      <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                        {pl.customer_name ? <span>{pl.customer_name}</span> : <span>Customer</span>}
                        {pl.customer_phone && (
                          <span className="text-gray-400 font-normal"> • {pl.customer_phone}</span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-1.5 pt-0.5">
                        {pl.purpose && (
                          <span className="text-[#ff5a1f] font-semibold">{pl.purpose} •</span>
                        )}
                        <span className="font-mono text-gray-600">{pl.order_code}</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>

                      {pl.payment_ref && (
                        <div className="text-[11px] text-gray-500 font-mono pt-0.5">
                          Txn Ref: <strong className="text-emerald-700 select-all">{pl.payment_ref}</strong>
                        </div>
                      )}
                    </div>

                    {/* Right side action buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(pl.payment_url, pl.token)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        {copiedToken === pl.token ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-gray-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* WhatsApp Button */}
                      <a
                        href={pl.wa_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </a>

                      {/* Open Link Button */}
                      <a
                        href={pl.payment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#ff5a1f] border border-orange-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <span>Open ↗</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
