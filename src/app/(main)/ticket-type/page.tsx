import React from "react";
import { fetchTicketsAction } from "@/app/actions/tickets";
import { getSiteSetting } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TicketTypePage() {
  const allTickets = await fetchTicketsAction();
  const activeTickets = allTickets.filter(t => t.active === 1);
  const exclusionNotice = getSiteSetting(
    "addon_exclusion_notice", 
    "*Excavator Activity is not included in the package. It can be purchased separately as an add-on."
  );
  const mandatoryPassNotice = getSiteSetting(
    "addon_mandatory_pass_notice",
    "*Note: This is an add-on package and requires a valid entry ticket. Any ticket type (Visitor, Participant, VIP Visitor, or VIP Participant) is valid."
  );

  return (
    <div className="min-h-screen bg-white text-black py-6 sm:py-16">
      <div className="max-w-5xl mx-auto px-2 sm:px-6">
        
        {/* Table Container Card with rounded corners and solid black border */}
        <div className="border-[2px] sm:border-[2.5px] border-black rounded-[18px] sm:rounded-[32px] overflow-hidden bg-white shadow-xl">
          
          {/* Header Banner matching the reference poster */}
          <div className="px-3 sm:px-14 py-4 sm:py-8 border-b-[2px] sm:border-b-[2.5px] border-black flex flex-row items-center justify-center gap-3 sm:gap-12">
            
            {/* Red Ticket Icon Graphic with scalloped side cutouts, white dashed divider, & checkmark */}
            <div className="relative shrink-0 flex items-center justify-center">
              <svg 
                className="w-14 sm:w-36 h-10 sm:h-24 drop-shadow-sm" 
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
              <h1 className="text-base sm:text-4xl md:text-5xl font-black font-sans tracking-tight text-black">
                Ticket Categories:
              </h1>
              <h2 className="text-base sm:text-4xl md:text-5xl font-black font-sans tracking-tight text-black">
                Havoc Rc Funzone
              </h2>
              <h2 className="text-base sm:text-4xl md:text-5xl font-black font-sans tracking-tight text-black">
                &amp; Miniature World
              </h2>
            </div>
          </div>

          {/* Comparison Table - full width without overflow on mobile */}
          <div className="w-full">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b-[2px] sm:border-b-[2.5px] border-black text-black bg-gray-50/50">
                  <th className="w-[28%] sm:w-[25%] py-2.5 sm:py-5 px-1.5 sm:px-6 text-center text-xs sm:text-2xl font-black font-sans border-r-[2px] sm:border-r-[2.5px] border-black">
                    Ticket Type
                  </th>
                  <th className="w-[26%] sm:w-[23%] py-2.5 sm:py-5 px-1 sm:px-6 text-center text-xs sm:text-2xl font-black font-sans border-r-[2px] sm:border-r-[2.5px] border-black">
                    Price
                  </th>
                  <th className="w-[46%] sm:w-[52%] py-2.5 sm:py-5 px-2 sm:px-8 text-center text-xs sm:text-2xl font-black font-sans">
                    Access &amp; Benefits
                  </th>
                </tr>
              </thead>
              <tbody className="text-black font-sans">
                {activeTickets.map((ticket, index) => {
                  const isLast = index === activeTickets.length - 1;
                  const borderClass = isLast ? "" : "border-b-[2px] sm:border-b-[2.5px] border-black";
                  const cleanName = ticket.name.replace(/_/g, " ");
                  const hasPerk = ticket.has_simulator_perk === 1;
                  const isExcavatorOrAddon = Boolean(ticket.is_addon || ticket.name.toUpperCase().includes("EXCAVATOR") || ticket.name.toUpperCase().includes("DUMP"));
                  const isVipParticipant = ticket.name.toUpperCase().replace(/\s+/g, "_").includes("VIP_PARTICIPANT");

                  // Render specific customized benefits (filtering out any generic arena session from excavator add-on)
                  const customBenefits = ticket.benefits
                    ?.split("\n")
                    .map(s => s.trim())
                    .filter(Boolean)
                    .filter(b => {
                      if (isExcavatorOrAddon) {
                        const lower = b.toLowerCase();
                        if (lower.includes("arena session") || lower.includes("1-hour") || lower.includes("1 hour")) {
                          return false;
                        }
                      }
                      return true;
                    });

                  return (
                    <tr key={ticket.id} className={borderClass}>
                      <td className="py-3 sm:py-8 px-1.5 sm:px-6 text-center align-middle font-black text-xs sm:text-3xl border-r-[2px] sm:border-r-[2.5px] border-black capitalize break-words">
                        {cleanName}
                      </td>
                      <td className="py-3 sm:py-8 px-1 sm:px-6 text-center align-middle border-r-[2px] sm:border-r-[2.5px] border-black">
                        <div className="font-black text-xs sm:text-3xl text-black leading-tight">
                          ₹{ticket.price}+GST
                        </div>
                        <div className="text-[9px] sm:text-sm font-semibold text-gray-700 mt-0.5 sm:mt-1 leading-tight">
                          {isExcavatorOrAddon 
                            ? "for 1 person (Add-on)" 
                            : isVipParticipant 
                              ? "for 2 hrs / 1 person" 
                              : "for 1 hr / 1 person"}
                        </div>
                      </td>
                      <td className="py-3 sm:py-8 px-2 sm:px-8 align-middle">
                        {customBenefits && customBenefits.length > 0 ? (
                          <div className="space-y-1.5 sm:space-y-3">
                            {ticket.description && (
                              <p className="text-[10px] sm:text-lg font-bold text-black mb-1 sm:mb-2 leading-tight">
                                {ticket.description}
                              </p>
                            )}
                            <ul className="space-y-1 sm:space-y-2 text-[10px] sm:text-lg font-bold text-black">
                              {(() => {
                                const isParticipantType = ticket.name.toUpperCase().includes("PARTICIPANT");
                                const rcAccessIndex = isParticipantType
                                  ? customBenefits.findIndex(b => {
                                      const lower = b.toLowerCase();
                                      return lower.includes("15 rc") || lower.includes("rc activit") || lower.includes("full access");
                                    })
                                  : -1;
                                const targetNoticeIndex = rcAccessIndex !== -1 ? rcAccessIndex : (isParticipantType ? 0 : -1);

                                return customBenefits.map((b, bIdx) => {
                                  const showExclusion = bIdx === targetNoticeIndex && Boolean(exclusionNotice);

                                  return (
                                    <li key={bIdx} className="space-y-0.5">
                                      <div className="flex items-start gap-1 sm:gap-3">
                                        <div className="shrink-0 w-3.5 sm:w-6 h-3.5 sm:h-6 rounded-full bg-[#0040c0] flex items-center justify-center text-white mt-0.5">
                                          <svg className="w-2 sm:w-3.5 h-2 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        </div>
                                        <div className="flex-1 leading-tight">
                                          <span>{b}</span>
                                          {showExclusion && (
                                            <p className="text-[9px] sm:text-sm font-semibold text-[#d00000] mt-0.5 sm:mt-1 leading-tight">
                                              {exclusionNotice}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </li>
                                  );
                                });
                              })()}
                            </ul>

                            {/* Note for Add-on package: Arena entry ticket is mandatory */}
                            {Boolean(ticket.is_addon || ticket.name.toUpperCase().includes("EXCAVATOR")) && mandatoryPassNotice && (
                              <p className="text-[9px] sm:text-sm font-semibold text-[#d00000] mt-1 leading-tight">
                                {mandatoryPassNotice}
                              </p>
                            )}
                          </div>
                        ) : ticket.name.toUpperCase() === "VISITOR" ? (
                          <div className="flex items-start gap-1.5 sm:gap-4">
                            <div className="shrink-0 pt-0.5">
                              <svg className="w-4 sm:w-9 h-4 sm:h-9 text-[#d00000]" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="3.2">
                                <circle cx="18" cy="18" r="15" />
                                <line x1="7" y1="7" x2="29" y2="29" />
                              </svg>
                            </div>
                            <ul className="space-y-0.5 sm:space-y-1 text-[10px] sm:text-lg font-bold text-black leading-tight sm:leading-relaxed">
                              <li className="flex items-center gap-1 sm:gap-2">
                                <span className="text-xs sm:text-xl leading-none">•</span>
                                <span>Entry only as companion.</span>
                              </li>
                              <li className="flex items-center gap-1 sm:gap-2">
                                <span className="text-xs sm:text-xl leading-none">•</span>
                                <span>No play access</span>
                              </li>
                            </ul>
                          </div>
                        ) : ticket.name.toUpperCase() === "PARTICIPANT" ? (
                          <div className="flex items-start gap-1.5 sm:gap-4">
                            <div className="shrink-0 w-3.5 sm:w-8 h-3.5 sm:h-8 rounded-full bg-[#0040c0] flex items-center justify-center text-white mt-0.5">
                              <svg className="w-2 sm:w-5 h-2 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                            <div className="leading-tight">
                              <p className="text-[10px] sm:text-lg font-bold text-black">
                                • Full access to 15 RC Activities
                              </p>
                              {exclusionNotice && (
                                <p className="text-[9px] sm:text-sm font-semibold text-[#d00000] mt-0.5 leading-tight">
                                  {exclusionNotice}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : ticket.name.toUpperCase() === "VIP_VISITOR" ? (
                          <div>
                            <p className="text-[10px] sm:text-lg font-bold text-black mb-1 sm:mb-3 leading-tight">
                              Selected premium experiences:
                            </p>
                            <ul className="space-y-1 sm:space-y-2 text-[10px] sm:text-lg font-bold text-black leading-tight">
                              <li className="flex items-center gap-1.5 sm:gap-3">
                                <span className="text-[#0040c0] text-xs sm:text-xl">✈</span>
                                <span>• RC Flight Simulator</span>
                              </li>
                              <li className="flex items-center gap-1.5 sm:gap-3">
                                <span className="text-black text-xs sm:text-xl">🚆</span>
                                <span>• HO &amp; N Scale Trains</span>
                              </li>
                              <li className="flex items-center gap-1.5 sm:gap-3">
                                <span className="text-[#d00000] text-xs sm:text-xl">🚗</span>
                                <span>• Car Race Sim Beginner</span>
                              </li>
                            </ul>
                          </div>
                        ) : ticket.name.toUpperCase() === "VIP_PARTICIPANT" ? (
                          <div className="space-y-2 sm:space-y-4">
                            <div className="flex items-start gap-1.5 sm:gap-4">
                              <div className="shrink-0 w-3.5 sm:w-8 h-3.5 sm:h-8 rounded-full bg-[#0040c0] flex items-center justify-center text-white mt-0.5">
                                <svg className="w-2 sm:w-5 h-2 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                              <ul className="text-[10px] sm:text-lg font-bold text-black leading-tight">
                                <li>• Full access to 15 RC Activities</li>
                                {exclusionNotice && (
                                  <li className="text-[9px] sm:text-sm font-semibold text-[#d00000] mt-0.5 leading-tight">{exclusionNotice}</li>
                                )}
                                <li className="mt-0.5 sm:mt-1.5">• Upgraded Hobby Grade RC Cars</li>
                              </ul>
                            </div>
                            <div className="flex items-start gap-1.5 sm:gap-4 pt-0.5">
                              <div className="shrink-0 w-6 sm:w-12 h-5 sm:h-10 flex items-center justify-center">
                                <img 
                                  src="/rc_car.png" 
                                  alt="RC Car" 
                                  className="w-full h-full object-contain filter grayscale contrast-125" 
                                />
                              </div>
                              <p className="text-[9px] sm:text-base font-bold text-black leading-tight">
                                • + {ticket.perk_duration_mins || 30} mins extra for 1 simulator at Havoc Sim Podium.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5 sm:space-y-3">
                            {ticket.description && (
                              <p className="text-[10px] sm:text-lg font-bold text-black leading-tight">
                                {ticket.description}
                              </p>
                            )}
                            {ticket.benefits ? (
                              <ul className="space-y-1 sm:space-y-2 text-[10px] sm:text-lg font-bold text-black leading-tight">
                                {ticket.benefits.split("\n").map(s => s.trim()).filter(Boolean).map((benefitItem, bIdx) => (
                                  <li key={bIdx} className="flex items-center gap-1.5 sm:gap-3">
                                    <div className="shrink-0 w-3.5 sm:w-7 h-3.5 sm:h-7 rounded-full bg-[#0040c0] flex items-center justify-center text-white">
                                      <svg className="w-2 sm:w-4 h-2 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    </div>
                                    <span>• {benefitItem}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : !isExcavatorOrAddon ? (
                              <div className="flex items-center gap-1.5 sm:gap-3">
                                <div className="shrink-0 w-3.5 sm:w-7 h-3.5 sm:h-7 rounded-full bg-[#0040c0] flex items-center justify-center text-white">
                                  <svg className="w-2 sm:w-4 h-2 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </div>
                                <p className="text-[10px] sm:text-lg font-bold text-black leading-tight">
                                  • {hasPerk ? `Includes ${ticket.perk_duration_mins || 60} mins session at Havoc Sim Podium (${ticket.perk_title || 'VIP Simulator'})` : isVipParticipant ? '2-Hour arena session' : '1-Hour arena session'}
                                </p>
                              </div>
                            ) : null}

                            {/* Note for Add-on package: Arena entry ticket is mandatory */}
                            {Boolean(ticket.is_addon || ticket.name.toUpperCase().includes("EXCAVATOR")) && mandatoryPassNotice && (
                              <p className="text-[9px] sm:text-sm font-semibold text-[#d00000] mt-0.5 sm:mt-1.5 leading-tight">
                                {mandatoryPassNotice}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}

