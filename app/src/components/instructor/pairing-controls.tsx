"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Send, ExternalLink, Copy, Check, RotateCcw } from "lucide-react";

interface PairingControlsProps {
  assignmentId: string;
  analyzedCount: number;
  existingPairings: any[];
  students: { id: string; name: string; email?: string | null }[];
}

export function PairingControls({
  assignmentId,
  analyzedCount,
  existingPairings,
  students,
}: PairingControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const studentMap = new Map(students.map((s) => [s.id, s]));

  async function handleGeneratePairings() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInvitations() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pairings/send-invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) throw new Error("Failed to send invitations");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPairing(pairingId: string) {
    setResettingId(pairingId);
    try {
      const res = await fetch(`/api/pairings/${pairingId}/reset`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reset");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResettingId(null);
    }
  }

  function copyLink(pairingId: string) {
    const url = `${window.location.origin}/debate/${pairingId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(pairingId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      {existingPairings.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <div className="text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="mb-2 text-sm text-gray-500">
                {analyzedCount} memos analyzed. Generate pairings using Claude AI to match
                students by lines of argumentation.
              </p>
              <p className="mb-4 text-xs text-gray-400">
                Students will be clustered by their specific arguments, not just their overall position.
              </p>
              <Button
                onClick={handleGeneratePairings}
                disabled={loading || analyzedCount < 2}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing arguments...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    Generate Pairings with AI
                  </>
                )}
              </Button>
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              {existingPairings.length} Pairs
            </h3>
            <Button onClick={handleSendInvitations} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Invitations
                </>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {existingPairings.map((p: any, i: number) => {
              const studentA = studentMap.get(p.studentAId);
              const studentB = studentMap.get(p.studentBId);
              const debateUrl = `/debate/${p.id}`;

              return (
                <Card key={p.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Pair {i + 1}
                          </span>
                          <StatusBadge status={p.status} />
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-900">
                            {studentA?.name || "Unknown"}
                          </span>
                          <span className="text-gray-400">vs</span>
                          <span className="font-medium text-gray-900">
                            {studentB?.name || "Unknown"}
                          </span>
                        </div>

                        {p.matchmakingReason && (
                          <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                            {p.matchmakingReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(p.status === "completed" || p.status === "in_progress" || p.status === "no_show") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetPairing(p.id)}
                            disabled={resettingId === p.id}
                            className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                          >
                            {resettingId === p.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-3 w-3" />
                                Reset
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLink(p.id)}
                          className="text-xs"
                        >
                          {copiedId === p.id ? (
                            <>
                              <Check className="h-3 w-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy Link
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="text-xs"
                        >
                          <a
                            href={debateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {result?.unpaired?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-yellow-700">
              Unpaired Students ({result.unpaired.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              These students could not be paired. Consider manually assigning them.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
