import React from "react";

export default function TicketTypePage() {
  return (
    <div className="min-h-screen bg-white text-black py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        
        {/* Table Container Card with rounded corners and solid black border */}
        <div className="border-[2.5px] border-black rounded-[24px] sm:rounded-[32px] overflow-hidden bg-white shadow-xl">
          
          {/* Header Banner matching the reference poster */}
          <div className="px-6 sm:px-14 py-8 border-b-[2.5px] border-black flex flex-row items-center justify-center gap-6 sm:gap-12">
            
            {/* Red Ticket Icon Graphic with scalloped side cutouts, white dashed divider, & checkmark */}
            <div className="relative shrink-0 flex items-center justify-center">
              <svg 
                className="w-24 sm:w-36 h-16 sm:h-24 drop-shadow-sm" 
                viewBox="0 0 160 100" 
                fill="#d00000"
              >
                <path d="
                  M 12 0 
                  H 148 
                  A 12 12 0 0 1 160 12 
                  V 36 
                  A 14 14 0 0 0 160 64 
                  V 88 
                  A 12 12 0 0 1 148 100 
                  H 12 
                  A 12 12 0 0 1 0 88 
                  V 64 
                  A 14 14 0 0 0 0 36 
                  V 12 
                  A 12 12 0 0 1 12 0 
                  Z
                " />
                {/* Perforated separator bar */}
                <line x1="112" y1="18" x2="112" y2="82" stroke="#ffffff" strokeWidth="6" strokeDasharray="30 10" strokeLinecap="round" />
                {/* Ticket verified checkmark */}
                <path d="M 44 48 L 58 64 L 88 32" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* Title Text */}
            <div className="leading-tight text-left">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black font-sans tracking-tight text-black">
                Ticket Categories:
              </h1>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black font-sans tracking-tight text-black">
                Havoc Rc Funzone
              </h2>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black font-sans tracking-tight text-black">
                &amp; Miniature World
              </h2>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left min-w-[700px]">
              <thead>
                <tr className="border-b-[2.5px] border-black text-black">
                  <th className="w-[25%] py-5 px-6 text-center text-xl sm:text-2xl font-black font-sans border-r-[2.5px] border-black">
                    Ticket Type
                  </th>
                  <th className="w-[23%] py-5 px-6 text-center text-xl sm:text-2xl font-black font-sans border-r-[2.5px] border-black">
                    Price
                    <span className="block text-xs sm:text-sm font-semibold text-black mt-0.5">
                      (per hour, per person)
                    </span>
                  </th>
                  <th className="w-[52%] py-5 px-8 text-center text-xl sm:text-2xl font-black font-sans">
                    Access &amp; Benefits
                  </th>
                </tr>
              </thead>
              <tbody className="text-black font-sans">
                
                {/* Row 1: Visitor */}
                <tr className="border-b-[2.5px] border-black">
                  <td className="py-8 px-6 text-center align-middle font-black text-2xl sm:text-3xl border-r-[2.5px] border-black">
                    Visitor
                  </td>
                  <td className="py-8 px-6 text-center align-middle font-black text-2xl sm:text-3xl border-r-[2.5px] border-black whitespace-nowrap">
                    ₹300+GST
                  </td>
                  <td className="py-8 px-8 align-middle">
                    <div className="flex items-start gap-4">
                      {/* Red circle-slash (prohibited) icon */}
                      <div className="shrink-0 pt-0.5">
                        <svg className="w-9 h-9 text-[#d00000]" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="3.2">
                          <circle cx="18" cy="18" r="15" />
                          <line x1="7" y1="7" x2="29" y2="29" />
                        </svg>
                      </div>
                      <ul className="space-y-1 text-base sm:text-lg font-bold text-black leading-relaxed">
                        <li className="flex items-center gap-2">
                          <span className="text-xl leading-none">•</span>
                          <span>Entry only as a companion.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-xl leading-none">•</span>
                          <span>No play access to activities</span>
                        </li>
                      </ul>
                    </div>
                  </td>
                </tr>

                {/* Row 2: Participant */}
                <tr className="border-b-[2.5px] border-black">
                  <td className="py-8 px-6 text-center align-middle font-black text-2xl sm:text-3xl border-r-[2.5px] border-black">
                    Participant
                  </td>
                  <td className="py-8 px-6 text-center align-middle font-black text-2xl sm:text-3xl border-r-[2.5px] border-black whitespace-nowrap">
                    ₹1000+GST
                  </td>
                  <td className="py-8 px-8 align-middle">
                    <div className="flex items-center gap-4">
                      {/* Solid blue circle with white checkmark matching reference */}
                      <div className="shrink-0 w-8 h-8 rounded-full bg-[#0040c0] flex items-center justify-center text-white">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-black">
                        • Full access to all 16 RC Activities
                      </p>
                    </div>
                  </td>
                </tr>

                {/* Row 3: VIP Visitor */}
                <tr className="border-b-[2.5px] border-black">
                  <td className="py-8 px-6 text-center align-middle font-black text-2xl sm:text-3xl border-r-[2.5px] border-black">
                    VIP Visitor
                  </td>
                  <td className="py-8 px-6 text-center align-middle font-black text-2xl sm:text-3xl border-r-[2.5px] border-black whitespace-nowrap">
                    ₹500+GST
                  </td>
                  <td className="py-6 px-8 align-middle">
                    <p className="text-base sm:text-lg font-bold text-black mb-3">
                      As Selected premium experiences:
                    </p>
                    <ul className="space-y-2 text-base sm:text-lg font-bold text-black ml-1">
                      <li className="flex items-center gap-3">
                        <span className="text-[#0040c0] text-xl">✈</span>
                        <span>• RC Flight Simulator</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="text-black text-xl">🚆</span>
                        <span>• HO &amp; N Scale Model Railway Activities</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="text-[#d00000] text-xl">🚗</span>
                        <span>• Car Race Sim Beginner</span>
                      </li>
                    </ul>
                  </td>
                </tr>

                {/* Row 4: VIP Participant */}
                <tr>
                  <td className="py-8 px-6 text-center align-middle font-black text-2xl sm:text-3xl border-r-[2.5px] border-black">
                    VIP<br />Participant
                  </td>
                  <td className="py-8 px-6 text-center align-middle font-black text-2xl sm:text-3xl border-r-[2.5px] border-black whitespace-nowrap">
                    ₹1500+GST
                  </td>
                  <td className="py-8 px-8 align-middle">
                    <div className="space-y-4">
                      {/* Benefit Item 1 */}
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-[#0040c0] flex items-center justify-center text-white mt-0.5">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <ul className="text-base sm:text-lg font-bold text-black">
                          <li>• Full access to all 16 RC Activities</li>
                          <li className="mt-1.5">• Upgraded Hobby Grade RC Cars for Drift, Off-Road, Mini-Z tracks &amp; FPV RC cars.</li>
                        </ul>
                      </div>

                      {/* Benefit Item 2 with RC vehicle thumbnail */}
                      <div className="flex items-start gap-4 pt-1">
                        <div className="shrink-0 w-12 h-10 flex items-center justify-center">
                          <img 
                            src="/rc_car.png" 
                            alt="RC Car" 
                            className="w-full h-full object-contain filter grayscale contrast-125" 
                          />
                        </div>
                        <p className="text-sm sm:text-base font-bold text-black leading-snug">
                          • + 30 minutes additional activity for any 1 simulator in the Havoc Sim Podium. Subject to availability, waiting period may apply.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>

              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}
