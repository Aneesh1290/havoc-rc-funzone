"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  fetchBookingByIdAction, 
  fetchBookingsByOrderNumberAction,
  updateBookingStatusAction, 
  updateBookingPaymentRefAction,
  updateBookingTagsAction,
  updateBookingWristbandNumberAction,
  cancelBookingAction
} from "@/app/actions/tickets";
import { getSubcategoryBandsAction } from "@/app/actions/color-inventory";
import { formatOrderNumber, formatDateTime } from "@/lib/order-utils";
import { getSlotWristbandColor, getWristbandBadgeStyle } from "@/lib/slotColors";
import { hasUserPermission } from "@/lib/permissions";
import { ArrowLeft, ChevronDown, Edit2, Check, User, CreditCard, Tag, X, Building2, Printer, Sparkles, GraduationCap, PartyPopper, Briefcase, Flag, Users } from "lucide-react";
import Link from "next/link";
import { SimPerkBadgeList } from "@/components/SimPerkBadgeList";

interface EditingBandState {
  id: number;
  type: 'slot' | 'category';
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [booking, setBooking] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [subcategoryBands, setSubcategoryBands] = useState<any[]>([]);

  // Tags and Transaction ID editing
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [isEditingPaymentRef, setIsEditingPaymentRef] = useState(false);
  const [paymentRefInput, setPaymentRefInput] = useState("");
  const [isSavingRef, setIsSavingRef] = useState(false);

  // Wristband Number editing per item (supports 'slot' and 'category')
  const [editingBand, setEditingBand] = useState<EditingBandState | null>(null);
  const [bandInputs, setBandInputs] = useState<string[]>([]);
  const [isSavingBand, setIsSavingBand] = useState(false);
  const [bandAssignError, setBandAssignError] = useState<string | null>(null);

  useEffect(() => {
    getSubcategoryBandsAction()
      .then((res) => {
        if (res?.success && res.data) {
          setSubcategoryBands(res.data);
        }
      })
      .catch((err) => console.error("Failed to load subcategory bands:", err));
  }, []);

  const matchSubcategoryBand = (ticketName: string) => {
    if (!ticketName || !subcategoryBands || subcategoryBands.length === 0) return undefined;
    const clean = (s: string) => s.toLowerCase().replace(/[_\s-]+/g, '');
    const target = clean(ticketName);
    return subcategoryBands.find((b) => clean(b.category_name) === target);
  };

  const handleStartEditBand = (item: any, type: 'slot' | 'category' = 'slot') => {
    const qty = Math.max(1, item.quantity || 1);
    const rawCodes = type === 'category' ? (item.category_wristband_number || "") : (item.wristband_number || "");
    const existing = rawCodes
      .split(/[\s,]+/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    // Initialize inputs matching quantity
    const initialInputs: string[] = [];
    for (let i = 0; i < qty; i++) {
      initialInputs.push(existing[i] || "");
    }
    setEditingBand({ id: item.id, type });
    setBandInputs(initialInputs);
    setBandAssignError(null);
  };

  const handleSaveWristbandNumber = async (item: any, type: 'slot' | 'category' = 'slot') => {
    setIsSavingBand(true);
    setBandAssignError(null);
    try {
      const combinedCodes = bandInputs
        .map(b => b.trim())
        .filter(Boolean)
        .join(", ");

      if (type === 'category') {
        const catBand = matchSubcategoryBand(item.ticket_name);
        const res = await updateBookingWristbandNumberAction(item.id, combinedCodes, {
          color_hex: catBand?.color_hex,
          color_name: catBand?.color_name,
          category: catBand?.category_name || item.ticket_name,
          band_type: 'category'
        });

        if (!res.success) {
          setBandAssignError(res.error || "Failed to assign ticket wristband.");
          return;
        }
      } else {
        const bandColor = getSlotWristbandColor(item.time_slot, item.slot_color, item.slot_color_name);

        const res = await updateBookingWristbandNumberAction(item.id, combinedCodes, {
          color_hex: bandColor.hex,
          color_name: bandColor.name,
          band_type: 'slot'
        });

        if (!res.success) {
          setBandAssignError(res.error || "Failed to assign slot wristband.");
          return;
        }
      }

      setEditingBand(null);
      setBandAssignError(null);
      await loadBooking();
    } catch (e: any) {
      console.error(e);
      setBandAssignError(e.message || "Failed to assign wristband.");
    } finally {
      setIsSavingBand(false);
    }
  };


  const loadBooking = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data: any = await fetchBookingByIdAction(id);
      if (data) {
        setBooking(data);
        if (data.tags) setTagsInput(data.tags);
        if (data.payment_ref) setPaymentRefInput(data.payment_ref);
        const orderNum = data.order_number || data.id;
        const allItems: any[] = await fetchBookingsByOrderNumberAction(orderNum);
        setOrderItems(allItems && allItems.length > 0 ? allItems : [data]);
      } else {
        setBooking(null);
        setOrderItems([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth/session")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) setSessionUser(data.user);
      })
      .catch(() => {});
  }, []);

