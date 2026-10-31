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
  fetchBlockedSlotsAction,
  fetchTimeSlotsAction,
  fetchSimPodiumSlotsAction,
  fetchSiteSettingAction,
  fetchOpenedSpecificDatesAction
} from '@/app/actions/tickets';
import { fetchAddonsAction } from '@/app/actions/addons';
import type { TicketRow, VipPerkRow, BlockedSlotRow, TimeSlotRow, AddonRow } from '@/lib/db';
import type { SimPodiumSlot } from '@/lib/simulator-db';
import { useCart } from '@/context/CartContext';
import { Info, Check, X, Sparkles, ChevronRight, Ban, Plus } from 'lucide-react';

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
  const [availableAddons, setAvailableAddons] = useState<AddonRow[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Record<number, { selected: boolean; quantity: number }>>({});
  const [bookedQuantities, setBookedQuantities] = useState<{ticket_id: number, total_booked: number}[]>([]);
  const [simulators, setSimulators] = useState<VipPerkRow[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlotRow[]>([]);
  const [dbTimeSlots, setDbTimeSlots] = useState<TimeSlotRow[]>([]);
  const [dbSimSlots, setDbSimSlots] = useState<SimPodiumSlot[]>([]);
  const [isMondayOpen, setIsMondayOpen] = useState(false);
  const [openedSpecificDates, setOpenedSpecificDates] = useState<string[]>([]);

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
      tagline: "Full play access to 15 RC activities for 1 hour (Excavator Activity is not included in the package. It can be purchased separately as an add-on.).",
      price: "₹1,000 + GST",
      badge: "Full RC Access",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      accessType: "play",
      benefits: [
        "1 Hour unlimited play access across 15 RC activities",
        "Excavator Activity is not included in the package. It can be purchased separately as an add-on.",
        "Includes RC Race & Drift tracks, Train World, and more"
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
      tagline: "15 RC activities + Upgraded Hobby Grade Cars + 30-Min Havoc Sim Podium session (Excavator Activity is not included in the package. It can be purchased separately as an add-on.).",
      price: "₹1,500 + GST",
      badge: "All-Inclusive + Sim Podium",
      badgeColor: "bg-orange-50 text-[#ff5a1f] border-orange-200",
      accessType: "vip",
      benefits: [
        "Full access to 15 RC activities for 1 hour",
        "Excavator Activity is not included in the package. It can be purchased separately as an add-on.",
        "Upgraded hobby-grade RC Cars for Drift, Off-Road, Mini-Z tracks & FPV RC cars",
        "BONUS: Free 30-min session on any 1 simulator in the Havoc Sim Podium (Airbus, Boeing, GT, F1, etc.)"
      ]
    }
  };

  useEffect(() => {
    fetchTicketsAction().then(data => {
      setDbTickets(data.filter(t => t.active === 1 && !t.is_addon));
    });
    fetchAddonsAction(true).then(data => {
      setAvailableAddons(data || []);
    });
    fetchVipPerksAction(true).then(data => {
      setSimulators(data);
    });
    fetchBlockedSlotsAction().then(data => {
      setBlockedSlots(data || []);
    });
    fetchTimeSlotsAction(true).then(data => {
      setDbTimeSlots(data || []);
    });
    fetchSimPodiumSlotsAction().then(data => {
      setDbSimSlots(data || []);
    });
    fetchSiteSettingAction('monday_open', '0').then(val => {
      setIsMondayOpen(val === '1' || val.toLowerCase() === 'true');
    });
    fetchOpenedSpecificDatesAction().then(dates => {
      setOpenedSpecificDates(dates || []);
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
    { label: "8:30PM-9PM", startHour: 20.5 },
    { label: "9PM-9:30PM", startHour: 21.0 },
    { label: "9:30PM-10PM", startHour: 21.5 },
    { label: "10PM-10:30PM", startHour: 22.0 },
    { label: "10:30PM-11PM", startHour: 22.5 },
    { label: "11PM-11:30PM", startHour: 23.0 },
    { label: "11:30PM-12AM", startHour: 23.5 }
  ];

  // Helper to get pass end hour (e.g. "11AM-12PM" or "8PM - 9PM" ends at 12:00 -> 12.0 or 21:00 -> 21.0)
  const getPassEndHour = (passSlot: string): number => {
    if (!passSlot) return 0;
    const parts = passSlot.split("-");
    if (parts.length < 2) return 0;
    const end = parts[1].trim().toUpperCase();
    const isPM = end.includes("PM");
    const clean = end.replace(/AM|PM/g, "").trim();
    let h = parseInt(clean, 10);
    if (isNaN(h)) return 0;
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
    return h;
  };

  const selectedTicket = dbTickets.find(t => t.name === type);
  const hasSimPerk = selectedTicket ? Boolean(selectedTicket.has_simulator_perk || selectedTicket.name.toUpperCase().includes("VIP_PARTICIPANT")) : false;
  const perkDuration = selectedTicket?.perk_duration_mins || 30;
  const requiredSlotsPerTicket = perkDuration >= 60 ? Math.floor(perkDuration / 30) : 1; // 30m -> 1 slot, 60m -> 2 slots, etc.
  const totalSimSlotsNeeded = (hasSimPerk ? quantity : 0) * requiredSlotsPerTicket;
  const perkTitle = selectedTicket?.perk_title || `${perkDuration}-Min Havoc Sim Podium Session`;

  const passEndHour = getPassEndHour(time);
  
  // Use dynamically loaded slots from Havoc Sim Podium database (or fallback to static base slots)
  const activeSimSlots = dbSimSlots.length > 0 
    ? dbSimSlots.map(s => ({ label: s.label, startHour: s.startHour }))
    : BASE_30MIN_SIM_SLOTS;

  // Show 30-min simulator slots starting from or after the Funzone pass end hour.
  // If the pass is late evening (e.g. 8PM-9PM or 9PM-10PM), gracefully show the available evening simulator slots so visitors can still select their perk.
  const filteredSimSlots = time 
    ? activeSimSlots.filter(s => s.startHour >= passEndHour)
    : [];
  const availableSimSlots = filteredSimSlots.length > 0 
    ? filteredSimSlots 
    : (time ? activeSimSlots.slice(-4) : activeSimSlots);

  // Selected simulators & slots per participant & session
  const [simSelections, setSimSelections] = useState<{ simName: string; slotLabel: string }[]>([
    { simName: "", slotLabel: "" }
  ]);

  // Track expanded/collapsed participant cards (default opens Participant 1)
  const [openParticipants, setOpenParticipants] = useState<Record<number, boolean>>({ 0: true });

  const toggleParticipantCard = (index: number) => {
    setOpenParticipants(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

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

  // Adjust number of sim selections when perk duration, ticket, or quantity changes
  useEffect(() => {
    if (hasSimPerk && totalSimSlotsNeeded > 0) {
      setSimSelections(prev => {
        const next = [...prev];
        while (next.length < totalSimSlotsNeeded) {
          next.push({ simName: "", slotLabel: "" });
        }
        return next.slice(0, totalSimSlotsNeeded);
      });
    }
  }, [hasSimPerk, totalSimSlotsNeeded]);

  // When Funzone visit time changes, clear any previously chosen slot that is no longer valid
  useEffect(() => {
    if (hasSimPerk) {
      setSimSelections(prev => {
        return prev.map(item => {
          // If the slot is no longer in availableSimSlots, reset it to empty so participant picks explicitly
          if (item.slotLabel && !availableSimSlots.some(s => s.label === item.slotLabel)) {
            return { ...item, slotLabel: "" };
          }
          return item;
        });
      });
    }
  }, [time, hasSimPerk, availableSimSlots.length]);

  const basePrice = selectedTicket ? selectedTicket.price : 0;
  const totalPrice = basePrice * quantity;
  
  const bookedForSelected = selectedTicket 
    ? bookedQuantities.find(b => b.ticket_id === selectedTicket.id)?.total_booked || 0 
    : 0;
  const maxAvailableCap = selectedTicket ? Math.max(0, selectedTicket.capacity - bookedForSelected) : 100;

  // Check that all required simulator slots for EVERY participant have a simulator and time slot chosen,
  // AND ensure no single participant has assigned themselves conflicting identical time slots across multiple sessions
  const hasParticipantTimeConflict = hasSimPerk && Array.from({ length: quantity }, (_, pIdx) => {
    const pSlots = simSelections
      .slice(pIdx * requiredSlotsPerTicket, (pIdx + 1) * requiredSlotsPerTicket)
      .map(s => s.slotLabel)
      .filter(Boolean);
    const uniqueSlots = new Set(pSlots);
    return uniqueSlots.size < pSlots.length; // Conflict if duplicate slot found for same participant
  }).some(Boolean);

  const allSimsSelected = !hasSimPerk || (
    simSelections.length === totalSimSlotsNeeded &&
    simSelections.length > 0 &&
    simSelections.every(s => Boolean(s.simName && s.slotLabel)) &&
    !hasParticipantTimeConflict
  );

  // Check if currently selected date or time slot is blocked for the chosen ticket
  const isSelectedSlotBlocked = Boolean(
    date && time && blockedSlots.some(b => 
      (b.booking_date === date || b.booking_date === 'ALL') && 
      (b.time_slot === time || b.time_slot === 'ALL_DAY') &&
      (!b.ticket_id || (selectedTicket && b.ticket_id === selectedTicket.id))
    )
  );

  const canSubmit = type && date && time && !isSelectedSlotBlocked && maxAvailableCap > 0 && allSimsSelected;

  // Reset quantity if it exceeds the available capacity
  useEffect(() => {
    if (selectedTicket && quantity > maxAvailableCap) {
      setQuantity(maxAvailableCap > 0 ? maxAvailableCap : 1);
    }
  }, [selectedTicket, maxAvailableCap, quantity]);

  // Ensure add-on quantity never exceeds the main ticket pass quantity
  useEffect(() => {
    setSelectedAddons(prev => {
      let changed = false;
      const next: Record<number, { selected: boolean; quantity: number }> = {};
      for (const [idStr, val] of Object.entries(prev)) {
        const id = Number(idStr);
        if (val.quantity > quantity) {
          next[id] = { ...val, quantity };
          changed = true;
        } else {
          next[id] = val;
        }
      }
      return changed ? next : prev;
    });
  }, [quantity]);

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

    // Check if this date has been specifically opened by admin (e.g. single Monday holiday)
    const isExplicitlyOpened = openedSpecificDates.includes(val);

    // Check if the date is manually blocked by admin (ALL_DAY on this date, or ALL_DAY on ALL dates)
    // If a ticket type is selected, check if blocked globally (ticket_id is null) OR blocked specifically for this pass
    const isDayBlockedByAdmin = blockedSlots.some(b => 
      (b.booking_date === val || b.booking_date === 'ALL') && 
      b.time_slot === 'ALL_DAY' &&
      (!b.ticket_id || (selectedTicket && b.ticket_id === selectedTicket.id))
    );
    // Closed on Monday unless all Mondays are enabled OR this specific date is explicitly opened
    const isClosedMonday = isMonday && !isMondayOpen && !isExplicitlyOpened;
    const isBlocked = isClosedMonday || isDayBlockedByAdmin;
    
    return {
      value: val,
      display: `${title.split(' ')[0]} ${dayStr}`,
      isPast,
      isBlocked,
      isClosedMonday,
      isMonday,
      isExplicitlyOpened
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
              <img src="/ticket1.png" alt="RC Adventure Ticket" className="w-full h-full object-contain drop-shadow-xl hover:scale-105 transition-transform duration-500" />
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
                        {d.display} {d.isExplicitlyOpened && d.isMonday ? "(Special Open - Monday)" : d.isClosedMonday ? "(Closed - Every Monday)" : d.isBlocked ? "(Unavailable / Closed)" : ""}
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
                  <option value="" disabled>Select Time Slot</option>
                  {(dbTimeSlots.length > 0 
                    ? [...dbTimeSlots].sort((a, b) => a.start_hour - b.start_hour).map(s => ({ label: s.label, startHour: s.start_hour }))
                    : [
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
                  )
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
                    // Check if slot is blocked by admin (globally OR specifically for selected ticket pass)
                    const isBlockedSlot = blockedSlots.some(b => 
                      (b.booking_date === date || b.booking_date === 'ALL') && 
                      (b.time_slot === slot.label || b.time_slot === 'ALL_DAY') &&
                      (!b.ticket_id || (selectedTicket && b.ticket_id === selectedTicket.id))
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

            {/* Quantity */}
            <div className="space-y-2">
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

            {/* VIP Simulator Perk Selection Box - Organized per participant */}
            {hasSimPerk && (
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f] flex items-center justify-center font-bold text-sm">
                      ★
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 tracking-tight">
                        VIP Perk: {perkTitle}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {quantity > 1 
                          ? `${quantity} Tickets selected: Each participant gets their own 30-min simulator session. Slot selection is mandatory for each participant.`
                          : `Choose your simulator & preferred 30-min slot. Included free with your ${selectedTicket?.name.replace(/_/g, ' ')}.`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-[#ff5a1f] border border-[#ff5a1f]/20">
                      {quantity > 1 ? `${quantity} PARTICIPANTS` : `FREE PERK (30 MINS)`}
                    </span>
                    {!allSimsSelected && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 animate-pulse">
                        ● Selection Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Group slots by Participant */}
                <div className="space-y-6">
                  {Array.from({ length: quantity }, (_, participantIndex) => {
                    const participantNumber = participantIndex + 1;
                    const participantSlots = Array.from({ length: requiredSlotsPerTicket }, (__, sIdx) => {
                      const globalIndex = participantIndex * requiredSlotsPerTicket + sIdx;
                      return {
                        globalIndex,
                        sessionIndex: sIdx,
                        selection: simSelections[globalIndex] || { simName: "", slotLabel: "" }
                      };
                    });

                    const isParticipantComplete = participantSlots.every(ps => Boolean(ps.selection.simName && ps.selection.slotLabel));
                    const isOpen = Boolean(openParticipants[participantIndex]);

                    return (
                      <div 
                        key={participantIndex}
                        className={`rounded-2xl border-2 transition-all ${
                          isOpen 
                            ? "border-orange-200 bg-orange-50/20 shadow-sm p-4 sm:p-5 space-y-5" 
                            : isParticipantComplete
                              ? "border-green-200 bg-white hover:border-green-300 hover:shadow-sm p-3.5 sm:p-4"
                              : "border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm p-3.5 sm:p-4"
                        }`}
                      >
                        {/* Clickable Participant Header Card */}
                        <div 
                          onClick={() => toggleParticipantCard(participantIndex)}
                          className={`flex items-center justify-between cursor-pointer select-none group ${isOpen ? "pb-3" : "pb-0"}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-full bg-[#0d1b2a] text-white flex items-center justify-center text-xs font-bold group-hover:bg-[#ff5a1f] transition-colors">
                              {participantNumber}
                            </span>
                            <div>
                              <span className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
                                Participant {participantNumber} {quantity > 1 ? `of ${quantity}` : ""}
                              </span>
                              {!isOpen && (
                                <p className="text-[11px] text-gray-500 font-medium">
                                  {isParticipantComplete 
                                    ? participantSlots.map(ps => `${ps.selection.simName} (${ps.selection.slotLabel})`).join(", ")
                                    : "Tap to select simulator & slot"}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            {isParticipantComplete ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 shadow-sm">
                                <span>✓</span> Confirmed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> Slot Pending
                              </span>
                            )}

                            {/* Chevron Toggle */}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-white border border-gray-200 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180 bg-gray-100' : ''}`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Participant Sessions Body */}
                        {isOpen && (
                          <div className="space-y-5 pt-3 border-t border-gray-200/80 animate-in fade-in slide-in-from-top-1 duration-200">
                            {participantSlots.map(({ globalIndex, sessionIndex, selection }) => (
                              <div key={globalIndex} className="space-y-4">
                                {requiredSlotsPerTicket > 1 && (
                                  <div className="flex items-center justify-between pb-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                      Session {sessionIndex + 1} (30 Minutes)
                                    </span>
                                    <span className="text-[11px] font-bold text-[#ff5a1f]">
                                      {selection.simName 
                                        ? `${selection.simName} • ${selection.slotLabel || "Slot Pending"}` 
                                        : "Simulator & Slot Pending"}
                                    </span>
                                  </div>
                                )}

                                {/* Simulator Visual Selection Grid */}
                                <div>
                                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                    Select Simulator for Participant {participantNumber} {requiredSlotsPerTicket > 1 ? `(Session #${sessionIndex + 1})` : ""} *
                                  </label>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                                    {simulators.map((sim) => {
                                      const isSelected = selection.simName === sim.name;
                                      return (
                                        <div
                                          key={sim.id}
                                          onClick={() => {
                                            setSimSelections(prev => {
                                              const next = [...prev];
                                              next[globalIndex] = { ...next[globalIndex], simName: sim.name };
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
                                <div className="pt-2 border-t border-gray-200/60">
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                      Select 30-Min Slot for Participant {participantNumber} *
                                    </label>
                                    <span className="text-[11px] text-gray-500 font-semibold">
                                      {time ? `Available after ${time.split("-")[1] || time}` : "Select visit time slot first"}
                                    </span>
                                  </div>

                                  {!time ? (
                                    <div className="p-3 rounded-xl bg-white border border-gray-200 text-center text-xs text-gray-500 font-medium">
                                      Please select your Funzone time slot above first to view available simulator slots.
                                    </div>
                                  ) : availableSimSlots.length === 0 ? (
                                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center text-xs text-amber-800 font-medium">
                                      No simulator slots available after your selected time slot ({time}).
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-white rounded-xl border border-gray-200/80">
                                      {availableSimSlots.map((slot) => {
                                        const isSelected = selection.slotLabel === slot.label;
                                        
                                        // 1. Conflict Check: Same participant cannot be in two simulators at the SAME time slot
                                        const isSlotTakenBySameParticipant = participantSlots.some(ps => 
                                          ps.globalIndex !== globalIndex && 
                                          ps.selection.slotLabel === slot.label
                                        );

                                        // 2. Conflict Check: Disallow picking the EXACT same simulator rig at the exact same 30-min slot by another participant
                                        const isTakenByAnotherParticipant = simSelections.some((s, idx) => 
                                          idx !== globalIndex && 
                                          s.simName === selection.simName && 
                                          s.slotLabel === slot.label
                                        );

                                        // 3. Database check: Already booked in Havoc Sim Podium database
                                        const takenForThisSim = takenSimSlots[selection.simName] || [];
                                        const isTakenInDb = takenForThisSim.includes(slot.label);

                                        const isDisabled = isSlotTakenBySameParticipant || isTakenByAnotherParticipant || isTakenInDb;

                                        return (
                                          <button
                                            key={slot.label}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => {
                                              setSimSelections(prev => {
                                                const next = [...prev];
                                                next[globalIndex] = { ...next[globalIndex], slotLabel: slot.label };
                                                return next;
                                              });
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                              isSelected
                                                ? "bg-[#ff5a1f] text-white border-[#ff5a1f] shadow-sm shadow-[#ff5a1f]/30 scale-[1.02]"
                                                : isTakenInDb
                                                  ? "bg-red-50 text-red-400 border-red-200 cursor-not-allowed opacity-60 line-through"
                                                  : isSlotTakenBySameParticipant
                                                    ? "bg-amber-50 text-amber-500 border-amber-200 cursor-not-allowed opacity-60 line-through"
                                                    : isTakenByAnotherParticipant
                                                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50 line-through"
                                                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                            }`}
                                            title={
                                              isTakenInDb
                                                ? "Already booked on Havoc Sim Podium"
                                                : isSlotTakenBySameParticipant
                                                  ? `Participant ${participantNumber} already has another session at ${slot.label}`
                                                  : isTakenByAnotherParticipant
                                                    ? "Already chosen for this simulator by another participant"
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
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Summary Box */}
                {time && simSelections.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-200/80 text-xs text-gray-700 space-y-1.5">
                    <span className="font-bold text-gray-900 block flex items-center justify-between">
                      <span>🏆 Simulator Reservations Summary:</span>
                      {allSimsSelected ? (
                        <span className="text-green-600 font-bold">✓ All Slots Confirmed</span>
                      ) : (
                        <span className="text-red-500 font-bold">Pending selections required</span>
                      )}
                    </span>
                    {Array.from({ length: quantity }, (_, pIdx) => {
                      const pNum = pIdx + 1;
                      const pSelections = simSelections.slice(pIdx * requiredSlotsPerTicket, (pIdx + 1) * requiredSlotsPerTicket);
                      return (
                        <div key={pIdx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-gray-600 border-t border-orange-100 pt-1">
                          <span>Participant {pNum}: {pSelections.map(s => s.simName).join(" & ")}</span>
                          <span className="font-bold text-[#ff5a1f]">
                            {pSelections.every(s => s.slotLabel) 
                              ? pSelections.map(s => s.slotLabel).join(" • ")
                              : <span className="text-red-500 font-semibold">Slot Pending</span>
                            }
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Add-Ons Section (e.g. Excavator Activities) */}
            {Boolean(type && date && time && availableAddons.length > 0) && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-white border border-amber-200/90 shadow-sm space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#ff5a1f]/15 text-[#ff5a1f] flex items-center justify-center text-base">
                      🚜
                    </span>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-gray-900 flex items-center gap-1.5">
                        Interested in Excavator Activities?
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        Add extra activities and machinery experiences to your visit!
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#ff5a1f] bg-orange-100/80 px-2.5 py-1 rounded-full border border-orange-200">
                    Add-on Available
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {availableAddons.map((addon) => {
                    const isSelected = !!selectedAddons[addon.id]?.selected;
                    const addonQty = selectedAddons[addon.id]?.quantity || quantity;

                    return (
                      <div
                        key={addon.id}
                        onClick={() => {
                          setSelectedAddons(prev => ({
                            ...prev,
                            [addon.id]: {
                              selected: !isSelected,
                              quantity: Math.min(prev[addon.id]?.quantity || quantity, quantity)
                            }
                          }));
                        }}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-orange-50/90 border-[#ff5a1f] shadow-md shadow-orange-500/10 ring-1 ring-[#ff5a1f]'
                            : 'bg-white border-gray-200 hover:border-orange-300 shadow-sm'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // toggled by parent div
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-[#ff5a1f] focus:ring-[#ff5a1f] cursor-pointer accent-[#ff5a1f]"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900">
                                {addon.name}
                              </span>
                              <span className="text-xs font-black text-[#ff5a1f] bg-orange-100/90 px-2.5 py-0.5 rounded-full">
                                +₹{addon.price} per person
                              </span>
                            </div>

                            {addon.tagline && (
                              <p className="text-xs text-gray-600 font-medium mt-0.5 leading-snug">
                                {addon.tagline}
                              </p>
                            )}
                            {addon.description && (
                              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                                {addon.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Quantity Counter for this Add-on */}
                        {isSelected && (
                          <div 
                            className="mt-3 pt-2.5 border-t border-orange-200/70 flex items-center justify-between animate-in fade-in duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-gray-700">Add-on Quantity:</span>
                              <span className="text-[10px] font-semibold text-gray-400">
                                (Max {quantity} {quantity === 1 ? 'pass' : 'passes'})
                              </span>
                            </div>
                            <div className="flex border border-orange-300 w-28 rounded-lg overflow-hidden bg-white shadow-sm">
                              <button
                                type="button"
                                className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:text-[#ff5a1f] hover:bg-orange-50 transition-colors"
                                onClick={() => {
                                  setSelectedAddons(prev => ({
                                    ...prev,
                                    [addon.id]: {
                                      selected: true,
                                      quantity: Math.max(1, addonQty - 1)
                                    }
                                  }));
                                }}
                              >-</button>
                              <div className="flex-1 h-8 flex items-center justify-center text-xs font-black text-gray-900 border-l border-r border-orange-200">
                                {addonQty}
                              </div>
                              <button
                                type="button"
                                disabled={addonQty >= quantity}
                                className={`w-8 h-8 flex items-center justify-center font-bold transition-colors ${
                                  addonQty >= quantity
                                    ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                                    : 'text-gray-600 hover:text-[#ff5a1f] hover:bg-orange-50'
                                }`}
                                onClick={() => {
                                  if (addonQty < quantity) {
                                    setSelectedAddons(prev => ({
                                      ...prev,
                                      [addon.id]: {
                                        selected: true,
                                        quantity: Math.min(addonQty + 1, quantity)
                                      }
                                    }));
                                  }
                                }}
                              >+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-6">
              <button 
                onClick={() => {
                  if (selectedTicket) {
                    // Cleanly format simulator names and slots per participant
                    const combinedSimNames = simSelections.length === 1 
                      ? simSelections[0].simName 
                      : simSelections.map((s, i) => {
                          const pNum = Math.floor(i / requiredSlotsPerTicket) + 1;
                          return quantity > 1 ? `#${i+1} (P${pNum}): ${s.simName}` : `#${i+1}: ${s.simName}`;
                        }).join(" | ");

                    const combinedSimSlots = simSelections.length === 1
                      ? simSelections[0].slotLabel
                      : simSelections.map((s, i) => {
                          const pNum = Math.floor(i / requiredSlotsPerTicket) + 1;
                          return quantity > 1 
                            ? `#${i+1} (P${pNum} - ${s.simName}): ${s.slotLabel}` 
                            : `#${i+1} (${s.simName}): ${s.slotLabel}`;
                        }).join(" • ");

                    // 1. Add base pass to cart
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

                    // 2. Add selected add-on(s) to cart with matching date & slot, strictly capped to pass quantity
                    availableAddons.forEach(addon => {
                      const sel = selectedAddons[addon.id];
                      if (sel?.selected && addon.ticket_id) {
                        const finalAddonQty = Math.min(sel.quantity || quantity, quantity);
                        addItem({
                          id: Math.random().toString(36).substring(7),
                          type: addon.name,
                          date,
                          timeSlot: time,
                          quantity: finalAddonQty,
                          price: addon.price,
                          ticketId: addon.ticket_id
                        });
                      }
                    });

                    // Clear selected add-ons after adding
                    setSelectedAddons({});
                  }
                }}
                disabled={!canSubmit}
                className={`w-full font-bold py-4 rounded-xl transition-all shadow-md text-sm tracking-wider uppercase ${
                  !canSubmit 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                    : 'bg-[#ff5a1f] hover:bg-[#e04812] text-white shadow-lg shadow-[#ff5a1f]/20 hover:-translate-y-0.5'
                }`}
              >
                {!allSimsSelected 
                  ? "Select All Participant Slots" 
                  : Object.values(selectedAddons).some(a => a.selected)
                    ? "Add Pass & Add-on to Cart"
                    : "Add to Cart"
                }
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
                <strong>Participant Ticket:</strong> Grants 1 hour full access to 15 RC Activities (Excavator Activity is not included in the package. It can be purchased separately as an add-on.).<br/>
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
                <strong>VIP Participant Ticket:</strong> Grants 1 hour full access to 15 RC Activities (Excavator Activity is not included in the package. It can be purchased separately as an add-on.), with upgraded hobby-grade RC cars on Drift, Off-Road, Mini-Z tracks & FPV RC cars + 30 minutes additional activity for any 1 simulator in the Havoc Sim Podium. Subject to availability, waiting period may apply.<br/>
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
