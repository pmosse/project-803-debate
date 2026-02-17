"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/lib/hooks/use-debate-store";

interface TranscriptPanelProps {
  transcript: TranscriptEntry[];
  nameA?: string;
  nameB?: string;
}

function mapSpeaker(speaker: string, nameA?: string, nameB?: string): string {
  if (!nameA && !nameB) return speaker;
  const firstA = nameA ? nameA.split(" ")[0] : "Student A";
  const firstB = nameB ? nameB.split(" ")[0] : "Student B";
  if (speaker === "Student A") return firstA;
  if (speaker === "Student B") return firstB;
  return speaker;
}

export function TranscriptPanel({ transcript, nameA, nameB }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const finalEntries = transcript.filter((t) => t.isFinal);
  const interimEntry = transcript.find((t) => !t.isFinal);

  return (
    <div
      ref={scrollRef}
      className="h-32 overflow-y-auto border-t bg-gray-50 px-4 py-2"
    >
      {finalEntries.length === 0 && !interimEntry ? (
        <p className="py-4 text-center text-sm text-gray-400">
          Live transcript will appear here...
        </p>
      ) : (
        <div className="space-y-1">
          {finalEntries.map((entry, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium text-[#1D4F91]">
                {mapSpeaker(entry.speaker, nameA, nameB)}:
              </span>{" "}
              <span className="text-gray-700">{entry.text}</span>
            </div>
          ))}
          {interimEntry && (
            <div className="text-sm opacity-50">
              <span className="font-medium text-[#1D4F91]">
                {mapSpeaker(interimEntry.speaker, nameA, nameB)}:
              </span>{" "}
              <span className="text-gray-500 italic">{interimEntry.text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
