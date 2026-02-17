"use client";

import { useEffect, useState } from "react";
import type { AiIntervention } from "@/lib/hooks/use-debate-store";
import { Bot, BookOpen } from "lucide-react";

interface AiModeratorBarProps {
  interventions: AiIntervention[];
}

const STYLE_MAP: Record<string, { bg: string; iconBg: string; label: string; labelColor: string }> = {
  phase_prompt: {
    bg: "bg-blue-50 border-blue-200",
    iconBg: "bg-blue-600",
    label: "Phase Guide",
    labelColor: "text-blue-700",
  },
  fact_check: {
    bg: "bg-amber-50 border-amber-300",
    iconBg: "bg-amber-600",
    label: "Fact Check",
    labelColor: "text-amber-700",
  },
  nudge: {
    bg: "bg-indigo-50 border-indigo-200",
    iconBg: "bg-indigo-600",
    label: "AI Moderator",
    labelColor: "text-indigo-700",
  },
};

const DEFAULT_STYLE = {
  bg: "bg-[#E8F4FD] border-[#B8D9F0]",
  iconBg: "bg-[#1D4F91]",
  label: "AI Moderator",
  labelColor: "text-[#1D4F91]",
};

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

    // phase_prompt stays until next intervention (no auto-hide)
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    if (latest.type !== "phase_prompt") {
      hideTimer = setTimeout(() => {
        setVisibleIntervention(null);
      }, 15000);
    }

    return () => {
      clearInterval(interval);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [interventions]);

  if (!visibleIntervention) return null;

  const style = STYLE_MAP[visibleIntervention.type] || DEFAULT_STYLE;
  const isFactCheck = visibleIntervention.type === "fact_check";

  return (
    <div className={`border-t border-b px-4 py-3 ${style.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}>
          {isFactCheck ? (
            <BookOpen className="h-4 w-4 text-white" />
          ) : (
            <Bot className="h-4 w-4 text-white" />
          )}
        </div>
        <div>
          <p className={`text-xs font-medium ${style.labelColor}`}>{style.label}</p>
          <p className="text-sm text-gray-700">{displayedText}</p>
        </div>
      </div>
    </div>
  );
}
