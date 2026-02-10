"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useDebateStore, PHASE_CONFIG } from "@/lib/hooks/use-debate-store";
import { PhaseTimer } from "./phase-timer";
import { TranscriptPanel } from "./transcript-panel";
import { AiModeratorBar } from "./ai-moderator-bar";
import { ConsentModal } from "./consent-modal";
import { PhaseOverlay } from "./phase-overlay";
import { DailyCall } from "./daily-call";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff, SkipForward } from "lucide-react";

interface DebateSessionProps {
  pairingId: string;
  assignmentTitle: string;
  roomUrl: string;
  studentRole: "A" | "B";
  studentName: string;
}

export function DebateSession({
  pairingId,
  assignmentTitle,
  roomUrl,
  studentRole,
  studentName,
}: DebateSessionProps) {
  const store = useDebateStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [dailyToken, setDailyToken] = useState<string | null>(null);

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
    if (!moderatorUrl) return;

    const ws = new WebSocket(`${moderatorUrl}/ws/${store.sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "transcript") {
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
        store.advancePhase();
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

    // Start debate if both consented (simplified: start after own consent)
    store.setPhase("opening_a");
    await fetch(`/api/debates/${pairingId}/session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
  }, [store, studentRole, pairingId]);

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

  // Consent screen
  if (store.phase === "consent") {
    return <ConsentModal onAccept={handleConsent} />;
  }

  // Completed screen
  if (store.phase === "completed") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="rounded-lg bg-green-50 p-8">
          <h2 className="text-xl font-semibold text-green-800">
            Debate Completed
          </h2>
          <p className="mt-2 text-green-600">
            Your instructor will review the results.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <span className="text-sm font-medium text-gray-700">
          DEBATE: {assignmentTitle}
        </span>
        <PhaseTimer
          phase={store.phase}
          timeRemaining={store.timeRemaining}
          isGracePeriod={store.isGracePeriod}
        />
      </div>

      {/* Phase overlay */}
      {store.showPhaseOverlay && (
        <PhaseOverlay phase={store.phase} />
      )}

      {/* Video area */}
      {dailyToken && roomUrl ? (
        <DailyCall
          roomUrl={roomUrl}
          token={dailyToken}
          studentRole={studentRole}
          micEnabled={micEnabled}
          camEnabled={camEnabled}
          wsRef={wsRef}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-gray-900 text-gray-400">
          Connecting to video...
        </div>
      )}

      {/* AI Moderator Bar */}
      <AiModeratorBar interventions={store.interventions} />

      {/* Transcript */}
      <TranscriptPanel transcript={store.transcript} />

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
          variant="outline"
          size="sm"
          onClick={() => {
            store.advancePhase();
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "phase_advance" }));
            }
          }}
          disabled={store.phase === "completed"}
          className="gap-1.5"
        >
          <SkipForward className="h-4 w-4" />
          <span className="text-xs">Next Phase</span>
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
