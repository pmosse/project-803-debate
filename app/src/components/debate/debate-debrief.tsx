"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2 } from "lucide-react";

interface DebateDebriefProps {
  pairingId: string;
}

export function DebateDebrief({ pairingId }: DebateDebriefProps) {
  const [debrief, setDebrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchDebrief() {
      try {
        const res = await fetch(`/api/debates/${pairingId}/debrief`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setDebrief(data.debrief);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchDebrief();
  }, [pairingId]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="w-full max-w-lg space-y-4">
        <div className="rounded-lg bg-green-50 p-8">
          <h2 className="text-xl font-semibold text-green-800">
            Debate Completed
          </h2>
          <p className="mt-2 text-green-600">
            Your instructor will review the results.
          </p>
        </div>

        <div className="rounded-lg border border-green-200 bg-white p-6 text-left">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-green-800">
              AI Debrief
            </h3>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating your personalized feedback...
            </div>
          )}

          {error && (
            <p className="text-sm text-gray-500">
              Feedback is not available right now. Check back later.
            </p>
          )}

          {debrief && (
            <p className="text-sm leading-relaxed text-gray-700">{debrief}</p>
          )}
        </div>
      </div>
    </div>
  );
}
