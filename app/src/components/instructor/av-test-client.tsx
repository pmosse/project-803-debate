"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DailyProvider,
  useDaily,
  useLocalSessionId,
  DailyVideo,
} from "@daily-co/daily-react";
import { Mic, MicOff, Camera, CameraOff, Phone, PhoneOff } from "lucide-react";

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

interface TranscriptLine {
  speaker: string;
  text: string;
  isFinal: boolean;
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
  const [transcriptionReady, setTranscriptionReady] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [finals, setFinals] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState<TranscriptLine | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [summarizing, setSummarizing] = useState(false);
  const finalsRef = useRef<TranscriptLine[]>([]);
  const lastSummarizedCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync
  useEffect(() => {
    finalsRef.current = finals;
  }, [finals]);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [finals, interim]);

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

  // Listen for transcription-started to know when Deepgram is ready
  useEffect(() => {
    if (!daily) return;
    const handleStarted = () => {
      setTranscriptionReady(true);
      setMicOn(true);
    };
    (daily as any).on("transcription-started", handleStarted);
    return () => {
      (daily as any).off("transcription-started", handleStarted);
    };
  }, [daily]);

  // Promote current interim to final (called by timeout)
  const promoteInterim = useCallback(() => {
    setInterim((cur) => {
      if (cur) {
        setFinals((prev) => [...prev, { ...cur, isFinal: true }]);
      }
      return null;
    });
  }, []);

  // Listen for transcription messages
  // Daily.co events here have no rawResponse, so we use a timeout to
  // promote interim text to final when speech pauses for 1.5 seconds.
  const handleTranscription = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      const text = e.text;
      if (!text?.trim()) return;

      const line: TranscriptLine = { speaker: "You", text, isFinal: false };

      // Clear any pending promotion timer
      if (interimTimerRef.current) {
        clearTimeout(interimTimerRef.current);
        interimTimerRef.current = null;
      }

      setInterim(line);
      // If no new event in 1.5s, promote this interim to final
      interimTimerRef.current = setTimeout(promoteInterim, 1500);
    },
    [promoteInterim]
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

  // Single interval: countdown + trigger summary (only runs once transcription is ready)
  useEffect(() => {
    if (!transcriptionReady) return;
    setCountdown(30); // reset countdown when transcription becomes ready
    const tick = setInterval(async () => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Fire summary
          const entries = finalsRef.current;
          if (entries.length > 0 && entries.length !== lastSummarizedCountRef.current) {
            lastSummarizedCountRef.current = entries.length;
            const text = entries.map((e) => `${e.speaker}: ${e.text}`).join("\n");

            setSummarizing(true);
            setSummaryError(null);
            fetch("/api/instructor/test-room/summarize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transcript: text }),
            })
              .then(async (res) => {
                if (!res.ok) {
                  const body = await res.text();
                  throw new Error(`${res.status}: ${body}`);
                }
                return res.json();
              })
              .then((data) => setSummary(data.summary))
              .catch((err) => {
                console.error("Summary failed:", err);
                setSummaryError(err.message || "Failed to generate summary");
              })
              .finally(() => setSummarizing(false));
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => clearInterval(tick);
  }, [transcriptionReady]);

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
          {!transcriptionReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <p className="mt-3 text-sm font-medium text-white">Starting transcription...</p>
                <p className="mt-1 text-xs text-gray-400">This takes about 15 seconds</p>
              </div>
            </div>
          )}
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
          <div
            ref={scrollRef}
            className="h-64 overflow-y-auto bg-gray-50 px-4 py-2"
          >
            {finals.length === 0 && !interim ? (
              <p className="py-4 text-center text-sm text-gray-400">
                Live transcript will appear here...
              </p>
            ) : (
              <div className="space-y-1">
                {finals.map((entry, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium text-[#1D4F91]">You:</span>{" "}
                    <span className="text-gray-700">{entry.text}</span>
                  </div>
                ))}
                {interim && (
                  <div className="text-sm opacity-50">
                    <span className="font-medium text-[#1D4F91]">You:</span>{" "}
                    <span className="italic text-gray-500">{interim.text}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI Summary */}
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <h2 className="text-sm font-semibold text-gray-700">AI Summary</h2>
            <span className="text-xs tabular-nums text-gray-400">
              {summarizing ? "Summarizing..." : `Next in ${countdown}s`}
            </span>
          </div>
          <div className="p-4">
            {summaryError && (
              <p className="mb-2 text-sm text-red-500">{summaryError}</p>
            )}
            {summary ? (
              <div className="whitespace-pre-wrap text-sm text-gray-700">{summary}</div>
            ) : (
              <p className="text-sm text-gray-400">
                Speak for a bit — a summary will appear after the countdown.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
