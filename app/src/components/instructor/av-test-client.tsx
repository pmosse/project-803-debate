"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DailyProvider,
  useDaily,
  useLocalSessionId,
  DailyVideo,
} from "@daily-co/daily-react";
import { Mic, MicOff, Camera, CameraOff, Phone, PhoneOff, Pause, Play } from "lucide-react";

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
      const res = await fetch("/api/professor/test-room", { method: "POST" });
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
      fetch("/api/professor/test-room", {
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
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const [finals, setFinals] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState<TranscriptLine | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [summarizing, setSummarizing] = useState(false);
  const finalsRef = useRef<TranscriptLine[]>([]);
  const lastSummarizedCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dgWsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

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

  // Join Daily.co for video (no transcription through Daily)
  useEffect(() => {
    if (!daily) return;
    let cancelled = false;

    daily
      .join()
      .then(() => {
        if (cancelled) return;
      })
      .catch((err: Error) => {
        console.error("Join failed:", err);
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
        // Get Deepgram API key from server
        const res = await fetch("/api/professor/test-room/deepgram-token");
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

        // Connect to Deepgram WebSocket
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
          setMicOn(true);

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

          // Handle transcription results
          if (data.type === "Results") {
            const alt = data.channel?.alternatives?.[0];
            if (!alt?.transcript) return;

            const text = alt.transcript.trim();
            if (!text) return;
            const isFinal = data.is_final;

            if (isFinal) {
              // Deepgram says this utterance is final — commit it
              setInterim(null);
              setFinals((prev) => [
                ...prev,
                { speaker: "You", text, isFinal: true },
              ]);
            } else {
              // Interim result — show as in-progress
              setInterim({ speaker: "You", text, isFinal: false });
            }
          }
        };

        dgWs.onerror = () => {
          setTranscriptionError("Deepgram connection error. Transcription may not work.");
        };

        dgWs.onclose = () => {
          // Only set error if we didn't intentionally close
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
        // Send close signal to Deepgram
        dgWsRef.current.send(JSON.stringify({ type: "CloseStream" }));
        dgWsRef.current.close();
      }
      dgWsRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    };
  }, []);

  // Cam toggle
  useEffect(() => {
    daily?.setLocalVideo(camOn);
  }, [daily, camOn]);

  // Mic toggle — control both Daily.co audio and MediaRecorder
  useEffect(() => {
    daily?.setLocalAudio(micOn);
    // Mute/unmute the mic stream feeding Deepgram
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = micOn;
      });
    }
  }, [daily, micOn]);

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
            fetch("/api/professor/test-room/summarize", {
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
    recorderRef.current?.stop();
    if (dgWsRef.current?.readyState === WebSocket.OPEN) {
      dgWsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      dgWsRef.current.close();
    }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    daily?.leave();
    onEnd();
  }

  // Simulated phase info for the test page
  const simulatedPhase = "Opening — Student A";
  const aiSuggestion = "Present your thesis and key arguments. Reference the assigned readings to support your position.";

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-gray-900">
      {/* Phase timeline bar */}
      <div className="overflow-x-auto bg-white/95 border-b px-3 py-2 scrollbar-hide">
        <div className="flex items-center justify-start sm:justify-center gap-1 min-w-max">
          {["Opening A", "Opening B", "Cross-Exam A", "Rebuttal B", "Cross-Exam B", "Rebuttal A", "Closing B", "Closing A"].map((label, idx) => (
            <div key={label} className="flex items-center">
              <div className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-medium whitespace-nowrap ${
                idx === 0
                  ? "bg-[#1D4F91] text-white"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {label}
              </div>
              {idx < 7 && (
                <div className="mx-0.5 h-px w-3 bg-gray-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI suggestion strip */}
      <div className="border-l-4 border-l-[#1D4F91] bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1">
            You, your turn
          </span>
          <span className="shrink-0 rounded px-2 py-0.5 font-mono text-sm font-bold text-white bg-green-600">
            2:00
          </span>
        </div>
        <p className="text-sm leading-snug text-gray-700">{aiSuggestion}</p>
      </div>

      {/* Paused banner */}
      {paused && (
        <div className="flex items-center justify-center gap-2 bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white">
          <Pause className="h-4 w-4" />
          Paused — timer stopped
        </div>
      )}

      {/* Video area — Google Meet style */}
      <div className="min-h-0 flex-1 relative overflow-hidden">
        {/* Transcription initializing overlay */}
        {!transcriptionReady && !transcriptionError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <p className="mt-3 text-sm font-medium text-white">Connecting to Deepgram Nova-3...</p>
              <p className="mt-1 text-xs text-gray-400">This should only take a few seconds</p>
            </div>
          </div>
        )}
        {transcriptionError && (
          <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-amber-500/90 px-3 py-2 text-sm text-white backdrop-blur-sm">
            {transcriptionError}
          </div>
        )}

        {paused ? (
          /* Paused: 50/50 split */
          <div className="grid h-full grid-cols-2 gap-2 p-2">
            {/* "Opponent" — show local video as stand-in */}
            <div className="relative overflow-hidden rounded-lg bg-gray-800">
              {localSessionId ? (
                <DailyVideo
                  sessionId={localSessionId}
                  type="video"
                  fit="cover"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  <Camera className="h-12 w-12 opacity-30" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
                Opponent (Demo)
              </div>
            </div>
            {/* Self */}
            <div className="relative overflow-hidden rounded-lg bg-gray-800">
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
          </div>
        ) : (
          /* Active: opponent big, self PiP */
          <div className="h-full p-2">
            {/* Big video — "opponent" (using local video as demo) */}
            <div className="relative h-full overflow-hidden rounded-lg bg-gray-800">
              {localSessionId ? (
                <DailyVideo
                  sessionId={localSessionId}
                  type="video"
                  fit="cover"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  <Camera className="h-12 w-12 opacity-30" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 rounded bg-yellow-500/80 px-2 py-1 text-xs text-white">
                Opponent (Demo) · speaking
              </div>

              {/* PiP — self, bottom-right corner */}
              <div className="absolute bottom-2 right-2 w-[120px] sm:w-[160px] aspect-[4/3] overflow-hidden rounded-lg border-2 border-white/20 bg-gray-800 shadow-lg">
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
                    <Camera className="h-6 w-6 opacity-30" />
                  </div>
                )}
                <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                  You
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 bg-gray-900 px-3 sm:px-4 py-2 sm:py-2.5">
        <button
          onClick={() => setMicOn(!micOn)}
          className={`rounded-full p-3 ${
            micOn
              ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
        >
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setCamOn(!camOn)}
          className={`rounded-full p-3 ${
            camOn
              ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
        >
          {camOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
        </button>

        <div className="mx-1 h-6 w-px bg-gray-700" />

        <button
          onClick={() => setPaused(!paused)}
          className={`rounded-full p-3 ${
            paused
              ? "bg-yellow-600 text-white hover:bg-yellow-500"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <div className="mx-1 h-6 w-px bg-gray-700" />

        <button
          onClick={handleEnd}
          className="rounded-full bg-red-500 p-3 text-white hover:bg-red-600"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>

      {/* Transcript + Summary panel — collapsible drawer at bottom on mobile, side panel on desktop */}
      <div className="bg-gray-800 border-t border-gray-700 max-h-[30vh] overflow-y-auto">
        <div className="grid gap-0 lg:grid-cols-2">
          {/* Transcript */}
          <div className="border-b lg:border-b-0 lg:border-r border-gray-700">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <h2 className="text-xs font-semibold text-gray-300">Live Transcript</h2>
              {transcriptionReady && (
                <span className="rounded bg-green-900/50 px-2 py-0.5 text-[10px] font-medium text-green-400">
                  Nova-3
                </span>
              )}
            </div>
            <div
              ref={scrollRef}
              className="h-32 lg:h-40 overflow-y-auto px-3 py-2"
            >
              {finals.length === 0 && !interim ? (
                <p className="py-4 text-center text-xs text-gray-500">
                  Live transcript will appear here...
                </p>
              ) : (
                <div className="space-y-1">
                  {finals.map((entry, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-medium text-blue-400">You:</span>{" "}
                      <span className="text-gray-300">{entry.text}</span>
                    </div>
                  ))}
                  {interim && (
                    <div className="text-xs opacity-50">
                      <span className="font-medium text-blue-400">You:</span>{" "}
                      <span className="italic text-gray-400">{interim.text}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* AI Summary */}
          <div>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
              <h2 className="text-xs font-semibold text-gray-300">AI Summary</h2>
              <span className="text-[10px] tabular-nums text-gray-500">
                {summarizing ? "Summarizing..." : `Next in ${countdown}s`}
              </span>
            </div>
            <div className="px-3 py-2 h-32 lg:h-40 overflow-y-auto">
              {summaryError && (
                <p className="mb-2 text-xs text-red-400">{summaryError}</p>
              )}
              {summary ? (
                <div className="whitespace-pre-wrap text-xs text-gray-300">{summary}</div>
              ) : (
                <p className="text-xs text-gray-500">
                  Speak for a bit — a summary will appear after the countdown.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
