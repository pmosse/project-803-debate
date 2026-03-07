"use client";

import { MessageSquare, HelpCircle, Shield, Flag } from "lucide-react";
import type { DebatePhase } from "@/lib/hooks/use-debate-store";

export const PHASE_ORDER: DebatePhase[] = [
  "opening_a", "opening_b",
  "crossexam_a", "rebuttal_b",
  "crossexam_b", "rebuttal_a",
  "closing_b", "closing_a",
];

export const PHASE_LABELS: Record<string, string> = {
  opening_a: "Opening A",
  opening_b: "Opening B",
  crossexam_a: "Cross-Exam A",
  rebuttal_b: "Rebuttal B",
  crossexam_b: "Cross-Exam B",
  rebuttal_a: "Rebuttal A",
  closing_a: "Closing A",
  closing_b: "Closing B",
};

const PHASE_ICONS: Record<string, typeof MessageSquare> = {
  opening_a: MessageSquare,
  opening_b: MessageSquare,
  crossexam_a: HelpCircle,
  crossexam_b: HelpCircle,
  rebuttal_a: Shield,
  rebuttal_b: Shield,
  closing_a: Flag,
  closing_b: Flag,
};

export function PhaseTimeline({ currentPhase, nameA, nameB }: { currentPhase: DebatePhase; nameA: string; nameB: string }) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const truncate = (s: string) => s.length > 12 ? s.slice(0, 11) + "…" : s;
  const firstA = truncate(nameA.split(" ")[0]);
  const firstB = truncate(nameB.split(" ")[0]);

  return (
    <div className="overflow-x-auto bg-white/95 border-b px-3 py-2 scrollbar-hide">
      <div className="flex items-center justify-start sm:justify-center gap-1 min-w-max">
        {PHASE_ORDER.map((phase, idx) => {
          const isCompleted = currentIdx > idx;
          const isCurrent = currentIdx === idx;
          const label = (PHASE_LABELS[phase] || phase)
            .replace(/ A$/, ` ${firstA}`)
            .replace(/ B$/, ` ${firstB}`);
          const Icon = PHASE_ICONS[phase] || MessageSquare;

          return (
            <div key={phase} className="flex items-center">
              <div className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
                isCurrent
                  ? "bg-[#1D4F91] text-white"
                  : isCompleted
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
              }`}>
                <Icon className={`h-3 w-3 shrink-0 ${
                  isCurrent ? "text-white" : isCompleted ? "text-green-600" : "text-gray-400"
                }`} />
                {label}
              </div>
              {idx < PHASE_ORDER.length - 1 && (
                <div className={`mx-0.5 h-px w-3 ${isCompleted ? "bg-green-300" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
