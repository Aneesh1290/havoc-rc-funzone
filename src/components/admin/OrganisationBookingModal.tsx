"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Building2,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Sparkles,
  PartyPopper,
  GraduationCap,
  Briefcase,
  Flag,
  FileText,
  DollarSign,
  Info,
  Car,
  Layers,
  ChevronDown
} from "lucide-react";
import { COUNTRY_CODES } from "@/lib/countries";
import { createOrganisationBookingAction } from "@/app/actions/organisation-bookings";
import type { TimeSlotRow, TicketRow } from "@/lib/db";
import { useRouter } from "next/navigation";

export interface OrganisationBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  timeSlots: TimeSlotRow[];
  tickets: TicketRow[];
}

export type OrgCategoryType = 
  | "School" 
  | "Birthday Party" 
  | "Corporate" 
  | "Private Event" 
  | "Group Gathering" 
  | "Other";

interface BookingLineItem {
  id: string;
  ticketId: number;
  ticketName: string;
  timeSlot: string;
  quantity: number;
  unitPrice: number;
  simulatorName?: string;
  simulatorSlot?: string;
}

const ORG_CATEGORIES = [
  {
    type: "School" as OrgCategoryType,
    label: "School / College",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    icon: GraduationCap,
    desc: "Field trips, educational visits, sports day outings",
    defaultSpecial: ["Dedicated Track Marshal", "Educational Briefing", "Group Rotation Setup"]
  },
  {
    type: "Birthday Party" as OrgCategoryType,
    label: "Birthday Party",
    badge: "bg-pink-50 text-pink-700 border-pink-200",
    icon: PartyPopper,
    desc: "Kids birthday bashes, private cake & celebration sessions",
    defaultSpecial: ["Cake Table & Balloons Setup", "Birthday Kid Podium Photo", "Music & Sound System"]
  },
  {
    type: "Corporate" as OrgCategoryType,
    label: "Corporate Outing",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Briefcase,
    desc: "Team building, company championship, corporate offsites",
    defaultSpecial: ["Grand Prix Lap Timing", "Podium Medal Ceremony", "F&B Dining Space"]
  },
  {
    type: "Private Event" as OrgCategoryType,
    label: "Private Arena Buyout",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Flag,
    desc: "Exclusive arena hire, private RC racing tournaments",
    defaultSpecial: ["Exclusive Track Access", "Custom Track Layout", "Dedicated Marshals"]
  },
  {
    type: "Group Gathering" as OrgCategoryType,
    label: "Group / Gathering",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Users,
    desc: "Family reunions, hobby clubs, large enthusiast groups",
    defaultSpecial: ["Group Seating Area", "Multiple Slot Rotation"]
  },
  {
    type: "Other" as OrgCategoryType,
    label: "Other Custom",
    badge: "bg-gray-100 text-gray-700 border-gray-200",
    icon: Building2,
    desc: "Custom bespoke reservation or partner event",
    defaultSpecial: ["Custom Arrangement"]
  }
];

const SPECIAL_REQUIREMENT_PRESETS = [
  "🎂 Cake Table & Party Area Setup",
  "🛡️ Dedicated Track Safety Marshal",
  "🏆 Podium Finish & Trophy / Medal Ceremony",
  "🍕 Food & Beverage Catering Space",
  "🎤 Sound System & Wireless Microphone",
  "🏁 Custom Track Obstacle Layout",
  "📸 Group Photograph & Victory Ceremony",
  "🚌 School Bus / Dedicated Parking Coordination"
];