  const canManageStatus = hasUserPermission(sessionUser, "bookings:status");
  const canCollectPayment = hasUserPermission(sessionUser, "bookings:payment");

  useEffect(() => {
    loadBooking();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400">
        Loading order details...
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="py-24 text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Order not found</h2>
        <Link href="/admin/bookings" className="text-[#ff5a1f] font-bold hover:underline">
          Return to Orders
        </Link>
      </div>
    );
  }

  const effectiveOrderNumber = booking.order_number || booking.id;
  const orderCode = formatOrderNumber(effectiveOrderNumber, booking.created_at, booking.payment_status);
  const isPaid = (booking.payment_status || "Paid").toLowerCase() === "paid";
  const isFulfilled = (booking.fulfillment_status || "").toLowerCase() === "fulfilled" || (booking.fulfillment_status || "").toLowerCase() === "attended";

  const totalQuantity = orderItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
  
  // Check if any order item has recorded total_amount
  const hasRecordedTotal = orderItems.some(item => item.total_amount !== null && item.total_amount !== undefined && !isNaN(Number(item.total_amount)));
  const rawSumTotal = orderItems.reduce((acc, item) => acc + Number(item.total_amount || 0), 0);
  const baseItemsSubtotal = orderItems.reduce((acc, item) => {
    const qty = item.quantity || 1;
    return acc + ((item.ticket_price || 0) * qty);
  }, 0);
  const fullTariffWithGst = Math.round(baseItemsSubtotal * 1.18);

  // If total_amount was recorded in DB, use exact recorded total (even if 0 for 100% discount!)
  const totalAmount = hasRecordedTotal ? rawSumTotal : fullTariffWithGst;
  const itemsSubtotal = hasRecordedTotal ? Math.round((totalAmount / 1.18) * 100) / 100 : baseItemsSubtotal;
  const taxGst = Math.round((totalAmount - itemsSubtotal) * 100) / 100;
  const deposit = Number(booking?.deposit_amount || 0);
  const amountDue = isPaid ? 0 : (booking?.payment_status === "Partially paid" ? Math.max(0, totalAmount - deposit) : totalAmount);
  const discountTotal = Math.max(0, fullTariffWithGst - totalAmount);

  const handleTogglePayment = async (status: string) => {
    setPaymentMenuOpen(false);
    let refToSave: string | undefined = undefined;
    if (status.toLowerCase() === "paid" && !booking.payment_ref) {
      const enteredRef = prompt("Enter Transaction ID / Payment Reference (e.g. UPI Ref, POS Slip, Cash):", "");
      if (enteredRef !== null && enteredRef.trim()) {
        refToSave = enteredRef.trim();
      }
    }
    await updateBookingStatusAction(booking.id, status, undefined, refToSave);
    loadBooking();
  };

  const handleSavePaymentRef = async () => {
    setIsSavingRef(true);
    await updateBookingPaymentRefAction(booking.id, paymentRefInput);
    setIsSavingRef(false);
    setIsEditingPaymentRef(false);
    loadBooking();
  };

  const handleToggleFulfillment = async (status: string) => {
    setActionMenuOpen(false);
    await updateBookingStatusAction(booking.id, undefined, status);
    loadBooking();
  };

  const handleCancelOrder = async () => {
    setActionMenuOpen(false);
    if (confirm(`Are you sure you want to cancel order ${orderCode}? The status will be set to Canceled and Refunded, and any locked simulator slots will be released.`)) {
      await cancelBookingAction(booking.id);
      loadBooking();
    }
  };

  const handleSaveTags = async () => {
    await updateBookingTagsAction(booking.id, tagsInput);
    setIsEditingTags(false);
    loadBooking();
  };

