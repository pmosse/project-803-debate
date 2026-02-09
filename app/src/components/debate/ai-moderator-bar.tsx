"use client";

import { useEffect, useState } from "react";
import type { AiIntervention } from "@/lib/hooks/use-debate-store";
import { Bot } from "lucide-react";

interface AiModeratorBarProps {
  interventions: AiIntervention[];
}

export function AiModeratorBar({ interventions }: AiModeratorBarProps) {
  const [visibleIntervention, setVisibleIntervention] =
    useState<AiIntervention | null>(null);
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    if (interventions.length === 0) return;
    const latest = interventions[interventions.length - 1];
    setVisibleIntervention(latest);
    setDisplayedText("");

    // Typing animation
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(latest.message.slice(0, i));
      if (i >= latest.message.length) clearInterval(interval);
    }, 30);

    // Auto-hide after 15s
    const hideTimer = setTimeout(() => {
      setVisibleIntervention(null);
    }, 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(hideTimer);
    };
  }, [interventions]);

  if (!visibleIntervention) return null;

  return (
    <div className="border-t border-b bg-[#E8F4FD] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1D4F91]">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-medium text-[#1D4F91]">AI Moderator</p>
          <p className="text-sm text-gray-700">{displayedText}</p>
        </div>
      </div>
    </div>
  );
}
