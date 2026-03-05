"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DailyProvider,
  useDaily,
  useLocalSessionId,
  useParticipantIds,
  DailyVideo,
  DailyAudio,
} from "@daily-co/daily-react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface TranscriptEvent {
  speaker: string;
  text: string;
  is_final: boolean;
}

interface DailyCallProps {
  roomUrl: string;
  token: string;
  studentRole: "A" | "B";
  studentName: string;
  studentPhotoUrl?: string | null;
  opponentName: string;
  opponentPhotoUrl?: string | null;
  micEnabled: boolean;
  camEnabled: boolean;
  wsRef: React.RefObject<WebSocket | null>;
  onRemoteJoined?: () => void;
  onTranscript?: (event: TranscriptEvent) => void;
  currentPhase?: string;
}

function AvatarFallback({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (photoUrl) {
    return (
      <div className="flex h-full items-center justify-center">
        <img
          src={photoUrl}
          alt={name}
          className="h-20 w-20 rounded-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-600 text-2xl font-semibold text-white">
        {initials}
      </div>
    </div>
  );
}

export function DailyCall(props: DailyCallProps) {
  // If WebRTC is still unavailable after the restoration attempt above,
  // show a clear error instead of letting DailyProvider crash.
  if (typeof window !== "undefined" && !window.RTCPeerConnection) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900 p-8">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
          <p className="mt-3 text-sm font-medium text-white">
            Video is unavailable
          </p>
          <p className="mt-2 text-xs text-gray-400">
            WebRTC (required for video calls) is not available in this browser.
            Try using an <strong className="text-gray-200">Incognito window</strong> or
            a different browser, then reload.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider url={props.roomUrl} token={props.token}>
      <DailyCallInner {...props} />
      <DailyAudio />
    </DailyProvider>
  );
}

function DailyCallInner({
  studentRole,
  studentName,
  studentPhotoUrl,
  opponentName,
  opponentPhotoUrl,
  micEnabled,
  camEnabled,
  wsRef,
  onRemoteJoined,
  onTranscript,
  currentPhase,
}: DailyCallProps) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const remoteIds = useParticipantIds({ filter: "remote" });
  const [joinError, setJoinError] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionReady, setTranscriptionReady] = useState(false);
  const remoteJoinedFired = useRef(false);
  const remotePresent = useRef(false);
  const dgWsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const currentPhaseRef = useRef(currentPhase);

  // Keep currentPhase ref in sync for use in Deepgram message handler
  useEffect(() => {
    currentPhaseRef.current = currentPhase;
  }, [currentPhase]);

  const mySpeakerLabel = studentRole === "A" ? "Student A" : "Student B";

  // Join Daily.co for video only (no transcription through Daily)
  useEffect(() => {
    if (!daily) return;

    let cancelled = false;

    daily
      .join()
      .then(() => {
        if (cancelled) return;
        setJoinError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          console.error("Daily.co join failed:", err);
          setJoinError(
            err.message?.includes("NotAllowedError")
              ? "Camera/mic permission denied. Please allow access and reload."
              : "Could not connect to video. Try reloading the page."
          );
        }
      });

    return () => {
      cancelled = true;
      daily.leave();
    };
  }, [daily]);

  // Start direct Deepgram transcription
  useEffect(() => {
    let cancelled = false;

    async function startDeepgram() {
      try {
        const res = await fetch("/api/deepgram-token");
        if (!res.ok) {
          setTranscriptionError("Failed to get transcription credentials");
          return;
        }
        const { key } = await res.json();

        // Get mic audio stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;

        // Connect to Deepgram WebSocket directly
        const params = new URLSearchParams({
          model: "nova-3",
          language: "en",
          punctuate: "true",
          interim_results: "true",
          endpointing: "700",
          smart_format: "true",
          utterance_end_ms: "2500",
          vad_events: "true",
        });
        const dgWs = new WebSocket(
          `wss://api.deepgram.com/v1/listen?${params}`,
          ["token", key]
        );
        dgWsRef.current = dgWs;

        dgWs.onopen = () => {
          if (cancelled) {
            dgWs.close();
            return;
          }
          setTranscriptionReady(true);

          // Start sending audio via MediaRecorder
          const recorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
          });
          recorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && dgWs.readyState === WebSocket.OPEN) {
              dgWs.send(e.data);
            }
          };
          recorder.start(250); // 250ms chunks
        };

        dgWs.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "Results") {
            const alt = data.channel?.alternatives?.[0];
            if (!alt?.transcript) return;

            const text = alt.transcript.trim();
            if (!text) return;
            const isFinal = data.is_final;

            if (isFinal) {
              // Send final transcript to backend via moderator WebSocket
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: "transcript_text",
                  speaker: mySpeakerLabel,
                  text,
                  is_final: true,
                }));
              }
              onTranscript?.({ speaker: mySpeakerLabel, text, is_final: true });
            } else {
              // Send interim to backend for real-time display
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: "transcript_text",
                  speaker: mySpeakerLabel,
                  text,
                  is_final: false,
                }));
              }
              onTranscript?.({ speaker: mySpeakerLabel, text, is_final: false });
            }
          }
        };

        dgWs.onerror = () => {
          setTranscriptionError("Deepgram connection error. AI coaching may not work.");
        };

        dgWs.onclose = () => {
          if (!cancelled) {
            setTranscriptionReady(false);
          }
        };
      } catch (err) {
        console.error("Deepgram setup failed:", err);
        setTranscriptionError("Failed to start transcription. Check mic permissions.");
      }
    }

    startDeepgram();

    return () => {
      cancelled = true;
      recorderRef.current?.stop();
      recorderRef.current = null;
      if (dgWsRef.current?.readyState === WebSocket.OPEN) {
        dgWsRef.current.send(JSON.stringify({ type: "CloseStream" }));
        dgWsRef.current.close();
      }
      dgWsRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire onRemoteJoined only when both remote participant is present AND transcription is ready
  useEffect(() => {
    if (remoteIds.length > 0) {
      remotePresent.current = true;
    }
    if (remotePresent.current && transcriptionReady && !remoteJoinedFired.current) {
      remoteJoinedFired.current = true;
      onRemoteJoined?.();
    }
  }, [remoteIds, transcriptionReady, onRemoteJoined]);

  // Sync mic/cam state — gate mic until transcription is ready
  useEffect(() => {
    if (!daily) return;
    daily.setLocalAudio(micEnabled && transcriptionReady);
    // Also mute/unmute the Deepgram mic stream
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = micEnabled && transcriptionReady;
      });
    }
  }, [daily, micEnabled, transcriptionReady]);

  useEffect(() => {
    if (!daily) return;
    daily.setLocalVideo(camEnabled);
  }, [daily, camEnabled]);

  // Handle opponent's transcript relayed via backend WebSocket
  // (opponent's Deepgram runs on their client; backend broadcasts to us)
  // This is handled in debate-session.tsx's ws.onmessage for type "transcript"

  const remoteId = remoteIds[0] ?? null;

  const myFirstName = studentName.split(" ")[0];
  const theirFirstName = opponentName.split(" ")[0];

  // Determine who is the active speaker based on phase suffix
  const isMySpeakingTurn = currentPhase
    ? (currentPhase.endsWith("_a") && studentRole === "A") ||
      (currentPhase.endsWith("_b") && studentRole === "B")
    : false;
  const isTheirSpeakingTurn = currentPhase
    ? (currentPhase.endsWith("_a") && studentRole === "B") ||
      (currentPhase.endsWith("_b") && studentRole === "A")
    : false;

  // Error state
  if (joinError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-900 p-8">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
          <p className="mt-3 text-sm text-gray-300">{joinError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative grid h-full min-h-0 grid-cols-2 gap-2 overflow-hidden bg-gray-900 p-2">
      {/* Transcription initializing overlay */}
      {!transcriptionReady && !transcriptionError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-white" />
            <p className="mt-3 text-sm font-medium text-white">Connecting to Deepgram Nova-3...</p>
            <p className="mt-1 text-xs text-gray-400">This should only take a few seconds</p>
          </div>
        </div>
      )}
      {/* Transcription error banner */}
      {transcriptionError && (
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-amber-500/90 px-3 py-2 text-sm text-white backdrop-blur-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{transcriptionError}</span>
        </div>
      )}
      {/* Local video */}
      <div className={`relative overflow-hidden rounded-lg bg-gray-800 transition-all ${
        isMySpeakingTurn ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900" : ""
      }`}>
        {localSessionId ? (
          <>
            <DailyVideo
              sessionId={localSessionId}
              type="video"
              mirror
              fit="cover"
              className="h-full w-full object-cover"
            />
            {!camEnabled && (
              <div className="absolute inset-0">
                <AvatarFallback name={studentName} photoUrl={studentPhotoUrl} />
              </div>
            )}
          </>
        ) : (
          <AvatarFallback name={studentName} photoUrl={studentPhotoUrl} />
        )}
        <div className={`absolute bottom-2 left-2 rounded px-2 py-1 text-xs text-white ${
          isMySpeakingTurn ? "bg-yellow-500/80" : "bg-black/50"
        }`}>
          {isMySpeakingTurn ? `You · ${myFirstName} (speaking)` : `You · ${myFirstName}`}
        </div>
      </div>

      {/* Remote video */}
      <div className={`relative overflow-hidden rounded-lg bg-gray-800 transition-all ${
        isTheirSpeakingTurn ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900" : ""
      }`}>
        {remoteId ? (
          <DailyVideo
            sessionId={remoteId}
            type="video"
            fit="cover"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <AvatarFallback name={opponentName} photoUrl={opponentPhotoUrl} />
              <p className="mt-2 text-sm">Waiting for {theirFirstName}...</p>
            </div>
          </div>
        )}
        <div className={`absolute bottom-2 left-2 rounded px-2 py-1 text-xs text-white ${
          isTheirSpeakingTurn ? "bg-yellow-500/80" : "bg-black/50"
        }`}>
          {isTheirSpeakingTurn ? `${theirFirstName} (speaking)` : theirFirstName}
        </div>
      </div>
    </div>
  );
}
