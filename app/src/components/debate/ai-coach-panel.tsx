"use client";

import { useEffect, useState, useRef } from "react";
import type { AiIntervention } from "@/lib/hooks/use-debate-store";
import type { DebatePhase } from "@/lib/hooks/use-debate-store";
import { Bot, BookOpen, GraduationCap } from "lucide-react";

interface AiCoachPanelProps {
  phase: DebatePhase;
  studentRole: "A" | "B";
  studentName: string;
  opponentName: string;
  opponentThesis?: string;
  opponentClaims?: string[];
  interventions: AiIntervention[];
}

// --- Zone 1: Phase context (persistent, instant) ---

function getPhaseInstructions(
  phase: string,
  opponentThesis?: string,
  opponentClaims?: string[]
): { you: string; opponent: string } | null {
  const claimsList = opponentClaims?.length
    ? opponentClaims.slice(0, 2).join("; ")
    : null;

  const instructions: Record<string, { you: string; opponent: string }> = {
    opening_a: {
      you: opponentThesis
        ? `Present your thesis and key arguments. Your opponent argues: "${opponentThesis}"`
        : "Present your thesis and key arguments. Reference the assigned readings to support your position.",
      opponent:
        "Listen carefully. Note claims you want to challenge during cross-examination.",
    },
    opening_b: {
      you: opponentThesis
        ? `Present your thesis and key arguments. Your opponent argues: "${opponentThesis}"`
        : "Present your thesis and key arguments. Reference the assigned readings to support your position.",
      opponent:
        "Listen carefully. Note claims you want to challenge during cross-examination.",
    },
    crossexam_a: {
      you: "Ask pointed questions to challenge your opponent's claims. Focus on weak evidence or logical gaps.",
      opponent:
        "Answer concisely and defend your position. Stay calm under pressure.",
    },
    crossexam_b: {
      you: "Ask pointed questions to challenge your opponent's claims. Focus on weak evidence or logical gaps.",
      opponent:
        "Answer concisely and defend your position. Stay calm under pressure.",
    },
    rebuttal_a: {
      you: claimsList
        ? `Address their strongest points: ${claimsList}. Explain why your position still holds.`
        : "Address your opponent's strongest points. Explain why your position still holds.",
      opponent: "Listen for any mischaracterizations of your argument.",
    },
    rebuttal_b: {
      you: claimsList
        ? `Address their strongest points: ${claimsList}. Explain why your position still holds.`
        : "Address your opponent's strongest points. Explain why your position still holds.",
      opponent: "Listen for any mischaracterizations of your argument.",
    },
    closing_a: {
      you: opponentThesis
        ? `Summarize why your position holds despite your opponent's argument that "${opponentThesis}".`
        : "Summarize your key arguments and why your position is stronger overall.",
      opponent: "Prepare your own closing statement.",
    },
    closing_b: {
      you: opponentThesis
        ? `Summarize why your position holds despite your opponent's argument that "${opponentThesis}".`
        : "Summarize your key arguments and why your position is stronger overall.",
      opponent: "The debate is almost over.",
    },
  };

  return instructions[phase] || null;
}

function PhaseContext({
  phase,
  studentRole,
  studentName,
  opponentName,
  opponentThesis,
  opponentClaims,
}: Omit<AiCoachPanelProps, "interventions">) {
  const instructions = getPhaseInstructions(
    phase,
    opponentThesis,
    opponentClaims
  );
  if (!instructions) return null;

  const isMyTurn =
    (phase.endsWith("_a") && studentRole === "A") ||
    (phase.endsWith("_b") && studentRole === "B");

  const myFirst = studentName.split(" ")[0];
  const theirFirst = opponentName.split(" ")[0];

  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1D4F91]">
        <GraduationCap className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">
          {isMyTurn ? `${myFirst}, your turn` : `${theirFirst}'s turn`}
        </p>
        <p className="mt-0.5 text-sm text-slate-600">
          {isMyTurn ? instructions.you : instructions.opponent}
        </p>
      </div>
    </div>
  );
}

// --- Zone 2: AI messages (stacking, up to 3) ---

const STYLE_MAP: Record<
  string,
  { bg: string; iconBg: string; label: string; labelColor: string }
> = {
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

function AiMessageRow({
  intervention,
  animate,
}: {
  intervention: AiIntervention;
  animate: boolean;
}) {
  const [displayedText, setDisplayedText] = useState(
    animate ? "" : intervention.message
  );
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!animate) {
      setDisplayedText(intervention.message);
      return;
    }
    let i = 0;
    setDisplayedText("");
    animRef.current = setInterval(() => {
      i++;
      setDisplayedText(intervention.message.slice(0, i));
      if (i >= intervention.message.length && animRef.current) {
        clearInterval(animRef.current);
      }
    }, 30);
    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, [intervention.message, animate]);

  const style = STYLE_MAP[intervention.type] || DEFAULT_STYLE;
  const isFactCheck = intervention.type === "fact_check";

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${style.bg}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.iconBg}`}
      >
        {isFactCheck ? (
          <BookOpen className="h-3.5 w-3.5 text-white" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-white" />
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-medium ${style.labelColor}`}>
          {style.label}
        </p>
        <p className="text-sm text-gray-700">{displayedText}</p>
      </div>
    </div>
  );
}

// --- Combined panel ---

export function AiCoachPanel({
  phase,
  studentRole,
  studentName,
  opponentName,
  opponentThesis,
  opponentClaims,
  interventions,
}: AiCoachPanelProps) {
  const visible = interventions.slice(-3);

  return (
    <div className="flex flex-col gap-2 border-t border-b bg-white px-4 py-3">
      {/* Zone 1: Phase context — always visible */}
      <PhaseContext
        phase={phase}
        studentRole={studentRole}
        studentName={studentName}
        opponentName={opponentName}
        opponentThesis={opponentThesis}
        opponentClaims={opponentClaims}
      />

      {/* Zone 2: AI messages — up to 3, newest gets typing animation */}
      {visible.map((intervention, idx) => (
        <AiMessageRow
          key={intervention.timestamp}
          intervention={intervention}
          animate={idx === visible.length - 1}
        />
      ))}
    </div>
  );
}
