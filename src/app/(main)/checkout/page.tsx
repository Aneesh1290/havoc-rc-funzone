"use client";

import { useCart } from "@/context/CartContext";
import { ArrowLeft, CreditCard, ChevronDown, CheckCircle2, AlertTriangle, Calendar, Clock, Ticket, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { addBookingAction, createBatchOrderAction, validateCouponAction, useCouponAction } from "@/app/actions/tickets";
import { getPublicPaymentConfigAction, PublicPaymentConfig } from "@/app/actions/payment-settings";
import { useRouter } from "next/navigation";
import { COUNTRY_CODES, validatePhoneNumber, getExpectedPhoneDigits } from "@/lib/countries";
import { formatOrderNumber } from "@/lib/order-utils";
import { SimPerkBadgeList } from "@/components/SimPerkBadgeList";

export default function CheckoutPage() {
  const { items, cartTotal, clearCart } = useCart();
  const router = useRouter();
  
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]); // Default: India (+91)
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
  });
  
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'desk'>('online');
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig>({
    enableOnline: true,
    enableDesk: true,
    defaultMethod: 'online',
    activeGateway: 'icici',
    gatewayName: 'ICICI Bank Gateway',
    gatewayEnv: 'live',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get('error');
      if (urlError) {
        setValidationError(decodeURIComponent(urlError));
      }
    }

    async function loadPaymentConfig() {
      try {
        const cfg = await getPublicPaymentConfigAction();
        setPaymentConfig(cfg);
        if (cfg.enableOnline && !cfg.enableDesk) {
          setPaymentMethod('online');
        } else if (!cfg.enableOnline && cfg.enableDesk) {
          setPaymentMethod('desk');
        } else if (cfg.defaultMethod) {
          setPaymentMethod(cfg.defaultMethod);
        }
      } catch (err) {
        console.error("Failed to fetch payment config:", err);
      }
    }

    loadPaymentConfig();
  }, []);
  const [bookingSuccessModal, setBookingSuccessModal] = useState<{
    customerName: string;
    subtotal: number;
    gst: number;
    totalAmount: number;
    itemsCount: number;
    orderCodes: string[];
    items: Array<{
      name: string;
      date: string;
      timeSlot: string;
      quantity: number;
      simulatorName?: string;
      simulatorSlot?: string;
    }>;
  } | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: "percentage" | "flat";
    value: number;
    discountAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const discountedSubtotal = Math.max(0, cartTotal - discount);
  const gst = discountedSubtotal * 0.18;
  const grandTotal = discountedSubtotal + gst;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponError("");
    setIsValidatingCoupon(true);

    try {
      const res = await validateCouponAction(couponInput.trim(), cartTotal);
      if (res.valid) {
        setAppliedCoupon({
          code: res.code!,
          discountType: res.discountType!,
          value: res.value!,
          discountAmount: res.discountAmount!,
        });
        setCouponError("");
      } else {
        setCouponError(res.error || "Invalid coupon");
        setAppliedCoupon(null);
      }
    } catch (e) {
      setCouponError("Could not validate coupon");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!agreedToTerms) {
      setValidationError("Please agree to the Terms & Conditions and Refund Policy to proceed.");
      return;
    }

    // Strict country phone validation
    const phoneCheck = validatePhoneNumber(formData.phone, selectedCountry);
    if (!phoneCheck.valid) {
      setValidationError(phoneCheck.error || "Please enter a valid phone number.");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Calculate item share of grand total (including 18% GST and net of any coupons) proportionally
      const totalRatio = cartTotal > 0 ? (grandTotal / cartTotal) : 1.18;

      // Create unified batch booking in database for all items in the cart under ONE order number
      const fullPhoneNumber = `${selectedCountry.dialCode} ${formData.phone.trim()}`;
      
      const batchItems = items.map(item => ({
        ticketId: item.ticketId,
        date: item.date,
        timeSlot: item.timeSlot,
        quantity: item.quantity,
        itemTotal: Math.round(item.price * item.quantity * totalRatio),
        simulatorName: item.simulatorName,
        simulatorSlot: item.simulatorSlot
      }));

      if (paymentMethod === 'online') {
        if (paymentConfig.activeGateway !== 'icici') {
          throw new Error(
            `${paymentConfig.gatewayName} is currently active in settings. Gateway connection is in setup mode. Please choose 'Pay at Desk' or switch back to ICICI Bank Gateway in Admin Settings.`
          );
        }

        const res = await fetch("/api/payment/icici/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: grandTotal,
            customer_details: {
              name: formData.fullName,
              email: formData.email,
              phone: fullPhoneNumber,
              whatsapp_consent: true,
            },
            booking_data: appliedCoupon 
              ? batchItems.map(item => ({ ...item, appliedCoupon: appliedCoupon.code }))
              : batchItems,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to initiate online payment");
        }

        if (appliedCoupon) {
          await useCouponAction(appliedCoupon.code);
        }

        if (data.redirectURI && data.tranCtx) {
          clearCart();
          window.location.href = `${data.redirectURI}?tranCtx=${data.tranCtx}`;
          return;
        } else {
          throw new Error("Invalid response from payment gateway");
        }
      }

      // Pay at Desk flow
      const batchRes = await createBatchOrderAction(
        batchItems,
        formData.fullName,
        formData.email,
        fullPhoneNumber,
        grandTotal,
        appliedCoupon ? appliedCoupon.code : null
      );

      const generatedOrderCodes: string[] = [];
      if (batchRes && batchRes.orderCode) {
        generatedOrderCodes.push(batchRes.orderCode);
      }
      
      // If coupon used, record usage in DB and auto-issue band if VIP band offer
      if (appliedCoupon) {
        await useCouponAction(appliedCoupon.code, {
          customerName: formData.fullName,
          orderCode: batchRes?.orderCode,
          bookingId: batchRes?.primaryId
        });
      }

      // Success! Show branded confirmation screen and clear cart
      const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
      setBookingSuccessModal({
        customerName: formData.fullName,
        subtotal: discountedSubtotal,
        gst: gst,
        totalAmount: grandTotal,
        itemsCount: totalQty,
        orderCodes: generatedOrderCodes,
        items: items.map(item => ({
          name: item.type,
          date: item.date,
          timeSlot: item.timeSlot,
          quantity: item.quantity,
          simulatorName: item.simulatorName,
          simulatorSlot: item.simulatorSlot,
        })),
      });
      clearCart();
    } catch (error: any) {
      console.error(error);
      setValidationError(error.message || "Something went wrong with your reservation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (bookingSuccessModal) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center px-4 py-16">
        {/* Havoc Orange Glowing Check Icon */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#ff5a1f] to-[#ff7e4f] flex items-center justify-center shadow-[0_10px_35px_rgba(255,90,31,0.35)] mb-6 ring-8 ring-[#ff5a1f]/10">
          <Check className="w-10 h-10 text-white stroke-[3]" />
        </div>

        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-black font-heading text-[#0d1b2a] tracking-tight mb-3 text-center">
          Booking <span className="text-[#ff5a1f]">Confirmed!</span>
        </h1>
        <p className="text-gray-600 text-sm md:text-base font-semibold mb-1 text-center">
          Get ready for high-speed action! See you at Havoc RC Funzone!
        </p>
        <p className="text-gray-400 text-xs mb-10 text-center">
          A confirmation will be sent to your email address. <span className="text-gray-600 font-medium">Please check your spam folder if you don't see it.</span>
        </p>

        {/* Booking Details Card */}
        <div className="w-full max-w-lg bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-xl shadow-gray-200/60 space-y-6 relative overflow-hidden">
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#ff5a1f] to-[#ff8c42]" />

          <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">
            Booking Details
          </div>

          {/* Reserved Items */}
          <div className="space-y-3">
            {bookingSuccessModal.items.map((item, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                <div className="font-bold text-[#0d1b2a] text-base md:text-lg mb-1">
                  {item.name} {item.quantity > 1 ? `(×${item.quantity})` : ""}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span>{item.date}</span>
                  <span>•</span>
                  <span>{item.timeSlot}</span>
                </div>
                {item.simulatorName && (
                  <SimPerkBadgeList 
                    simNameStr={item.simulatorName} 
                    simSlotStr={item.simulatorSlot} 
                  />
                )}
              </div>
            ))}
          </div>

          {/* Breakdown Table */}
          <div className="space-y-3 pt-2 text-sm border-t border-gray-100">
            <div className="flex justify-between items-center text-gray-500">
              <span>Booked For</span>
              <span className="font-bold text-[#0d1b2a] uppercase tracking-wider">{bookingSuccessModal.customerName}</span>
            </div>

            <div className="flex justify-between items-center text-gray-500">
              <span>Subtotal</span>
              <span className="font-bold text-[#0d1b2a]">₹{bookingSuccessModal.subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-gray-500">
              <span>GST (18%)</span>
              <span className="font-bold text-[#0d1b2a]">₹{bookingSuccessModal.gst.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-base">
              <span className="font-bold text-gray-700">Amount Due (Pay At Desk)</span>
              <span className="font-black text-[#ff5a1f] text-2xl">₹{bookingSuccessModal.totalAmount.toFixed(2)}</span>
            </div>

            {bookingSuccessModal.orderCodes && bookingSuccessModal.orderCodes.length > 0 && (
              <div className="flex justify-between items-center text-xs pt-3 border-t border-gray-100">
                <span className="text-gray-400 uppercase tracking-wider font-bold">Order ID</span>
                <span className="font-mono text-gray-800 font-bold tracking-wider bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">
                  {bookingSuccessModal.orderCodes.join(", ")}
                </span>
              </div>
            )}


          </div>
        </div>

        {/* Back to Home Button */}
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-[#ff5a1f] hover:bg-[#e04812] text-white font-extrabold px-8 py-3.5 rounded-xl uppercase tracking-wider text-sm transition-all shadow-lg shadow-[#ff5a1f]/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !isSubmitting && !bookingSuccessModal) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center min-h-[60vh] flex flex-col justify-center items-center">
        <h1 className="text-3xl font-black font-heading mb-4 text-gray-900">Your Cart is Empty</h1>
        <p className="text-gray-500 mb-8">You have not added any tickets to your cart yet.</p>
        <Link href="/" className="bg-[#ff5a1f] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#e04812] transition-colors">
          Browse Tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9fa] min-h-screen pb-20">
      {/* Checkout Header */}
      <div className="bg-white border-b border-gray-200 py-6 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-heading font-black text-2xl tracking-tighter text-[#0d1b2a]">
            HAVOC<span className="text-[#ff5a1f]">.</span>
          </Link>
          <h1 className="font-bold text-gray-500 tracking-widest text-sm uppercase">Checkout</h1>
          <Link href="/tickets" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#0d1b2a] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Cart
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-12">
        <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column - Forms */}
          <div className="lg:col-span-7 space-y-10">
            
            {/* Details Section */}
            <section>
              <h2 className="text-2xl font-black font-heading text-gray-900 mb-6">Your Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. John Doe" 
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Email Address</label>
                  <input 
                    type="email" 
                    required
                    placeholder="e.g. john@example.com" 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-gray-700 uppercase tracking-wide">Phone Number</label>
                    <div className="relative">
                      {/* Unified Input Box */}
                      <div className="group flex items-center bg-white border border-gray-200 rounded-xl transition-all focus-within:ring-2 focus-within:ring-[#ff5a1f]/20 focus-within:border-[#ff5a1f] shadow-sm hover:border-gray-300">
                        {/* Country Selector Button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                            aria-label="Country Dial Code"
                            className="h-full bg-gray-50/70 hover:bg-gray-100/90 rounded-l-xl px-3.5 py-3.5 font-bold text-gray-800 text-sm focus:outline-none cursor-pointer transition-colors flex items-center gap-2 select-none border-r border-gray-200"
                          >
                            <span className="text-base leading-none">{selectedCountry.flag}</span>
                            <span className="font-semibold text-gray-800 text-sm">{selectedCountry.code}</span>
                            <span className="font-mono text-gray-600 text-xs font-semibold">{selectedCountry.dialCode}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          </button>

                          {isCountryDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setIsCountryDropdownOpen(false)}
                              />
                              <div className="absolute top-full left-0 mt-2 w-72 max-h-64 overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-200 z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100 divide-y divide-gray-50">
                                {COUNTRY_CODES.map((country) => (
                                  <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(country);
                                      setIsCountryDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-orange-50 transition-colors flex items-center justify-between ${
                                      selectedCountry.code === country.code ? "bg-orange-50/70 font-bold text-[#ff5a1f]" : "text-gray-700"
                                    }`}
                                  >
                                    <span className="flex items-center gap-2 truncate pr-2">
                                      <span className="text-base leading-none shrink-0">{country.flag}</span>
                                      <span className="truncate">{country.name}</span>
                                    </span>
                                    <span className="font-mono font-semibold text-gray-500 shrink-0">
                                      {country.dialCode}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Phone Number Input */}
                        {(() => {
                          const { min, max, placeholder } = getExpectedPhoneDigits(selectedCountry);
                          const isComplete = formData.phone.length === max;
                          return (
                            <div className="flex-1 min-w-0 relative flex items-center">
                              <input 
                                type="tel" 
                                inputMode="numeric"
                                required
                                placeholder={`e.g. ${placeholder}`} 
                                value={formData.phone}
                                maxLength={max}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, "").slice(0, max);
                                  setFormData({ ...formData, phone: digits });
                                  if (validationError) setValidationError(null);
                                }}
                                className="w-full bg-transparent px-4 py-3.5 text-gray-900 focus:outline-none font-medium font-mono text-base tracking-wide placeholder:font-sans placeholder:text-sm placeholder:text-gray-400 placeholder:tracking-normal"
                              />
                              <div className="pr-4 shrink-0 flex items-center">
                                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold transition-colors ${
                                  isComplete 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                    : "bg-gray-100 text-gray-500"
                                }`}>
                                  {formData.phone.length}/{max}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

            {/* Payment Section */}
            <section>
              <h2 className="text-2xl font-black font-heading text-gray-900 mb-6">Payment Method</h2>
              
              {!paymentConfig.enableOnline && !paymentConfig.enableDesk ? (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-semibold flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Checkout is temporarily paused for maintenance. Please check back shortly or contact the counter.</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Option 1: Online Payment */}
                  {paymentConfig.enableOnline && (
                    <div 
                      onClick={() => setPaymentMethod('online')}
                      className={`border-2 rounded-2xl p-5 flex items-start gap-4 cursor-pointer relative overflow-hidden transition-all select-none ${
                        paymentMethod === 'online'
                          ? "border-[#ff5a1f] bg-[#ff5a1f]/5 shadow-sm shadow-[#ff5a1f]/10"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-all ${
                        paymentMethod === 'online' ? "border-[#ff5a1f] bg-[#ff5a1f]" : "border-gray-300 bg-white"
                      }`}>
                        {paymentMethod === 'online' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 text-base sm:text-lg">Pay Online (Instant Confirmation)</h3>
                          {paymentConfig.defaultMethod === 'online' && (
                            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs sm:text-sm mt-1">
                          UPI, Credit/Debit Cards, NetBanking via {paymentConfig.gatewayName}. Holds your slot instantly while paying.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Option 2: Pay at Desk */}
                  {paymentConfig.enableDesk && (
                    <div 
                      onClick={() => setPaymentMethod('desk')}
                      className={`border-2 rounded-2xl p-5 flex items-start gap-4 cursor-pointer relative overflow-hidden transition-all select-none ${
                        paymentMethod === 'desk'
                          ? "border-[#ff5a1f] bg-[#ff5a1f]/5 shadow-sm shadow-[#ff5a1f]/10"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center transition-all ${
                        paymentMethod === 'desk' ? "border-[#ff5a1f] bg-[#ff5a1f]" : "border-gray-300 bg-white"
                      }`}>
                        {paymentMethod === 'desk' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900 text-base sm:text-lg">Pay at Desk</h3>
                          {paymentConfig.defaultMethod === 'desk' && (
                            <span className="bg-orange-100 text-orange-800 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs sm:text-sm mt-1">
                          Reserve your slot now and pay with cash, card, or UPI upon arrival at the venue ticket counter.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div 
                onClick={() => {
                  setAgreedToTerms(!agreedToTerms);
                  if (validationError) setValidationError(null);
                }}
                className={`mt-8 p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                  agreedToTerms 
                    ? "bg-[#ff5a1f]/5 border-[#ff5a1f] shadow-sm shadow-[#ff5a1f]/10" 
                    : validationError 
                      ? "bg-red-50/50 border-red-300 hover:border-red-400" 
                      : "bg-white border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* Custom Styled Checkbox */}
                <div 
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                    agreedToTerms 
                      ? "bg-[#ff5a1f] text-white shadow-sm shadow-[#ff5a1f]/30 scale-100" 
                      : "bg-white border-2 border-gray-300 text-transparent hover:border-gray-400"
                  }`}
                >
                  <Check className={`w-4 h-4 stroke-[3] transition-transform ${agreedToTerms ? "scale-100" : "scale-50"}`} />
                </div>

                <div className="flex-1 text-sm text-gray-700 leading-relaxed">
                  <span>I have read and agree to the </span>
                  <Link 
                    href="/terms" 
                    onClick={(e) => e.stopPropagation()} 
                    target="_blank"
                    className="font-bold text-[#0d1b2a] underline decoration-[#ff5a1f]/40 hover:text-[#ff5a1f] hover:decoration-[#ff5a1f] transition-colors"
                  >
                    Terms &amp; Conditions
                  </Link>
                  <span>, </span>
                  <Link 
                    href="/refund" 
                    onClick={(e) => e.stopPropagation()} 
                    target="_blank"
                    className="font-bold text-[#0d1b2a] underline decoration-[#ff5a1f]/40 hover:text-[#ff5a1f] hover:decoration-[#ff5a1f] transition-colors"
                  >
                    Refund Policy
                  </Link>
                  <span> and </span>
                  <Link 
                    href="/shipping" 
                    onClick={(e) => e.stopPropagation()} 
                    target="_blank"
                    className="font-bold text-[#0d1b2a] underline decoration-[#ff5a1f]/40 hover:text-[#ff5a1f] hover:decoration-[#ff5a1f] transition-colors"
                  >
                    Shipping Policy
                  </Link>
                  <span>.</span>
                </div>
              </div>

              {validationError && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-3 animate-in fade-in duration-200">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={isSubmitting || (!paymentConfig.enableOnline && !paymentConfig.enableDesk)}
                className="w-full mt-6 bg-[#ff5a1f] hover:bg-[#e04812] text-white py-4 rounded-xl font-black tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl shadow-[#ff5a1f]/20 group disabled:opacity-60 disabled:cursor-not-allowed uppercase"
              >
                {isSubmitting 
                  ? (paymentMethod === 'online' ? "CONNECTING TO GATEWAY..." : "PROCESSING RESERVATION...") 
                  : (!paymentConfig.enableOnline && !paymentConfig.enableDesk)
                    ? "CHECKOUT CURRENTLY UNAVAILABLE"
                    : (paymentMethod === 'online' ? `PROCEED TO PAY ₹${grandTotal.toFixed(2)}` : "BOOK & PAY AT DESK")
                }
                {!isSubmitting && paymentConfig.enableOnline && <ArrowLeft className="w-5 h-5 rotate-180 group-hover:translate-x-1 transition-transform" />}
              </button>
            </section>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 sticky top-8">
              <h2 className="text-xl font-black font-heading text-gray-900 mb-6">Order Summary</h2>
              
              <div className="space-y-6 mb-8">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4 pb-6 border-b border-gray-100 last:pb-0 last:border-0">
                    <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                      {/* Placeholder for item image, you could add dynamic images later */}
                      <div className="w-full h-full bg-[#0d1b2a] flex items-center justify-center">
                        <span className="text-[#ff5a1f] font-black text-xs text-center leading-tight tracking-wider">HAVOC<br/>TICKET</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-gray-900 leading-snug pr-4">{item.type.replace(/_/g, ' ')}</h3>
                        <p className="font-bold text-gray-900">₹{item.price * item.quantity}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Date: {item.date}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Slot: {item.timeSlot}</p>
                      <SimPerkBadgeList 
                        simNameStr={item.simulatorName} 
                        simSlotStr={item.simulatorSlot} 
                      />
                      <p className="text-xs font-bold text-[#ff5a1f] mt-2">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-6 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="text-gray-900 font-bold">₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Booking Fee</span>
                  <span className="text-green-600 font-bold">Free</span>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <input 
                    type="text" 
                    placeholder="Discount code" 
                    value={couponInput}
                    disabled={!!appliedCoupon}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] transition-all disabled:opacity-50"
                  />
                  {appliedCoupon ? (
                    <button 
                      type="button" 
                      onClick={handleRemoveCoupon}
                      className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                    >
                      Remove
                    </button>
                  ) : (
                    <button 
                      type="button" 
                      onClick={handleApplyCoupon}
                      disabled={isValidatingCoupon || !couponInput.trim()}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                    >
                      {isValidatingCoupon ? "..." : "Apply"}
                    </button>
                  )}
                </div>

                {couponError && (
                  <p className="text-xs text-red-500 font-semibold">{couponError}</p>
                )}

                {appliedCoupon && (
                  <div className="flex justify-between text-sm text-green-600 font-bold bg-green-50 p-2.5 rounded-lg border border-green-100">
                    <span>Discount ({appliedCoupon.code} - {appliedCoupon.discountType === "percentage" ? `${appliedCoupon.value}%` : `₹${appliedCoupon.value}`})</span>
                    <span>-₹{appliedCoupon.discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm pt-2">
                  <span className="text-gray-500 font-medium">GST (18%)</span>
                  <span className="text-gray-900 font-bold">₹{gst.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-end pt-6 mt-6 border-t border-gray-100">
                <span className="text-xl font-black text-gray-900">Total</span>
                <span className="text-3xl font-black text-[#0d1b2a]">₹{grandTotal.toFixed(2)}</span>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100 text-center">
                <div className="flex items-center justify-center gap-2 mb-3 text-xs text-emerald-700 font-bold bg-emerald-50 py-1.5 px-3 rounded-full border border-emerald-100 inline-flex">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>256-Bit SSL Encrypted | {paymentConfig.gatewayName}</span>
                </div>
                <p className="text-[11px] text-gray-400 font-semibold mb-3 uppercase tracking-wider">Accepted Payment Options</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="bg-white border border-gray-200 px-2.5 py-1 rounded text-[11px] font-black text-blue-900 tracking-wider shadow-sm">VISA</span>
                  <span className="bg-white border border-gray-200 px-2.5 py-1 rounded text-[11px] font-bold text-red-600 shadow-sm">Mastercard</span>
                  <span className="bg-white border border-gray-200 px-2.5 py-1 rounded text-[11px] font-bold text-orange-600 shadow-sm">RuPay</span>
                  <span className="bg-white border border-gray-200 px-2.5 py-1 rounded text-[11px] font-bold text-blue-600 shadow-sm">AMEX</span>
                  <span className="bg-white border border-gray-200 px-2.5 py-1 rounded text-[11px] font-bold text-slate-700 shadow-sm">Diners</span>
                  <span className="bg-white border border-gray-200 px-2.5 py-1 rounded text-[11px] font-black text-emerald-700 shadow-sm">UPI</span>
                  <span className="bg-white border border-gray-200 px-2.5 py-1 rounded text-[11px] font-semibold text-gray-700 shadow-sm">Net Banking</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
