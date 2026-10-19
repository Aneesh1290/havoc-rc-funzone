import React from "react";

export interface ParsedSimSlot {
  sessionNum: number;
  participantNum?: number;
  simulatorName: string;
  slotLabel: string;
}

/**
 * Parses raw simulatorName and simulatorSlot strings into a structured list of sessions.
 * Supports single selections as well as multi-participant / multi-session formats like:
 * simName: "#1 (P1): RC Flying Sim | #2 (P1): RC Flying Sim | #3 (P2): Flight Sim Pro"
 * simSlot: "#1 (P1 - RC Flying Sim): 12PM-12:30PM • #2 (P1 - RC Flying Sim): 12:30PM-1PM • ..."
 */
export function parseSimPerkDisplay(simNameStr?: string, simSlotStr?: string): ParsedSimSlot[] {
  if (!simNameStr && !simSlotStr) return [];

  // Multi-session encoded
  if (simNameStr && (simNameStr.includes("#1") || (simSlotStr && simSlotStr.includes("#1")))) {
    const nameSegments = (simNameStr || "").split("|").map(s => s.trim()).filter(Boolean);
    const slotSegments = (simSlotStr || "").replace(/[()]/g, "").split("•").map(s => s.trim()).filter(Boolean);

    const count = Math.max(nameSegments.length, slotSegments.length);
    const parsed: ParsedSimSlot[] = [];

    for (let i = 0; i < count; i++) {
      const nSeg = nameSegments[i] || "";
      const sSeg = slotSegments[i] || "";

      // Extract session number: e.g. #1 or #2
      const sessMatch = nSeg.match(/#(\d+)/) || sSeg.match(/#(\d+)/);
      const sessionNum = sessMatch ? parseInt(sessMatch[1], 10) : i + 1;

      // Extract participant number: e.g. (P1) or (P2)
      const pMatch = nSeg.match(/\(P(\d+)\)/i) || sSeg.match(/\(P(\d+)/i);
      const participantNum = pMatch ? parseInt(pMatch[1], 10) : undefined;

      // Extract clean simulator name
      const simNameClean = nSeg.replace(/^#\d+(?:\s*\([^)]*\))?:\s*/, "").trim() || "Simulator";

      // Extract slot label
      const timeMatch = sSeg.match(/(\d{1,2}(?::\d{2})?(?:AM|PM)-\d{1,2}(?::\d{2})?(?:AM|PM))/i);
      const slotLabel = timeMatch ? timeMatch[1] : sSeg.replace(/^#\d+[^:]*:\s*/, "").trim();

      parsed.push({
        sessionNum,
        participantNum,
        simulatorName: simNameClean,
        slotLabel: slotLabel || "Slot Pending"
      });
    }

    return parsed;
  }

  // Single simulator session
  return [
    {
      sessionNum: 1,
      simulatorName: simNameStr || "Simulator",
      slotLabel: simSlotStr || "Slot Pending"
    }
  ];
}

interface SimPerkBadgeListProps {
  simNameStr?: string;
  simSlotStr?: string;
  className?: string;
}

export function SimPerkBadgeList({ simNameStr, simSlotStr, className = "" }: SimPerkBadgeListProps) {
  if (!simNameStr && !simSlotStr) return null;

  const items = parseSimPerkDisplay(simNameStr, simSlotStr);
  if (items.length === 0) return null;

  // Single selection display (clean pill)
  if (items.length === 1) {
    const item = items[0];
    return (
      <div className={`mt-2.5 rounded-xl border border-orange-200/80 bg-orange-50/60 p-2.5 text-xs text-gray-800 ${className}`}>
        <div className="flex items-center gap-1.5 font-bold text-gray-900">
          <span className="text-sm">🏆</span>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#ff5a1f]">VIP Simulator Perk</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 bg-white/90 rounded-lg px-2.5 py-1.5 border border-orange-100 shadow-2xs">
          <span className="font-bold text-gray-900 truncate">{item.simulatorName}</span>
          <span className="px-2 py-0.5 rounded-md bg-[#ff5a1f]/10 text-[#ff5a1f] font-black text-[11px] whitespace-nowrap">
            {item.slotLabel}
          </span>
        </div>
      </div>
    );
  }

  // Multi-item / Multi-participant grouped display
  // Group by participant if participant numbers exist
  const hasMultipleParticipants = items.some(it => it.participantNum !== undefined);

  return (
    <div className={`mt-2.5 rounded-xl border border-orange-200/80 bg-orange-50/50 p-2.5 text-xs text-gray-800 space-y-2 ${className}`}>
      <div className="flex items-center justify-between border-b border-orange-200/50 pb-1.5">
        <div className="flex items-center gap-1.5 font-bold text-gray-900">
          <span className="text-sm">🏆</span>
          <span className="text-[11px] font-black uppercase tracking-wider text-[#ff5a1f]">VIP Simulator Perks</span>
        </div>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          {items.length} Sessions (30m each)
        </span>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
        {items.map((item, idx) => (
          <div 
            key={idx}
            className="flex items-center justify-between gap-2 bg-white rounded-lg px-2.5 py-1.5 border border-orange-100/90 shadow-2xs hover:border-orange-300 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-md bg-gray-900 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                {item.participantNum ? `P${item.participantNum}` : `#${item.sessionNum}`}
              </span>
              <span className="font-bold text-gray-900 text-xs truncate">
                {item.simulatorName}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-orange-50 text-[#ff5a1f] border border-orange-200/60 font-black text-[11px] shrink-0 whitespace-nowrap">
              {item.slotLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
