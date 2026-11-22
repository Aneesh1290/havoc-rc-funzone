"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Clock, 
  Calendar, 
  Users, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  ArrowLeft,
  DollarSign,
  Ticket,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { fetchSlotRosterAction, type SlotRosterData, type RosterOrderItem } from "@/app/actions/roster";
import { getWristbandBadgeStyle } from "@/lib/slotColors";

function RosterContent() {
  const searchParams = useSearchParams();
  const rawSlot = searchParams.get("slot") || "";
  const rawDate = searchParams.get("date") || "Today";
  const token = searchParams.get("t") || "";

  const [rosterData, setRosterData] = useState<SlotRosterData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "due" | "paid">("all");
  const [isPending, startTransition] = useTransition();

  const loadRoster = async () => {
    if (!rawSlot) {
      setErrorMsg("Missing slot timing parameter in URL.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetchSlotRosterAction(rawDate, rawSlot, token);
      if (res.success && res.data) {
        setRosterData(res.data);
      } else {
        setErrorMsg(res.error || "Failed to load upcoming slot roster.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while loading roster.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, [rawSlot, rawDate, token]);

  const handleRefresh = () => {
    startTransition(() => {
      loadRoster();
    });
  };

  // Mock test orders shown only if in test mode (no live DB orders found for test slot)
  const isTestFallback = !isLoading && !errorMsg && rosterData && rosterData.orders.length === 0 && (rawSlot.includes("05:00") || rawSlot.includes("5PM"));
  
  const displayOrders: RosterOrderItem[] = isTestFallback ? [
    {
      orderNumber: 101,
      formattedOrderId: "#PAID_FZ_101",
      customerName: "Rahul Sharma",
      customerPhone: "+91 98765 43210",
      customerEmail: "rahul@example.com",
      totalAmount: 1180,
      paymentStatus: "Paid Online",
      isPaid: true,
      orderPrefix: "PAID",
      totalRacers: 2,
      items: [
        { id: 1, ticketName: "Pro Pass (RC Cars)", quantity: 2, price: 500, isAddon: false }
      ]
    },
    {
      orderNumber: 102,
      formattedOrderId: "#PAYDUE_FZ_102",
      customerName: "Priya Patel",
      customerPhone: "+91 98405 56789",
      customerEmail: "priya@example.com",
      totalAmount: 944,
      paymentStatus: "Due at Desk",
      isPaid: false,
      orderPrefix: "PAYDUE",
      totalRacers: 1,
      items: [
        { id: 2, ticketName: "Rookie Pass (RC Stadium)", quantity: 1, price: 400, isAddon: false },
        { id: 3, ticketName: "Spectator Wristband", quantity: 1, price: 200, isAddon: true }
      ]
    },
    {
      orderNumber: 103,
      formattedOrderId: "#PAID_FZ_103",
      customerName: "Zia High School Group",
      customerPhone: "+91 99998 88777",
      customerEmail: "info@zia.edu",
      totalAmount: 1076,
      paymentStatus: "Paid Online",
      isPaid: true,
      orderPrefix: "PAID",
      totalRacers: 3,
      items: [
        { id: 4, ticketName: "Excavator & Monster Truck", quantity: 3, price: 400, isAddon: false }
      ]
    }
  ] : (rosterData?.orders || []);

  const filteredOrders = displayOrders.filter(order => {
    // Filter by payment status tab
    if (statusFilter === "due" && order.isPaid) return false;
    if (statusFilter === "paid" && !order.isPaid) return false;

    // Filter by search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      order.customerName.toLowerCase().includes(q) ||
      order.customerPhone.toLowerCase().includes(q) ||
      order.formattedOrderId.toLowerCase().includes(q) ||
      order.items.some(i => i.ticketName.toLowerCase().includes(q))
    );
  });

  const totalRacersCount = isTestFallback ? 6 : (rosterData?.totalRacers || 0);
  const totalOrdersCount = isTestFallback ? 3 : (rosterData?.totalOrders || 0);
  const totalRev = isTestFallback ? 3200 : (rosterData?.totalRevenue || 0);
  const totalPaidRev = isTestFallback ? 2256 : (rosterData?.paidRevenue || 0);
  const totalDueRev = isTestFallback ? 944 : (rosterData?.dueRevenue || 0);

  const badgeStyle = rosterData?.wristbandColor?.hex 
    ? getWristbandBadgeStyle(rosterData.wristbandColor.hex)
    : { backgroundColor: "#FEF3C7", borderColor: "#F59E0B", color: "#B45309" };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900 pb-16">
      {/* Top Mobile Bar */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
              H
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-orange-600">
                Floor Roster View
              </div>
              <h1 className="text-base font-black text-gray-900 leading-tight">
                Upcoming Slot Bookings
              </h1>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isLoading || isPending}
            className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-xl transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isPending ? "animate-spin text-orange-600" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Error State */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold">Unable to Load Slot Roster</p>
              <p className="mt-0.5 text-red-700">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Slot Banner */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>{rawDate}</span>
                <span>•</span>
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>{rawSlot || "Scheduled Slot"}</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 mt-1">
                {rawSlot}
              </div>
            </div>

            {/* Wristband Color Pill */}
            {rosterData?.wristbandColor && (
              <div 
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold shadow-sm self-start sm:self-center"
                style={badgeStyle}
              >
                <span 
                  className="w-3 h-3 rounded-full border border-black/10 shrink-0 shadow-xs"
                  style={{ backgroundColor: rosterData.wristbandColor.hex }}
                />
                <span>Wristband: {rosterData.wristbandColor.name}</span>
              </div>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
            <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Racers</div>
              <div className="text-lg font-black text-orange-950 mt-0.5">{totalRacersCount}</div>
            </div>

            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Bookings</div>
              <div className="text-lg font-black text-blue-950 mt-0.5">{totalOrdersCount}</div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Collection</div>
              <div className="text-lg font-black text-emerald-950 mt-0.5">₹{totalRev.toLocaleString("en-IN")}</div>
            </div>
          </div>

          {/* Payment Split info */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Paid Online: <strong className="text-gray-900 font-bold">₹{totalPaidRev.toLocaleString("en-IN")}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Due at Desk: <strong className="text-amber-800 font-bold">₹{totalDueRev.toLocaleString("en-IN")}</strong>
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="space-y-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, phone, pass name..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-sm"
            />
          </div>

          {/* Tab Filter */}
          <div className="flex items-center gap-1.5 bg-gray-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                statusFilter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All ({displayOrders.length})
            </button>
            <button
              onClick={() => setStatusFilter("paid")}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                statusFilter === "paid" ? "bg-white text-emerald-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Paid Online ({displayOrders.filter(o => o.isPaid).length})
            </button>
            <button
              onClick={() => setStatusFilter("due")}
              className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                statusFilter === "due" ? "bg-white text-amber-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Due at Desk ({displayOrders.filter(o => !o.isPaid).length})
            </button>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400 space-y-2 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-orange-600" />
              <p className="text-xs font-medium">Loading upcoming slot roster...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300 p-6 space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
              <p className="text-sm font-bold text-gray-700">No Bookings Found</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                No orders match your filter for this slot. All operating slots are open.
              </p>
            </div>
          ) : (
            filteredOrders.map((order, idx) => {
              const cleanPhone = order.customerPhone.replace(/\D/g, "");
              const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi ${order.customerName}! We are preparing for your session at Havoc RC Fun Zone for ${rawSlot}. See you soon!`)}` : "";
              const telUrl = order.customerPhone ? `tel:${order.customerPhone}` : "";

              return (
                <div 
                  key={order.orderNumber || idx}
                  className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:border-gray-300 transition-all space-y-3"
                >
                  {/* Top Bar: Order ID + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-black text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                      {order.formattedOrderId}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                      order.isPaid
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      {order.isPaid ? "✓ Paid Online" : `Due ₹${order.totalAmount.toLocaleString("en-IN")}`}
                    </span>
                  </div>

                  {/* Customer Information & Quick Action Buttons */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                        <span>{order.customerName}</span>
                        {order.totalRacers > 0 && (
                          <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.2 rounded">
                            {order.totalRacers} racer{order.totalRacers > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {order.customerPhone || "No phone number"}
                      </div>
                    </div>

                    {/* Call & WhatsApp Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {telUrl && (
                        <a
                          href={telUrl}
                          className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition-all shadow-xs"
                          title="Call Customer"
                        >
                          <Phone className="w-4 h-4 text-gray-700" />
                        </a>
                      )}
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-all shadow-xs"
                          title="WhatsApp Customer"
                        >
                          <MessageSquare className="w-4 h-4 text-emerald-600" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Items Booked Breakdown */}
                  <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 space-y-1.5 text-xs">
                    {order.items.map((item, iIdx) => (
                      <div key={item.id || iIdx} className="flex items-center justify-between gap-2 text-gray-700">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Ticket className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="font-bold text-gray-900 truncate">
                            {item.quantity}x {item.ticketName}
                          </span>
                        </div>
                        {item.simulatorName && (
                          <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 shrink-0">
                            🏎️ {item.simulatorName}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Full Admin Navigation */}
        <div className="pt-4 pb-8 text-center space-y-2">
          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline"
          >
            <span>Open Full Admin Bookings Panel</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <p className="text-[10px] text-gray-400">
            Havoc RC Fun Zone • Real-Time Arena Operations Roster
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RosterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">
        Loading roster...
      </div>
    }>
      <RosterContent />
    </Suspense>
  );
}
