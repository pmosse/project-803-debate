"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function ReEvaluateButton({ pairingId }: { pairingId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleClick() {
    if (!confirm("This will delete existing evaluations and re-run the AI scorer. Continue?")) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/debates/${pairingId}/re-evaluate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: "Evaluation complete. Refreshing..." });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult({ ok: false, message: data.error || "Failed" });
      }
    } catch (err) {
      setResult({ ok: false, message: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="gap-1.5"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Evaluating..." : "Re-run Evaluation"}
      </Button>
      {result && (
        <span className={`text-xs ${result.ok ? "text-green-600" : "text-red-600"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}
