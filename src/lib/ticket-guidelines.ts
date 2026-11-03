export interface TicketGuidelineItem {
  id: string;
  title?: string;
  text: string;
  highlight?: string;
}

export interface TicketGuidelinesConfig {
  sectionTitle: string;
  items: TicketGuidelineItem[];
}

export const DEFAULT_TICKET_GUIDELINES: TicketGuidelinesConfig = {
  sectionTitle: "⚠️ Important Guidelines:",
  items: [
    {
      id: "g-1",
      title: "",
      text: "Children under 14 years must be accompanied by a parent or guardian holding a valid Visitor, Participant, VIP Visitor, or VIP Participant ticket. Parents/guardians are solely responsible for the safety and supervision of their children and must not leave them unattended at any time during the entire allotted time. ❌ Children under 3 years of age are not allowed inside the Funzone.",
      highlight: ""
    },
    {
      id: "g-2",
      title: "",
      text: "❌ Food, eatables, and drinks are not allowed inside the Fun Zone area during the activity time.",
      highlight: ""
    },
    {
      id: "g-3",
      title: "Visitor Ticket:",
      text: "Allows 1 hour entry only as a companion. Visitors are not permitted to play any activities.",
      highlight: "₹300 + GST per hour per person"
    },
    {
      id: "g-4",
      title: "Participant Ticket:",
      text: "Grants 1 hour full access to 15 RC Activities (Excavator Activity is not included in the package. It can be purchased separately as an add-on.).",
      highlight: "₹1000 + GST per hour per person"
    },
    {
      id: "g-5",
      title: "VIP Visitor Ticket:",
      text: "Grants 1 hour access to selected experiences – RC Flight Simulator, Car Race Sim Beginner, HO & N Scale Model Railway Activities.",
      highlight: "₹500 + GST per hour per person"
    },
    {
      id: "g-6",
      title: "VIP Participant Ticket:",
      text: "Grants 2 hours full access to 15 RC Activities (Excavator Activity is not included in the package. It can be purchased separately as an add-on.), with upgraded hobby-grade RC cars on Drift, Off-Road, Mini-Z tracks & FPV RC cars + 60 minutes additional activity for any 1 simulator in the Havoc Sim Podium. Subject to availability, waiting period may apply.",
      highlight: "₹2000 + GST for 2 hour for one person"
    },
    {
      id: "g-7",
      title: "",
      text: "🚫 Entry will not be allowed to any person without a valid booking/ticket.",
      highlight: ""
    },
    {
      id: "g-8",
      title: "",
      text: "⏰ Please arrive at least 20 minutes before your slot start time.",
      highlight: ""
    },
    {
      id: "g-9",
      title: "",
      text: "❌ Late arrivals will not receive additional play/visit time.",
      highlight: ""
    },
    {
      id: "g-10",
      title: "",
      text: "❌ No refunds, cancellations, or rescheduling once tickets are booked. Tickets are non-transferable and cannot be shared with other candidates during the allotted time.",
      highlight: ""
    },
    {
      id: "g-11",
      title: "",
      text: "❗ Please note that limited parking is available below the Fun Zone premises. Participants and visitors are requested to plan their visit accordingly. BMTC Shantinagar Public Parking is also available approximately a 5-minute walk from the Fun Zone.",
      highlight: ""
    }
  ]
};