export default function OrganisationBookingModal({
  isOpen,
  onClose,
  onSuccess,
  timeSlots = [],
  tickets = [],
}: OrganisationBookingModalProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  // Stepper state: 1 = Details & Packages, 2 = Confirmation & Print
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // 1. Organisation & Contact Information
  const [orgType, setOrgType] = useState<OrgCategoryType>("School");
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [expectedGuests, setExpectedGuests] = useState<number>(20);
  const [specialRequests, setSpecialRequests] = useState<string[]>([]);
  const [customRequestInput, setCustomRequestInput] = useState("");

  // 2. Schedule & Slot Timing
  const [eventDate, setEventDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  // 3. Line Items & Experiences
  const [items, setItems] = useState<BookingLineItem[]>([]);

  // 4. Custom Pricing & Invoicing
  const [pricingMode, setPricingMode] = useState<"standard" | "custom_package" | "per_head">("standard");
  const [packageLumpSum, setPackageLumpSum] = useState<number>(15000);
  const [perHeadRate, setPerHeadRate] = useState<number>(600);
  const [taxOption, setTaxOption] = useState<"inclusive" | "add_gst" | "exempt">("inclusive");

  // 5. Payment Terms & Deposit
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Partially paid" | "Unpaid">("Unpaid");
  const [depositAmount, setDepositAmount] = useState<number>(5000);
  const [paymentMode, setPaymentMode] = useState("Bank Transfer (NEFT/RTGS)");
  const [paymentRef, setPaymentRef] = useState("");
  const [notes, setNotes] = useState("");

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Initialize selected slots and items when timeSlots / tickets load
  useEffect(() => {
    if (timeSlots.length > 0 && selectedSlots.length === 0) {
      const activeSlot = timeSlots.find(s => s.active) || timeSlots[0];
      if (activeSlot) {
        setSelectedSlots([activeSlot.label]);
      }
    }
  }, [timeSlots, selectedSlots]);

  // Set default special requirements when orgType changes
  useEffect(() => {
    const cat = ORG_CATEGORIES.find(c => c.type === orgType);
    if (cat && cat.defaultSpecial) {
      setSpecialRequests(cat.defaultSpecial);
    }
  }, [orgType]);

  // Add default ticket line item if empty
  useEffect(() => {
    if (items.length === 0 && tickets.length > 0 && selectedSlots.length > 0) {
      const defaultTicket = tickets.find(t => t.active && !t.is_addon) || tickets[0];
      if (defaultTicket) {
        setItems([
          {
            id: `item-${Date.now()}-1`,
            ticketId: defaultTicket.id,
            ticketName: defaultTicket.name,
            timeSlot: selectedSlots[0],
            quantity: expectedGuests || 15,
            unitPrice: defaultTicket.price || 799,
          }
        ]);
      }
    }
  }, [tickets, selectedSlots, items.length, expectedGuests]);

  const toggleSpecialRequest = (preset: string) => {
    setSpecialRequests(prev => 
      prev.includes(preset) ? prev.filter(p => p !== preset) : [...prev, preset]
    );
  };

  const handleAddCustomRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (customRequestInput.trim() && !specialRequests.includes(customRequestInput.trim())) {
      setSpecialRequests(prev => [...prev, customRequestInput.trim()]);
      setCustomRequestInput("");
    }
  };

  const toggleSlot = (slotLabel: string) => {
    setSelectedSlots(prev => {
      const exists = prev.includes(slotLabel);
      if (exists) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(s => s !== slotLabel);
      } else {
        return [...prev, slotLabel];
      }
    });
  };

  const handleAddLineItem = () => {
    const defaultTicket = tickets.find(t => t.active && !t.is_addon) || tickets[0] || { id: 1, name: "RC Fun Zone Track Pass", price: 799 };
    const defaultSlot = selectedSlots[0] || "11AM-12PM";
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        ticketId: defaultTicket.id,
        ticketName: defaultTicket.name,
        timeSlot: defaultSlot,
        quantity: Math.max(1, expectedGuests || 10),
        unitPrice: defaultTicket.price || 799,
      }
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateLineItem = (id: string, updates: Partial<BookingLineItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, ...updates };
        if (updates.ticketId !== undefined) {
          const t = tickets.find(ticket => ticket.id === updates.ticketId);
          if (t) {
            updated.ticketName = t.name;
            if (updates.unitPrice === undefined) {
              updated.unitPrice = t.price;
            }
          }
        }
        return updated;
      }
      return item;
    }));
  };

  // Financial Calculations
  const { subtotal, gstAmount, grandTotal, balanceDue } = useMemo(() => {
    let rawAmount = 0;
    if (pricingMode === "standard") {
      rawAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    } else if (pricingMode === "custom_package") {
      rawAmount = Math.max(0, Number(packageLumpSum || 0));
    } else if (pricingMode === "per_head") {
      rawAmount = Math.max(0, Number(perHeadRate || 0)) * Math.max(1, Number(expectedGuests || 1));
    }

    let calculatedSubtotal = 0;
    let calculatedGst = 0;
    let calculatedTotal = 0;

    if (taxOption === "inclusive") {
      calculatedTotal = rawAmount;
      calculatedSubtotal = Math.round((rawAmount / 1.18) * 100) / 100;
      calculatedGst = Math.round((rawAmount - calculatedSubtotal) * 100) / 100;
    } else if (taxOption === "add_gst") {
      calculatedSubtotal = rawAmount;
      calculatedGst = Math.round(rawAmount * 0.18 * 100) / 100;
      calculatedTotal = calculatedSubtotal + calculatedGst;
    } else {
      // Exempt
      calculatedSubtotal = rawAmount;
      calculatedGst = 0;
      calculatedTotal = rawAmount;
    }

    let calculatedBalance = 0;
    if (paymentStatus === "Paid") {
      calculatedBalance = 0;
    } else if (paymentStatus === "Partially paid") {
      calculatedBalance = Math.max(0, calculatedTotal - Number(depositAmount || 0));
    } else {
      calculatedBalance = calculatedTotal;
    }

    return {
      subtotal: calculatedSubtotal,
      gstAmount: calculatedGst,
      grandTotal: calculatedTotal,
      balanceDue: calculatedBalance
    };
  }, [items, pricingMode, packageLumpSum, perHeadRate, expectedGuests, taxOption, paymentStatus, depositAmount]);

  // Form Submission
  const handleSubmitReservation = async () => {
    setErrorMessage(null);

    if (!orgName.trim()) {
      setErrorMessage("Please enter an organisation, school, or party name.");
      return;
    }
    if (!contactName.trim()) {
      setErrorMessage("Please enter the coordinator or organizer contact name.");
      return;
    }
    if (!phone.trim()) {
      setErrorMessage("Please enter a valid contact phone number.");
      return;
    }
    if (items.length === 0) {
      setErrorMessage("Please add at least one session / activity pass.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Split grand total proportionally among items so item totals add up to grandTotal
      const totalRawUnits = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
      const bookingItems = items.map(item => {
        const itemProportion = totalRawUnits > 0 ? (item.quantity * item.unitPrice) / totalRawUnits : (1 / items.length);
        const itemFinalTotal = Math.round(grandTotal * itemProportion);
        return {
          ticketId: item.ticketId,
          ticketName: item.ticketName,
          date: eventDate,
          timeSlot: item.timeSlot,
          quantity: item.quantity,
          itemTotal: itemFinalTotal,
          simulatorName: item.simulatorName,
          simulatorSlot: item.simulatorSlot,
        };
      });

      const fullPhone = `${countryCode} ${phone.trim()}`;

      const res = await createOrganisationBookingAction({
        organizationType: orgType,
        organizationName: orgName.trim(),
        contactName: contactName.trim(),
        contactPhone: fullPhone,
        contactEmail: email.trim() || `${orgName.toLowerCase().replace(/[^a-z0-9]/g, '')}@reservation.havoc`,
        expectedGuests: Number(expectedGuests || 0),
        eventDate: eventDate,
        items: bookingItems,
        totalAmount: grandTotal,
        depositAmount: paymentStatus === "Partially paid" ? Number(depositAmount || 0) : (paymentStatus === "Paid" ? grandTotal : 0),
        paymentStatus: paymentStatus,
        paymentRef: paymentRef.trim() ? `${paymentMode} - ${paymentRef.trim()}` : paymentMode,
        organizationNotes: notes.trim(),
        specialRequests: specialRequests,
        tags: `ORGANISATION,${orgType.toUpperCase().replace(/\s+/g, '_')}`
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to create reservation.");
        setIsSubmitting(false);
        return;
      }

      setConfirmedOrder({
        orderCode: res.orderCode || `#PAYDUE_FZ_${res.orderNumber}`,
        orderNumber: res.orderNumber,
        primaryId: res.primaryId,
        orgName,
        orgType,
        contactName,
        phone: fullPhone,
        email,
        eventDate,
        selectedSlots,
        expectedGuests,
        items,
        subtotal,
        gstAmount,
        grandTotal,
        depositAmount: paymentStatus === "Partially paid" ? depositAmount : (paymentStatus === "Paid" ? grandTotal : 0),
        balanceDue,
        paymentStatus,
        paymentMode,
        paymentRef,
        specialRequests,
        notes
      });

      setCurrentStep(2);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      
      {/* Main Modal Box */}
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#0f172a] px-6 py-5 text-white flex items-center justify-between shrink-0 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#ff5a1f] to-orange-400 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-heading font-black tracking-tight text-white flex items-center gap-2">
                <span>Organisation Reservation Booking</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#ff5a1f]/20 text-[#ff5a1f] border border-[#ff5a1f]/30">
                  Admin Flow
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Schools, Birthday Parties, Corporate Outings & Private Arena Buyouts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-8 bg-gray-50/60">
          
          {currentStep === 1 && (
            <>
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm font-medium animate-in fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Category Picker */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <span>1. Select Reservation Category</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ORG_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = orgType === cat.type;
                    return (
                      <button
                        key={cat.type}
                        type="button"
                        onClick={() => setOrgType(cat.type)}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col gap-2 ${
                          isSelected
                            ? "bg-white border-[#ff5a1f] shadow-md ring-2 ring-[#ff5a1f]/20"
                            : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? "bg-[#ff5a1f] text-white" : "bg-gray-100 text-gray-600"}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#ff5a1f]" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{cat.label}</h4>
                          <p className="text-[11px] text-gray-500 line-clamp-1">{cat.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Organisation Profile & Organizer Contact */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#ff5a1f]" />
                  <span>2. Organisation & Organizer Details</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Org / Group Name */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      Organisation / School / Party Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={e => setOrgName(e.target.value)}
                      placeholder={
                        orgType === "School" 
                          ? "e.g. National Public School (Class 8 Field Trip)" 
                          : orgType === "Birthday Party" 
                            ? "e.g. Aarav's 10th Birthday Bash" 
                            : "e.g. Razorpay Engineering Offsite"
                      }
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] focus:ring-2 focus:ring-[#ff5a1f]/20 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-semibold transition-all outline-none"
                    />
                  </div>

                  {/* Contact Person Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      Coordinator / Contact Person <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      placeholder="e.g. Mr. Suresh Kumar / Priya (Parent)"
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] focus:ring-2 focus:ring-[#ff5a1f]/20 rounded-xl px-4 py-2.5 text-sm text-gray-900 transition-all outline-none"
                    />
                  </div>

                  {/* Guest Count */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Expected Guests / Students</span>
                      <span className="text-[10px] text-gray-400 font-normal">Approx headcount</span>
                    </label>
                    <div className="relative">
                      <Users className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        min="1"
                        value={expectedGuests}
                        onChange={e => setExpectedGuests(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] focus:ring-2 focus:ring-[#ff5a1f]/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 font-bold transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      Contact Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={e => setCountryCode(e.target.value)}
                        className="w-24 bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl px-2 py-2.5 text-xs text-gray-900 font-semibold outline-none"
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={`${c.code}-${c.dialCode}`} value={c.dialCode}>
                            {c.flag} {c.dialCode}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="98765 43210"
                        className="flex-1 bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] focus:ring-2 focus:ring-[#ff5a1f]/20 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-semibold transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      Email Address (Optional)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="coordinator@school.edu / parent@gmail.com"
                        className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] focus:ring-2 focus:ring-[#ff5a1f]/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Special Perks & Event Setups */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <label className="text-xs font-bold text-gray-700 block">
                    Special Requirements & Arena Setups:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIAL_REQUIREMENT_PRESETS.map(preset => {
                      const isSelected = specialRequests.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => toggleSpecialRequest(preset)}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${
                            isSelected
                              ? "bg-orange-50 text-orange-800 border-orange-300 font-bold"
                              : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {isSelected ? "✓ " : "+ "}
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Event Date & Slot Timing Selection */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#ff5a1f]" />
                  <span>3. Event Date & Time Slots</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Date Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Event Date</label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={e => setEventDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] focus:ring-2 focus:ring-[#ff5a1f]/20 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 outline-none"
                    />
                  </div>

                  {/* Multi-Slot Selector */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Reserve Slot(s) — Can pick multiple for long sessions</span>
                      <span className="text-[11px] text-[#ff5a1f] font-semibold">{selectedSlots.length} slot(s) selected</span>
                    </label>

                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                      {timeSlots.map(slot => {
                        const isSelected = selectedSlots.includes(slot.label);
                        return (
                          <button
                            key={slot.label}
                            type="button"
                            onClick={() => toggleSlot(slot.label)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-[#0f172a] text-white border-[#0f172a] shadow-sm"
                                : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                            }`}
                          >
                            <Clock className="w-3 h-3 text-orange-400" />
                            <span>{slot.label}</span>
                            {isSelected && <span className="text-[#ff5a1f] font-black">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Experience & Passes Package Builder */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#ff5a1f]" />
                    <span>4. Passes & Activities Inclusions</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#ff5a1f] text-xs font-bold transition-colors border border-orange-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-gray-200 bg-gray-50/70 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                    >
                      {/* Ticket Type */}
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          Pass / Experience
                        </label>
                        <select
                          value={item.ticketId}
                          onChange={e => handleUpdateLineItem(item.id, { ticketId: Number(e.target.value) })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-[#ff5a1f]"
                        >
                          {tickets.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name} (₹{t.price})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Time Slot */}
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          Assigned Slot
                        </label>
                        <select
                          value={item.timeSlot}
                          onChange={e => handleUpdateLineItem(item.id, { timeSlot: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-[#ff5a1f]"
                        >
                          {selectedSlots.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                          {timeSlots.filter(s => !selectedSlots.includes(s.label)).map(s => (
                            <option key={s.label} value={s.label}>{s.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                          Passes Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleUpdateLineItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-[#ff5a1f]"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="sm:col-span-2 space-y-1 flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                            Rate (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={e => handleUpdateLineItem(item.id, { unitPrice: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-[#ff5a1f]"
                          />
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(item.id)}
                            className="text-gray-400 hover:text-red-500 p-1.5 mt-4 transition-colors"
                            title="Remove line item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Custom Billing & Payment Terms */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#ff5a1f]" />
                  <span>5. Custom Billing & Payment Terms</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Pricing Mode */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Pricing Strategy</label>
                    <select
                      value={pricingMode}
                      onChange={e => setPricingMode(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 outline-none"
                    >
                      <option value="standard">Standard Catalog Pricing</option>
                      <option value="custom_package">Custom Negotiated Lump Sum (₹)</option>
                      <option value="per_head">Discounted Per-Head Rate (₹/guest)</option>
                    </select>
                  </div>

                  {/* Dynamic Rate Field depending on strategy */}
                  {pricingMode === "custom_package" && (
                    <div className="space-y-1.5 animate-in fade-in">
                      <label className="text-xs font-bold text-gray-700">Fixed Package Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={packageLumpSum}
                        onChange={e => setPackageLumpSum(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl px-4 py-2.5 text-sm font-black text-gray-900 outline-none"
                      />
                    </div>
                  )}

                  {pricingMode === "per_head" && (
                    <div className="space-y-1.5 animate-in fade-in">
                      <label className="text-xs font-bold text-gray-700">Rate Per Guest (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={perHeadRate}
                        onChange={e => setPerHeadRate(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl px-4 py-2.5 text-sm font-black text-gray-900 outline-none"
                      />
                    </div>
                  )}

                  {/* GST Options */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">GST / Tax Setting</label>
                    <select
                      value={taxOption}
                      onChange={e => setTaxOption(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 outline-none"
                    >
                      <option value="inclusive">GST 18% Included in Total</option>
                      <option value="add_gst">Add 18% GST on Top</option>
                      <option value="exempt">Tax Exempt / Flat Lump Sum</option>
                    </select>
                  </div>
                </div>

                {/* Live Invoice Summary Card */}
                <div className="bg-gradient-to-r from-slate-900 to-[#1e293b] text-white p-5 rounded-2xl shadow-md grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Subtotal</span>
                    <span className="text-lg font-mono font-bold text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">GST (18%)</span>
                    <span className="text-lg font-mono font-bold text-orange-400">₹{gstAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block">Grand Total</span>
                    <span className="text-xl font-mono font-black text-emerald-400">₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-400 block">Balance Due</span>
                    <span className="text-xl font-mono font-black text-amber-400">₹{balanceDue.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Payment Status & Deposit Collection */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Reservation Payment Status</label>
                    <select
                      value={paymentStatus}
                      onChange={e => setPaymentStatus(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 outline-none"
                    >
                      <option value="Unpaid">Unpaid (Quotation / Hold Slot)</option>
                      <option value="Partially paid">Advance Token Paid</option>
                      <option value="Paid">100% Paid in Full</option>
                    </select>
                  </div>

                  {paymentStatus === "Partially paid" && (
                    <div className="space-y-1.5 animate-in fade-in">
                      <label className="text-xs font-bold text-gray-700">Advance Deposit Amount (₹)</label>
                      <input
                        type="number"
                        min="1"
                        max={grandTotal}
                        value={depositAmount}
                        onChange={e => setDepositAmount(Math.min(grandTotal, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 outline-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={e => setPaymentMode(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 outline-none"
                    >
                      <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI / QR Code">UPI / QR Code</option>
                      <option value="Cash at Desk">Cash at Desk</option>
                      <option value="Cheque / Demand Draft">Cheque / Demand Draft</option>
                      <option value="Corporate PO / On Account">Corporate PO / On Account</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Transaction Ref / Cheque No / PO</label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      placeholder="e.g. UTR-982187312 / Cheque #004521"
                      className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none"
                    />
                  </div>
                </div>

                {/* Internal Staff Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">Staff Notes & Internal Instructions</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Arriving by 2 school buses at 10:45 AM. Teacher in charge: Suresh (9876543210). Need table setup in lounge."
                    className="w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-[#ff5a1f] rounded-xl p-3 text-xs text-gray-900 outline-none resize-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Confirmation & Printable Reservation Slip */}
          {currentStep === 2 && confirmedOrder && (
            <div className="space-y-6 animate-in zoom-in-95 duration-200">
              
              {/* Success Banner */}
              <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-teal-50 border border-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-emerald-950 font-heading">
                      Reservation Successfully Confirmed!
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Order reference: <strong className="font-mono font-bold text-emerald-950 text-sm px-2 py-0.5 rounded bg-white/80 border border-emerald-200">{confirmedOrder.orderCode}</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip / Quotation</span>
                </button>
              </div>

              {/* Printable Official Reservation Confirmation Sheet */}
              <div 
                ref={printRef}
                className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6 text-gray-900 print:border-none print:shadow-none print:p-4 print:text-black"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 pb-6">
                  <div>
                    <h1 className="text-2xl font-heading font-black tracking-tight text-gray-950">
                      HAVOC RC FUN ZONE &amp; MINIATURE WORLD
                    </h1>
                    <p className="text-xs text-gray-600 font-medium">
                      India&apos;s Premier RC Track &amp; Simulator Arena
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      No 21 First Floor, KH Double Road Opposite Shantinagar Bus Stand Bangalore 560027
                    </p>
                    <p className="text-xs text-gray-500">
                      Phone: +91 89513 36255 | Email: havocrcfunzone@gmail.com
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-300">
                      {confirmedOrder.orgType} RESERVATION
                    </span>
                    <p className="font-mono font-bold text-lg text-gray-900 mt-1">
                      {confirmedOrder.orderCode}
                    </p>
                    <p className="text-xs text-gray-500">
                      Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Event & Client Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-5 rounded-2xl border border-gray-100 text-xs">
                  <div>
                    <span className="text-gray-400 uppercase font-bold text-[10px] block">Organisation / Group</span>
                    <span className="font-bold text-gray-900 text-sm block mt-0.5">{confirmedOrder.orgName}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase font-bold text-[10px] block">Coordinator</span>
                    <span className="font-bold text-gray-900 block mt-0.5">{confirmedOrder.contactName}</span>
                    <span className="text-gray-500 block">{confirmedOrder.phone}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase font-bold text-[10px] block">Reserved Event Date</span>
                    <span className="font-bold text-gray-900 text-sm block mt-0.5">{confirmedOrder.eventDate}</span>
                    <span className="text-gray-500 block">{confirmedOrder.selectedSlots.join(", ")}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase font-bold text-[10px] block">Expected Headcount</span>
                    <span className="font-bold text-gray-900 text-sm block mt-0.5">{confirmedOrder.expectedGuests} Guests</span>
                  </div>
                </div>

                {/* Items Breakdown Table */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-3">
                    Reserved Experiences &amp; Passes
                  </h4>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                        <th className="py-2.5">Pass / Activity</th>
                        <th className="py-2.5">Time Slot</th>
                        <th className="py-2.5 text-center">Quantity</th>
                        <th className="py-2.5 text-right">Unit Rate</th>
                        <th className="py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {confirmedOrder.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2.5 font-bold text-gray-900">{item.ticketName}</td>
                          <td className="py-2.5 text-gray-600">{item.timeSlot}</td>
                          <td className="py-2.5 text-center font-bold">{item.quantity}</td>
                          <td className="py-2.5 text-right">₹{item.unitPrice}</td>
                          <td className="py-2.5 text-right font-bold">₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="border-t border-gray-200 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                  <div>
                    {confirmedOrder.specialRequests && confirmedOrder.specialRequests.length > 0 && (
                      <div className="space-y-1">
                        <span className="font-bold text-gray-700 block">Requested Arrangements:</span>
                        <p className="text-gray-600">{confirmedOrder.specialRequests.join(" • ")}</p>
                      </div>
                    )}
                    {confirmedOrder.notes && (
                      <p className="text-gray-500 mt-1 italic">Note: {confirmedOrder.notes}</p>
                    )}
                  </div>

                  <div className="w-full sm:w-64 space-y-1.5 text-right bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal:</span>
                      <span className="font-mono">₹{confirmedOrder.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    {confirmedOrder.gstAmount > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>GST (18%):</span>
                        <span className="font-mono">₹{confirmedOrder.gstAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-900 font-bold border-t border-gray-200 pt-1 text-sm">
                      <span>Grand Total:</span>
                      <span className="font-mono text-base">₹{confirmedOrder.grandTotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Advance Received:</span>
                      <span className="font-mono">₹{Number(confirmedOrder.depositAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-amber-700 font-black border-t border-amber-200 pt-1 text-sm">
                      <span>Balance Due at Desk:</span>
                      <span className="font-mono text-base">₹{confirmedOrder.balanceDue.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="text-[11px] text-gray-400 border-t border-gray-100 pt-4 flex justify-between items-center">
                  <span>Please present this slip at the reception desk upon arrival.</span>
                  <span>Authorized Signature: _______________________</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-between shrink-0">
          {currentStep === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitReservation}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#ff5a1f] to-orange-500 hover:from-orange-600 hover:to-orange-500 shadow-md shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Creating Reservation...</span>
                ) : (
                  <>
                    <span>Confirm &amp; Lock Reservation (₹{grandTotal.toLocaleString('en-IN')})</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Done / Close
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (confirmedOrder?.primaryId) {
                      router.push(`/admin/bookings/${confirmedOrder.primaryId}`);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white bg-[#0f172a] hover:bg-gray-800 shadow-md transition-all"
                >
                  <span>View Order Details</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

      </div>

    </div>
  );
}
