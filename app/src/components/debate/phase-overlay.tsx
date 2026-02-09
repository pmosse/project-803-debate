"use client";

import { PHASE_CONFIG, type DebatePhase } from "@/lib/hooks/use-debate-store";

interface PhaseOverlayProps {
  phase: DebatePhase;
}

export function PhaseOverlay({ phase }: PhaseOverlayProps) {
  const config = PHASE_CONFIG[phase];

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="animate-in fade-in zoom-in rounded-lg bg-white px-12 py-8 text-center shadow-2xl">
        <h2 className="text-2xl font-bold text-[#1D4F91]">{config.label}</h2>
        {config.duration > 0 && (
          <p className="mt-2 text-gray-500">
            {Math.floor(config.duration / 60)}:
            {(config.duration % 60).toString().padStart(2, "0")}
          </p>
        )}
      </div>
    </div>
  );
}
