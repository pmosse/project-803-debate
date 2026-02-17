import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  users,
  memos,
  pairings,
  assignments,
  debateSessions,
  evaluations,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EvaluationRadar } from "@/components/instructor/evaluation-radar";
import { ArrowLeft } from "lucide-react";

export default async function DebateDetailPage({
  params,
}: {
  params: Promise<{ pairingId: string }>;
}) {
  const { pairingId } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  if ((session.user as any).role !== "instructor") redirect("/dashboard");

  // Fetch pairing
  const [pairing] = await db
    .select()
    .from(pairings)
    .where(eq(pairings.id, pairingId))
    .limit(1);

  if (!pairing) redirect("/instructor/dashboard");

  // Fetch assignment, students, memos, debate session, evaluations in parallel
  const [
    [assignment],
    [studentA],
    [studentB],
    [debateSession],
  ] = await Promise.all([
    db.select().from(assignments).where(eq(assignments.id, pairing.assignmentId)).limit(1),
    db.select().from(users).where(eq(users.id, pairing.studentAId)).limit(1),
    db.select().from(users).where(eq(users.id, pairing.studentBId)).limit(1),
    db.select().from(debateSessions).where(eq(debateSessions.pairingId, pairingId)).limit(1),
  ]);

  const [memoA, memoB] = await Promise.all([
    db.select().from(memos).where(and(eq(memos.assignmentId, pairing.assignmentId), eq(memos.studentId, pairing.studentAId))).limit(1).then(r => r[0] || null),
    db.select().from(memos).where(and(eq(memos.assignmentId, pairing.assignmentId), eq(memos.studentId, pairing.studentBId))).limit(1).then(r => r[0] || null),
  ]);

  let evalA = null;
  let evalB = null;
  if (debateSession) {
    [evalA, evalB] = await Promise.all([
      db.select().from(evaluations).where(and(eq(evaluations.debateSessionId, debateSession.id), eq(evaluations.studentId, pairing.studentAId))).limit(1).then(r => r[0] || null),
      db.select().from(evaluations).where(and(eq(evaluations.debateSessionId, debateSession.id), eq(evaluations.studentId, pairing.studentBId))).limit(1).then(r => r[0] || null),
    ]);
  }

  const nameA = studentA?.name || "Student A";
  const nameB = studentB?.name || "Student B";
  const firstNameA = nameA.split(" ")[0];
  const firstNameB = nameB.split(" ")[0];

  const transcript = (debateSession?.transcript || []) as {
    speaker: string;
    text: string;
    timestamp: number;
    phase: string;
  }[];

  function mapSpeaker(speaker: string): string {
    if (speaker === "Student A") return firstNameA;
    if (speaker === "Student B") return firstNameB;
    return speaker;
  }

  function prettyPhase(phase: string): string {
    return phase
      ?.replace(/_[ab]$/, "")
      .replace("crossexam", "cross-exam")
      .replace("opening", "opening")
      .replace("rebuttal", "rebuttal")
      .replace("closing", "closing") || "";
  }

  function EvalCard({ name, memo, evaluation }: { name: string; memo: any; evaluation: any }) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            {name}
            {evaluation?.passFail && (
              <Badge variant={evaluation.passFail === "pass" ? "success" : "error"}>
                {evaluation.passFail.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memo?.positionBinary && (
            <div className="mb-3">
              <Badge variant={memo.positionBinary === "net_positive" ? "success" : "error"}>
                {memo.positionBinary === "net_positive" ? "Net Positive" : "Net Negative"}
              </Badge>
              {memo.analysis?.thesis && (
                <p className="mt-1 text-sm text-gray-600">{memo.analysis.thesis}</p>
              )}
            </div>
          )}

          {evaluation ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Score</span>
                  <p className="text-lg font-bold">{evaluation.score}</p>
                </div>
                <div>
                  <span className="text-gray-500">Confidence</span>
                  <p className="text-lg font-bold">{evaluation.confidence}</p>
                </div>
                <div>
                  <span className="text-gray-500">Reading</span>
                  <p className="text-lg font-bold">{evaluation.evidenceOfReadingScore}</p>
                </div>
              </div>

              <EvaluationRadar
                data={[
                  { dimension: "Opening", score: Number(evaluation.openingClarity) || 0 },
                  { dimension: "Rebuttal", score: Number(evaluation.rebuttalQuality) || 0 },
                  { dimension: "Reading", score: Number(evaluation.readingAccuracy) || 0 },
                  { dimension: "Evidence", score: Number(evaluation.evidenceUse) || 0 },
                ]}
              />

              {(evaluation.integrityFlags as string[] | null)?.length ? (
                <div>
                  <span className="text-xs font-medium text-red-600">Integrity Flags:</span>
                  <ul className="ml-4 list-disc text-sm text-red-600">
                    {(evaluation.integrityFlags as string[]).map((flag: string, i: number) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {evaluation.aiSummary && (
                <div className="border-t pt-3">
                  <span className="text-xs font-medium text-gray-500">AI Summary</span>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{evaluation.aiSummary}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No evaluation yet.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/instructor/assignment/${pairing.assignmentId}?tab=results`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-[#1D4F91] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to results
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {nameA} vs {nameB}
        </h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
          {assignment && <span>{assignment.title}</span>}
          <StatusBadge status={pairing.status} />
          {debateSession?.durationSeconds && (
            <span>{Math.round(debateSession.durationSeconds / 60)} min</span>
          )}
        </div>
      </div>

      {/* Evaluations side by side */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <EvalCard name={nameA} memo={memoA} evaluation={evalA} />
        <EvalCard name={nameB} memo={memoB} evaluation={evalB} />
      </div>

      {/* Transcript */}
      {transcript.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Full Transcript
              <span className="ml-2 text-sm font-normal text-gray-400">
                {transcript.length} entries
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {transcript.map((entry, i) => {
                const speakerName = mapSpeaker(entry.speaker);
                const phase = prettyPhase(entry.phase);
                const prevPhase = i > 0 ? prettyPhase(transcript[i - 1].phase) : "";
                const showPhaseDivider = phase !== prevPhase;

                return (
                  <div key={i}>
                    {showPhaseDivider && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-xs font-medium text-gray-400 uppercase">
                          {phase}
                        </span>
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                    )}
                    <div className="text-sm">
                      <span className="font-medium text-[#1D4F91]">
                        {speakerName}:
                      </span>{" "}
                      <span className="text-gray-700">{entry.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {transcript.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-400">
            No transcript available.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
