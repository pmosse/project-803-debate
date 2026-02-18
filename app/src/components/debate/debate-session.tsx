"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useDebateStore, PHASE_CONFIG } from "@/lib/hooks/use-debate-store";
import { PhaseTimer } from "./phase-timer";
import { TranscriptPanel } from "./transcript-panel";
import { AiCoachPanel } from "./ai-coach-panel";
import { ConsentModal } from "./consent-modal";
import { PhaseOverlay } from "./phase-overlay";
import { DebateDebrief } from "./debate-debrief";
import { DailyCall } from "./daily-call";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, SkipForward } from "lucide-react";
import type { DebatePhase } from "@/lib/hooks/use-debate-store";
import { Check, Bot, WifiOff, Loader2 } from "lucide-react";

function AiStatusIndicator({
  connectionStatus,
  transcriptCount,
}: {
  connectionStatus: "disconnected" | "connecting" | "connected";
  transcriptCount: number;
}) {
  if (connectionStatus === "disconnected") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1">
        <WifiOff className="h-3 w-3 text-red-600" />
        <span className="text-[11px] font-medium text-red-700">AI Offline</span>
      </div>
    );
  }

  if (connectionStatus === "connecting") {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1">
        <Loader2 className="h-3 w-3 animate-spin text-yellow-600" />
        <span className="text-[11px] font-medium text-yellow-700">Connecting...</span>
      </div>
    );
  }

  // Connected
  const hasTranscripts = transcriptCount > 0;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1">
      <Bot className="h-3 w-3 text-emerald-600" />
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[11px] font-medium text-emerald-700">
        {hasTranscripts ? "Listening" : "AI Ready"}
      </span>
    </div>
  );
}

/** Visible debate phases grouped for the timeline (no waiting/consent/completed). */
const TIMELINE_PHASES: { key: DebatePhase; group: string; suffix: "a" | "b" }[] = [
  { key: "opening_a", group: "Opening", suffix: "a" },
  { key: "opening_b", group: "Opening", suffix: "b" },
  { key: "crossexam_a", group: "Cross-Exam", suffix: "a" },
  { key: "crossexam_b", group: "Cross-Exam", suffix: "b" },
  { key: "rebuttal_a", group: "Rebuttal", suffix: "a" },
  { key: "rebuttal_b", group: "Rebuttal", suffix: "b" },
  { key: "closing_a", group: "Closing", suffix: "a" },
  { key: "closing_b", group: "Closing", suffix: "b" },
];

function phaseIndex(phase: DebatePhase): number {
  return TIMELINE_PHASES.findIndex((p) => p.key === phase);
}

