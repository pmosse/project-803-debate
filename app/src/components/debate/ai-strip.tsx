"use client";

import { useEffect, useState, useRef } from "react";
import { Bot, BookOpen, AlertTriangle, MessageCircle, Loader2 } from "lucide-react";
import { PHASE_CONFIG, type DebatePhase, type AiIntervention } from "@/lib/hooks/use-debate-store";
import { getPhaseInstructions } from "./ai-coach-panel";

interface AiStripProps {
  phase: DebatePhase;
  studentRole: "A" | "B";
  studentName: string;
  opponentName: string;
  opponentThesis?: string;
  opponentClaims?: string[];
  interventions: AiIntervention[];
  timeRemaining: number;
  isGracePeriod: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getTimerColor(
  timeRemaining: number,
  totalDuration: number,
  isGracePeriod: boolean
): string {
  if (isGracePeriod) return "bg-red-600";
  const ratio = timeRemaining / totalDuration;
  if (ratio > 0.5) return "bg-green-600";
  if (ratio > 0.2) return "bg-yellow-500";
  return "bg-red-600";
}

const INTERVENTION_ICON: Record<string, typeof Bot> = {
  fact_check: BookOpen,
  flag: AlertTriangle,
  nudge: MessageCircle,
};

const INTERVENTION_BORDER: Record<string, string> = {
  fact_check: "border-l-amber-500",
  flag: "border-l-red-500",
  nudge: "border-l-indigo-500",
  question: "border-l-blue-500",
  redirect: "border-l-orange-500",
};

export function AiStrip({
  phase,
  studentRole,
  studentName,
  opponentName,
  opponentThesis,
  opponentClaims,
  interventions,
  timeRemaining,
  isGracePeriod,
}: AiStripProps) {
  const [activeIntervention, setActiveIntervention] = useState<AiIntervention | null>(null);
  const [phasePrompt, setPhasePrompt] = useState<string | null>(null);
  const lastInterventionIdRef = useRef<number>(0);
  const lastPhaseRef = useRef<string>(phase);
  const phaseStartedAtRef = useRef<number>(Date.now());

  // Watch for new non-phase_prompt interventions — sticky until replaced
  useEffect(() => {
    const realInterventions = interventions.filter((i) => i.type !== "phase_prompt");
    const latest = realInterventions[realInterventions.length - 1];
    if (!latest || latest.timestamp <= lastInterventionIdRef.current) return;

    lastInterventionIdRef.current = latest.timestamp;
    setActiveIntervention(latest);
  }, [interventions]);

  // Track phase_prompt for current phase (AI-generated context-aware suggestion)
  useEffect(() => {
    const cutoff = phaseStartedAtRef.current;
    const currentPhasePrompts = interventions.filter(
      (i) => i.type === "phase_prompt" && i.timestamp >= cutoff
    );
    if (currentPhasePrompts.length > 0) {
      setPhasePrompt(currentPhasePrompts[currentPhasePrompts.length - 1].message);
    }
  }, [interventions]);

  // Clear intervention and phase prompt on phase change
  useEffect(() => {
    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase;
      phaseStartedAtRef.current = Date.now();
      setActiveIntervention(null);
      setPhasePrompt(null);
    }
  }, [phase]);

  const config = PHASE_CONFIG[phase];
  const hasDuration = config.duration > 0;

  const isMyTurn =
    (phase.endsWith("_a") && studentRole === "A") ||
    (phase.endsWith("_b") && studentRole === "B");

  const myFirst = studentName.split(" ")[0];
  const theirFirst = opponentName.split(" ")[0];
  const instructions = getPhaseInstructions(phase, opponentThesis, opponentClaims);

  const isRebuttalPhase = phase === "rebuttal_a" || phase === "rebuttal_b";

  // Determine what to show
  let message: string;
  let borderClass: string;
  let Icon = Bot;
  let label: string;
  let isLoading = false;

  if (activeIntervention) {
    message = activeIntervention.message;
    borderClass = INTERVENTION_BORDER[activeIntervention.type] || "border-l-blue-500";
    Icon = INTERVENTION_ICON[activeIntervention.type] || Bot;
    label = "AI Moderator";
  } else if (isRebuttalPhase && isMyTurn) {
    // For rebuttal phases, show AI-generated context-aware suggestion from phase_prompt
    if (phasePrompt) {
      message = phasePrompt;
      borderClass = "border-l-[#1D4F91]";
      label = `${myFirst}, your turn`;
    } else {
      message = "";
      isLoading = true;
      borderClass = "border-l-[#1D4F91]";
      label = `${myFirst}, your turn`;
    }
  } else if (instructions) {
    message = isMyTurn ? instructions.you : instructions.opponent;
    borderClass = isMyTurn ? "border-l-[#1D4F91]" : "border-l-gray-400";
    label = isMyTurn ? `${myFirst}, your turn` : `${theirFirst}'s turn`;
  } else {
    return null;
  }

  const timerColorClass = hasDuration
    ? getTimerColor(timeRemaining, config.duration, isGracePeriod)
    : "";

  return (
    <div
      className={`border-l-4 bg-white px-3 py-2.5 ${borderClass}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1">
          {label}
        </span>
        {hasDuration && (
          <span
            className={`shrink-0 rounded px-2 py-0.5 font-mono text-sm font-bold text-white ${timerColorClass}`}
          >
            {isGracePeriod && "+"}
            {formatTime(timeRemaining)}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Generating suggestions based on cross-examination...</span>
        </div>
      ) : (
        <p className="text-sm leading-snug text-gray-700">{message}</p>
      )}
    </div>
  );
}
