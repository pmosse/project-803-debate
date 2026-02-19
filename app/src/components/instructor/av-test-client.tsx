"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DailyProvider,
  useDaily,
  useLocalSessionId,
  DailyVideo,
} from "@daily-co/daily-react";
import { Mic, MicOff, Camera, CameraOff, Phone, PhoneOff } from "lucide-react";
import { TranscriptPanel } from "@/components/debate/transcript-panel";
import type { TranscriptEntry } from "@/lib/hooks/use-debate-store";

interface RoomInfo {
  roomUrl: string;
  roomName: string;
  token: string;
}

export function AvTestClient() {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    try {
      const res = await fetch("/api/instructor/test-room", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create room");
      const data = await res.json();
      setRoom(data);
    } catch (err) {
      console.error(err);
      alert("Failed to create test room. Check console for details.");
    } finally {
      setStarting(false);
    }
  }

  function handleEnd() {
    if (room) {
      fetch("/api/instructor/test-room", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName: room.roomName }),
      }).catch(console.error);
    }
    setRoom(null);
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-white p-12">
        <p className="mb-4 text-sm text-gray-500">
          Test your camera, microphone, and live transcription in a solo sandbox.
        </p>
        <button
          onClick={handleStart}
          disabled={starting}
          className="flex items-center gap-2 rounded-lg bg-[#1D4F91] px-6 py-3 text-sm font-medium text-white hover:bg-[#163d73] disabled:opacity-50"
        >
          <Phone className="h-4 w-4" />
          {starting ? "Starting..." : "Start Test"}
        </button>
      </div>
    );
  }

  return (
    <DailyProvider url={room.roomUrl} token={room.token}>
      <AvTestInner roomName={room.roomName} onEnd={handleEnd} />
    </DailyProvider>
  );
}

function AvTestInner({
  roomName,
  onEnd,
}: {
  roomName: string;
  onEnd: () => void;
}) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const lastSummarizedRef = useRef(0);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  // Keep ref in sync
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Join + start transcription
  useEffect(() => {
    if (!daily) return;
    let cancelled = false;

    daily
      .join()
      .then(() => {
        if (cancelled) return;
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
        console.error("Join failed:", err);
      });

    return () => {
      cancelled = true;
      daily.leave();
    };
  }, [daily]);

  // Listen for transcription messages
  const handleTranscription = useCallback(
    (e: { participantId: string; text: string; rawResponse: Record<string, unknown> }) => {
      const text = e.text;
      if (!text?.trim()) return;

      const isFinal = (e.rawResponse?.is_final as boolean) ?? false;

      setTranscript((prev) => {
        if (isFinal) {
          // Replace any interim entry, add final
          const withoutInterim = prev.filter((t) => t.isFinal);
          return [
            ...withoutInterim,
            { speaker: "You", text, timestamp: Date.now(), phase: "test", isFinal: true },
          ];
        }
        // Update interim
        const finals = prev.filter((t) => t.isFinal);
        return [
          ...finals,
          { speaker: "You", text, timestamp: Date.now(), phase: "test", isFinal: false },
        ];
      });
    },
    []
  );

  useEffect(() => {
    if (!daily) return;
    daily.on("transcription-message", handleTranscription);
    return () => {
      daily.off("transcription-message", handleTranscription);
    };
  }, [daily, handleTranscription]);

  // Mic/cam toggles
  useEffect(() => {
    daily?.setLocalAudio(micOn);
  }, [daily, micOn]);

  useEffect(() => {
    daily?.setLocalVideo(camOn);
  }, [daily, camOn]);

  // AI summary every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const entries = transcriptRef.current.filter((t) => t.isFinal);
      if (entries.length === 0 || entries.length === lastSummarizedRef.current) return;

      lastSummarizedRef.current = entries.length;
      const text = entries.map((e) => `${e.speaker}: ${e.text}`).join("\n");

      try {
        const res = await fetch("/api/instructor/test-room/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: text }),
        });
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary);
        }
      } catch (err) {
        console.error("Summary failed:", err);
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  function handleEnd() {
    daily?.leave();
    onEnd();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Left column: video + controls */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="relative aspect-video bg-gray-900">
          {localSessionId ? (
            <DailyVideo
              sessionId={localSessionId}
              type="video"
              mirror
              fit="cover"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              <Camera className="h-12 w-12 opacity-30" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
            You (Instructor)
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 border-t p-3">
          <button
            onClick={() => setMicOn(!micOn)}
            className={`rounded-full p-3 ${
              micOn
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                : "bg-red-100 text-red-600 hover:bg-red-200"
            }`}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setCamOn(!camOn)}
            className={`rounded-full p-3 ${
              camOn
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                : "bg-red-100 text-red-600 hover:bg-red-200"
            }`}
          >
            {camOn ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
          </button>
          <button
            onClick={handleEnd}
            className="rounded-full bg-red-500 p-3 text-white hover:bg-red-600"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Right column: transcript + summary */}
      <div className="flex flex-col gap-4">
        {/* Transcript */}
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b px-4 py-2">
            <h2 className="text-sm font-semibold text-gray-700">Live Transcript</h2>
          </div>
          <div className="h-64">
            <TranscriptPanel transcript={transcript} nameA="You" />
          </div>
        </div>

        {/* AI Summary */}
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b px-4 py-2">
            <h2 className="text-sm font-semibold text-gray-700">AI Summary</h2>
          </div>
          <div className="p-4">
            {summary ? (
              <div className="whitespace-pre-wrap text-sm text-gray-700">{summary}</div>
            ) : (
              <p className="text-sm text-gray-400">
                A summary will appear after 30 seconds of speech...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
