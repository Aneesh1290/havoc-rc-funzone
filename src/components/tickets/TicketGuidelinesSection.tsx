"use client";

import { useEffect, useState } from "react";
import { 
  DEFAULT_TICKET_GUIDELINES, 
  type TicketGuidelinesConfig 
} from "@/lib/ticket-guidelines";
import { fetchTicketGuidelinesAction } from "@/app/actions/tickets";

interface Props {
  initialConfig?: TicketGuidelinesConfig;
  className?: string;
}

export default function TicketGuidelinesSection({ initialConfig, className }: Props) {
  const [config, setConfig] = useState<TicketGuidelinesConfig>(initialConfig || DEFAULT_TICKET_GUIDELINES);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const data = await fetchTicketGuidelinesAction();
        if (isMounted && data && Array.isArray(data.items)) {
          setConfig(data);
        }
      } catch (e) {
        console.error("Failed to load ticket guidelines:", e);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const items = config.items && config.items.length > 0 ? config.items : DEFAULT_TICKET_GUIDELINES.items;

  return (
    <div className={`mt-20 w-full max-w-5xl bg-white/60 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/50 z-10 relative ${className || ""}`}>
      <h2 className="text-2xl font-black font-heading text-[#0d1b2a] mb-8 flex items-center gap-3">
        {config.sectionTitle || "⚠️ Important Guidelines:"}
      </h2>

      <ul className="space-y-6 text-gray-800 text-sm md:text-base font-bold leading-relaxed">
        {items.map((item, index) => (
          <li key={item.id || index} className="flex gap-4">
            <span className="min-w-[24px] text-[#ff5a1f] font-black">{index + 1}.</span>
            <div className="flex-1 space-y-1">
              <div>
                {item.title && item.title.trim() && (
                  <span className="underline decoration-2 underline-offset-4 text-[#0d1b2a] mr-1.5">
                    {item.title}
                  </span>
                )}
                <span>{item.text}</span>
              </div>
              {item.highlight && item.highlight.trim() && (
                <div className="text-[#ff5a1f] font-bold text-sm">
                  {item.highlight}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

