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
  cancelBookingAction,
  fetchAvailableAddonsAction,
  addAddonToOrderAction,
  removeOrderItemAction,
  upgradeBookingItemAction,
  updateBookingScheduleAndContactAction,
  fetchTicketsAction,
  fetchTimeSlotsAction
} from "@/app/actions/tickets";
import { getSubcategoryBandsAction } from "@/app/actions/color-inventory";
import { formatOrderNumber, formatDateTime } from "@/lib/order-utils";
import { getSlotWristbandColor, getWristbandBadgeStyle } from "@/lib/slotColors";
import { hasUserPermission } from "@/lib/permissions";
import { ArrowLeft, ChevronDown, Edit2, Check, User, CreditCard, Tag, X, Building2, Printer, Sparkles, GraduationCap, PartyPopper, Briefcase, Flag, Users, Send, ExternalLink, Loader2, Plus, Trash2, Calendar, Clock, ArrowUpCircle, Phone, Mail } from "lucide-react";
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

  // Advance Payment Notification State
  const [isSendingAdvance, setIsSendingAdvance] = useState(false);
  const [advanceStatusMsg, setAdvanceStatusMsg] = useState<{ type: "success" | "error"; text: string; paymentUrl?: string; waDirectUrl?: string } | null>(null);

  // Add Add-on / Activity State
  const [isAddAddonModalOpen, setIsAddAddonModalOpen] = useState(false);
  const [availableAddons, setAvailableAddons] = useState<any[]>([]);
  const [selectedAddonId, setSelectedAddonId] = useState<number | string>("");
  const [addonQuantity, setAddonQuantity] = useState<number>(2);
  const [isSubmittingAddon, setIsSubmittingAddon] = useState(false);
  const [addonError, setAddonError] = useState<string | null>(null);
  const [isDeletingItemId, setIsDeletingItemId] = useState<number | null>(null);

  // Upgrade Package State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradingItem, setUpgradingItem] = useState<any | null>(null);
  const [upgradeTicketsList, setUpgradeTicketsList] = useState<any[]>([]);
  const [targetUpgradeTicketId, setTargetUpgradeTicketId] = useState<number | string>("");
  const [upgradePaymentConfirmed, setUpgradePaymentConfirmed] = useState(true);
  const [upgradePaymentMode, setUpgradePaymentMode] = useState<string>("Cash");
  const [upgradePaymentRef, setUpgradePaymentRef] = useState<string>("");
  const [customDiffAmount, setCustomDiffAmount] = useState<string>("");
  const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // Reschedule (Date & Slot) State
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleTargetItem, setRescheduleTargetItem] = useState<any | null>(null);
  const [rescheduleScope, setRescheduleScope] = useState<'order' | 'item'>('order');
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState<string>("");
  const [availableTimeSlots, setAvailableTimeSlots] = useState<any[]>([]);
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Contact Details Edit State
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactNameInput, setContactNameInput] = useState<string>("");
  const [contactPhoneInput, setContactPhoneInput] = useState<string>("");
  const [contactEmailInput, setContactEmailInput] = useState<string>("");
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

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
        setContactNameInput(data.customer_name || "");
        setContactPhoneInput(data.customer_phone || "");
        setContactEmailInput(data.customer_email || "");
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

  const handleOpenAddAddonModal = async () => {
    setIsAddAddonModalOpen(true);
    setAddonError(null);
    try {
      const addons = await fetchAvailableAddonsAction();
      setAvailableAddons(addons || []);
      if (addons && addons.length > 0) {
        // Prefer excavator if available, otherwise first item
        const exc = addons.find((a: any) => a.name && a.name.toUpperCase().includes("EXCAVATOR"));
        setSelectedAddonId(exc ? exc.id : addons[0].id);
      }
    } catch (err) {
      console.error("Failed to load addons:", err);
    }
  };

  const handleAddAddonSubmit = async () => {
    if (!selectedAddonId) {
      setAddonError("Please select an add-on activity.");
      return;
    }
    setIsSubmittingAddon(true);
    setAddonError(null);
    try {
      const targetOrderNum = booking.order_number || booking.id;
      const res = await addAddonToOrderAction({
        orderNumber: targetOrderNum,
        ticketId: Number(selectedAddonId),
        quantity: addonQuantity
      });
      if (!res.success) {
        setAddonError(res.error || "Failed to add add-on.");
        return;
      }
      setIsAddAddonModalOpen(false);
      await loadBooking();
    } catch (err: any) {
      setAddonError(err.message || "Failed to add add-on.");
    } finally {
      setIsSubmittingAddon(false);
    }
  };

  const handleRemoveItem = async (itemId: number, ticketName?: string) => {
    if (!window.confirm(`Delete "${ticketName ? ticketName.replace('_', ' ') : 'this product'}" from this order? This will remove it and update the order total.`)) return;
    setIsDeletingItemId(itemId);
    try {
      const targetOrderNum = booking.order_number || booking.id;
      const res = await removeOrderItemAction(itemId, targetOrderNum);
      if (!res.success) {
        alert(res.error || "Failed to delete item.");
        return;
      }
      await loadBooking();
    } catch (err: any) {
      alert(err.message || "Failed to delete item.");
    } finally {
      setIsDeletingItemId(null);
    }
  };

  // Upgrade Handlers
  const handleOpenUpgradeModal = async (item: any) => {
    setUpgradingItem(item);
    setUpgradeError(null);
    setUpgradePaymentConfirmed(true);
    setUpgradePaymentMode("Cash");
    setUpgradePaymentRef("");
    setCustomDiffAmount("");
    setIsUpgradeModalOpen(true);
    try {
      const allTickets = await fetchTicketsAction();
      const validTargets = (allTickets || []).filter(
        (t: any) => t.id !== item.ticket_id && t.active && !t.is_addon && !t.name.toUpperCase().includes("ORGANISATION")
      );
      setUpgradeTicketsList(validTargets);
      if (validTargets.length > 0) {
        const higher = validTargets.find((t: any) => Number(t.price) > Number(item.ticket_price || 0));
        setTargetUpgradeTicketId(higher ? higher.id : validTargets[0].id);
      }
    } catch (err) {
      console.error("Failed to load tickets for upgrade:", err);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (!upgradingItem || !targetUpgradeTicketId) {
      setUpgradeError("Please select a target ticket package to upgrade to.");
      return;
    }
    setIsSubmittingUpgrade(true);
    setUpgradeError(null);
    try {
      const targetOrderNum = booking.order_number || booking.id;
      const res = await upgradeBookingItemAction({
        orderNumber: targetOrderNum,
        bookingItemId: upgradingItem.id,
        targetTicketId: Number(targetUpgradeTicketId),
        paymentConfirmed: upgradePaymentConfirmed,
        paymentMode: upgradePaymentMode,
        paymentRef: upgradePaymentRef.trim() || undefined,
        customDiffAmount: customDiffAmount !== "" && !isNaN(Number(customDiffAmount)) ? Number(customDiffAmount) : undefined
      });

      if (!res.success) {
        setUpgradeError(res.error || "Failed to process upgrade.");
        return;
      }

      setIsUpgradeModalOpen(false);
      setUpgradingItem(null);
      await loadBooking();
    } catch (err: any) {
      setUpgradeError(err.message || "Failed to process upgrade.");
    } finally {
      setIsSubmittingUpgrade(false);
    }
  };

  // Reschedule Handlers
  const handleOpenRescheduleModal = async (item?: any) => {
    setRescheduleTargetItem(item || null);
    setRescheduleScope(item ? "item" : "order");
    setRescheduleDate(item?.booking_date || booking?.booking_date || "");
    setRescheduleTimeSlot(item?.time_slot || booking?.time_slot || "");
    setRescheduleError(null);
    setIsRescheduleModalOpen(true);
    try {
      const slots = await fetchTimeSlotsAction(true);
      setAvailableTimeSlots(slots || []);
    } catch (err) {
      console.error("Failed to load time slots:", err);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleDate.trim() || !rescheduleTimeSlot.trim()) {
      setRescheduleError("Please select both a booking date and a time slot.");
      return;
    }
    setIsSubmittingReschedule(true);
    setRescheduleError(null);
    try {
      const targetOrderNum = booking.order_number || booking.id;
      const res = await updateBookingScheduleAndContactAction({
        orderNumber: targetOrderNum,
        bookingItemId: rescheduleTargetItem?.id,
        scope: rescheduleScope,
        newDate: rescheduleDate.trim(),
        newTimeSlot: rescheduleTimeSlot.trim()
      });

      if (!res.success) {
        setRescheduleError(res.error || "Failed to reschedule booking.");
        return;
      }

      setIsRescheduleModalOpen(false);
      await loadBooking();
    } catch (err: any) {
      setRescheduleError(err.message || "Failed to reschedule booking.");
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  // Contact Info Handlers
  const handleSaveContact = async () => {
    if (!contactNameInput.trim()) {
      setContactError("Customer name cannot be empty.");
      return;
    }
    setIsSavingContact(true);
    setContactError(null);
    try {
      const targetOrderNum = booking.order_number || booking.id;
      const res = await updateBookingScheduleAndContactAction({
        orderNumber: targetOrderNum,
        customerName: contactNameInput.trim(),
        customerPhone: contactPhoneInput.trim(),
        customerEmail: contactEmailInput.trim()
      });

      if (!res.success) {
        setContactError(res.error || "Failed to save contact details.");
        return;
      }

      setIsEditingContact(false);
      await loadBooking();
    } catch (err: any) {
      setContactError(err.message || "Failed to save contact details.");
    } finally {
      setIsSavingContact(false);
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

  // Group-level statuses: aggregate across all items in order
  const allItems = orderItems.length > 0 ? orderItems : [booking];
  const allPaid = allItems.every((item) => (item.payment_status || "").toLowerCase() === "paid");
  const anyPaid = allItems.some((item) => (item.payment_status || "").toLowerCase() === "paid");
  const anyPartiallyPaid = allItems.some((item) => (item.payment_status || "").toLowerCase() === "partially paid");

  const allCanceled = allItems.every((item) => {
    const f = (item.fulfillment_status || "").toLowerCase();
    const p = (item.payment_status || "").toLowerCase();
    return f === "canceled" || f === "cancelled" || p === "refunded";
  });
  const nonCanceledItems = allItems.filter((item) => {
    const f = (item.fulfillment_status || "").toLowerCase();
    const p = (item.payment_status || "").toLowerCase();
    return f !== "canceled" && f !== "cancelled" && p !== "refunded";
  });
  const anyFulfilled = allItems.some((item) => {
    const f = (item.fulfillment_status || "").toLowerCase();
    return f === "fulfilled" || f === "attended";
  });
  const allActiveFulfilled = nonCanceledItems.length > 0 && nonCanceledItems.every((item) => {
    const f = (item.fulfillment_status || "").toLowerCase();
    return f === "fulfilled" || f === "attended";
  });

  const isPaid = allPaid;
  const isPartiallyPaid = !allPaid && (anyPaid || anyPartiallyPaid);
  const isRefunded = allItems.every((item) => (item.payment_status || "").toLowerCase() === "refunded");
  const isCanceled = allCanceled;
  const isFulfilled = !allCanceled && allActiveFulfilled;
  const isPartiallyFulfilled = !allCanceled && !allActiveFulfilled && anyFulfilled;

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

  const handleSendAdvancePaymentNotification = async () => {
    if (!booking.customer_phone) {
      alert("This booking does not have a customer phone number.");
      return;
    }
    const unpaidItemIds = orderItems.filter(i => (i.payment_status || "").toLowerCase() !== "paid").map(i => i.id);
    const targetIds = unpaidItemIds.length > 0 ? unpaidItemIds : [booking.id];

    if (!confirm(`Send advance WhatsApp payment link notification to ${booking.customer_name || 'Customer'} (${booking.customer_phone}) for ₹${amountDue.toFixed(2)}?`)) {
      return;
    }

    setIsSendingAdvance(true);
    setAdvanceStatusMsg(null);

    try {
      const res = await fetch("/api/admin/advance-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_number: effectiveOrderNumber,
          booking_ids: targetIds,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.success) {
        setAdvanceStatusMsg({
          type: "success",
          text: data.message || "Advance payment notification sent successfully via WhatsApp!",
          paymentUrl: data.paymentUrl,
          waDirectUrl: data.waDirectUrl,
        });
        loadBooking();
      } else {
        setAdvanceStatusMsg({
          type: "error",
          text: data.error || "Failed to send advance payment notification.",
        });
      }
    } catch (err: any) {
      setAdvanceStatusMsg({
        type: "error",
        text: err.message || "Network error while sending notification.",
      });
    } finally {
      setIsSendingAdvance(false);
    }
  };

  const handleSaveTags = async () => {
    await updateBookingTagsAction(booking.id, tagsInput);
    setIsEditingTags(false);
    loadBooking();
  };

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
            ) : isPartiallyPaid ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-yellow-50 text-yellow-800 border border-yellow-300">
                PARTIALLY PAID
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
            ) : isPartiallyFulfilled ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                PARTIALLY FULFILLED
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
                    onClick={() => {
                      setActionMenuOpen(false);
                      handleOpenRescheduleModal();
                    }}
                    className="w-full text-left px-4 py-2.5 text-indigo-300 hover:bg-white/10 font-bold flex items-center gap-2.5 transition-colors border-b border-gray-700/50"
                  >
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Reschedule Date & Slot</span>
                  </button>
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

          {/* Direct Reschedule Order Button */}
          {canManageStatus && !isCanceled && (
            <button
              onClick={() => handleOpenRescheduleModal()}
              className="px-4 py-2.5 rounded-full bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all border border-gray-200"
              title="Reschedule booking date and time slot"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Reschedule</span>
            </button>
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

          {/* Advance Booking Notification Button (when unpaid/partially paid) */}
          {!isPaid && !isCanceled && !isRefunded && (
            <button
              onClick={handleSendAdvancePaymentNotification}
              disabled={isSendingAdvance}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-60"
              title="Send WhatsApp payment link notification so customer can pay before arrival"
            >
              {isSendingAdvance ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Advance Payment Link</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Notification Feedback Banner */}
      {advanceStatusMsg && (
        <div className={`p-4 rounded-2xl border text-sm flex items-start justify-between gap-3 ${
          advanceStatusMsg.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
            : "bg-red-50 border-red-200 text-red-900"
        }`}>
          <div className="space-y-1">
            <p className="font-bold flex items-center gap-2">
              <span>{advanceStatusMsg.type === "success" ? "✓" : "✕"}</span>
              <span>{advanceStatusMsg.text}</span>
            </p>
            {advanceStatusMsg.paymentUrl && (
              <p className="text-xs">
                Payment Link: <a href={advanceStatusMsg.paymentUrl} target="_blank" rel="noreferrer" className="underline font-mono font-bold">{advanceStatusMsg.paymentUrl}</a>
              </p>
            )}
            {advanceStatusMsg.waDirectUrl && (
              <p className="text-xs">
                WhatsApp Direct Link: <a href={advanceStatusMsg.waDirectUrl} target="_blank" rel="noreferrer" className="underline font-bold text-teal-800">Open in WhatsApp Web</a>
              </p>
            )}
          </div>
          <button 
            onClick={() => setAdvanceStatusMsg(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Advance Notification Timestamp Banner (if already sent) */}
      {booking.advance_notified_at && (
        <div className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/70 text-teal-900 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔔</span>
            <span>
              <strong>Advance Payment Link sent:</strong> Customer received the advance payment notification on <strong className="font-semibold">{formatDateTime(booking.advance_notified_at)}</strong>.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 font-bold text-[11px] border border-teal-300">
            Advance Notified
          </span>
        </div>
      )}

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

              {/* Grid with Headcount and Reserved Slots */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white/80 p-4 rounded-xl border border-indigo-100/60 text-xs">
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Expected Headcount</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {booking.expected_guests ? `${booking.expected_guests} Attendees` : `${booking.quantity || 1} Attendees`}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Reservation Status</span>
                  <span className="font-bold text-emerald-700 text-sm">Pure Reservation (Slot Locked)</span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block">Reserved Arena Slots</span>
                  <span className="font-bold text-indigo-700 text-sm font-mono">{orderItems.length} Slot{orderItems.length > 1 ? "s" : ""}</span>
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

          {/* Items / Reserved Slots Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-3 flex items-center justify-between">
              <span>{booking?.organization_name ? "Reserved Arena Slots" : "Items"} ({booking?.organization_name ? orderItems.length : totalQuantity})</span>
              {booking?.organization_name ? (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                  Fixed Quotation / Pure Reservation
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAddAddonModal}
                  className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  title="Add an activity or addon (e.g. RC Excavator Activity) to this booking"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Add-On</span>
                </button>
              )}
            </h2>

            <div className="space-y-6">
              {orderItems.map((item, idx) => {
                const isOrgReservation = Boolean(booking?.organization_name || item.organization_name);
                const itemQty = item.quantity || 1;
                const hasItemTotal = item.total_amount !== null && item.total_amount !== undefined && !isNaN(Number(item.total_amount));
                const catalogUnitPrice = item.ticket_price || 0;
                const catalogLineTotalWithGst = Math.round(catalogUnitPrice * itemQty * 1.18);
                const itemLineEffective = hasItemTotal ? Number(item.total_amount) : catalogLineTotalWithGst;
                const itemEffectiveSubtotalBeforeTax = Math.round((itemLineEffective / 1.18) * 100) / 100;
                const itemUnitPrice = itemQty > 0 ? (itemEffectiveSubtotalBeforeTax / itemQty) : 0;
                const isDiscounted = hasItemTotal && itemLineEffective < catalogLineTotalWithGst;
                const itemIsPaid = (item.payment_status || "").toLowerCase() === "paid";
                const itemIsPartiallyPaid = (item.payment_status || "").toLowerCase() === "partially paid";
                const itemIsRefunded = (item.payment_status || "").toLowerCase() === "refunded";
                const itemIsCanceled = (item.fulfillment_status || "").toLowerCase() === "canceled" || (item.fulfillment_status || "").toLowerCase() === "cancelled";
                const itemIsFulfilled = (item.fulfillment_status || "").toLowerCase() === "fulfilled" || (item.fulfillment_status || "").toLowerCase() === "attended";
                const isAddonActivity = Boolean(
                  item.is_addon === 1 || 
                  (item.ticket_name && (
                    item.ticket_name.toUpperCase().includes("EXCAVATOR") || 
                    item.ticket_name.toUpperCase().includes("DUMP") ||
                    item.ticket_name.toUpperCase().includes("ADDON") ||
                    item.ticket_name.toUpperCase().includes("ADD-ON")
                  ))
                );

                return (
                  <div key={item.id || idx} className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b border-gray-100 gap-4 last:pb-0 last:border-0">
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Ticket Type & Sub-Category Band Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-gray-900 text-sm tracking-tight uppercase">
                          {isOrgReservation 
                            ? `${booking?.organization_type || "Organisation"} Reservation Session`
                            : (item.ticket_name ? item.ticket_name.replace("_", " ") : "Havoc Funzone Pass")}
                        </span>

                        {/* Ticket Sub-Category Band Badge (if configured) */}
                        {!isOrgReservation && (() => {
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

                        {/* Upgrade Package Button */}
                        {!isOrgReservation && !isAddonActivity && canManageStatus && !itemIsCanceled && (
                          <button
                            type="button"
                            onClick={() => handleOpenUpgradeModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300 transition-all shadow-2xs active:scale-95 cursor-pointer"
                            title={`Upgrade ${item.ticket_name} to higher package`}
                          >
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>Upgrade</span>
                          </button>
                        )}

                        {/* Item Payment Status Badge */}
                        {itemIsRefunded ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                            REFUNDED
                          </span>
                        ) : itemIsPaid ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-green-50 text-green-700 border border-green-200">
                            PAID
                          </span>
                        ) : itemIsPartiallyPaid ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-yellow-50 text-yellow-800 border border-yellow-300">
                            PARTIALLY PAID
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            UNPAID
                          </span>
                        )}

                        {/* Item Fulfillment Status Badge */}
                        {itemIsCanceled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-50 text-red-600 border border-red-200">
                            CANCELED
                          </span>
                        ) : itemIsFulfilled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            FULFILLED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-orange-50 text-orange-700 border border-orange-200">
                            UNFULFILLED
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
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Select Date:</span>
                        <strong className="text-gray-900 font-semibold">{item.booking_date}</strong>
                        {canManageStatus && !itemIsCanceled && (
                          <button
                            type="button"
                            onClick={() => handleOpenRescheduleModal(item)}
                            className="text-gray-400 hover:text-indigo-600 p-0.5 rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
                            title="Reschedule Date / Time Slot"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span className="text-[10px] text-indigo-600 font-bold hover:underline">Reschedule</span>
                          </button>
                        )}
                      </div>

                      {/* Time Slot & Slot Band Row */}
                      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 pt-0.5">
                        <span>Select Time Slot:</span>
                        <strong className="text-gray-900 font-bold">{item.time_slot}</strong>
                        {canManageStatus && !itemIsCanceled && (
                          <button
                            type="button"
                            onClick={() => handleOpenRescheduleModal(item)}
                            className="text-gray-400 hover:text-indigo-600 p-0.5 rounded hover:bg-gray-100 transition-colors"
                            title="Reschedule Time Slot"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        {isAddonActivity ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Add-on Activity (No Slot Band Required)
                          </span>
                        ) : (
                          <>
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
                          </>
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
                      {isOrgReservation ? (
                        <div className="text-right">
                          <span className="inline-block px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                            🔒 Pure Slot Reservation
                          </span>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}

                      {/* Delete / Remove Product Button */}
                      {orderItems.length > 1 && canManageStatus && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id, item.ticket_name)}
                          disabled={isDeletingItemId === item.id}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all ml-2 shrink-0 flex items-center gap-1 shadow-2xs active:scale-95"
                          title={`Delete ${item.ticket_name || 'product'} from this order`}
                        >
                          {isDeletingItemId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              <span className="text-[11px] font-bold text-red-700">Delete</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Info Card */}
          {!booking?.organization_name && (
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
          )}

        </div>

        {/* Right Column (Order info + Tags) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Order Info Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">
              Order info
            </h2>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact info</p>
                {canManageStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingContact(!isEditingContact);
                      setContactNameInput(booking.customer_name || "");
                      setContactPhoneInput(booking.customer_phone || "");
                      setContactEmailInput(booking.customer_email || "");
                      setContactError(null);
                    }}
                    className="text-xs font-bold text-[#ff5a1f] hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingContact ? "Cancel" : "Edit"}</span>
                  </button>
                )}
              </div>
              
              {isEditingContact ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={contactNameInput}
                      onChange={(e) => setContactNameInput(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      placeholder="Customer Name"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={contactPhoneInput}
                      onChange={(e) => setContactPhoneInput(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      placeholder="e.g. 9845013819"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={contactEmailInput}
                      onChange={(e) => setContactEmailInput(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]"
                      placeholder="e.g. customer@example.com"
                    />
                  </div>
                  {contactError && (
                    <p className="text-[11px] text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-200">{contactError}</p>
                  )}
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingContact(false)}
                      className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveContact}
                      disabled={isSavingContact}
                      className="text-xs bg-[#ff5a1f] hover:bg-[#e04812] text-white px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1 shadow-xs disabled:opacity-50"
                    >
                      {isSavingContact && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Save Contact</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}
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

      {/* Add Add-On / Activity Modal */}
      {isAddAddonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-orange-100 text-orange-600">
                  <Plus className="w-4 h-4 font-black" />
                </span>
                <h3 className="font-bold text-gray-900 text-base">Add Activity / Add-On</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddAddonModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Select Activity / Add-On
                </label>
                {availableAddons.length > 0 ? (
                  <select
                    value={selectedAddonId}
                    onChange={(e) => setSelectedAddonId(Number(e.target.value))}
                    className="w-full text-xs font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {availableAddons.map((addon) => {
                      const withGst = Math.round(Number(addon.price || 0) * 1.18);
                      return (
                        <option key={addon.id} value={addon.id}>
                          {addon.name} — ₹{addon.price} (+ 18% GST = ₹{withGst})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <p className="text-xs text-gray-500 italic">No add-ons found in catalog.</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Quantity
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={addonQuantity}
                    onChange={(e) => setAddonQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 text-xs font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                  <span className="text-xs text-gray-600 font-medium">
                    Total with GST:{" "}
                    <strong className="text-gray-900 font-bold">
                      ₹{(() => {
                        const sel = availableAddons.find(a => a.id === Number(selectedAddonId));
                        const p = sel ? Number(sel.price || 0) : 300;
                        return Math.round(p * addonQuantity * 1.18).toLocaleString('en-IN');
                      })()}
                    </strong>
                  </span>
                </div>
              </div>

              {addonError && (
                <div className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 p-2.5 rounded-xl flex items-start gap-1.5">
                  <span>⚠️</span>
                  <span>{addonError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsAddAddonModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAddonSubmit}
                disabled={isSubmittingAddon || !selectedAddonId}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-sm disabled:opacity-50 transition-all flex items-center gap-1.5 active:scale-95"
              >
                {isSubmittingAddon && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Add to Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Package Modal */}
      {isUpgradeModalOpen && upgradingItem && (() => {
        const currentQty = Math.max(1, upgradingItem.quantity || 1);
        const currentUnitPrice = Number(upgradingItem.ticket_price || 0);
        const selectedTarget = upgradeTicketsList.find(t => t.id === Number(targetUpgradeTicketId));
        const targetUnitPrice = selectedTarget ? Number(selectedTarget.price || 0) : 0;
        
        const unitDiff = Math.max(0, targetUnitPrice - currentUnitPrice);
        const subtotalDiff = unitDiff * currentQty;
        const autoDiffWithGst = Math.round(subtotalDiff * 1.18);
        const finalPayableDiff = customDiffAmount !== "" && !isNaN(Number(customDiffAmount))
          ? Number(customDiffAmount)
          : autoDiffWithGst;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                    <Sparkles className="w-4 h-4 font-black" />
                  </span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Upgrade Ticket Package</h3>
                    <p className="text-xs text-gray-500">Calculate tariff difference and upgrade customer session</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Current Ticket Info Box */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Current Package</span>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-gray-900 text-sm uppercase">
                    {upgradingItem.ticket_name ? upgradingItem.ticket_name.replace("_", " ") : "Ticket"}
                  </span>
                  <span className="font-mono font-bold text-gray-700">
                    ₹{currentUnitPrice.toLocaleString('en-IN')} × {currentQty} = ₹{Math.round(currentUnitPrice * currentQty * 1.18).toLocaleString('en-IN')} (incl. GST)
                  </span>
                </div>
              </div>

              {/* Target Package Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Select Upgraded Package</label>
                <div className="grid grid-cols-1 gap-2">
                  {upgradeTicketsList.map((t) => {
                    const isSelected = Number(targetUpgradeTicketId) === t.id;
                    const tPrice = Number(t.price || 0);
                    const diffPerPerson = tPrice - currentUnitPrice;
                    const diffTotalWithGst = Math.round(diffPerPerson * currentQty * 1.18);
                    return (
                      <label
                        key={t.id}
                        onClick={() => setTargetUpgradeTicketId(t.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="upgradeTicket"
                            checked={isSelected}
                            onChange={() => setTargetUpgradeTicketId(t.id)}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <span className="font-extrabold text-gray-900 text-xs uppercase block">
                              {t.name ? t.name.replace("_", " ") : "Package"}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              Base: ₹{tPrice.toLocaleString('en-IN')} (+ 18% GST = ₹{Math.round(tPrice * 1.18).toLocaleString('en-IN')})
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-xs font-black font-mono ${diffTotalWithGst >= 0 ? "text-indigo-700" : "text-amber-700"}`}>
                            {diffTotalWithGst >= 0 ? `+₹${diffTotalWithGst.toLocaleString('en-IN')}` : `-₹${Math.abs(diffTotalWithGst).toLocaleString('en-IN')}`}
                          </span>
                          <span className="block text-[10px] text-gray-400">Total Difference</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Price Difference Breakdown Box */}
              <div className="p-4 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/60 rounded-xl border-2 border-indigo-200 text-xs space-y-2">
                <div className="flex items-center justify-between text-gray-600">
                  <span>New Package Tariff ({currentQty} × ₹{targetUnitPrice}):</span>
                  <span className="font-mono font-semibold">₹{(targetUnitPrice * currentQty).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Current Package Tariff ({currentQty} × ₹{currentUnitPrice}):</span>
                  <span className="font-mono font-semibold">−₹{(currentUnitPrice * currentQty).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600 border-t border-indigo-100 pt-1.5">
                  <span>Net Base Difference:</span>
                  <span className="font-mono font-semibold">₹{subtotalDiff.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>GST (18%):</span>
                  <span className="font-mono font-semibold">₹{Math.round(subtotalDiff * 0.18).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-gray-900 border-t-2 border-indigo-200 pt-2 text-sm">
                  <span className="text-indigo-950 font-black">Total Upgrade Difference:</span>
                  <span className="text-indigo-700 font-mono font-black text-base">
                    ₹{autoDiffWithGst.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3 text-[11px] border-t border-indigo-100">
                  <span className="text-gray-500 font-medium">Custom/Adjusted Difference (₹):</span>
                  <input
                    type="number"
                    value={customDiffAmount}
                    onChange={(e) => setCustomDiffAmount(e.target.value)}
                    placeholder={String(autoDiffWithGst)}
                    className="w-28 text-xs font-mono font-bold bg-white border border-indigo-300 rounded-lg px-2.5 py-1 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Payment Settlement Method */}
              <div className="space-y-2.5 border-t border-gray-100 pt-3">
                <span className="text-xs font-bold text-gray-800 block">Upgrade Payment Settlement</span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                    upgradePaymentConfirmed ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 font-bold" : "border-gray-200 text-gray-600"
                  }`}>
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={upgradePaymentConfirmed}
                      onChange={() => setUpgradePaymentConfirmed(true)}
                    />
                    <span>Payment Collected</span>
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer ${
                    !upgradePaymentConfirmed ? "border-amber-500 bg-amber-50/50 text-amber-950 font-bold" : "border-gray-200 text-gray-600"
                  }`}>
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={!upgradePaymentConfirmed}
                      onChange={() => setUpgradePaymentConfirmed(false)}
                    />
                    <span>Add to Due (Unpaid)</span>
                  </label>
                </div>

                {upgradePaymentConfirmed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Payment Mode</label>
                      <select
                        value={upgradePaymentMode}
                        onChange={(e) => setUpgradePaymentMode(e.target.value)}
                        className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI / QR</option>
                        <option value="Card">Credit / Debit Card</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">UTR / Ref (Optional)</label>
                      <input
                        type="text"
                        value={upgradePaymentRef}
                        onChange={(e) => setUpgradePaymentRef(e.target.value)}
                        placeholder="e.g. UPI/TN123456"
                        className="w-full text-xs font-mono font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {upgradeError && (
                <div className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 p-2.5 rounded-xl flex items-start gap-1.5">
                  <span>⚠️</span>
                  <span>{upgradeError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpgrade}
                  disabled={isSubmittingUpgrade || !targetUpgradeTicketId}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {isSubmittingUpgrade && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm & Apply Upgrade</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reschedule Booking (Date & Slot) Modal */}
      {isRescheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Calendar className="w-4 h-4 font-black" />
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Reschedule Booking</h3>
                  <p className="text-xs text-gray-500">Update booking date or arena time slot</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRescheduleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Scope Selector if multiple items */}
              {orderItems.length > 1 && (
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Apply Reschedule To</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                      rescheduleScope === 'order' ? "border-indigo-500 bg-indigo-50/60 font-bold text-indigo-950" : "border-gray-200 text-gray-600"
                    }`}>
                      <input
                        type="radio"
                        name="rescheduleScope"
                        checked={rescheduleScope === 'order'}
                        onChange={() => setRescheduleScope('order')}
                      />
                      <span>All Items in Order</span>
                    </label>

                    <label className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                      rescheduleScope === 'item' ? "border-indigo-500 bg-indigo-50/60 font-bold text-indigo-950" : "border-gray-200 text-gray-600"
                    }`}>
                      <input
                        type="radio"
                        name="rescheduleScope"
                        checked={rescheduleScope === 'item'}
                        onChange={() => setRescheduleScope('item')}
                      />
                      <span>Selected Item Only</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Date Input */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Booking Date</label>
                <input
                  type="text"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  placeholder="e.g. Nov 10 or 2026-11-10"
                  className="w-full text-xs font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center gap-1.5 pt-1.5">
                  <span className="text-[10px] text-gray-400">Quick set:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const m = d.toLocaleString('en-US', { month: 'short' });
                      const day = String(d.getDate()).padStart(2, '0');
                      setRescheduleDate(`${m} ${day}`);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline px-1.5 py-0.5 rounded bg-indigo-50"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      const m = d.toLocaleString('en-US', { month: 'short' });
                      const day = String(d.getDate()).padStart(2, '0');
                      setRescheduleDate(`${m} ${day}`);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline px-1.5 py-0.5 rounded bg-indigo-50"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 2);
                      const m = d.toLocaleString('en-US', { month: 'short' });
                      const day = String(d.getDate()).padStart(2, '0');
                      setRescheduleDate(`${m} ${day}`);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline px-1.5 py-0.5 rounded bg-indigo-50"
                  >
                    +2 Days
                  </button>
                </div>
              </div>

              {/* Time Slot Selector */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Time Slot</label>
                {availableTimeSlots.length > 0 ? (
                  <select
                    value={rescheduleTimeSlot}
                    onChange={(e) => setRescheduleTimeSlot(e.target.value)}
                    className="w-full text-xs font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  >
                    {availableTimeSlots.map((s) => (
                      <option key={s.id} value={s.label}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={rescheduleTimeSlot}
                    onChange={(e) => setRescheduleTimeSlot(e.target.value)}
                    placeholder="e.g. 12PM-1PM"
                    className="w-full text-xs font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                )}
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-snug">
                <span>⚠️ Rescheduling will reset previously assigned slot wristband numbers so desk staff can issue the matching wristband for the new time slot upon arrival.</span>
              </div>

              {rescheduleError && (
                <div className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 p-2.5 rounded-xl flex items-start gap-1.5">
                  <span>⚠️</span>
                  <span>{rescheduleError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsRescheduleModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReschedule}
                disabled={isSubmittingReschedule}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isSubmittingReschedule && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Rescheduled Slot</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
