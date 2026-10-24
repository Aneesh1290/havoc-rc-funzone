"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  fetchBookingByIdAction, 
  fetchBookingsByOrderNumberAction,
  updateBookingStatusAction, 
  updateBookingTagsAction,
  cancelBookingAction
} from "@/app/actions/tickets";
import { formatOrderNumber, formatDateTime } from "@/lib/order-utils";
import { getSlotWristbandColor, getWristbandBadgeStyle } from "@/lib/slotColors";
import { hasUserPermission } from "@/lib/permissions";
import { ArrowLeft, ChevronDown, Edit2, Check, User, CreditCard, Tag } from "lucide-react";
import Link from "next/link";
import { SimPerkBadgeList } from "@/components/SimPerkBadgeList";

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

  // Tags editing
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  const loadBooking = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data: any = await fetchBookingByIdAction(id);
      if (data) {
        setBooking(data);
        if (data.tags) setTagsInput(data.tags);
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
  
  // Calculate subtotal across all items
  const itemsSubtotal = orderItems.reduce((acc, item) => {
    const rawAmt = Number(item.total_amount || 0);
    const qty = item.quantity || 1;
    const price = item.ticket_price || (rawAmt > 0 ? Math.round(rawAmt / qty) : 0);
    return acc + (price * qty);
  }, 0);

  // Compute total amount and 18% GST
  const rawSumTotal = orderItems.reduce((acc, item) => acc + Number(item.total_amount || 0), 0);
  const taxGst = rawSumTotal > itemsSubtotal
    ? (rawSumTotal - itemsSubtotal)
    : Math.round(itemsSubtotal * 0.18 * 100) / 100;
  const totalAmount = rawSumTotal > itemsSubtotal ? rawSumTotal : (itemsSubtotal + taxGst);
  const amountDue = isPaid ? 0 : totalAmount;

  const handleTogglePayment = async (status: string) => {
    setPaymentMenuOpen(false);
    await updateBookingStatusAction(booking.id, status, undefined);
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
          
          {/* Items Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-3">
              Items ({totalQuantity})
            </h2>

            <div className="space-y-6">
              {orderItems.map((item, idx) => {
                const itemQty = item.quantity || 1;
                const rawItemAmt = Number(item.total_amount || 0);
                const itemUnitPrice = item.ticket_price || (rawItemAmt > 0 ? Math.round(rawItemAmt / itemQty) : 0);
                const itemLineSubtotal = itemUnitPrice * itemQty;
                const itemIsPaid = (item.payment_status || booking.payment_status || "Paid").toLowerCase() === "paid";
                const itemIsFulfilled = (item.fulfillment_status || booking.fulfillment_status || "Fulfilled").toLowerCase() === "fulfilled";

                return (
                  <div key={item.id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-gray-100 gap-4 last:pb-0 last:border-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-gray-900 text-base">
                          {item.ticket_name ? item.ticket_name.replace("_", " ") : "Havoc Funzone Pass"}
                        </span>
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
                      </div>
                      <p className="text-xs text-gray-500">
                        Select Date: <strong className="text-gray-700 font-semibold">{item.booking_date}</strong>
                      </p>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
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
                              <span>{band.name} Band</span>
                            </span>
                          );
                        })()}
                      </div>
                      <div className="max-w-md">
                        <SimPerkBadgeList 
                          simNameStr={item.simulator_name} 
                          simSlotStr={item.simulator_slot} 
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-6 self-start sm:self-auto text-sm">
                      <span className="text-gray-500 font-medium">₹{itemUnitPrice.toFixed(2)}</span>
                      <span className="text-gray-400 font-semibold">×{itemQty}</span>
                      <span className="font-black text-gray-900 text-base">₹{itemLineSubtotal.toFixed(2)}</span>
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
                <span className="text-gray-500">Items</span>
                <span className="font-medium text-gray-900">₹{itemsSubtotal.toFixed(2)}</span>
              </div>
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
