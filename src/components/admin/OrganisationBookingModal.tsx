"use client";

import { useState, useMemo, useRef } from "react";
import {
  Building2,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  ChevronRight,
  Sparkles,
  PartyPopper,
  GraduationCap,
  Briefcase,
  Flag,
  FileText,
  Lock,
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
    desc: "Family get-togethers, hobbyist clubs, weekend clubs",
    defaultSpecial: ["Reserved Seating Area", "Custom Session Timing", "Priority Queue"]
  },
  {
    type: "Other" as OrgCategoryType,
    label: "Custom / Other",
    badge: "bg-neutral-50 text-neutral-700 border-neutral-200",
    icon: Sparkles,
    desc: "Other special events, film shoots, brand activations",
    defaultSpecial: ["Special Event Assistance", "Staff Coordinator"]
  }
];

const PRESET_SPECIAL_REQUESTS = [
  "Cake Table & Party Setup",
  "Dedicated Track Marshal",
  "Music & Sound System",
  "Podium & Medal Ceremony",
  "F&B Dining Space Area",
  "Educational / Safety Briefing",
  "Custom Track Obstacles",
  "Grand Prix Lap Timing",
  "Photography / Videography Permit",
  "Extended Session Buffer"
];

export default function OrganisationBookingModal({
  isOpen,
  onClose,
  onSuccess,
  timeSlots = []
}: OrganisationBookingModalProps) {
  const router = useRouter();

  // Category
  const [selectedCategory, setSelectedCategory] = useState<OrgCategoryType>("School");

  // Organization info
  const [organizationName, setOrganizationName] = useState("");
  const [contactName, setContactName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneRaw, setPhoneRaw] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [expectedGuests, setExpectedGuests] = useState<number>(20);

  // Reservation Schedule
  const [eventDate, setEventDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [blockPublicSlots, setBlockPublicSlots] = useState(true);

  // Special requests & notes
  const [specialRequests, setSpecialRequests] = useState<string[]>([
    "Dedicated Track Marshal",
    "Educational Briefing"
  ]);
  const [customRequestInput, setCustomRequestInput] = useState("");
  const [organizationNotes, setOrganizationNotes] = useState("");

  // Submission & Confirmation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] = useState<{
    orderCode: string;
    orderNumber: number;
    primaryId: number;
  } | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Active time slots sorted
  const activeSlots = useMemo(() => {
    return (timeSlots || []).filter((s) => s.active !== 0);
  }, [timeSlots]);

  // When category changes, suggest default special requirements
  const handleCategorySelect = (cat: OrgCategoryType) => {
    setSelectedCategory(cat);
    const found = ORG_CATEGORIES.find((c) => c.type === cat);
    if (found && found.defaultSpecial) {
      setSpecialRequests(Array.from(new Set([...found.defaultSpecial])));
    }
  };

  const toggleSpecialRequest = (item: string) => {
    setSpecialRequests((prev) =>
      prev.includes(item) ? prev.filter((r) => r !== item) : [...prev, item]
    );
  };

  const addCustomRequest = () => {
    if (!customRequestInput.trim()) return;
    if (!specialRequests.includes(customRequestInput.trim())) {
      setSpecialRequests((prev) => [...prev, customRequestInput.trim()]);
    }
    setCustomRequestInput("");
  };

  const toggleTimeSlot = (slotLabel: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slotLabel)
        ? prev.filter((s) => s !== slotLabel)
        : [...prev, slotLabel]
    );
  };

  const handleSelectAllSlots = () => {
    if (selectedSlots.length === activeSlots.length) {
      setSelectedSlots([]);
    } else {
      setSelectedSlots(activeSlots.map((s) => s.label));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!organizationName.trim()) {
      setErrorMessage("Please enter an Organisation or Group Name.");
      return;
    }
    if (!contactName.trim()) {
      setErrorMessage("Please enter the Coordinator / Primary Contact name.");
      return;
    }
    if (!phoneRaw.trim()) {
      setErrorMessage("Please provide a contact phone number.");
      return;
    }
    if (!eventDate) {
      setErrorMessage("Please choose the reservation date.");
      return;
    }
    if (selectedSlots.length === 0) {
      setErrorMessage("Please select at least one time slot to reserve and block.");
      return;
    }

    const fullPhone = `${countryCode} ${phoneRaw.trim()}`;

    try {
      setIsSubmitting(true);
      const res = await createOrganisationBookingAction({
        organizationType: selectedCategory,
        organizationName: organizationName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: fullPhone,
        expectedGuests: Number(expectedGuests) || 0,
        eventDate,
        timeSlots: selectedSlots,
        blockPublicSlots,
        organizationNotes: organizationNotes.trim() || undefined,
        specialRequests
      });

      if (!res.success || !res.orderCode) {
        setErrorMessage(res.error || "Failed to confirm reservation.");
        setIsSubmitting(false);
        return;
      }

      setConfirmationData({
        orderCode: res.orderCode,
        orderNumber: res.orderNumber || 0,
        primaryId: res.primaryId || 0
      });
      setIsSubmitting(false);
      onSuccess();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || "An unexpected error occurred.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-neutral-100 flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-orange-600/30 text-orange-400 border border-orange-500/30">
              <Building2 className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Organisation Reservation
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40">
                  Pure Reservation
                </span>
              </div>
              <p className="text-xs text-neutral-300">
                Reserve & block arena time slots for schools, birthday parties & group events
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Reservation Error: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* STEP 2: CONFIRMATION & PRINT SLIP */}
          {confirmationData ? (
            <div className="space-y-6 py-2">
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Reservation Confirmed & Slots Locked!</h3>
                    <p className="text-xs text-emerald-700">
                      Reserved slots are blocked for public checkout on havocrcfunzone.com
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Reservation Code</div>
                  <div className="text-lg font-extrabold text-neutral-900 font-mono tracking-tight">
                    {confirmationData.orderCode}
                  </div>
                </div>
              </div>

              {/* Printable Reservation Summary Card */}
              <div
                ref={printAreaRef}
                className="p-6 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50/70 space-y-6 print:p-8 print:m-0 print:border-black print:bg-white"
              >
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                      HAVOC RC FUN ZONE
                    </h2>
                    <p className="text-xs text-neutral-500 font-medium">
                      Official Organisation Reservation Slip
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                      {selectedCategory} Reservation
                    </span>
                    <div className="text-xs text-neutral-400 mt-1">
                      Date Created: {new Date().toLocaleDateString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">Organisation / Group</div>
                    <div className="text-sm font-bold text-neutral-800 mt-0.5">{organizationName}</div>
                  </div>
                  <div>
                    <div className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">Coordinator / Contact</div>
                    <div className="text-sm font-semibold text-neutral-800 mt-0.5">{contactName}</div>
                    <div className="text-neutral-500 text-[11px]">{countryCode} {phoneRaw}</div>
                    {contactEmail && <div className="text-neutral-400 text-[11px]">{contactEmail}</div>}
                  </div>
                  <div>
                    <div className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">Expected Headcount</div>
                    <div className="text-sm font-bold text-neutral-800 mt-0.5">{expectedGuests} Guests / Participants</div>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Event Date & Reserved Slots
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-3 py-1 rounded-lg bg-neutral-900 text-white font-bold text-xs flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-orange-400" />
                      {new Date(eventDate).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </span>
                    {blockPublicSlots && (
                      <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3 text-rose-600" />
                        Slots Blocked for Public
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedSlots.map((slot) => (
                      <span
                        key={slot}
                        className="px-3 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 font-bold text-xs flex items-center gap-1"
                      >
                        <Clock className="w-3.5 h-3.5 text-orange-600" />
                        {slot}
                      </span>
                    ))}
                  </div>
                </div>

                {specialRequests.length > 0 && (
                  <div>
                    <div className="text-neutral-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">
                      Special Requirements & Inclusions
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {specialRequests.map((req, i) => (
                        <span key={i} className="px-2.5 py-0.5 rounded-md bg-neutral-200/70 text-neutral-800 text-[11px] font-medium">
                          ✓ {req}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {organizationNotes && (
                  <div>
                    <div className="text-neutral-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                      Internal / Staff Notes
                    </div>
                    <p className="text-xs text-neutral-700 bg-white p-3 rounded-lg border border-neutral-200">
                      {organizationNotes}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-neutral-200 text-[11px] text-neutral-500 flex justify-between items-center">
                  <span>Status: <strong className="text-emerald-700">Reserved / Slot Blocked</strong></span>
                  <span>Order Reference: #{confirmationData.orderNumber}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-semibold text-xs flex items-center gap-2 transition"
                >
                  <Printer className="w-4 h-4" />
                  Print Reservation Slip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/admin/bookings/${confirmationData.primaryId}`);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                >
                  View in Admin Order Details
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* STEP 1: FORM INPUT */
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* 1. Category Selection */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    1. Reservation Category
                  </label>
                  <span className="text-[11px] text-neutral-500">
                    Preconfigures party & group coordination
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ORG_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategory === cat.type;
                    return (
                      <button
                        key={cat.type}
                        type="button"
                        onClick={() => handleCategorySelect(cat.type)}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? "border-orange-500 bg-orange-50/50 shadow-sm ring-2 ring-orange-500/20"
                            : "border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`p-1.5 rounded-lg ${isSelected ? "bg-orange-600 text-white" : "bg-neutral-100 text-neutral-600"}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-neutral-800">
                            {cat.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 line-clamp-1">
                          {cat.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2. Organisation & Coordinator Details */}
              <section className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-neutral-700">
                  <Building2 className="w-4 h-4 text-orange-600" />
                  <span>2. Organisation & Coordinator Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Organisation / School / Host Name *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="e.g. Greenwood High / Aryan's Birthday"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Primary Contact / Coordinator *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="e.g. Priya Sharma / Mr. Rajesh"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Contact Phone *
                    </label>
                    <div className="flex">
                      <div className="relative">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="appearance-none bg-neutral-100 border border-r-0 border-neutral-300 rounded-l-lg py-2 pl-2.5 pr-6 text-xs text-neutral-700 font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={`${c.dialCode}-${c.code}`} value={c.dialCode}>
                              {c.dialCode} ({c.name})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-neutral-400 absolute right-1.5 top-3 pointer-events-none" />
                      </div>
                      <div className="relative flex-1">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          required
                          value={phoneRaw}
                          onChange={(e) => setPhoneRaw(e.target.value)}
                          placeholder="98765 43210"
                          className="w-full pl-8 pr-3 py-2 rounded-r-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Contact Email (Optional)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="coordinator@school.org"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Expected Headcount / Group Size
                    </label>
                    <div className="relative">
                      <Users className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={expectedGuests}
                        onChange={(e) => setExpectedGuests(parseInt(e.target.value) || 0)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Special Requirements selection */}
                <div className="pt-2 border-t border-neutral-200">
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1.5">
                    Special Setups & Preferences
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_SPECIAL_REQUESTS.map((req) => {
                      const isChecked = specialRequests.includes(req);
                      return (
                        <button
                          key={req}
                          type="button"
                          onClick={() => toggleSpecialRequest(req)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                            isChecked
                              ? "bg-neutral-900 text-white border-neutral-900 shadow-sm"
                              : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                          }`}
                        >
                          {isChecked ? "✓ " : "+ "}
                          {req}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add custom request chip */}
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={customRequestInput}
                      onChange={(e) => setCustomRequestInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomRequest();
                        }
                      }}
                      placeholder="+ Add custom requirement chip..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <button
                      type="button"
                      onClick={addCustomRequest}
                      className="px-3 py-1.5 rounded-lg bg-neutral-200 text-neutral-700 text-xs font-semibold hover:bg-neutral-300"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </section>

              {/* 3. Event Date & Slot Timing */}
              <section className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-neutral-700">
                    <Calendar className="w-4 h-4 text-orange-600" />
                    <span>3. Event Date & Slot Timing</span>
                  </div>
                  <div className="text-[11px] font-semibold text-orange-700">
                    {selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""} selected
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                      Event Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[11px] font-semibold text-neutral-600">
                        Select Slots to Reserve & Lock *
                      </label>
                      <button
                        type="button"
                        onClick={handleSelectAllSlots}
                        className="text-[11px] text-orange-600 hover:text-orange-700 font-semibold underline"
                      >
                        {selectedSlots.length === activeSlots.length ? "Deselect All" : "Select All Slots"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {activeSlots.map((slot) => {
                        const isSelected = selectedSlots.includes(slot.label);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => toggleTimeSlot(slot.label)}
                            className={`p-2.5 rounded-lg text-xs font-bold border transition text-center flex items-center justify-center gap-1.5 ${
                              isSelected
                                ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                                : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300"
                            }`}
                          >
                            <Clock className={`w-3 h-3 ${isSelected ? "text-orange-200" : "text-neutral-400"}`} />
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Slot Blocking & Online Reservation Guard */}
                <div className="pt-3 border-t border-neutral-200 flex items-center justify-between bg-white p-3 rounded-lg border">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-md bg-rose-50 text-rose-600">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-800">
                        Block Selected Slots from Public Online Booking
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        Instantly prevents public customers on havocrcfunzone.com from booking these slots for this date.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={blockPublicSlots}
                      onChange={(e) => setBlockPublicSlots(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>
              </section>

              {/* 4. Staff / Internal Notes */}
              <section className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-orange-600" />
                  4. Staff / Coordinator Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={organizationNotes}
                  onChange={(e) => setOrganizationNotes(e.target.value)}
                  placeholder="e.g. Bringing their own birthday cake at 3 PM, need 4 tables arranged in the party area, requested 1 dedicated track marshal."
                  className="w-full p-3 rounded-xl border border-neutral-200 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </section>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-semibold text-xs transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Reserving & Blocking Slots...
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Confirm & Block Slots ({selectedSlots.length} Slots)
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
