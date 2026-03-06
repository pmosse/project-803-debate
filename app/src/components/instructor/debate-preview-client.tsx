"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDebateStore, PHASE_CONFIG } from "@/lib/hooks/use-debate-store";
import { PhaseTimeline, PHASE_ORDER } from "@/components/debate/phase-timeline";
import { AiStrip } from "@/components/debate/ai-strip";
import { PhaseOverlay } from "@/components/debate/phase-overlay";
import { Button } from "@/components/ui/button";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, SkipForward,
  Clock, Pause, Play, RotateCcw, Eye,
} from "lucide-react";
import type { DebatePhase } from "@/lib/hooks/use-debate-store";

const MOCK_NAME_A = "You (Student A)";
const MOCK_NAME_B = "Sample Opponent";

const MOCK_OPPONENT_THESIS =
  "Government intervention in markets leads to more equitable outcomes and corrects systemic failures that free markets cannot address on their own.";

const MOCK_OPPONENT_CLAIMS = [
  "Market failures like externalities require regulatory correction",
  "Progressive taxation reduces inequality without harming growth",
];

const MOCK_INTERVENTIONS: { phase: DebatePhase; delay: number; type: string; message: string }[] = [
  {
    phase: "opening_a",
    delay: 5000,
    type: "nudge",
    message: "Remember to cite specific readings to support your opening thesis.",
  },
  {
    phase: "crossexam_a",
    delay: 4000,
    type: "fact_check",
    message: "The claim about GDP growth rates may need a specific citation — can you reference the source?",
  },
  {
    phase: "rebuttal_a",
    delay: 3000,
    type: "nudge",
    message: "Address your opponent's strongest point directly before making new arguments.",
  },
];