  const isRefunded = (booking.payment_status || "").toLowerCase() === "refunded";
  const isCanceled = (booking.fulfillment_status || "").toLowerCase() === "canceled" || (booking.fulfillment_status || "").toLowerCase() === "cancelled";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumb: Orders > Order #PAYDUE_... */}
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
        <Link href="/admin/bookings" className="hover:text-gray-900 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Orders</span>
        </Link>
        <span>&gt;</span>
        <span className="text-gray-900 font-bold">Order {orderCode}</span>
      </div>

      {/* Main Order Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black font-heading text-gray-900 tracking-tight">
              Order {orderCode}
            </h1>

            {/* Payment badge */}
            {isRefunded ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                REFUNDED
              </span>
            ) : isPaid ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                PAID
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                UNPAID
              </span>
            )}

            {/* Fulfillment badge */}
            {isCanceled ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-50 text-red-600 border border-red-200">
                CANCELED
              </span>
            ) : isFulfilled ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                FULFILLED
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200">
                UNFULFILLED
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Placed on {formatDateTime(booking.created_at)}
          </p>
        </div>

        {/* Action Buttons - rendered based on permissions */}
        <div className="flex items-center gap-3">
          {/* More Actions dropdown matching screenshot - only if user has status/fulfillment permission */}
          {canManageStatus && (
            <div className="relative">
              <button
                onClick={() => {
                  setActionMenuOpen(!actionMenuOpen);
                  setPaymentMenuOpen(false);
                }}
                className="px-4 py-2.5 rounded-full bg-[#18202f] hover:bg-[#222d40] text-white font-bold text-sm flex items-center gap-1.5 shadow-sm transition-all border border-gray-700/50"
              >
                <span>More Actions</span>
                <span className="text-xs text-gray-400">∨</span>
              </button>

              {actionMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-[#1c2433] border border-gray-700/80 rounded-2xl shadow-2xl z-30 py-2 text-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => handleToggleFulfillment("Fulfilled")}
                    className="w-full text-left px-4 py-2.5 text-white hover:bg-white/10 font-bold flex items-center gap-2.5 transition-colors"
                  >
                    <span className="text-white font-black text-sm">✓</span>
                    <span>Mark as fulfilled</span>
                  </button>
                  <button
                    onClick={() => handleToggleFulfillment("Unfulfilled")}
                    className="w-full text-left px-4 py-2.5 text-white hover:bg-white/10 font-bold flex items-center gap-2.5 transition-colors"
                  >
                    <span className="text-white font-black text-sm">✕</span>
                    <span>Mark as unfulfilled</span>
                  </button>
                  <button
                    onClick={handleCancelOrder}
                    className="w-full text-left px-4 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold flex items-center gap-2.5 transition-colors"
                  >
                    <span className="text-red-400 font-black text-sm">✕</span>
                    <span>Cancel order</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Collect Payment dropdown matching screenshot - only if user has payment permission */}
          {canCollectPayment && (
            <div className="relative">
              <button
                onClick={() => {
                  setPaymentMenuOpen(!paymentMenuOpen);
                  setActionMenuOpen(false);
                }}
                className="px-5 py-2.5 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-sm flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
              >
                <span>Collect Payment</span>
                <span className="text-xs">∨</span>
              </button>

              {paymentMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#1c2433] border border-gray-700/80 rounded-2xl shadow-2xl z-30 py-2 text-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => handleTogglePayment("Paid")}
                    className="w-full text-left px-4 py-2.5 text-white hover:bg-white/10 font-bold flex items-center gap-2.5 transition-colors"
                  >
                    <span className="text-white font-black text-sm">✓</span>
                    <span>Mark as paid</span>
                  </button>
                  <button
                    onClick={() => handleTogglePayment("Unpaid")}
                    className="w-full text-left px-4 py-2.5 text-white hover:bg-white/10 font-bold flex items-center gap-2.5 transition-colors"
                  >
                    <span className="text-white font-black text-sm">✕</span>
                    <span>Mark as unpaid</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Items + Payment Info) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* VIP Band Offer Banner if Coupon Used */}
          {(booking.applied_coupon || orderItems.some(i => i.applied_coupon)) && (() => {
            const couponCode = booking.applied_coupon || orderItems.find(i => i.applied_coupon)?.applied_coupon;
            return (
              <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/10 via-amber-100/60 to-yellow-50 p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⭐</span>
                      <span className="text-xs font-black uppercase tracking-wider text-amber-950">
                        VIP Offer Wristband Activated
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 font-medium">
                      Customer applied promotional band coupon code: <strong className="font-mono font-black text-amber-950 text-sm px-2 py-0.5 rounded bg-amber-200/80 border border-amber-300">{couponCode}</strong>
                    </p>
                    <p className="text-[11px] text-amber-800">
                      VIP band inventory was automatically deducted. Please hand over the designated VIP wristband upon desk check-in.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-xl font-mono font-bold text-xs bg-amber-950 text-amber-300 shadow-sm border border-amber-800">
                      VIP WRISTBAND
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Organisation Reservation Details Card */}
          {booking?.organization_name && (
            <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/50 p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-900">
                        {booking.organization_type || "Organisation"} Reservation
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Group Booking
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-gray-900 font-heading">
                      {booking.organization_name}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 shadow-xs transition-colors self-start sm:self-auto"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Print Slip</span>
                </button>
              </div>

              {/* Grid with Headcount, Deposit, and Balance */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/80 p-4 rounded-xl border border-indigo-100/60 text-xs">
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Expected Guests</span>
                  <span className="font-bold text-gray-900 text-sm">{booking.expected_guests || totalQuantity} Attendees</span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Grand Total</span>
                  <span className="font-bold text-gray-900 text-sm font-mono">₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-emerald-600 uppercase font-bold text-[10px] block">Advance Paid</span>
                  <span className="font-bold text-emerald-700 text-sm font-mono">₹{deposit.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-amber-600 uppercase font-bold text-[10px] block">Balance Due</span>
                  <span className="font-bold text-amber-700 text-sm font-mono">₹{amountDue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Special Requests */}
              {booking.special_requests && (
                <div className="text-xs space-y-1 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
                  <span className="font-bold text-amber-900 block">Requested Arrangements & Setups:</span>
                  <p className="text-amber-800">{booking.special_requests}</p>
                </div>
              )}

              {/* Organization Notes */}
              {booking.organization_notes && (
                <div className="text-xs space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <span className="font-bold text-gray-700 block">Staff / Internal Notes:</span>
                  <p className="text-gray-600">{booking.organization_notes}</p>
                </div>
              )}

              {/* Collect Balance Action Button */}
              {amountDue > 0 && canCollectPayment && (
                <div className="pt-1 flex items-center justify-between bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  <div className="text-xs">
                    <span className="font-bold text-amber-900">Remaining Balance: ₹{amountDue.toLocaleString('en-IN')}</span>
                    <p className="text-[11px] text-amber-700">Collect payment upon arrival and mark reservation as fully paid.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePayment("Paid")}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all active:scale-95 shrink-0"
                  >
                    Collect Balance (₹{amountDue.toLocaleString('en-IN')})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Items Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-3">
              Items ({totalQuantity})
            </h2>

            <div className="space-y-6">
              {orderItems.map((item, idx) => {
                const itemQty = item.quantity || 1;
                const hasItemTotal = item.total_amount !== null && item.total_amount !== undefined && !isNaN(Number(item.total_amount));
                const catalogUnitPrice = item.ticket_price || 0;
                const catalogLineTotalWithGst = Math.round(catalogUnitPrice * itemQty * 1.18);
                const itemLineEffective = hasItemTotal ? Number(item.total_amount) : catalogLineTotalWithGst;
                const itemEffectiveSubtotalBeforeTax = Math.round((itemLineEffective / 1.18) * 100) / 100;
                const itemUnitPrice = itemQty > 0 ? (itemEffectiveSubtotalBeforeTax / itemQty) : 0;
                const isDiscounted = hasItemTotal && itemLineEffective < catalogLineTotalWithGst;
                const itemIsPaid = (item.payment_status || booking.payment_status || "Paid").toLowerCase() === "paid";
                const itemIsFulfilled = (item.fulfillment_status || booking.fulfillment_status || "Fulfilled").toLowerCase() === "fulfilled";

                return (
                  <div key={item.id || idx} className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b border-gray-100 gap-4 last:pb-0 last:border-0">
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Ticket Type & Sub-Category Band Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-gray-900 text-sm tracking-tight uppercase">
                          {item.ticket_name ? item.ticket_name.replace("_", " ") : "Havoc Funzone Pass"}
                        </span>

                        {/* Ticket Sub-Category Band Badge (if configured) */}
                        {(() => {
                          const catBand = matchSubcategoryBand(item.ticket_name);
                          if (catBand) {
                            const badgeStyle = getWristbandBadgeStyle(catBand.color_hex);
                            return (
                              <span 
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs"
                                style={{
                                  backgroundColor: badgeStyle.backgroundColor,
                                  borderColor: badgeStyle.borderColor,
                                  color: badgeStyle.color
                                }}
                              >
                                <span 
                                  className="w-2.5 h-2.5 rounded-full border shrink-0 shadow-inner"
                                  style={{ 
                                    backgroundColor: catBand.color_hex,
                                    borderColor: badgeStyle.dotBorderColor
                                  }}
                                />
                                <span>{catBand.color_name} Band</span>
                              </span>
                            );
                          }
                          return null;
                        })()}

                        {itemIsPaid && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-green-50 text-green-700 border border-green-200">
                            PAID
                          </span>
                        )}
                        {itemIsFulfilled && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            FULFILLED
                          </span>
                        )}

                        {/* Ticket Type Wristband Assignment */}
                        {editingBand?.id === item.id && editingBand?.type === 'category' ? (
                          <div className="inline-flex flex-col gap-1.5 bg-gray-50 border border-indigo-400 rounded-xl p-2 shadow-xs">
                            <div className="flex items-center justify-between text-[10px] font-bold text-gray-700 uppercase tracking-wide border-b border-gray-200 pb-1">
                              <span>Assign {item.ticket_name ? item.ticket_name.replace("_", " ") : "Ticket"} Band #{bandInputs.length > 1 ? ` (1 to ${bandInputs.length})` : ''}:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveWristbandNumber(item, 'category')}
                                  disabled={isSavingBand}
                                  className="text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-xs"
                                  title="Save Ticket Bands"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingBand(null)}
                                  disabled={isSavingBand}
                                  className="text-gray-500 hover:text-gray-700 p-0.5 hover:bg-gray-200 rounded"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {bandInputs.map((val, bIdx) => (
                                <div key={bIdx} className="flex items-center gap-1">
                                  {bandInputs.length > 1 && (
                                    <span className="text-[10px] font-black text-gray-400 font-mono">
                                      #{bIdx + 1}:
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => {
                                      const next = [...bandInputs];
                                      next[bIdx] = e.target.value;
                                      setBandInputs(next);
                                    }}
                                    placeholder={`Band ${bIdx + 1}`}
                                    className="w-24 text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                                    autoFocus={bIdx === 0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveWristbandNumber(item, 'category');
                                      if (e.key === "Escape") setEditingBand(null);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                            {bandAssignError && (
                              <div className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1 leading-tight flex items-start gap-1">
                                <span className="font-black text-red-500">⚠️</span>
                                <span>{bandAssignError}</span>
                              </div>
                            )}
                          </div>
                        ) : item.category_wristband_number ? (
                          <div className="inline-flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                              Ticket Band:
                            </span>
                            {item.category_wristband_number.split(/[\s,]+/).filter(Boolean).map((bCode: string, bIdx: number) => (
                              <span key={bIdx} className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-300 text-indigo-900 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-xs">
                                <span className="text-indigo-600 text-xs font-black">#</span>
                                <span><strong className="text-indigo-950 font-black font-mono">{bCode}</strong></span>
                              </span>
                            ))}
                            <button
                              onClick={() => handleStartEditBand(item, 'category')}
                              className="text-indigo-700 hover:text-indigo-950 p-1 hover:bg-indigo-100 rounded-full transition-colors"
                              title="Edit Assigned Ticket Bands"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditBand(item, 'category')}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 border-dashed px-2.5 py-0.5 rounded-full transition-all shadow-2xs"
                            title={`Assign wristband numbers for ${item.ticket_name || 'Ticket'}`}
                          >
                            <span>+ Assign {item.ticket_name ? item.ticket_name.replace("_", " ") : "Ticket"} Band # ({Math.max(1, item.quantity || 1)})</span>
                          </button>
                        )}
                      </div>

                      {/* Date Row */}
                      <p className="text-xs text-gray-500">
                        Select Date: <strong className="text-gray-700 font-semibold">{item.booking_date}</strong>
                      </p>

                      {/* Time Slot & Slot Band Row */}
                      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 pt-0.5">
                        <span>Select Time Slot:</span>
                        <strong className="text-gray-900 font-bold">{item.time_slot}</strong>
                        {item.time_slot && (() => {
                          const band = getSlotWristbandColor(item.time_slot, item.slot_color, item.slot_color_name);
                          const badgeStyle = getWristbandBadgeStyle(band.hex);
                          return (
                            <span 
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs"
                              style={{
                                backgroundColor: badgeStyle.backgroundColor,
                                borderColor: badgeStyle.borderColor,
                                color: badgeStyle.color
                              }}
                            >
                              <span 
                                className="w-2.5 h-2.5 rounded-full border shrink-0 shadow-inner"
                                style={{ 
                                  backgroundColor: band.hex,
                                  borderColor: badgeStyle.dotBorderColor
                                }}
                              />
                              <span>{band.name} Slot Band</span>
                            </span>
                          );
                        })()}

                        {/* Slot Wristband Number Section */}
                        {editingBand?.id === item.id && editingBand?.type === 'slot' ? (
                          <div className="inline-flex flex-col gap-1.5 bg-gray-50 border border-blue-400 rounded-xl p-2 shadow-xs">
                            <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-1">
                              <span>Assign Slot Band #{bandInputs.length > 1 ? ` (1 to ${bandInputs.length})` : ''}:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSaveWristbandNumber(item, 'slot')}
                                  disabled={isSavingBand}
                                  className="text-white bg-green-600 hover:bg-green-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-xs"
                                  title="Save All Bands"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingBand(null)}
                                  disabled={isSavingBand}
                                  className="text-gray-500 hover:text-gray-700 p-0.5 hover:bg-gray-200 rounded"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {bandInputs.map((val, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  {bandInputs.length > 1 && (
                                    <span className="text-[10px] font-black text-gray-400 font-mono">
                                      #{idx + 1}:
                                    </span>
                                  )}
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => {
                                      const next = [...bandInputs];
                                      next[idx] = e.target.value;
                                      setBandInputs(next);
                                    }}
                                    placeholder={`Band ${idx + 1}`}
                                    className="w-24 text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                    autoFocus={idx === 0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveWristbandNumber(item, 'slot');
                                      if (e.key === "Escape") setEditingBand(null);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                            {bandAssignError && (
                              <div className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1 leading-tight flex items-start gap-1">
                                <span className="font-black text-red-500">⚠️</span>
                                <span>{bandAssignError}</span>
                              </div>
                            )}
                          </div>
                        ) : item.wristband_number ? (
                          <div className="inline-flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Slot Band:
                            </span>
                            {item.wristband_number.split(/[\s,]+/).filter(Boolean).map((bCode: string, bIdx: number) => (
                              <span key={bIdx} className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-900 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-xs">
                                <span className="text-amber-600 text-xs font-black">#</span>
                                <span><strong className="text-amber-950 font-black font-mono">{bCode}</strong></span>
                              </span>
                            ))}
                            <button
                              onClick={() => handleStartEditBand(item, 'slot')}
                              className="text-amber-700 hover:text-amber-950 p-1 hover:bg-amber-100 rounded-full transition-colors"
                              title="Edit Assigned Slot Bands"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditBand(item, 'slot')}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 border-dashed px-2.5 py-0.5 rounded-full transition-all shadow-2xs"
                          >
                            <span>+ Assign Slot Band # ({Math.max(1, item.quantity || 1)})</span>
                          </button>
                        )}
                      </div>
                      <div className="max-w-md">
                        <SimPerkBadgeList 
                          simNameStr={item.simulator_name} 
                          simSlotStr={item.simulator_slot} 
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-6 self-start sm:self-auto text-sm">
                      <div className="text-right">
                        {isDiscounted && catalogUnitPrice > 0 && (
                          <span className="text-xs text-gray-400 line-through mr-1.5 block sm:inline">
                            ₹{catalogUnitPrice.toFixed(2)}
                          </span>
                        )}
                        <span className="text-gray-700 font-bold">₹{itemUnitPrice.toFixed(2)}</span>
                      </div>
                      <span className="text-gray-400 font-semibold">×{itemQty}</span>
                      <div className="text-right">
                        {isDiscounted && (
                          <span className="text-xs text-gray-400 line-through block font-normal">
                            ₹{catalogLineTotalWithGst.toFixed(2)}
                          </span>
                        )}
                        <span className="font-black text-gray-900 text-base">₹{itemLineEffective.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Info Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-bold text-gray-900">Payment info</h2>
              {isPaid ? (
                <span className="px-2.5 py-0.5 rounded text-xs font-black uppercase bg-green-50 text-green-700 border border-green-200">
                  PAID
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded text-xs font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                  UNPAID
                </span>
              )}
            </div>

            <div className="space-y-2.5 pt-1 text-sm text-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Tariff Subtotal</span>
                <span className="font-medium text-gray-900">₹{baseItemsSubtotal.toFixed(2)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between items-center text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span>🏷️ Coupon Discount</span>
                    {(booking.applied_coupon || orderItems.find(i => i.applied_coupon)?.applied_coupon) && (
                      <span className="font-mono bg-emerald-200/80 text-emerald-950 px-1.5 py-0.5 rounded text-[11px] font-black border border-emerald-300">
                        {booking.applied_coupon || orderItems.find(i => i.applied_coupon)?.applied_coupon}
                      </span>
                    )}
                  </span>
                  <span>-₹{discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Shipping / Desk Booking</span>
                <span className="text-green-600 font-bold">Free</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Tax (18% GST)</span>
                <span className="font-medium text-gray-900">₹{taxGst.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xl font-black text-gray-900">
              <span>Total</span>
              <span className="text-2xl text-[#0d1b2a]">₹{totalAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-sm font-semibold text-gray-500 pt-1">
              <span>Amount due</span>
              <span className={amountDue > 0 ? "text-amber-600 font-bold" : "text-gray-900 font-medium"}>
                ₹{amountDue.toFixed(2)}
              </span>
            </div>

            {/* Transaction ID / Payment Reference Section */}
            <div className="pt-3 border-t border-gray-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Transaction ID / Payment Ref
                </span>
                {canCollectPayment && !isEditingPaymentRef && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentRefInput(booking.payment_ref || "");
                      setIsEditingPaymentRef(true);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{booking.payment_ref ? "Edit" : "+ Add Transaction ID"}</span>
                  </button>
                )}
              </div>

              {isEditingPaymentRef ? (
                <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={paymentRefInput}
                    onChange={(e) => setPaymentRefInput(e.target.value)}
                    placeholder="e.g. UPI Ref / Cash / POS Slip"
                    className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    disabled={isSavingRef}
                    onClick={handleSavePaymentRef}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs disabled:opacity-50"
                  >
                    {isSavingRef ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPaymentRef(false);
                      setPaymentRefInput(booking.payment_ref || "");
                    }}
                    className="px-2.5 py-1.5 text-gray-500 hover:text-gray-700 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-800 flex items-center justify-between">
                  <span className="truncate">
                    {booking.payment_ref ? booking.payment_ref : <span className="font-sans text-gray-400 font-normal italic">No transaction reference recorded</span>}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (Order info + Tags) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Order Info Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">
              Order info
            </h2>

            <div className="space-y-3.5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact info</p>
              
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f] font-black text-xs flex items-center justify-center shrink-0 border border-[#ff5a1f]/20">
                  {booking.customer_name ? booking.customer_name.charAt(0).toUpperCase() : "G"}
                </div>
                <div className="font-bold text-gray-900 text-sm">
                  {booking.customer_name || "Guest Customer"}
                </div>
              </div>

              <div className="text-xs text-gray-600 space-y-1.5 pt-1 border-t border-gray-100">
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">Email:</span>
                  <span className="font-medium text-gray-900">{booking.customer_email || "No email"}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-gray-400">Phone:</span>
                  <span className="font-medium text-gray-900">{booking.customer_phone || "No phone"}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Tags Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Tag className="w-4 h-4 text-[#ff5a1f]" />
              <h2 className="text-base font-bold text-gray-900">Tags</h2>
            </div>

            {isEditingTags ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. VIP, Birthday, Desk"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsEditingTags(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTags}
                    className="text-xs bg-[#ff5a1f] text-white px-3 py-1 rounded-lg font-bold hover:bg-[#e04812]"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setIsEditingTags(true)}
                className="border border-dashed border-gray-300 hover:border-[#ff5a1f] rounded-xl p-3 text-center cursor-pointer transition-colors text-xs text-gray-500 hover:text-[#ff5a1f]"
              >
                {booking.tags ? (
                  <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md font-semibold">
                    {booking.tags}
                  </span>
                ) : (
                  <span>+ Assign Tags</span>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
