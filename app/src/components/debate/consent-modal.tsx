"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Bot,
  Clock,
  Mic,
  BookOpen,
  Video,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ConsentModalProps {
  onAccept: () => void;
}

const PHASES = [
  { name: "Opening Statements", time: "2 min each", desc: "Present your thesis and key arguments" },
  { name: "Cross-Examination", time: "3 min each", desc: "Question your opponent on their claims" },
  { name: "Rebuttals", time: "1 min each", desc: "Address your opponent's strongest points" },
  { name: "Closing Statements", time: "30 sec each", desc: "Summarize why your position is stronger" },
];

export function ConsentModal({ onAccept }: ConsentModalProps) {
  const [step, setStep] = useState<"info" | "consent">("info");
  const [techOpen, setTechOpen] = useState(false);

  if (step === "info") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-lg">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1D4F91]/10">
              <BookOpen className="h-6 w-6 text-[#1D4F91]" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">How This Debate Works</h2>
            <p className="mt-1 text-sm text-gray-500">~13 minutes total</p>
          </div>

          {/* Phases */}
          <div className="mb-6 space-y-2">
            {PHASES.map((phase, i) => (
              <div key={phase.name} className="flex items-start gap-3 rounded-lg bg-gray-50 px-4 py-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1D4F91] text-xs font-bold text-white">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{phase.name}</span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {phase.time}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{phase.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI Moderator info */}
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <Bot className="h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">AI Moderator</p>
                <p className="mt-0.5 text-xs text-blue-700">
                  An AI moderator listens throughout the debate. It may suggest follow-up
                  questions, flag inaccurate claims against the readings, and nudge you if
                  there's a long silence. After the debate, you'll receive personalized feedback.
                </p>
              </div>
            </div>
          </div>

          {/* Tech stack collapsible */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50">
            <button
              onClick={() => setTechOpen(!techOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm font-medium text-gray-700">Technology behind this platform</span>
              {techOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {techOpen && (
              <div className="border-t border-gray-200 px-4 py-3">
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-start gap-2">
                    <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span><strong>Daily.co</strong> — live video and audio conferencing</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span><strong>Deepgram Nova-3</strong> — real-time speech-to-text transcription</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span><strong>Claude (Anthropic)</strong> — AI moderation, fact-checking, and post-debate feedback</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span><strong>RAG + pgvector</strong> — reading passages indexed for real-time fact verification</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button onClick={() => setStep("consent")} className="w-full gap-2">
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Consent step
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <Shield className="h-6 w-6 text-[#1D4F91]" />
          <h2 className="text-xl font-semibold">Before We Begin</h2>
        </div>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            This debate session will be <strong>recorded</strong> and{" "}
            <strong>transcribed</strong> for educational purposes.
          </p>
          <p>
            The recording and transcript will be available to your instructor
            for assessment. The AI moderator will analyze the conversation in
            real-time.
          </p>
          <p>By proceeding, you consent to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Audio and video recording of this session</li>
            <li>Real-time speech-to-text transcription</li>
            <li>AI analysis of your debate performance</li>
          </ul>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => setStep("info")} className="flex-1">
            Back
          </Button>
          <Button onClick={onAccept} className="flex-1">
            I Consent — Join Debate
          </Button>
        </div>
      </div>
    </div>
  );
}
