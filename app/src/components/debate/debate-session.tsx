"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useDebateStore, PHASE_CONFIG } from "@/lib/hooks/use-debate-store";
import { ConsentModal } from "./consent-modal";
import { PhaseOverlay } from "./phase-overlay";
import { DebateDebrief } from "./debate-debrief";
import { DailyCall } from "./daily-call";
import { AiStrip } from "./ai-strip";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, SkipForward, Clock, Pause, Play, MessageSquare, HelpCircle, Shield, Flag } from "lucide-react";
import type { DebatePhase } from "@/lib/hooks/use-debate-store";
import { Check, Bot, Loader2 } from "lucide-react";

function ReadyCheckOverlay({
  message,
  summary,
  readyA,
  readyB,
  studentRole,
  studentName,
  opponentName,
  onReady,
  onLeave,
}: {
  message: string;
  summary: string;
  readyA: boolean;
  readyB: boolean;
  studentRole: "A" | "B";
  studentName: string;
  opponentName: string;
  onReady: () => void;
  onLeave: () => void;
}) {
  const myReady = studentRole === "A" ? readyA : readyB;
  const theirReady = studentRole === "A" ? readyB : readyA;
  const myFirst = studentName.split(" ")[0];
  const theirFirst = opponentName.split(" ")[0];
  const isLoading = !message;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#1D4F91]" />
          <h3 className="text-lg font-semibold text-gray-900">Phase Transition</h3>
        </div>

        {isLoading ? (
          <div className="mb-5 text-sm text-gray-500">
            Generating phase summary...
          </div>
        ) : (
          <>
            {summary && (
              <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm text-blue-800 leading-relaxed">{summary}</p>
              </div>
            )}
            <p className="mb-5 text-sm text-gray-600 leading-relaxed">{message}</p>
          </>
        )}

        <div className="mb-5 flex gap-3">
          <div className={`flex-1 rounded-lg border-2 p-3 text-center transition-colors ${
            myReady ? "border-green-500 bg-green-50" : "border-gray-200"
          }`}>
            <div className="text-xs text-gray-500">{myFirst} (You)</div>
            <div className="mt-1">
              {myReady ? (
                <Check className="mx-auto h-5 w-5 text-green-600" />
              ) : (
                <span className="text-xs text-gray-400">Waiting for you</span>
              )}
            </div>
          </div>
          <div className={`flex-1 rounded-lg border-2 p-3 text-center transition-colors ${
            theirReady ? "border-green-500 bg-green-50" : "border-gray-200"
          }`}>
            <div className="text-xs text-gray-500">{theirFirst}</div>
            <div className="mt-1">
              {theirReady ? (
                <Check className="mx-auto h-5 w-5 text-green-600" />
              ) : (
                <span className="text-xs text-gray-400">Waiting</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onLeave}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            size="lg"
          >
            Leave Debate
          </Button>
          <Button
            onClick={onReady}
            disabled={myReady || isLoading}
            className="flex-1"
            size="lg"
          >
            {myReady ? `Waiting for ${theirFirst}...` : isLoading ? "Loading..." : "I'm Ready"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const PHASE_ORDER: DebatePhase[] = [
  "opening_a", "opening_b",
  "crossexam_a", "rebuttal_b",
  "crossexam_b", "rebuttal_a",
  "closing_a", "closing_b",
];

const PHASE_LABELS: Record<string, string> = {
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

function PhaseTimeline({ currentPhase, nameA, nameB }: { currentPhase: DebatePhase; nameA: string; nameB: string }) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  const truncate = (s: string) => s.length > 12 ? s.slice(0, 11) + "…" : s;
  const firstA = truncate(nameA.split(" ")[0]);
  const firstB = truncate(nameB.split(" ")[0]);

  return (
    <div className="flex items-center justify-center gap-1 bg-white/95 border-b px-3 py-2">
      {PHASE_ORDER.map((phase, idx) => {
        const isCompleted = currentIdx > idx;
        const isCurrent = currentIdx === idx;
        const label = (PHASE_LABELS[phase] || phase)
          .replace(/ A$/, ` ${firstA}`)
          .replace(/ B$/, ` ${firstB}`);
        const Icon = PHASE_ICONS[phase] || MessageSquare;

        return (
          <div key={phase} className="flex items-center">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
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
  );
}

interface DebateSessionProps {
  pairingId: string;
  assignmentTitle: string;
  roomUrl: string;
  studentRole: "A" | "B";
  studentName: string;
  studentPhotoUrl?: string | null;
  opponentName: string;
  opponentPhotoUrl?: string | null;
  opponentThesis?: string;
  opponentClaims?: string[];
}

export function DebateSession({
  pairingId,
  assignmentTitle,
  roomUrl,
  studentRole,
  studentName,
  studentPhotoUrl,
  opponentName,
  opponentPhotoUrl,
  opponentThesis,
  opponentClaims,
}: DebateSessionProps) {
  const store = useDebateStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const phaseFromRemoteRef = useRef(false);
  const readyCheckSentRef = useRef(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [dailyToken, setDailyToken] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  // Send ready_check_start when grace period triggers readyCheck with empty message
  // (i.e., the store set readyCheck but no server message yet)
  useEffect(() => {
    if (store.readyCheck && !store.readyCheckMessage && !readyCheckSentRef.current) {
      readyCheckSentRef.current = true;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const nextPhase = store.readyCheckNextPhase;
        ws.send(JSON.stringify({
          type: "ready_check_start",
          current_phase: store.phase,
          next_phase: nextPhase,
        }));
      }
    }
    if (!store.readyCheck) {
      readyCheckSentRef.current = false;
    }
  }, [store.readyCheck, store.readyCheckMessage, store.readyCheckNextPhase, store.phase]);

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
        const phase = data.phase as DebatePhase;
        phaseFromRemoteRef.current = true;
        if (phase && phase !== store.phase) {
          store.setPhase(phase);
        } else if (!phase) {
          store.advancePhase();
        }
      } else if (data.type === "sync") {
        const phase = data.phase as DebatePhase;
        if (phase && phase !== "opening_a") {
          store.syncPhase(phase, data.elapsed || 0);
        }
      } else if (data.type === "ready_check") {
        // Server sends ready check with AI transition message + summary
        const nextPhase = data.next_phase as DebatePhase;
        store.startReadyCheck(data.message || "", nextPhase, data.summary || "");
      } else if (data.type === "ready_update") {
        store.updateReadyState(data.ready_a, data.ready_b);
      } else if (data.type === "add_time") {
        store.addTime(data.seconds || 60);
      } else if (data.type === "pause") {
        store.setPaused(true);
      } else if (data.type === "resume") {
        store.setPaused(false);
      }
    };

    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sessionId]);

  // Send phase changes over WS so moderator tracks current phase
  // Skip if the phase change originated from a remote phase_advance message
  // to avoid duplicate AI phase prompts.
  useEffect(() => {
    if (phaseFromRemoteRef.current) {
      phaseFromRemoteRef.current = false;
      return;
    }
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (store.phase === "waiting" || store.phase === "consent") return;

    ws.send(JSON.stringify({ type: "phase_command", phase: store.phase }));
  }, [store.phase]);

  // When debate completes naturally (timer runs out on closing_b),
  // persist completion to the DB so evaluations trigger.
  useEffect(() => {
    if (store.phase !== "completed" || !store.sessionId) return;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "end" }));
    }

    fetch(`/api/debates/${pairingId}/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        transcript: store.transcript.filter((t) => t.isFinal),
        durationSeconds: Math.floor(
          (Date.now() - (store.transcript[0]?.timestamp || Date.now())) / 1000
        ),
      }),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.phase, store.sessionId, pairingId]);

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

  const handleLeave = useCallback(() => {
    // Setting phase to "completed" triggers the completion effect
    // which sends the WS end signal and persists to DB
    store.setPhase("completed");
  }, [store]);

  const handleReadyClick = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "ready_signal",
        student: studentRole,
      }));
    }
    // Optimistically mark self as ready
    if (studentRole === "A") {
      store.updateReadyState(true, store.readyB);
    } else {
      store.updateReadyState(store.readyA, true);
    }
  }, [store, studentRole]);

  const handleTogglePause = useCallback(() => {
    const newPaused = !store.isPaused;
    store.togglePause();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: newPaused ? "pause" : "resume" }));
    }
  }, [store]);

  const handleAddTime = useCallback(() => {
    // Add 60 seconds locally
    store.addTime(60);
    // Broadcast to other client via WebSocket
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "add_time", seconds: 60 }));
    }
  }, [store]);

  const handleSkip = useCallback(() => {
    const currentConfig = PHASE_CONFIG[store.phase];
    const nextPhase = currentConfig.next;
    if (!nextPhase) return;

    // Send ready_check_start to server instead of immediate advance
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "ready_check_start",
        current_phase: store.phase,
        next_phase: nextPhase,
      }));
    }
    // Set local readyCheck state (server will broadcast ready_check with message)
    store.startReadyCheck("", nextPhase);
  }, [store]);

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

  const isMySpeakingTurn =
    (store.phase.endsWith("_a") && studentRole === "A") ||
    (store.phase.endsWith("_b") && studentRole === "B");

  const showTimedControls =
    isActiveDebate && PHASE_CONFIG[store.phase].duration > 0 && !store.readyCheck;

  return (
    <div className="flex h-[calc(100dvh)] flex-col bg-gray-900">
      {/* Ready check overlay */}
      {store.readyCheck && (
        <ReadyCheckOverlay
          message={store.readyCheckMessage}
          summary={store.readyCheckSummary}
          readyA={store.readyA}
          readyB={store.readyB}
          studentRole={studentRole}
          studentName={studentName}
          opponentName={opponentName}
          onReady={handleReadyClick}
          onLeave={handleLeave}
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

      {/* Phase timeline */}
      {isActiveDebate && (
        <PhaseTimeline
          currentPhase={store.phase}
          nameA={studentRole === "A" ? studentName : opponentName}
          nameB={studentRole === "B" ? studentName : opponentName}
        />
      )}

      {/* Paused banner */}
      {store.isPaused && (
        <div className="flex items-center justify-center gap-2 bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white">
          <Pause className="h-4 w-4" />
          Paused — timer stopped
        </div>
      )}

      {/* Video area */}
      <div className="min-h-0 flex-1 max-h-[45vh]">
        {dailyToken && roomUrl ? (
          <DailyCall
            roomUrl={roomUrl}
            token={dailyToken}
            studentRole={studentRole}
            studentName={studentName}
            studentPhotoUrl={studentPhotoUrl}
            opponentName={opponentName}
            opponentPhotoUrl={opponentPhotoUrl}
            micEnabled={micEnabled}
            camEnabled={camEnabled}
            wsRef={wsRef}
            onRemoteJoined={handleOpponentJoined}
            onTranscript={handleTranscript}
            currentPhase={store.phase}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-900 text-gray-400">
            Connecting to video...
          </div>
        )}
      </div>

      {/* AI strip — light box below video */}
      {isActiveDebate && (
        <AiStrip
          phase={store.phase}
          studentRole={studentRole}
          studentName={studentName}
          opponentName={opponentName}
          opponentThesis={opponentThesis}
          opponentClaims={opponentClaims}
          interventions={store.interventions}
          timeRemaining={store.timeRemaining}
          isGracePeriod={store.isGracePeriod}
        />
      )}

      {/* Controls bar — mic, cam, +1min, skip, hangup */}
      <div className="flex items-center justify-center gap-3 bg-gray-900 px-4 py-2.5">
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
            {PHASE_CONFIG[store.phase].next && isMySpeakingTurn && (
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
