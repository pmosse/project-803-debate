"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useDebateStore, PHASE_CONFIG } from "@/lib/hooks/use-debate-store";
import { ConsentModal } from "./consent-modal";
import { PhaseOverlay } from "./phase-overlay";
import { DebateDebrief } from "./debate-debrief";
import { DailyCall } from "./daily-call";
import { AiStrip } from "./ai-strip";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, SkipForward, Clock, Pause, Play } from "lucide-react";
import type { DebatePhase } from "@/lib/hooks/use-debate-store";
import { Check, Bot, Loader2 } from "lucide-react";
import { PhaseTimeline } from "./phase-timeline";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-y-auto max-h-[90dvh] rounded-xl bg-white p-5 sm:p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="h-5 w-5 shrink-0 text-[#1D4F91]" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Phase Transition</h3>
        </div>

        {isLoading ? (
          <div className="mb-4 text-sm text-gray-500">
            Generating phase summary...
          </div>
        ) : (
          <>
            {summary && (
              <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm text-blue-800 leading-relaxed">{summary}</p>
              </div>
            )}
            <p className="mb-4 text-sm text-gray-600 leading-relaxed">{message}</p>
          </>
        )}

        <div className="mb-4 flex gap-2">
          <div className={`flex-1 min-w-0 rounded-lg border-2 p-2.5 text-center transition-colors ${
            myReady ? "border-green-500 bg-green-50" : "border-gray-200"
          }`}>
            <div className="text-xs text-gray-500 truncate">{myFirst} (You)</div>
            <div className="mt-1">
              {myReady ? (
                <Check className="mx-auto h-5 w-5 text-green-600" />
              ) : (
                <span className="text-xs text-gray-400">Waiting</span>
              )}
            </div>
          </div>
          <div className={`flex-1 min-w-0 rounded-lg border-2 p-2.5 text-center transition-colors ${
            theirReady ? "border-green-500 bg-green-50" : "border-gray-200"
          }`}>
            <div className="text-xs text-gray-500 truncate">{theirFirst}</div>
            <div className="mt-1">
              {theirReady ? (
                <Check className="mx-auto h-5 w-5 text-green-600" />
              ) : (
                <span className="text-xs text-gray-400">Waiting</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onLeave}
            className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            Leave
          </Button>
          <Button
            onClick={onReady}
            disabled={myReady || isLoading}
            className="flex-1 min-w-0"
          >
            <span className="truncate">
              {myReady ? `Waiting for ${theirFirst}...` : isLoading ? "Loading..." : "I'm Ready"}
            </span>
          </Button>
        </div>
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
  const [tokenError, setTokenError] = useState(false);

  // Send ready_check_start when grace period triggers readyCheck with empty message
  // (i.e., the store set readyCheck but no server message yet)
  useEffect(() => {
    if (store.readyCheck && !store.readyCheckMessage && !readyCheckSentRef.current) {
      // Only the speaking student sends ready_check_start to avoid duplicate summaries
      const isSpeaker =
        (store.phase.endsWith("_a") && studentRole === "A") ||
        (store.phase.endsWith("_b") && studentRole === "B");
      if (!isSpeaker) return;
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
  }, [store.readyCheck, store.readyCheckMessage, store.readyCheckNextPhase, store.phase, studentRole]);

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
      } else if (session.status === "active") {
        // Debate already in progress (e.g. page refresh) — skip consent, rejoin
        const myConsent = studentRole === "A" ? session.consentA : session.consentB;
        if (myConsent) {
          setConsentGiven(true);
          // Fetch Daily.co token to rejoin video
          try {
            const tokenRes = await fetch(`/api/debates/${pairingId}/token`);
            if (tokenRes.ok) {
              const { token } = await tokenRes.json();
              setDailyToken(token);
            } else {
              setTokenError(true);
            }
          } catch {
            setTokenError(true);
          }
          // Restore persisted phase if available, otherwise fallback
          const restoredPhase = session.currentPhase as DebatePhase | null;
          store.setPhase(restoredPhase || "opening_a");
        } else {
          store.setPhase("consent");
        }
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

  // Warn on browser tab close / navigation during active debate
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (store.phase !== "completed" && store.phase !== "waiting" && store.phase !== "consent") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [store.phase]);

  // WebSocket for AI moderator — only connect after consent to prevent sync from skipping consent
  useEffect(() => {
    if (!store.sessionId || !consentGiven) return;
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
        if (phase) {
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
  }, [store.sessionId, consentGiven]);

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

  // Persist current phase to DB on each transition (skip waiting/consent)
  useEffect(() => {
    if (!store.sessionId) return;
    if (store.phase === "waiting" || store.phase === "consent") return;
    fetch(`/api/debates/${pairingId}/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPhase: store.phase }),
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.phase, store.sessionId, pairingId]);

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
    try {
      const tokenRes = await fetch(`/api/debates/${pairingId}/token`);
      if (tokenRes.ok) {
        const { token } = await tokenRes.json();
        setDailyToken(token);
      } else {
        setTokenError(true);
      }
    } catch {
      setTokenError(true);
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

  // Show debate UI once consent is given (even while waiting for opponent)
  const isActiveDebate = store.phase !== "consent";
  const isLobby = store.phase === "consent" && consentGiven;
  const showDebateUi = isActiveDebate || isLobby;

  const isMySpeakingTurn =
    (store.phase.endsWith("_a") && studentRole === "A") ||
    (store.phase.endsWith("_b") && studentRole === "B");

  const showTimedControls =
    isActiveDebate && PHASE_CONFIG[store.phase].duration > 0 && !store.readyCheck;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-gray-900">
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
          onLeave={() => setShowLeaveConfirm(true)}
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

      {/* Phase timeline — shown in lobby (waiting for opponent) and during debate */}
      {showDebateUi && (
        <PhaseTimeline
          currentPhase={isLobby ? "opening_a" : store.phase}
          nameA={studentRole === "A" ? studentName : opponentName}
          nameB={studentRole === "B" ? studentName : opponentName}
        />
      )}

      {/* Lobby banner — waiting for opponent after consent */}
      {isLobby && (
        <div className="flex items-center justify-center gap-2 bg-blue-50 border-b border-blue-200 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-[#1D4F91]" />
          <p className="text-sm text-[#1D4F91]">
            Waiting for your opponent to join...
          </p>
        </div>
      )}

      {/* AI strip — between timeline and video */}
      {showDebateUi && (
        <AiStrip
          phase={isLobby ? "opening_a" : store.phase}
          studentRole={studentRole}
          studentName={studentName}
          opponentName={opponentName}
          opponentThesis={opponentThesis}
          opponentClaims={opponentClaims}
          interventions={store.interventions}
          timeRemaining={isLobby ? PHASE_CONFIG.opening_a.duration : store.timeRemaining}
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

      {/* Video area */}
      <div className="min-h-0 flex-1 max-h-[40vh]">
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
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-gray-900 text-gray-400">
            {tokenError ? (
              <>
                <p className="text-red-400">Failed to connect to video</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-200 hover:bg-gray-700"
                  onClick={async () => {
                    setTokenError(false);
                    try {
                      const tokenRes = await fetch(`/api/debates/${pairingId}/token`);
                      if (tokenRes.ok) {
                        const { token } = await tokenRes.json();
                        setDailyToken(token);
                      } else {
                        setTokenError(true);
                      }
                    } catch {
                      setTokenError(true);
                    }
                  }}
                >
                  Retry
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <p>Connecting to video...</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls bar — mic, cam, +1min, skip, hangup */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <PhoneOff className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Leave Debate?</h3>
            <p className="mt-2 text-sm text-gray-500">
              The debate will end for both you and your opponent. Your progress
              so far will be saved and evaluated.
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Stay
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleLeave}
              >
                Leave Debate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
