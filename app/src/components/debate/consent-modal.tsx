"use client";

import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

interface ConsentModalProps {
  onAccept: () => void;
}

export function ConsentModal({ onAccept }: ConsentModalProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="max-w-md rounded-lg bg-white p-8 shadow-lg">
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
        <div className="mt-6">
          <Button onClick={onAccept} className="w-full">
            I Consent — Start Debate
          </Button>
        </div>
      </div>
    </div>
  );
}
