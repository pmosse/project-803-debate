import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  users,
  memos,
  pairings,
  debateSessions,
  evaluations,
} from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EvaluationRadar } from "@/components/instructor/evaluation-radar";
import { ArrowLeft } from "lucide-react";

export default async function InstructorStudentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assignment?: string }>;
}) {
  const { id } = await params;
  const { assignment: assignmentId } = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");

  const [student] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!student) redirect("/instructor/dashboard");

  let memo = null;
  if (assignmentId) {
    const [m] = await db
      .select()
      .from(memos)
      .where(
        and(eq(memos.studentId, id), eq(memos.assignmentId, assignmentId))
      )
      .limit(1);
    memo = m;
  }

  let pairing = null;
  let opponentName = "";
  if (assignmentId) {
    const [p] = await db
      .select()
      .from(pairings)
      .where(
        and(
          eq(pairings.assignmentId, assignmentId),
          or(eq(pairings.studentAId, id), eq(pairings.studentBId, id))
        )
      )
      .limit(1);
    pairing = p;

    // Fetch opponent's name for transcript display
    if (p) {
      const opponentId = p.studentAId === id ? p.studentBId : p.studentAId;
      if (opponentId) {
        const [opp] = await db.select({ name: users.name }).from(users).where(eq(users.id, opponentId)).limit(1);
        opponentName = opp?.name || "";
      }
    }
  }

  let debateSession = null;
  let evaluation = null;
  if (pairing) {
    const [ds] = await db
      .select()
      .from(debateSessions)
      .where(eq(debateSessions.pairingId, pairing.id))
      .limit(1);
    debateSession = ds;

    if (ds) {
      const [ev] = await db
        .select()
        .from(evaluations)
        .where(
          and(
            eq(evaluations.debateSessionId, ds.id),
            eq(evaluations.studentId, id)
          )
        )
        .limit(1);
      evaluation = ev;
    }
  }

  return (
    <div>
      <div className="mb-6">
        {assignmentId && (
          <Link
            href={`/instructor/assignment/${assignmentId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-[#1D4F91] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to assignment
          </Link>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
        <p className="text-sm text-gray-500">{student.email || "No email"}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Memo
              {memo && <StatusBadge status={memo.status} />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {memo ? (
              <div className="space-y-3">
                {memo.positionBinary && (
                  <div>
                    <span className="text-xs text-gray-500">Position: </span>
                    <Badge
                      variant={
                        memo.positionBinary === "net_positive"
                          ? "success"
                          : "error"
                      }
                    >
                      {memo.positionBinary === "net_positive"
                        ? "Net Positive"
                        : "Net Negative"}
                    </Badge>
                  </div>
                )}
                {memo.analysis && (
                  <>
                    <div>
                      <span className="text-xs text-gray-500">Thesis:</span>
                      <p className="text-sm">
                        {(memo.analysis as any).thesis}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Key Claims:</span>
                      <ul className="ml-4 list-disc text-sm">
                        {(memo.analysis as any).key_claims?.map(
                          (c: string, i: number) => (
                            <li key={i}>{c}</li>
                          )
                        )}
                      </ul>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">
                        Stance Strength:
                      </span>
                      <Badge variant="secondary" className="ml-1">
                        {(memo.analysis as any).stance_strength}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No memo uploaded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Evaluation
              {evaluation?.passFail && (
                <Badge
                  variant={
                    evaluation.passFail === "pass" ? "success" : "error"
                  }
                >
                  {evaluation.passFail.toUpperCase()}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evaluation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Score</span>
                    <p className="text-lg font-bold">{evaluation.score}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Confidence</span>
                    <p className="text-lg font-bold">{evaluation.confidence}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Evidence of Reading</span>
                    <p className="text-lg font-bold">
                      {evaluation.evidenceOfReadingScore}
                    </p>
                  </div>
                </div>

                <EvaluationRadar
                  data={[
                    {
                      dimension: "Opening Clarity",
                      score: Number(evaluation.openingClarity) || 0,
                    },
                    {
                      dimension: "Rebuttal Quality",
                      score: Number(evaluation.rebuttalQuality) || 0,
                    },
                    {
                      dimension: "Reading Accuracy",
                      score: Number(evaluation.readingAccuracy) || 0,
                    },
                    {
                      dimension: "Evidence Use",
                      score: Number(evaluation.evidenceUse) || 0,
                    },
                  ]}
                />

                {(evaluation.integrityFlags as string[] | null)?.length ? (
                  <div>
                    <span className="text-xs font-medium text-red-600">
                      Integrity Flags:
                    </span>
                    <ul className="ml-4 list-disc text-sm text-red-600">
                      {(evaluation.integrityFlags as string[]).map(
                        (flag, i) => (
                          <li key={i}>{flag}</li>
                        )
                      )}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No evaluation available yet.
              </p>
            )}
          </CardContent>
        </Card>

        {evaluation?.aiSummary && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">AI Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {evaluation.aiSummary}
              </p>
            </CardContent>
          </Card>
        )}

        {debateSession?.transcript && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Debate Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {(
                  debateSession.transcript as {
                    speaker: string;
                    text: string;
                    timestamp: number;
                    phase: string;
                  }[]
                ).map((entry, i) => {
                  const isStudentA = pairing?.studentAId === id;
                  const speakerName =
                    entry.speaker === "Student A"
                      ? (isStudentA ? student.name : opponentName) || "Student A"
                      : entry.speaker === "Student B"
                        ? (isStudentA ? opponentName : student.name) || "Student B"
                        : entry.speaker;
                  const phasePretty = entry.phase
                    ?.replace(/_[ab]$/, "")
                    .replace("crossexam", "cross-exam");
                  return (
                    <div key={i} className="text-sm">
                      <span className="font-medium text-[#1D4F91]">
                        {speakerName}:
                      </span>{" "}
                      <span className="text-gray-700">{entry.text}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        [{phasePretty}]
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