function PhaseTimeline({
  currentPhase,
  studentName,
  opponentName,
  studentRole,
}: {
  currentPhase: DebatePhase;
  studentName: string;
  opponentName: string;
  studentRole: "A" | "B";
}) {
  const currentIdx = phaseIndex(currentPhase);
  const firstName = (name: string) => name.split(" ")[0];
  const myFirst = firstName(studentName);
  const theirFirst = firstName(opponentName);

  return (
    <div className="border-b bg-gray-50 px-4 py-2">
      <div className="flex items-center gap-1">
        {TIMELINE_PHASES.map((p, i) => {
          const isActive = p.key === currentPhase;
          const isDone = currentIdx > i;
          const isMine =
            (p.suffix === "a" && studentRole === "A") ||
            (p.suffix === "b" && studentRole === "B");
          const isAskingSuffix = p.group === "Cross-Exam";
          const askerName = isMine ? myFirst : theirFirst;
          const responderName = isMine ? theirFirst : myFirst;
          const speakerLabel = isAskingSuffix
            ? `${askerName} to ${responderName}`
            : (isMine ? myFirst : theirFirst);

          return (
            <div key={p.key} className="flex flex-1 flex-col items-center">
              {/* Dot / check */}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-[#1D4F91] text-white ring-2 ring-[#1D4F91]/30"
                    : isDone
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {/* Label */}
              <span
                className={`mt-1 text-center text-[10px] leading-tight ${
                  isActive ? "font-semibold text-[#1D4F91]" : "text-gray-400"
                }`}
              >
                {p.group}
                <br />
                <span className={isActive ? "text-[#1D4F91]" : "text-gray-300"}>
                  {speakerLabel}
                </span>
              </span>
              {/* Connector line (between dots) */}
              {i < TIMELINE_PHASES.length - 1 && (
                <div
                  className={`absolute mt-3 h-0.5 w-full ${
                    isDone ? "bg-green-400" : "bg-gray-200"
                  }`}
                  style={{ display: "none" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DebateSessionProps {
  pairingId: string;
  assignmentTitle: string;
  roomUrl: string;
  studentRole: "A" | "B";
  studentName: string;
  opponentName: string;
  opponentThesis?: string;
  opponentClaims?: string[];
}

export function DebateSession({
  pairingId,
  assignmentTitle,
  roomUrl,
  studentRole,
  studentName,
  opponentName,
  opponentThesis,
  opponentClaims,
}: DebateSessionProps) {
  const store = useDebateStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [dailyToken, setDailyToken] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  // Initialize session
  useEffect(() => {
    store.setStudentRole(studentRole);

    async function initSession() {
      const res = await fetch(`/api/debates/${pairingId}/session`, {
        method: "POST",
      });
      const session = await res.json();
      store.setSession(session.id, pairingId);

      if (session.status === "completed") {
        store.setPhase("completed");
      } else {
        store.setPhase("consent");
      }
    }

    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairingId, studentRole]);

  // Timer tick
  useEffect(() => {
    timerRef.current = setInterval(() => {
      store.tick();
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WebSocket for AI moderator
  useEffect(() => {
    if (!store.sessionId) return;
    const moderatorUrl = process.env.NEXT_PUBLIC_DEBATE_MODERATOR_URL;
    if (!moderatorUrl) {
      store.setConnectionStatus("disconnected");
      return;
    }

    store.setConnectionStatus("connecting");
    const ws = new WebSocket(`${moderatorUrl}/ws/${store.sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      store.setConnectionStatus("connected");
    };

    ws.onerror = () => {
      store.setConnectionStatus("disconnected");
    };

    ws.onclose = () => {
      store.setConnectionStatus("disconnected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "transcript") {
        // Opponent's speech relayed via backend broadcast
        store.addTranscript({
          speaker: data.speaker,
          text: data.text,
          timestamp: data.timestamp,
          phase: store.phase,
          isFinal: data.is_final,
        });
      } else if (data.type === "intervention") {
        store.addIntervention({
          timestamp: Date.now(),
          type: data.intervention_type,
          message: data.message,
          targetStudent: data.target_student,
        });
      } else if (data.type === "phase_advance") {
        const phase = data.phase as import("@/lib/hooks/use-debate-store").DebatePhase;
        if (phase && phase !== store.phase) {
          store.setPhase(phase);
        } else if (!phase) {
          store.advancePhase();
        }
      } else if (data.type === "sync") {
        const phase = data.phase as import("@/lib/hooks/use-debate-store").DebatePhase;
        if (phase && phase !== "opening_a") {
          // Late joiner — sync to current phase with elapsed time
          store.syncPhase(phase, data.elapsed || 0);
        }
      }
    };

    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sessionId]);

  // Send phase changes over WS so moderator tracks current phase
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (store.phase === "waiting" || store.phase === "consent") return;

    ws.send(JSON.stringify({ type: "phase_command", phase: store.phase }));
  }, [store.phase]);

  const handleConsent = useCallback(async () => {
    store.setConsent(studentRole, true);

    await fetch(`/api/debates/${pairingId}/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [studentRole === "A" ? "consentA" : "consentB"]: 1,
      }),
    });

    // Fetch Daily.co token
    const tokenRes = await fetch(`/api/debates/${pairingId}/token`);
    if (tokenRes.ok) {
      const { token } = await tokenRes.json();
      setDailyToken(token);
    }

    // Mark consent given — join video but DON'T start timer yet.
    // Timer starts when opponent joins (via onRemoteJoined).
    setConsentGiven(true);
  }, [store, studentRole, pairingId]);

  const handleTranscript = useCallback((event: { speaker: string; text: string; is_final: boolean }) => {
    store.addTranscript({
      speaker: event.speaker,
      text: event.text,
      timestamp: Date.now(),
      phase: store.phase,
      isFinal: event.is_final,
    });
  }, [store]);

  const handleOpponentJoined = useCallback(async () => {
    // Only start if debate hasn't begun yet
    if (store.phase === "consent" || store.phase === "waiting") {
      store.setPhase("opening_a");
      await fetch(`/api/debates/${pairingId}/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
    }
  }, [store, pairingId]);

  const handleLeave = useCallback(async () => {
    // Send end signal to moderator so it saves final transcript
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "end" }));
    }

    // Save session state
    await fetch(`/api/debates/${pairingId}/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        transcript: store.transcript.filter((t) => t.isFinal),
        phasesLog: Object.entries(PHASE_CONFIG)
          .filter(([key]) => key !== "waiting" && key !== "consent")
          .map(([phase]) => ({ phase, startedAt: 0 })),
        durationSeconds: Math.floor(
          (Date.now() - (store.transcript[0]?.timestamp || Date.now())) / 1000
        ),
      }),
    });

    store.setPhase("completed");
    wsRef.current?.close();
  }, [pairingId, store]);

  // Loading state while session initializes
  if (store.phase === "waiting") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1D4F91]" />
        <p className="mt-3 text-sm text-gray-500">Preparing your debate...</p>
      </div>
    );
  }

  // Consent screen (only show if consent not yet given)
  if (store.phase === "consent" && !consentGiven) {
    return <ConsentModal onAccept={handleConsent} />;
  }

  // Completed screen with AI debrief
  if (store.phase === "completed") {
    return <DebateDebrief pairingId={pairingId} />;
  }

  const isActiveDebate = store.phase !== "consent";

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            DEBATE: {assignmentTitle}
          </span>
          <AiStatusIndicator
            connectionStatus={store.connectionStatus}
            transcriptCount={store.transcript.filter((t) => t.isFinal).length}
          />
        </div>
        {isActiveDebate ? (
          <PhaseTimer
            phase={store.phase}
            timeRemaining={store.timeRemaining}
            isGracePeriod={store.isGracePeriod}
            nameA={studentRole === "A" ? studentName : opponentName}
            nameB={studentRole === "B" ? studentName : opponentName}
          />
        ) : (
          <span className="text-sm text-gray-400">Waiting for opponent...</span>
        )}
      </div>

      {/* Phase timeline — only during active debate */}
      {isActiveDebate && (
        <PhaseTimeline
          currentPhase={store.phase}
          studentName={studentName}
          opponentName={opponentName}
          studentRole={studentRole}
        />
      )}

      {/* Phase overlay */}
      {store.showPhaseOverlay && (
        <PhaseOverlay
          phase={store.phase}
          nameA={studentRole === "A" ? studentName : opponentName}
          nameB={studentRole === "B" ? studentName : opponentName}
        />
      )}

      {/* Video area */}
      {dailyToken && roomUrl ? (
        <DailyCall
          roomUrl={roomUrl}
          token={dailyToken}
          studentRole={studentRole}
          studentName={studentName}
          opponentName={opponentName}
          micEnabled={micEnabled}
          camEnabled={camEnabled}
          wsRef={wsRef}
          onRemoteJoined={handleOpponentJoined}
          onTranscript={handleTranscript}
          currentPhase={store.phase}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
          Connecting to video...
        </div>
      )}

      {/* AI Coach panel — phase context + stacking AI messages */}
      {isActiveDebate && (
        <AiCoachPanel
          phase={store.phase}
          studentRole={studentRole}
          studentName={studentName}
          opponentName={opponentName}
          opponentThesis={opponentThesis}
          opponentClaims={opponentClaims}
          interventions={store.interventions}
        />
      )}

      {/* Live transcript — visible in all active phases */}
      {isActiveDebate && (
        <TranscriptPanel
          transcript={store.transcript}
          nameA={studentRole === "A" ? studentName : opponentName}
          nameB={studentRole === "B" ? studentName : opponentName}
        />
      )}

      {/* Floating skip button — visible when it's the active speaker's turn */}
      {isActiveDebate && PHASE_CONFIG[store.phase].next && (
        <div className="flex justify-center py-1.5 bg-gray-900/50">
          <button
            onClick={() => {
              const currentConfig = PHASE_CONFIG[store.phase];
              const nextPhase = currentConfig.next;
              if (!nextPhase) return;
              store.setPhase(nextPhase);
              const ws = wsRef.current;
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "phase_advance", phase: nextPhase }));
              }
            }}
            className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 shadow-lg hover:bg-white transition-colors backdrop-blur-sm"
          >
            <SkipForward className="h-4 w-4" />
            Skip to next phase
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 border-t bg-white px-4 py-3">
        <Button
          variant={micEnabled ? "outline" : "destructive"}
          size="icon"
          onClick={() => setMicEnabled(!micEnabled)}
        >
          {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button
          variant={camEnabled ? "outline" : "destructive"}
          size="icon"
          onClick={() => setCamEnabled(!camEnabled)}
        >
          {camEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={() => setShowLeaveConfirm(true)}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>

      {/* Leave confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Leave Debate?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to leave? The debate will end for both
              participants.
            </p>
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleLeave}>
                Leave Debate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
