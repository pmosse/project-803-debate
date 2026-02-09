"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  DailyProvider,
  useDaily,
  useLocalSessionId,
  useParticipantIds,
  useAudioTrack,
  DailyVideo,
  DailyAudio,
} from "@daily-co/daily-react";
import { Video } from "lucide-react";

interface DailyCallProps {
  roomUrl: string;
  token: string;
  studentRole: "A" | "B";
  micEnabled: boolean;
  camEnabled: boolean;
  wsRef: React.RefObject<WebSocket | null>;
}

export function DailyCall(props: DailyCallProps) {
  return (
    <DailyProvider url={props.roomUrl} token={props.token}>
      <DailyCallInner {...props} />
      <DailyAudio />
    </DailyProvider>
  );
}

function DailyCallInner({
  studentRole,
  micEnabled,
  camEnabled,
  wsRef,
}: DailyCallProps) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const remoteIds = useParticipantIds({ filter: "remote" });
  const localAudio = useAudioTrack(localSessionId ?? "");

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Join on mount, leave on unmount
  useEffect(() => {
    if (!daily) return;
    daily.join();
    return () => {
      daily.leave();
    };
  }, [daily]);

  // Sync mic/cam state
  useEffect(() => {
    if (!daily) return;
    daily.setLocalAudio(micEnabled);
  }, [daily, micEnabled]);

  useEffect(() => {
    if (!daily) return;
    daily.setLocalVideo(camEnabled);
  }, [daily, camEnabled]);

  // Audio capture pipeline: Daily mic track → downsample → base64 → WS
  useEffect(() => {
    const track = localAudio?.persistentTrack;
    if (!track || track.readyState !== "live") return;

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const stream = new MediaStream([track]);
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;

    // ScriptProcessor: 4096 buffer, 1 input channel, 1 output channel
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    const speakerLabel = studentRole === "A" ? "Student A" : "Student B";

    processor.onaudioprocess = (e) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const input = e.inputBuffer.getChannelData(0);
      const targetRate = 16000;
      const ratio = ctx.sampleRate / targetRate;
      const targetLength = Math.floor(input.length / ratio);
      const output = new Int16Array(targetLength);

      for (let i = 0; i < targetLength; i++) {
        const srcIndex = Math.floor(i * ratio);
        // Clamp to [-1, 1] then scale to Int16
        const s = Math.max(-1, Math.min(1, input[srcIndex]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // Base64 encode the Int16Array
      const bytes = new Uint8Array(output.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      ws.send(JSON.stringify({ type: "audio", audio: base64, speaker: speakerLabel }));
    };

    source.connect(processor);
    processor.connect(ctx.destination);

    return () => {
      processor.disconnect();
      source.disconnect();
      ctx.close();
      audioContextRef.current = null;
      processorRef.current = null;
      sourceRef.current = null;
    };
  }, [localAudio?.persistentTrack, studentRole, wsRef]);

  const remoteId = remoteIds[0] ?? null;

  return (
    <div className="grid flex-1 grid-cols-2 gap-2 bg-gray-900 p-2">
      {/* Local video */}
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
          <div className="flex h-full items-center justify-center">
            <Video className="h-12 w-12 text-gray-500 opacity-30" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
          You ({studentRole === "A" ? "Student A" : "Student B"})
        </div>
      </div>

      {/* Remote video */}
      <div className="relative overflow-hidden rounded-lg bg-gray-800">
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
              <p className="mt-2 text-sm">Waiting for opponent...</p>
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white">
          Opponent ({studentRole === "A" ? "Student B" : "Student A"})
        </div>
      </div>
    </div>
  );
}
