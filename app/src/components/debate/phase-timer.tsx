"use client";

import { PHASE_CONFIG, type DebatePhase } from "@/lib/hooks/use-debate-store";

interface PhaseTimerProps {
  phase: DebatePhase;
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
  if (isGracePeriod) return "text-red-600";
  const ratio = timeRemaining / totalDuration;
  if (ratio > 0.5) return "text-green-600";
  if (ratio > 0.2) return "text-yellow-600";
  return "text-red-600";
}

export function PhaseTimer({
  phase,
  timeRemaining,
  isGracePeriod,
}: PhaseTimerProps) {
  const config = PHASE_CONFIG[phase];
  const colorClass = getTimerColor(timeRemaining, config.duration, isGracePeriod);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-600">{config.label}</span>
      {config.duration > 0 && (
        <span className={`font-mono text-lg font-bold ${colorClass}`}>
          {isGracePeriod && "+"}
          {formatTime(timeRemaining)}
        </span>
      )}
    </div>
  );
}
