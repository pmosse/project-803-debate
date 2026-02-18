"use client";

import { useEffect, useRef, useState } from "react";
import {
  DailyProvider,
  useDaily,
  useLocalSessionId,
  useParticipantIds,
  DailyVideo,
  DailyAudio,
} from "@daily-co/daily-react";
import { Video, AlertTriangle } from "lucide-react";

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
  opponentName: string;
  micEnabled: boolean;
  camEnabled: boolean;
  wsRef: React.RefObject<WebSocket | null>;
  onRemoteJoined?: () => void;
  onTranscript?: (event: TranscriptEvent) => void;
  currentPhase?: string;
}

export function DailyCall(props: DailyCallProps) {
  // If WebRTC is still unavailable after the restoration attempt above,
  // show a clear error instead of letting DailyProvider crash.
  if (typeof window !== "undefined" && !window.RTCPeerConnection) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-900 p-8">
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
  opponentName,
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
  const remoteJoinedFired = useRef(false);

  // Join on mount, start transcription, leave on unmount
  useEffect(() => {
    if (!daily) return;

    let cancelled = false;

    daily
      .join()
      .then(() => {
        if (cancelled) return;
        setJoinError(null);
        // Start Daily.co built-in transcription (powered by Deepgram server-side)
        daily.startTranscription({
          language: "multi",
          model: "nova-2-general",
          profanity_filter: false,
          endpointing: 700,
          punctuate: true,
          extra: { interim_results: true, smart_format: true },
        });
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

  // Fire onRemoteJoined when first remote participant appears
  useEffect(() => {
    if (remoteIds.length > 0 && !remoteJoinedFired.current) {
      remoteJoinedFired.current = true;
      onRemoteJoined?.();
    }
  }, [remoteIds, onRemoteJoined]);

  // Sync mic/cam state
  useEffect(() => {
    if (!daily) return;
    daily.setLocalAudio(micEnabled);
  }, [daily, micEnabled]);

  useEffect(() => {
    if (!daily) return;
    daily.setLocalVideo(camEnabled);
  }, [daily, camEnabled]);

  // Listen for Daily.co built-in transcription events
  useEffect(() => {
    if (!daily || !localSessionId) return;

    const handleTranscriptionMessage = (e: {
      participantId: string;
      text: string;
      rawResponse: Record<string, unknown>;
    }) => {
      const text = e.text;
      if (!text?.trim()) return;

      const is_final = (e.rawResponse?.is_final as boolean) ?? false;
      const isMe = e.participantId === localSessionId;
      const speaker = isMe
        ? (studentRole === "A" ? "Student A" : "Student B")
        : (studentRole === "A" ? "Student B" : "Student A");

      // Forward own speech to backend (avoids duplicates since both clients hear both)
      if (isMe && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "transcript_text",
          speaker,
          text,
          is_final,
        }));
      }

      // Update local UI
      onTranscript?.({ speaker, text, is_final });
    };

    daily.on("transcription-message", handleTranscriptionMessage);
    return () => {
      daily.off("transcription-message", handleTranscriptionMessage);
    };
  }, [daily, localSessionId, studentRole, wsRef, onTranscript]);

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
      <div className="flex flex-1 items-center justify-center bg-gray-900 p-8">
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
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-hidden bg-gray-900 p-2">
      {/* Local video */}
      <div className={`relative overflow-hidden rounded-lg bg-gray-800 transition-all ${
        isMySpeakingTurn ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900" : ""
      }`}>
        {localSessionId ? (
          <DailyVideo
            sessionId={localSessionId}
            type="video"
            mirror
            fit="cover"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Video className="h-12 w-12 text-gray-500 opacity-30" />
          </div>
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
              <Video className="mx-auto h-12 w-12 opacity-30" />
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
