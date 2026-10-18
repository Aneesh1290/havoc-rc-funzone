"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Need to unwrap the params promise for Next.js 15+ in Client Components
import { use } from 'react';
import { 
  fetchTicketsAction, 
  fetchBookedQuantitiesAction, 
  fetchVipPerksAction, 
  fetchTakenSimulatorSlotsAction,
  fetchBlockedSlotsAction 
} from '@/app/actions/tickets';
import type { TicketRow, VipPerkRow, BlockedSlotRow } from '@/lib/db';
import { useCart } from '@/context/CartContext';
import { Info, Check, X, Sparkles, ChevronRight, Ban } from 'lucide-react';

export default function BookingProductPage({ params }: { params: Promise<{ month: string }> }) {
  const unwrappedParams = use(params);
  // Parse month from URL, e.g., "october-2026" -> "October 2026"
  const title = unwrappedParams.month.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const { addItem } = useCart();

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dbTickets, setDbTickets] = useState<TicketRow[]>([]);
  const [bookedQuantities, setBookedQuantities] = useState<{ticket_id: number, total_booked: number}[]>([]);
  const [simulators, setSimulators] = useState<VipPerkRow[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlotRow[]>([]);

  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  const TICKET_BENEFITS: Record<string, {
    title: string;
    tagline: string;
    price: string;
    badge: string;
    badgeColor: string;
    accessType: "observation" | "play" | "vip";
    benefits: string[];
    restrictions?: string[];
  }> = {
    VISITOR: {
      title: "Visitor Pass",
      tagline: "Companion & Observation entry for 1 hour.",
      price: "₹300 + GST",
      badge: "Companion Only",
      badgeColor: "bg-gray-100 text-gray-700 border-gray-200",
      accessType: "observation",
      benefits: [
        "1 Hour arena entry to observe the activities and accompany participants",
        "Access to lounge and observation gallery areas"
      ],
      restrictions: [
        "Participation in any RC activity is strictly prohibited"
      ]
    },
    PARTICIPANT: {
      title: "Participant Pass",
      tagline: "Full play access to all 16 RC activities for 1 hour.",
      price: "₹1,000 + GST",
      badge: "Full RC Access",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      accessType: "play",
      benefits: [
        "1 Hour unlimited play access across all 16 RC activities",
        "Includes RC Race & Drift tracks, RC Mining excavators, Train World, and more"
      ]
    },
    VIP_VISITOR: {
      title: "VIP Visitor Pass",
      tagline: "Entry + 3 curated premium simulator & railway experiences.",
      price: "₹500 + GST",
      badge: "Premium Experience",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      accessType: "vip",
      benefits: [
        "1 Hour access with selected premium experiences:",
        "✈ RC Flight Simulator session",
        "🚆 HO & N Scale Miniature Railway activities",
        "🚗 Car Race Sim Beginner rig access"
      ]
    },
    VIP_PARTICIPANT: {
      title: "VIP Participant Pass",
      tagline: "All 16 RC activities + Upgraded Hobby Grade Cars + 30-Min Havoc Sim Podium session.",
      price: "₹1,500 + GST",
      badge: "All-Inclusive + Sim Podium",
      badgeColor: "bg-orange-50 text-[#ff5a1f] border-orange-200",
      accessType: "vip",
      benefits: [
        "Full unlimited access to all 16 RC activities for 1 hour",
        "Upgraded hobby-grade RC Cars for Drift, Off-Road, Mini-Z tracks & FPV RC cars",
        "BONUS: Free 30-min session on any 1 simulator in the Havoc Sim Podium (Airbus, Boeing, GT, F1, etc.)"
      ]
    }
  };

  useEffect(() => {
    fetchTicketsAction().then(data => {
      setDbTickets(data.filter(t => t.active === 1));
    });
    fetchVipPerksAction(true).then(data => {
      setSimulators(data);
      if (data.length > 0) {
        setSimSelections(prev => prev.map(s => ({ ...s, simName: s.simName || data[0].name })));
      }
    });
    fetchBlockedSlotsAction().then(data => {
      setBlockedSlots(data || []);
    });
  }, []);

  useEffect(() => {
    if (date && time) {
      fetchBookedQuantitiesAction(date, time).then(data => {
        setBookedQuantities(data);
      });
    } else {
      setBookedQuantities([]);
    }
  }, [date, time]);

  // Always use 30-minute simulator slots as the base unit (e.g. 11AM-11:30AM)
  const BASE_30MIN_SIM_SLOTS = [
    { label: "11AM-11:30AM", startHour: 11.0 },
    { label: "11:30AM-12PM", startHour: 11.5 },
    { label: "12PM-12:30PM", startHour: 12.0 },
    { label: "12:30PM-1PM", startHour: 12.5 },
    { label: "1PM-1:30PM", startHour: 13.0 },
    { label: "1:30PM-2PM", startHour: 13.5 },
    { label: "2PM-2:30PM", startHour: 14.0 },
    { label: "2:30PM-3PM", startHour: 14.5 },
    { label: "3PM-3:30PM", startHour: 15.0 },
    { label: "3:30PM-4PM", startHour: 15.5 },
    { label: "4PM-4:30PM", startHour: 16.0 },
    { label: "4:30PM-5PM", startHour: 16.5 },
    { label: "5PM-5:30PM", startHour: 17.0 },
    { label: "5:30PM-6PM", startHour: 17.5 },
    { label: "6PM-6:30PM", startHour: 18.0 },
    { label: "6:30PM-7PM", startHour: 18.5 },
    { label: "7PM-7:30PM", startHour: 19.0 },
    { label: "7:30PM-8PM", startHour: 19.5 },
    { label: "8PM-8:30PM", startHour: 20.0 },
    { label: "8:30PM-9PM", startHour: 20.5 }
  ];

  // Helper to get pass end hour (e.g. "11AM-12PM" ends at 12:00 -> 12.0)
  const getPassEndHour = (passSlot: string): number => {
    if (!passSlot) return 0;
    const parts = passSlot.split("-");
    if (parts.length < 2) return 0;
    const end = parts[1].trim().toUpperCase();
    let isPM = end.includes("PM");
    let clean = end.replace("AM", "").replace("PM", "");
    let h = parseInt(clean, 10);
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return h;
  };

  const selectedTicket = dbTickets.find(t => t.name === type);
  const hasSimPerk = selectedTicket ? Boolean(selectedTicket.has_simulator_perk || selectedTicket.name.toUpperCase().includes("VIP_PARTICIPANT")) : false;
  const perkDuration = selectedTicket?.perk_duration_mins || 30;
  const requiredSlotsCount = perkDuration >= 60 ? Math.floor(perkDuration / 30) : 1; // 30m -> 1 slot, 60m -> 2 slots, etc.
  const perkTitle = selectedTicket?.perk_title || `${perkDuration}-Min Havoc Sim Podium Session`;

  const passEndHour = getPassEndHour(time);
  // Sim slots must strictly be after the Funzone pass duration ends
  const availableSimSlots = time 
    ? BASE_30MIN_SIM_SLOTS.filter(s => s.startHour >= passEndHour)
    : BASE_30MIN_SIM_SLOTS;

  // Selected simulators & slots per segment (e.g. Session 1 & Session 2 for 1-hour passes)
  const [simSelections, setSimSelections] = useState<{ simName: string; slotLabel: string }[]>([
    { simName: "Race Sim GT", slotLabel: "" }
  ]);

  // Store taken/booked slots from PostgreSQL database: Record<simulatorName, string[]>
  const [takenSimSlots, setTakenSimSlots] = useState<Record<string, string[]>>({});
  const [loadingSimSlots, setLoadingSimSlots] = useState(false);

  // Fetch taken slots from PostgreSQL whenever selected simulators or date change
  useEffect(() => {
    if (!hasSimPerk || !date) return;

    let isMounted = true;
    const fetchSlotsForSelected = async () => {
      setLoadingSimSlots(true);
      const uniqueSimNames = Array.from(new Set(simSelections.map(s => s.simName).filter(Boolean)));
      const takenMap: Record<string, string[]> = {};

      for (const simName of uniqueSimNames) {
        try {
          const taken = await fetchTakenSimulatorSlotsAction(simName, date);
          takenMap[simName] = taken;
        } catch (e) {
          console.error(`Failed to fetch taken slots for ${simName}:`, e);
          takenMap[simName] = [];
        }
      }

      if (isMounted) {
        setTakenSimSlots(takenMap);
        setLoadingSimSlots(false);
      }
    };

    fetchSlotsForSelected();

    return () => {
      isMounted = false;
    };
  }, [hasSimPerk, date, simSelections.map(s => s.simName).join(',')]);

  // Adjust number of sim selections when perk duration or ticket changes
  useEffect(() => {
    if (hasSimPerk) {
      setSimSelections(prev => {
        const next = [...prev];
        while (next.length < requiredSlotsCount) {
          next.push({ simName: simulators[0]?.name || "Race Sim GT", slotLabel: "" });
        }
        return next.slice(0, requiredSlotsCount);
      });
    }
  }, [hasSimPerk, requiredSlotsCount, simulators]);

  // Automatically sync slots whenever Funzone visit time changes
  useEffect(() => {
    if (time && hasSimPerk && availableSimSlots.length > 0) {
      setSimSelections(prev => {
        return prev.map((item, idx) => {
          // Provide distinct consecutive 30-min slots for each session that aren't taken in PostgreSQL
          const takenForThis = takenSimSlots[item.simName] || [];
          const candidate = availableSimSlots.find((s, sIdx) => sIdx >= idx && !takenForThis.includes(s.label)) || availableSimSlots[idx] || availableSimSlots[0];
          return {
            ...item,
            slotLabel: candidate ? candidate.label : ""
          };
        });
      });
    }
  }, [time, hasSimPerk, availableSimSlots.length, takenSimSlots]);

  const basePrice = selectedTicket ? selectedTicket.price : 0;
  const totalPrice = basePrice * quantity;
  
  const bookedForSelected = selectedTicket 
    ? bookedQuantities.find(b => b.ticket_id === selectedTicket.id)?.total_booked || 0 
    : 0;
  const maxAvailableCap = selectedTicket ? Math.max(0, selectedTicket.capacity - bookedForSelected) : 100;

  // Check that all required simulator slots have a simulator and time slot chosen
  const allSimsSelected = !hasSimPerk || (
    simSelections.length === requiredSlotsCount &&
    simSelections.every(s => s.simName && s.slotLabel)
  );

  const canSubmit = type && date && time && maxAvailableCap > 0 && allSimsSelected;

  // Reset quantity if it exceeds the available capacity
  useEffect(() => {
    if (selectedTicket && quantity > maxAvailableCap) {
      setQuantity(maxAvailableCap > 0 ? maxAvailableCap : 1);
    }
  }, [selectedTicket, maxAvailableCap, quantity]);

  // Generate dynamic dates for the selected month and year
  const [monthStr, yearStr] = unwrappedParams.month.split('-');
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthIndex = monthNames.indexOf(monthStr.toLowerCase());
  const year = parseInt(yearStr);
  const daysInMonth = monthIndex >= 0 ? new Date(year, monthIndex + 1, 0).getDate() : 30;
  const shortMonth = monthStr.charAt(0).toUpperCase() + monthStr.slice(1, 3).toLowerCase();
  
  // To check for past dates
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  const isCurrentMonth = year === currentYear && monthIndex === currentMonth;
  const isPastMonth = year < currentYear || (year === currentYear && monthIndex < currentMonth);

  const availableDates = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dayStr = dayNum.toString().padStart(2, '0');
    const val = `${shortMonth} ${dayStr}`;
    
    // Day of week check (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const thisDateObj = new Date(year, monthIndex, dayNum);
    const isMonday = thisDateObj.getDay() === 1;

    let isPast = false;
    if (isPastMonth) {
      isPast = true;
    } else if (isCurrentMonth && dayNum < currentDay) {
      isPast = true;
    }

    // Check if the date is manually blocked by admin (ALL_DAY on this date, or ALL_DAY on ALL dates)
    const isBlocked = isMonday || blockedSlots.some(b => 
      (b.booking_date === val || b.booking_date === 'ALL') && b.time_slot === 'ALL_DAY'
    );
    
    return {
      value: val,
      display: `${title.split(' ')[0]} ${dayStr}`,
      isPast,
      isBlocked,
      isMonday
    };
  }).filter(d => !d.isPast); // Completely hide past dates from the dropdown options once the day is done

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#f8f9fa] text-[#0d1b2a] py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <div className="text-sm font-bold text-gray-500 mb-12 flex gap-3 items-center">
          <Link href="/" className="hover:text-[#ff5a1f] transition-colors">Home</Link>
          <span className="text-gray-300">›</span>
          <Link href="/tickets" className="hover:text-[#ff5a1f] transition-colors">All Products</Link>
          <span className="text-gray-300">›</span>
          <span className="text-gray-900">{title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left: Product Image & Notes */}
          <div className="flex flex-col gap-8">
            <div className="w-full aspect-square flex flex-col items-center justify-center relative bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
              <img src="/ticket.png" alt="RC Adventure Ticket" className="w-full h-full object-contain drop-shadow-xl hover:scale-105 transition-transform duration-500" />
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
              <h3 className="text-xl font-black font-heading text-[#ff5a1f] underline decoration-2 underline-offset-4">Important Note:</h3>
              
              <ul className="space-y-4 text-gray-700 text-sm list-disc pl-5">
                <li>
                  <strong className="text-[#0d1b2a]">Visitors</strong> are allowed entry for 1 hours only to observe the activities.<br/>
                  Participation in any activity is strictly not permitted for visitors.
                </li>
                <li>
                  <strong className="text-[#0d1b2a]">Participants</strong> are allowed to play and participate in all RC activities for 1 hours unlimited.
                </li>
              </ul>

              <p className="text-sm text-gray-600 leading-relaxed pt-2 border-t border-gray-100">
                <strong className="text-[#0d1b2a]">Experience unlimited excitement at Havoc Rc Funzone!</strong> Dive into our 1 hours unlimited RC Playzone, perfect for racing enthusiasts of all ages. Enjoy heart-pounding action, cutting-edge RC cars, and meticulously designed tracks that guarantee pure fun. Our state-of-the-art facilities and friendly staff ensure a memorable visit, promoting fun and safety for everyone. Don't miss out on the ultimate RC adventure this summer!
              </p>
            </div>
          </div>

          {/* Right: Booking Form */}
          <div className="space-y-6 pt-2">
            <h1 className="text-4xl font-black font-heading tracking-wide mb-2 text-[#0d1b2a]">{title}</h1>
            <div className="text-2xl font-bold text-[#ff5a1f] mb-10 flex items-center gap-2">
              ₹{totalPrice.toFixed(2)}
              {quantity > 1 && <span className="text-sm text-gray-400 font-normal tracking-normal">(₹{basePrice.toFixed(2)} each)</span>}
            </div>

            {/* Select Date */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Select Date *</label>
              <div className="relative">
                <select 
                  className="w-full bg-white text-gray-900 font-bold p-3.5 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] appearance-none transition-all shadow-sm disabled:bg-gray-100"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setTime(""); // Reset time when date changes
                  }}
                >
                  <option value="" disabled>Select</option>
                  {availableDates.map(d => {
                    const isDisabled = d.isPast || d.isBlocked;
                    return (
                      <option 
                        key={d.value} 
                        value={d.value} 
                        disabled={isDisabled} 
                        className={isDisabled ? "text-gray-400 bg-gray-50" : ""}
                      >
                        {d.display} {d.isMonday ? "(Closed - Every Monday)" : d.isBlocked ? "(Unavailable / Closed)" : ""}
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
              </div>
            </div>

            {/* Select Time Slot */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Select Time Slot *</label>
              <div className="relative">
                <select 
                  className="w-full bg-white text-gray-900 font-bold p-3.5 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] appearance-none transition-all shadow-sm disabled:bg-gray-100"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={!date}
                >
                  <option value="" disabled>Select</option>
                  {[
                    { label: "11AM-12PM", startHour: 11 },
                    { label: "12PM-1PM", startHour: 12 },
                    { label: "1PM-2PM", startHour: 13 },
                    { label: "2PM-3PM", startHour: 14 },
                    { label: "3PM-4PM", startHour: 15 },
                    { label: "4PM-5PM", startHour: 16 },
                    { label: "5PM-6PM", startHour: 17 },
                    { label: "6PM-7PM", startHour: 18 },
                    { label: "7PM-8PM", startHour: 19 },
                  ]
                  .filter(slot => {
                    // If today is selected, hide slots that have already passed
                    const isTodaySelected = isCurrentMonth && date === `${shortMonth} ${currentDay.toString().padStart(2, '0')}`;
                    if (isTodaySelected) {
                      const currentHour = now.getHours();
                      const currentMinute = now.getMinutes();
                      if (currentHour > slot.startHour) return false;
                      if (currentHour === slot.startHour && currentMinute >= 30) return false;
                    }
                    return true;
                  })
                  .map(slot => {
                    // Check if slot is blocked by admin
                    const isBlockedSlot = blockedSlots.some(b => 
                      (b.booking_date === date || b.booking_date === 'ALL') && 
                      (b.time_slot === slot.label || b.time_slot === 'ALL_DAY')
                    );
                    
                    return (
                      <option 
                        key={slot.label} 
                        value={slot.label} 
                        disabled={isBlockedSlot} 
                        className={isBlockedSlot ? "text-gray-400 bg-gray-50" : ""}
                      >
                        {slot.label} {isBlockedSlot ? "(Unavailable)" : ""}
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
              </div>
            </div>

            {/* Type of Visit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700">Type of Visit *</label>
                <button
                  type="button"
                  onClick={() => setIsGuideModalOpen(true)}
                  className="text-xs font-bold text-[#ff5a1f] hover:text-[#e04812] flex items-center gap-1.5 transition-colors group"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span className="underline decoration-[#ff5a1f]/40 group-hover:decoration-[#e04812]">Compare Pass Types</span>
                </button>
              </div>

              <div className="relative">
                <select 
                  className="w-full bg-white text-gray-900 font-bold p-3.5 pr-10 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#ff5a1f]/20 focus:border-[#ff5a1f] appearance-none uppercase transition-all shadow-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="" disabled className="normal-case">Select</option>
                  {dbTickets.map(ticket => (
                    <option key={ticket.id} value={ticket.name}>
                      {ticket.name.replace('_', ' ')} - ₹{ticket.price} PER PERSON
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                  <svg className="h-4 w-4 fill-current transform rotate-180" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
              </div>

              {/* Instant Benefit Card for Selected Pass (handles pre-set passes and dynamically created admin passes) */}
              {type && (
                <div className="mt-3 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#ff5a1f]" />
                      What's Included with {selectedTicket?.name.replace(/_/g, ' ') || type}:
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      hasSimPerk 
                        ? 'bg-orange-50 text-[#ff5a1f] border-orange-200' 
                        : (TICKET_BENEFITS[type.toUpperCase()]?.badgeColor || 'bg-gray-100 text-gray-700 border-gray-200')
                    }`}>
                      {hasSimPerk ? `Includes ${perkDuration}-Min Sim` : (TICKET_BENEFITS[type.toUpperCase()]?.badge || 'Standard Pass')}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 font-medium">
                    {selectedTicket?.description || TICKET_BENEFITS[type.toUpperCase()]?.tagline || `Valid for 1-hour arena session with allocated slot capacity.`}
                  </p>

                  <ul className="text-xs text-gray-700 space-y-1.5 pt-1">
                    {selectedTicket?.benefits ? (
                      selectedTicket.benefits.split("\n").filter(Boolean).map((line, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                          <span>{line}</span>
                        </li>
                      ))
                    ) : (
                      TICKET_BENEFITS[type.toUpperCase()]?.benefits.map((b, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))
                    )}
                    {TICKET_BENEFITS[type.toUpperCase()]?.restrictions?.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-amber-700 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200/60 mt-1">
                        <span className="shrink-0 font-bold">⚠️</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => setIsGuideModalOpen(true)}
                    className="text-[11px] font-bold text-[#ff5a1f] hover:underline pt-1 inline-flex items-center gap-1"
                  >
                    View pass comparison guide &rarr;
                  </button>
                </div>
              )}
            </div>

            {/* VIP Simulator Perk Selection Box - Supports 1 or multiple 30-min sessions */}
            {hasSimPerk && (
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f] flex items-center justify-center font-bold text-sm">
                      ★
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 tracking-tight">
                        VIP Perk: {perkTitle}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {requiredSlotsCount > 1 
                          ? `Total ${perkDuration} mins: Choose any simulator and slot for each of your ${requiredSlotsCount} sessions (30 mins each).`
                          : `Choose your simulator & preferred 30-min slot. Included free with your ${selectedTicket?.name.replace(/_/g, ' ')}.`
                        }
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-[#ff5a1f] border border-[#ff5a1f]/20">
                    {requiredSlotsCount > 1 ? `${requiredSlotsCount} × 30-MIN SLOTS` : `FREE PERK (30 MINS)`}
                  </span>
                </div>

                {/* Iterate over each required 30-min session segment */}
                <div className="space-y-6">
                  {simSelections.map((selection, sessionIndex) => (
                    <div 
                      key={sessionIndex} 
                      className={`p-4 rounded-xl border ${
                        requiredSlotsCount > 1 
                          ? "bg-gray-50/50 border-gray-200 space-y-4" 
                          : "border-transparent p-0 space-y-4"
                      }`}
                    >
                      {requiredSlotsCount > 1 && (
                        <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                          <span className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-[#ff5a1f] text-white flex items-center justify-center text-[10px] font-bold">
                              {sessionIndex + 1}
                            </span>
                            Session {sessionIndex + 1} (30 Minutes)
                          </span>
                          <span className="text-[11px] font-bold text-[#ff5a1f]">
                            {selection.simName} • {selection.slotLabel || "Slot Pending"}
                          </span>
                        </div>
                      )}

                      {/* Simulator Visual Selection Grid */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                          {requiredSlotsCount > 1 
                            ? `Select Simulator for Session #${sessionIndex + 1} *` 
                            : `Select Simulator (${simulators.length} available) *`
                          }
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                          {simulators.map((sim) => {
                            const isSelected = selection.simName === sim.name;
                            return (
                              <div
                                key={sim.id}
                                onClick={() => {
                                  setSimSelections(prev => {
                                    const next = [...prev];
                                    next[sessionIndex] = { ...next[sessionIndex], simName: sim.name };
                                    return next;
                                  });
                                }}
                                className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all p-2 flex flex-col justify-between group ${
                                  isSelected 
                                    ? "border-[#ff5a1f] bg-orange-50/40 shadow-sm ring-2 ring-[#ff5a1f]/10" 
                                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"
                                }`}
                              >
                                <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 relative mb-2 flex items-center justify-center">
                                  <img 
                                    src={sim.image} 
                                    alt={sim.name} 
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                  <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">
                                    {sim.category}
                                  </span>
                                  {isSelected && (
                                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#ff5a1f] text-white flex items-center justify-center font-black text-xs shadow-sm">
                                      ✓
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h5 className="text-xs font-bold text-gray-900 line-clamp-1 group-hover:text-[#ff5a1f] transition-colors">{sim.name}</h5>
                                  <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{sim.tagline}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 30-Min Time Slot Pill Buttons */}
                      <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                            {requiredSlotsCount > 1 
                              ? `Select 30-Min Slot for Session #${sessionIndex + 1} *`
                              : `Select 30-Min Simulator Slot *`
                            }
                          </label>
                          <span className="text-[11px] text-gray-500 font-semibold">
                            {time ? `Available after ${time.split("-")[1] || time}` : "Select visit time slot first"}
                          </span>
                        </div>

                        {!time ? (
                          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-center text-xs text-gray-500 font-medium">
                            Please select your Funzone time slot above first to view available simulator slots.
                          </div>
                        ) : availableSimSlots.length === 0 ? (
                          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-center text-xs text-amber-800 font-medium">
                            No simulator slots available after your selected time slot ({time}).
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                            {availableSimSlots.map((slot) => {
                              const isSelected = selection.slotLabel === slot.label;
                              const isTakenByAnother = simSelections.some((s, idx) => idx !== sessionIndex && s.slotLabel === slot.label);
                              const takenForThisSim = takenSimSlots[selection.simName] || [];
                              const isTakenInDb = takenForThisSim.includes(slot.label);
                              const isDisabled = isTakenByAnother || isTakenInDb;

                              return (
                                <button
                                  key={slot.label}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() => {
                                    setSimSelections(prev => {
                                      const next = [...prev];
                                      next[sessionIndex] = { ...next[sessionIndex], slotLabel: slot.label };
                                      return next;
                                    });
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                    isSelected
                                      ? "bg-[#ff5a1f] text-white border-[#ff5a1f] shadow-sm shadow-[#ff5a1f]/30 scale-[1.02]"
                                      : isTakenInDb
                                        ? "bg-red-50 text-red-400 border-red-200 cursor-not-allowed opacity-60 line-through"
                                        : isTakenByAnother
                                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50 line-through"
                                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                  }`}
                                  title={
                                    isTakenInDb
                                      ? "Already booked on Havoc Sim Podium"
                                      : isTakenByAnother
                                        ? "Already chosen in another session"
                                        : undefined
                                  }
                                >
                                  {slot.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Box */}
                {time && simSelections.every(s => s.slotLabel) && (
                  <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-200/80 text-xs text-gray-700 space-y-1">
                    <span className="font-bold text-gray-900 block">🏆 Simulator Reservation Summary:</span>
                    {simSelections.map((s, idx) => (
                      <div key={idx} className="flex justify-between items-center text-gray-600">
                        <span>Slot {idx + 1}: <strong className="text-gray-900">{s.simName}</strong></span>
                        <span className="font-bold text-[#ff5a1f]">{s.slotLabel} (30 mins)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2 mt-8">
              <label className="block text-sm font-bold text-gray-700">Quantity *</label>
              <div className="flex border border-gray-300 w-32 rounded-xl overflow-hidden bg-white shadow-sm">
                <button 
                  className={`w-10 h-11 flex items-center justify-center font-bold transition-colors ${maxAvailableCap === 0 ? 'text-gray-300 cursor-not-allowed bg-gray-50' : 'text-gray-600 hover:text-[#ff5a1f] hover:bg-gray-50'}`}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={maxAvailableCap === 0}
                >-</button>
                <div className="flex-1 h-11 flex items-center justify-center text-gray-900 font-bold border-l border-r border-gray-200">
                  {maxAvailableCap === 0 ? 0 : quantity}
                </div>
                <button 
                  className={`w-10 h-11 flex items-center justify-center font-bold transition-colors ${selectedTicket && quantity >= maxAvailableCap ? 'text-gray-300 cursor-not-allowed bg-gray-50' : 'text-gray-600 hover:text-[#ff5a1f] hover:bg-gray-50'}`}
                  onClick={() => {
                    if (quantity < maxAvailableCap) setQuantity(quantity + 1);
                  }}
                  disabled={selectedTicket && quantity >= maxAvailableCap}
                >+</button>
              </div>
              {selectedTicket && maxAvailableCap === 0 && (
                <p className="text-xs text-red-500 font-bold mt-1">This ticket is fully booked for this time slot.</p>
              )}
              {selectedTicket && maxAvailableCap > 0 && quantity >= maxAvailableCap && (
                <p className="text-xs text-[#ff5a1f] font-medium mt-1">Only {maxAvailableCap} tickets left for this time slot.</p>
              )}
            </div>

            <div className="pt-6">
              <button 
                onClick={() => {
                  if (selectedTicket) {
                    // Cleanly format simulator names (e.g. "RC Flying Sim" or "RC Flying Sim & Race Sim F1")
                    const uniqueSims = Array.from(new Set(simSelections.map(s => s.simName)));
                    const combinedSimNames = uniqueSims.length === 1 
                      ? uniqueSims[0] 
                      : simSelections.map((s, i) => `#${i+1}: ${s.simName}`).join(" | ");

                    // Cleanly format simulator slots without redundant repeated session names
                    const combinedSimSlots = requiredSlotsCount > 1
                      ? simSelections.map((s, i) => `#${i+1} (${s.simName}): ${s.slotLabel}`).join(" • ")
                      : simSelections[0]?.slotLabel || "";

                    addItem({
                      id: Math.random().toString(36).substring(7),
                      type,
                      date,
                      timeSlot: time,
                      quantity,
                      price: basePrice,
                      ticketId: selectedTicket.id,
                      simulatorName: hasSimPerk ? combinedSimNames : undefined,
                      simulatorSlot: hasSimPerk ? combinedSimSlots : undefined
                    });
                  }
                }}
                disabled={!canSubmit}
                className={`w-full font-bold py-4 rounded-xl transition-all shadow-md text-sm tracking-wider uppercase ${
                  !canSubmit 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                    : 'bg-[#ff5a1f] hover:bg-[#e04812] text-white shadow-lg shadow-[#ff5a1f]/20 hover:-translate-y-0.5'
                }`}
              >
                Add to Cart
              </button>
            </div>

          </div>
        </div>

        {/* Important Guidelines Section */}
        <div className="mt-20 bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100">
          <h2 className="text-2xl font-black font-heading text-[#0d1b2a] mb-8 flex items-center gap-3">
            <span className="text-[#ff5a1f]">⚠️</span> Important Guidelines
          </h2>
          
          <ul className="space-y-6 text-gray-700 text-sm leading-relaxed">
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">1.</span>
              <div>
                Children under 14 years must be accompanied by a parent or guardian holding a valid Visitor, Participant, VIP Visitor, or VIP Participant ticket. Parents/guardians are solely responsible for the safety and supervision of their children and must not leave them unattended at any time during the entire allotted time. <span className="text-red-500 font-bold ml-1">❌ Children under 3 years of age are not allowed inside the Funzone.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">2.</span>
              <div>
                <span className="text-red-500 font-bold mr-1">❌</span> Food, eatables, and drinks are not allowed inside the Fun Zone area during the activity time.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">3.</span>
              <div>
                <strong>Visitor Ticket:</strong> Allows 1 hour entry only as a companion. Visitors are not permitted to play any activities.<br/>
                <span className="text-[#ff5a1f] font-bold">₹300 + GST per hour per person</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">4.</span>
              <div>
                <strong>Participant Ticket:</strong> Grants 1 hour full access to all 16 RC Activities.<br/>
                <span className="text-[#ff5a1f] font-bold">₹1000 + GST per hour per person</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">5.</span>
              <div>
                <strong>VIP Visitor Ticket:</strong> Grants 1 hour access to selected experiences – RC Flight Simulator, Car Race Sim Beginner, HO & N Scale Model Railway Activities.<br/>
                <span className="text-[#ff5a1f] font-bold">₹500 + GST per hour per person</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">6.</span>
              <div>
                <strong>VIP Participant Ticket:</strong> Grants 1 hour full access to all 16 RC Activities, with upgraded hobby-grade RC cars on Drift, Off-Road, Mini-Z tracks & FPV RC cars + 30 minutes additional activity for any 1 simulator in the Havoc Sim Podium. Subject to availability, waiting period may apply.<br/>
                <span className="text-[#ff5a1f] font-bold">₹1500 + GST per hour per person</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">7.</span>
              <div>
                <span className="text-red-500 font-bold mr-1">🚫</span> Entry will not be allowed to any person without a valid booking/ticket.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">8.</span>
              <div>
                <span className="mr-1">⏰</span> Please arrive at least 20 minutes before your slot start time.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">9.</span>
              <div>
                <span className="text-red-500 font-bold mr-1">❌</span> Late arrivals will not receive additional play/visit time.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">10.</span>
              <div>
                <span className="text-red-500 font-bold mr-1">❌</span> No refunds, cancellations, or rescheduling once tickets are booked. Tickets are non-transferable and cannot be shared with other candidates during the allotted time.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="font-bold text-[#ff5a1f] min-w-[24px]">11.</span>
              <div>
                <span className="text-[#ff5a1f] font-bold mr-1">❗</span> Please note that limited parking is available below the Fun Zone premises. Participants and visitors are requested to plan their visit accordingly. BMTC Shantinagar Public Parking is also available approximately a 5-minute walk from the Fun Zone.
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Pass Types Comparison Modal */}
      {isGuideModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setIsGuideModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4 mb-6">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-[#ff5a1f] block mb-1">
                  Pass Comparison Guide
                </span>
                <h3 className="text-2xl sm:text-3xl font-heading font-black text-[#0d1b2a] tracking-tight">
                  Which Pass Should You Choose?
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Compare entry privileges, activity access, and VIP perks across all 4 pass categories.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(false)}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pass Cards Grid (Dynamic from database passes + fallback to benefits) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
              {dbTickets.map((t) => {
                const key = t.name.toUpperCase();
                const defaultInfo = TICKET_BENEFITS[key];
                const isCurrent = type.toUpperCase() === key;
                const hasPerk = t.has_simulator_perk === 1;

                // Title & Tagline
                const title = defaultInfo?.title || t.name.replace(/_/g, " ");
                const tagline = t.description || defaultInfo?.tagline || `1-hour entry access with reserved arena capacity.`;
                const priceStr = `₹${t.price.toLocaleString("en-IN")} + GST`;

                // Badge
                const badge = hasPerk 
                  ? (t.perk_title || "VIP Sim Perk") 
                  : (defaultInfo?.badge || "Active Pass");
                const badgeColor = hasPerk 
                  ? "bg-orange-50 text-[#ff5a1f] border-orange-200" 
                  : (defaultInfo?.badgeColor || "bg-blue-50 text-blue-700 border-blue-200");

                // Benefits list
                let benefitsList: string[] = [];
                if (t.benefits && t.benefits.trim()) {
                  benefitsList = t.benefits.split("\n").map(s => s.trim()).filter(Boolean);
                } else if (defaultInfo?.benefits) {
                  benefitsList = defaultInfo.benefits;
                } else {
                  benefitsList = [
                    `1 Hour arena entry access`,
                    hasPerk ? `Includes ${t.perk_duration_mins || 30}-min simulator session at Havoc Sim Podium` : `Slot capacity: ${t.capacity} players`
                  ];
                }

                const restrictionsList = defaultInfo?.restrictions || [];

                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                      isCurrent
                        ? "border-[#ff5a1f] bg-orange-50/20 shadow-md ring-2 ring-[#ff5a1f]/10"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                          {badge}
                        </span>
                        <span className="text-base font-black text-[#ff5a1f]">
                          {priceStr}
                        </span>
                      </div>

                      <h4 className="text-lg font-black font-heading text-[#0d1b2a] mb-1">
                        {title}
                      </h4>
                      <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                        {tagline}
                      </p>

                      <div className="space-y-2 border-t border-gray-100 pt-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                          Access &amp; Benefits:
                        </span>
                        <ul className="space-y-1.5 text-xs text-gray-700">
                          {benefitsList.map((b, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                              <span>{b}</span>
                            </li>
                          ))}
                          {restrictionsList.map((r, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-200/50 mt-1">
                              <span className="shrink-0">🚫</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-5 mt-4 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => {
                          setType(t.name);
                          setIsGuideModalOpen(false);
                        }}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          isCurrent
                            ? "bg-green-600 text-white shadow-sm"
                            : "bg-[#0d1b2a] hover:bg-[#ff5a1f] text-white"
                        }`}
                      >
                        {isCurrent ? "✓ Currently Selected" : `Select ${title}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note & Close Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
              <p>All passes are valid for 1 hour duration. Entry only with pre-booked slot.</p>
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(false)}
                className="w-full sm:w-auto px-6 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition-colors"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
