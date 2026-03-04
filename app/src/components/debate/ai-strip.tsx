"use client";

import { useEffect, useState, useRef } from "react";
import { Bot, BookOpen, AlertTriangle, MessageCircle } from "lucide-react";
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
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInterventionIdRef = useRef<number>(0);

  const config = PHASE_CONFIG[phase];
  const hasDuration = config.duration > 0;

  // Watch for new non-phase_prompt interventions
  useEffect(() => {
    const realInterventions = interventions.filter((i) => i.type !== "phase_prompt");
    const latest = realInterventions[realInterventions.length - 1];
    if (!latest || latest.timestamp <= lastInterventionIdRef.current) return;

    lastInterventionIdRef.current = latest.timestamp;
    setActiveIntervention(latest);

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = setTimeout(() => {
      setActiveIntervention(null);
    }, 10000);
  }, [interventions]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const isMyTurn =
    (phase.endsWith("_a") && studentRole === "A") ||
    (phase.endsWith("_b") && studentRole === "B");

  const myFirst = studentName.split(" ")[0];
  const theirFirst = opponentName.split(" ")[0];
  const instructions = getPhaseInstructions(phase, opponentThesis, opponentClaims);

  // Determine what to show
  let message: string;
  let borderClass: string;
  let Icon = Bot;
  let label: string;

  if (activeIntervention) {
    message = activeIntervention.message;
    borderClass = INTERVENTION_BORDER[activeIntervention.type] || "border-l-blue-500";
    Icon = INTERVENTION_ICON[activeIntervention.type] || Bot;
    label = "AI Moderator";
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
      className={`border-l-4 bg-black/70 backdrop-blur-sm px-3 py-2.5 ${borderClass}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide flex-1">
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
      <p className="text-sm leading-snug text-gray-100">{message}</p>
    </div>
  );
}
