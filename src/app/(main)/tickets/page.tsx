"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface MonthData {
  month: string;
  year: number;
  idx: number;
}

export default function TicketsPage() {
  const [months, setMonths] = useState<MonthData[]>([]);

  useEffect(() => {
    // 1. Get current date details
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    const currentMonth = currentDate.getMonth(); // 0-11
    const currentYear = currentDate.getFullYear();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    // 2. Always display current month
    const calculatedMonths: MonthData[] = [
      {
        month: monthNames[currentMonth],
        year: currentYear,
        idx: currentMonth,
      }
    ];

    // 3. If day >= 15, unlock the next month
    if (currentDay >= 15) {
      // 4. Handle year rollover safely
      const nextMonthIdx = (currentMonth + 1) % 12;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      calculatedMonths.push({
        month: monthNames[nextMonthIdx],
        year: nextYear,
        idx: nextMonthIdx,
      });
    }
    
    setMonths(calculatedMonths);
  }, []);

  return (
    <div 
      className="py-24 flex-grow relative overflow-hidden bg-cover bg-center bg-fixed min-h-[80vh]"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      {/* Light overlay for readability while keeping the image bright */}
      <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]"></div>
      
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#ff5a1f]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-white/40 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 flex flex-col items-center">
        <div className="text-xs font-bold tracking-widest text-[#ff5a1f] mb-4 uppercase drop-shadow-sm bg-white/80 px-4 py-1.5 rounded-full border border-white/40 backdrop-blur-md">START YOUR JOURNEY</div>
        <h1 className="text-4xl md:text-6xl font-black text-[#0d1b2a] mb-16 tracking-tight font-heading text-center drop-shadow-sm">
          CHOOSE YOUR MONTH
        </h1>

        <div id="dynamicMonthSelector" className="flex flex-wrap gap-8 justify-center items-center w-full max-w-5xl">
          {months.map((m) => (
            <div key={`${m.month}-${m.year}`} className="relative group w-[340px] h-[400px]" data-month={m.month.toLowerCase()} data-year={m.year} data-idx={m.idx}>
              {/* Animated glow shadow behind card */}
              <div className="absolute inset-0 bg-[#ff5a1f]/10 rounded-3xl blur-2xl opacity-0 group-hover:opacity-40 transition-all duration-700 ease-in-out group-hover:scale-105"></div>
              
              <div className="absolute inset-0 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/50 flex flex-col items-center justify-center transition-all duration-500 group-hover:-translate-y-3 shadow-[0_8px_32px_rgba(0,0,0,0.1)] group-hover:shadow-[0_16px_40px_rgba(0,0,0,0.15)] group-hover:bg-white/80 overflow-hidden z-10">
                
                {/* Animated top accent bar */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#ff5a1f] to-[#ff8c42] transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-out z-20"></div>

                <div className="relative z-20 flex flex-col items-center w-full px-8">
                  {/* Calendar Icon */}
                  <div className="w-16 h-16 rounded-full bg-[#ff5a1f]/10 border border-[#ff5a1f]/20 flex items-center justify-center text-[#ff5a1f] mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
                  </div>

                  <h2 className="text-4xl font-black text-[#0d1b2a] tracking-widest mb-1 font-heading text-center uppercase drop-shadow-sm group-hover:text-[#ff5a1f] transition-colors duration-300">
                    {m.month}
                  </h2>
                  
                  <p className="text-6xl font-black text-gray-400 mb-10 font-heading drop-shadow-sm transition-colors duration-300 group-hover:text-gray-500">
                    {m.year}
                  </p>
                  
                  <Link 
                    href={`/tickets/${m.month.toLowerCase()}-${m.year}`}
                    className="group/btn w-full py-4 bg-[#ff5a1f] text-white font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-3 text-sm tracking-widest overflow-hidden relative shadow-lg hover:shadow-[#ff5a1f]/40 hover:bg-[#e04812]"
                  >
                    <span className="relative z-10 group-hover/btn:scale-105 transition-transform duration-300">EXPLORE</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 group-hover/btn:translate-x-1 transition-transform duration-300"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </Link>
                </div>
              </div>
            </div>
          ))}
          
          {/* Loading Skeletons for Server-Side Rendering match */}
          {months.length === 0 && (
             <div className="relative w-[340px] h-[400px] animate-pulse rounded-3xl bg-white/40 border border-white/20"></div>
          )}
        </div>
        
        {/* Important Guidelines Section */}
        <div className="mt-20 w-full max-w-5xl bg-white/60 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 z-10 relative">
          <h2 className="text-2xl font-black font-heading text-[#0d1b2a] mb-8 flex items-center gap-3">
            <span className="text-[#ff5a1f]">⚠️</span> Important Guidelines:
          </h2>
          
          <ul className="space-y-6 text-gray-800 text-sm md:text-base font-bold leading-relaxed">
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">1.</span>
              <div>
                Children under 14 years must be accompanied by a parent or guardian holding a valid Visitor, Participant, VIP Visitor, or VIP Participant ticket. Parents/guardians are solely responsible for the safety and supervision of their children and must not leave them unattended at any time during the entire allotted time. <span className="text-red-600 ml-1">❌ Children under 3 years of age are not allowed inside the Funzone.</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">2.</span>
              <div>
                <span className="text-red-600 mr-1">❌</span> Food, eatables, and drinks are not allowed inside the Fun Zone area during the activity time.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">3.</span>
              <div>
                <span className="underline decoration-2 underline-offset-4 text-[#0d1b2a]">Visitor Ticket:</span> Allows 1 hour entry only as a companion. Visitors are not permitted to play any activities.<br/>
                <span className="text-[#ff5a1f]">₹300 + GST per hour per person</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">4.</span>
              <div>
                <span className="underline decoration-2 underline-offset-4 text-[#0d1b2a]">Participant Ticket:</span> Grants 1 hour full access to all 16 RC Activities.<br/>
                <span className="text-[#ff5a1f]">₹1000 + GST per hour per person</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">5.</span>
              <div>
                <span className="underline decoration-2 underline-offset-4 text-[#0d1b2a]">VIP Visitor Ticket:</span> Grants 1 hour access to selected experiences – RC Flight Simulator, Car Race Sim Beginner, HO & N Scale Model Railway Activities.<br/>
                <span className="text-[#ff5a1f]">₹500 + GST per hour per person</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">6.</span>
              <div>
                <span className="underline decoration-2 underline-offset-4 text-[#0d1b2a]">VIP Participant Ticket:</span> Grants 1 hour full access to all 16 RC Activities, with upgraded hobby-grade RC cars on Drift, Off-Road, Mini-Z tracks & FPV RC cars + 30 minutes additional activity for any 1 simulator in the Havoc Sim Podium. Subject to availability, waiting period may apply.<br/>
                <span className="text-[#ff5a1f]">₹1500 + GST per hour per person</span>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">7.</span>
              <div>
                <span className="text-red-600 mr-1">🚫</span> Entry will not be allowed to any person without a valid booking/ticket.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">8.</span>
              <div>
                <span className="mr-1 text-xl">⏰</span> Please arrive at least 20 minutes before your slot start time.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">9.</span>
              <div>
                <span className="text-red-600 mr-1">❌</span> Late arrivals will not receive additional play/visit time.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">10.</span>
              <div>
                <span className="text-red-600 mr-1">❌</span> No refunds, cancellations, or rescheduling once tickets are booked. Tickets are non-transferable and cannot be shared with other candidates during the allotted time.
              </div>
            </li>
            <li className="flex gap-4">
              <span className="min-w-[24px] text-[#ff5a1f]">11.</span>
              <div>
                <span className="text-[#ff5a1f] mr-1 text-lg">❗</span> Please note that limited parking is available below the Fun Zone premises. Participants and visitors are requested to plan their visit accordingly. BMTC Shantinagar Public Parking is also available approximately a 5-minute walk from the Fun Zone.
              </div>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