export function DebatePreviewClient() {
  const store = useDebateStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interventionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  // Initialize to opening_a on mount
  useEffect(() => {
    store.setStudentRole("A");
    store.setPhase("opening_a");
    return () => {
      // Cleanup on unmount
      interventionTimers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer tick
  useEffect(() => {
    timerRef.current = setInterval(() => {
      store.tick();
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inject mock interventions on phase change
  useEffect(() => {
    // Clear previous timers
    interventionTimers.current.forEach(clearTimeout);
    interventionTimers.current = [];

    const matching = MOCK_INTERVENTIONS.filter((i) => i.phase === store.phase);
    for (const mock of matching) {
      const timer = setTimeout(() => {
        store.addIntervention({
          timestamp: Date.now(),
          type: mock.type,
          message: mock.message,
          targetStudent: "A",
        });
      }, mock.delay);
      interventionTimers.current.push(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.phase]);

  // Auto-advance from ready check after a brief pause (simulating both students ready)
  useEffect(() => {
    if (!store.readyCheck) return;
    // Simulate receiving a summary + message after 1s
    const t1 = setTimeout(() => {
      const nextPhase = store.readyCheckNextPhase;
      if (nextPhase) {
        store.startReadyCheck(
          `Great work on that phase! Let's move on to ${PHASE_CONFIG[nextPhase].label}.`,
          nextPhase,
          "Both debaters presented strong arguments. Key points of contention included market efficiency and the role of regulation."
        );
      }
    }, 800);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.readyCheck, store.readyCheckNextPhase]);

  const handleReadyClick = useCallback(() => {
    // In preview, immediately advance
    const nextPhase = store.readyCheckNextPhase;
    if (nextPhase) {
      store.setPhase(nextPhase);
    }
  }, [store]);

  const handleSkip = useCallback(() => {
    const currentConfig = PHASE_CONFIG[store.phase];
    const nextPhase = currentConfig.next;
    if (!nextPhase || nextPhase === "completed") return;
    store.startReadyCheck("", nextPhase);
  }, [store]);

  const handleTogglePause = useCallback(() => {
    store.togglePause();
  }, [store]);

  const handleAddTime = useCallback(() => {
    store.addTime(60);
  }, [store]);

  const handleReset = useCallback(() => {
    interventionTimers.current.forEach(clearTimeout);
    interventionTimers.current = [];
    store.setPhase("opening_a");
  }, [store]);

  // Completed state
  if (store.phase === "completed") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="rounded-xl bg-white p-8 shadow-md text-center max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Preview Complete</h2>
          <p className="text-sm text-gray-500 mb-6">
            You&apos;ve walked through all debate phases. In a real debate, students would see
            their AI-generated debrief and scores here.
          </p>
          <Button onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restart Preview
          </Button>
        </div>
      </div>
    );
  }

  const isActiveDebate = store.phase !== "consent" && store.phase !== "waiting";
  const showTimedControls =
    isActiveDebate && PHASE_CONFIG[store.phase].duration > 0 && !store.readyCheck;

  return (
    <div className="flex flex-col -mx-4 md:mx-0">
      {/* Header banner */}
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 sm:px-4 py-2 mb-3 sm:mb-4 mx-4 md:mx-0">
        <Eye className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-xs sm:text-sm text-amber-800">
          <strong>Debate Preview</strong> — This is a simulation of the student debate experience. No real video, audio, or AI moderation is running.
        </p>
      </div>

      <div className="flex flex-col md:rounded-xl md:overflow-hidden shadow-md md:border border-gray-200 bg-gray-900">
        {/* Ready check overlay */}
        {store.readyCheck && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 sm:p-6 shadow-2xl">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Phase Transition</h3>
              {!store.readyCheckMessage ? (
                <p className="mb-4 text-sm text-gray-500">Generating phase summary...</p>
              ) : (
                <>
                  {store.readyCheckSummary && (
                    <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                      <p className="text-sm text-blue-800 leading-relaxed">{store.readyCheckSummary}</p>
                    </div>
                  )}
                  <p className="mb-4 text-sm text-gray-600 leading-relaxed">{store.readyCheckMessage}</p>
                </>
              )}
              <Button
                onClick={handleReadyClick}
                disabled={!store.readyCheckMessage}
                className="w-full"
              >
                {store.readyCheckMessage ? "Continue to Next Phase" : "Loading..."}
              </Button>
            </div>
          </div>
        )}

        {/* Phase overlay */}
        {store.showPhaseOverlay && (
          <PhaseOverlay
            phase={store.phase}
            nameA={MOCK_NAME_A}
            nameB={MOCK_NAME_B}
          />
        )}

        {/* Phase timeline */}
        {isActiveDebate && (
          <PhaseTimeline
            currentPhase={store.phase}
            nameA={MOCK_NAME_A}
            nameB={MOCK_NAME_B}
          />
        )}

        {/* AI strip */}
        {isActiveDebate && (
          <AiStrip
            phase={store.phase}
            studentRole="A"
            studentName={MOCK_NAME_A}
            opponentName={MOCK_NAME_B}
            opponentThesis={MOCK_OPPONENT_THESIS}
            opponentClaims={MOCK_OPPONENT_CLAIMS}
            interventions={store.interventions}
            timeRemaining={store.timeRemaining}
            isGracePeriod={store.isGracePeriod}
          />
        )}

        {/* Paused banner */}
        {store.isPaused && (
          <div className="flex items-center justify-center gap-2 bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white">
            <Pause className="h-4 w-4" />
            Paused — timer stopped
          </div>
        )}

        {/* Mock video area */}
        <div className="grid grid-cols-2 gap-2 p-2 sm:p-3 min-h-[25vh] sm:min-h-[30vh] max-h-[40vh]">
          {/* Student A (You) */}
          <div className="flex flex-col items-center justify-center rounded-lg bg-gray-800 border border-gray-700">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1D4F91] text-2xl font-bold text-white">
              Y
            </div>
            <p className="mt-2 text-sm font-medium text-white">You (Student A)</p>
            <p className="text-xs text-gray-400">
              {store.phase.endsWith("_a") ? "Speaking" : "Listening"}
            </p>
          </div>

          {/* Student B (Opponent) */}
          <div className="flex flex-col items-center justify-center rounded-lg bg-gray-800 border border-gray-700">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-700 text-2xl font-bold text-white">
              S
            </div>
            <p className="mt-2 text-sm font-medium text-white">{MOCK_NAME_B}</p>
            <p className="text-xs text-gray-400">
              {store.phase.endsWith("_b") ? "Speaking" : "Listening"}
            </p>
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 bg-gray-900 px-3 sm:px-4 py-2 sm:py-2.5">
          <Button
            variant={micEnabled ? "outline" : "destructive"}
            size="icon"
            onClick={() => setMicEnabled(!micEnabled)}
            className={micEnabled ? "border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700" : ""}
          >
            {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          <Button
            variant={camEnabled ? "outline" : "destructive"}
            size="icon"
            onClick={() => setCamEnabled(!camEnabled)}
            className={camEnabled ? "border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700" : ""}
          >
            {camEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>

          {showTimedControls && (
            <>
              <div className="mx-1 h-6 w-px bg-gray-700" />
              <Button
                variant="outline"
                size="icon"
                onClick={handleTogglePause}
                className={store.isPaused
                  ? "border-yellow-500 bg-yellow-600 text-white hover:bg-yellow-500"
                  : "border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700"
                }
                title={store.isPaused ? "Resume" : "Pause"}
              >
                {store.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddTime}
                className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700"
                title="+1 minute"
              >
                <Clock className="h-4 w-4" />
              </Button>
              {PHASE_CONFIG[store.phase].next && PHASE_CONFIG[store.phase].next !== "completed" && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSkip}
                  className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700"
                  title="Skip to next phase"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              )}
            </>
          )}

          <div className="mx-1 h-6 w-px bg-gray-700" />
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            className="border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700"
            title="Restart preview"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={() => store.setPhase("completed")}
            title="End preview"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
