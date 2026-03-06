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
import { eq, and, or, inArray } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EvaluationRadar } from "@/components/instructor/evaluation-radar";
import { CriteriaScoresDisplay } from "@/components/instructor/criteria-scores-display";
import { ArrowLeft, FileDown } from "lucide-react";
import { MemoDeleteButton } from "@/components/student/memo-delete-button";

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

  if (!student) redirect("/professor/dashboard");

  // If a specific assignment is provided, show single-assignment view
  if (assignmentId) {
    return <SingleAssignmentView studentId={id} student={student} assignmentId={assignmentId} />;
  }

  // Otherwise show all assignments for this student
  const studentMemos = await db
    .select()
    .from(memos)
    .where(eq(memos.studentId, id));

  const studentPairings = await db
    .select()
    .from(pairings)
    .where(or(eq(pairings.studentAId, id), eq(pairings.studentBId, id)));

  // Get assignment details
  const assignmentIds = [
    ...new Set([
      ...studentMemos.map((m) => m.assignmentId),
      ...studentPairings.map((p) => p.assignmentId),
    ]),
  ];

  const assignmentRows = assignmentIds.length > 0
    ? await db
        .select()
        .from(assignments)
        .where(inArray(assignments.id, assignmentIds))
    : [];

  // Get debate sessions and evaluations
  const pairingIds = studentPairings.map((p) => p.id);
  const allDebateSessions = pairingIds.length > 0
    ? await db.select().from(debateSessions).where(inArray(debateSessions.pairingId, pairingIds))
    : [];

  const sessionIds = allDebateSessions.map((s) => s.id);
  const allEvaluations = sessionIds.length > 0
    ? await db
        .select()
        .from(evaluations)
        .where(and(inArray(evaluations.debateSessionId, sessionIds), eq(evaluations.studentId, id)))
    : [];

  // Get opponent names
  const opponentIds = studentPairings
    .map((p) => (p.studentAId === id ? p.studentBId : p.studentAId))
    .filter(Boolean) as string[];
  const opponents = opponentIds.length > 0
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, opponentIds))
    : [];
  const opponentMap = Object.fromEntries(opponents.map((o) => [o.id, o.name]));

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/professor/students"
          className="mb-3 inline-flex items-center gap-1 text-sm text-[#1D4F91] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to students
        </Link>
        <div className="flex items-center gap-3">
          {student.photoPath ? (
            <img
              src={`/api/uploads/${student.photoPath}`}
              alt={student.name}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1D4F91]/10 text-lg font-medium text-[#1D4F91]">
              {student.name.charAt(0)}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
            <p className="text-sm text-gray-500">{student.email || "No email"}</p>
          </div>
        </div>
      </div>

      {assignmentRows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No assignments found for this student.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {assignmentRows.map((assignment) => {
            const memo = studentMemos.find((m) => m.assignmentId === assignment.id);
            const pairing = studentPairings.find((p) => p.assignmentId === assignment.id);
            const debateSession = pairing
              ? allDebateSessions.find((s) => s.pairingId === pairing.id)
              : null;
            const evaluation = debateSession
              ? allEvaluations.find((e) => e.debateSessionId === debateSession.id)
              : null;
            const opponentId = pairing
              ? (pairing.studentAId === id ? pairing.studentBId : pairing.studentAId)
              : null;
            const oppName = opponentId ? opponentMap[opponentId] || "Unknown" : null;

            return (
              <Card key={assignment.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <Link
                      href={`/professor/assignment/${assignment.id}`}
                      className="text-[#1D4F91] hover:underline"
                    >
                      {assignment.title}
                    </Link>
                    <Badge>{assignment.courseCode}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Memo */}
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 mb-2">Memo</h3>
                      {memo ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={memo.status} />
                            {memo.filePath && (
                              <a
                                href={`/api/memos/${memo.id}/download`}
                                title="Download memo PDF"
                                className="text-gray-400 hover:text-[#1D4F91] transition-colors"
                              >
                                <FileDown className="h-4 w-4" />
                              </a>
                            )}
                            <MemoDeleteButton memoId={memo.id} studentName={student.name} />
                          </div>
                          {memo.positionBinary && (
                            <Badge
                              variant={memo.positionBinary === "net_positive" ? "success" : "error"}
                            >
                              {memo.positionBinary === "net_positive" ? "Net Positive" : "Net Negative"}
                            </Badge>
                          )}
                          {(memo.analysis as any)?.thesis && (
                            <p className="text-xs text-gray-600 line-clamp-2">
                              {(memo.analysis as any).thesis}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not uploaded</span>
                      )}
                    </div>

                    {/* Debate */}
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 mb-2">Debate</h3>
                      {pairing ? (
                        <div className="space-y-1">
                          <StatusBadge status={pairing.status} />
                          {oppName && (
                            <p className="text-xs text-gray-600">vs {oppName}</p>
                          )}
                          {debateSession?.durationSeconds && (
                            <p className="text-xs text-gray-500">
                              {Math.round(debateSession.durationSeconds / 60)} min
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not paired</span>
                      )}
                    </div>

                    {/* Evaluation */}
                    <div>
                      <h3 className="text-xs font-medium text-gray-500 mb-2">Evaluation</h3>
                      {evaluation ? (
                        <div className="space-y-1">
                          {evaluation.passFail && (
                            <Badge variant={evaluation.passFail === "pass" ? "success" : evaluation.passFail === "fail" ? "error" : "secondary"}>
                              {evaluation.passFail.toUpperCase()}
                            </Badge>
                          )}
                          {evaluation.score && (
                            <p className="text-sm font-medium">Score: {evaluation.score}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not evaluated</span>
                      )}
                    </div>
                  </div>

                  {/* Link to detailed view */}
                  <div className="mt-3 pt-3 border-t flex gap-3">
                    <Link
                      href={`/professor/student/${id}?assignment=${assignment.id}`}
                      className="text-xs text-[#1D4F91] hover:underline"
                    >
                      View details
                    </Link>
                    {pairing && (
                      <Link
                        href={`/professor/debate/${pairing.id}`}
                        className="text-xs text-[#1D4F91] hover:underline"
                      >
                        View debate
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Single-assignment detailed view (original behavior)
async function SingleAssignmentView({
  studentId,
  student,
  assignmentId,
}: {
  studentId: string;
  student: typeof users.$inferSelect;
  assignmentId: string;
}) {
  const [memo] = await db
    .select()
    .from(memos)
    .where(and(eq(memos.studentId, studentId), eq(memos.assignmentId, assignmentId)))
    .limit(1);

  let pairing = null;
  let opponentName = "";
  const [p] = await db
    .select()
    .from(pairings)
    .where(
      and(
        eq(pairings.assignmentId, assignmentId),
        or(eq(pairings.studentAId, studentId), eq(pairings.studentBId, studentId))
      )
    )
    .limit(1);
  pairing = p || null;

  if (p) {
    const opponentId = p.studentAId === studentId ? p.studentBId : p.studentAId;
    if (opponentId) {
      const [opp] = await db.select({ name: users.name }).from(users).where(eq(users.id, opponentId)).limit(1);
      opponentName = opp?.name || "";
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
            eq(evaluations.studentId, studentId)
          )
        )
        .limit(1);
      evaluation = ev;
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/professor/student/${studentId}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-[#1D4F91] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to student overview
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
        <p className="text-sm text-gray-500">{student.email || "No email"}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Memo
              <div className="flex items-center gap-2">
                {memo && <StatusBadge status={memo.status} />}
                {memo?.filePath && (
                  <a
                    href={`/api/memos/${memo.id}/download`}
                    title="Download memo PDF"
                    className="text-gray-400 hover:text-[#1D4F91] transition-colors"
                  >
                    <FileDown className="h-4 w-4" />
                  </a>
                )}
                {memo && <MemoDeleteButton memoId={memo.id} studentName={student.name} />}
              </div>
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
                  {!evaluation.criteriaScores && (
                    <div>
                      <span className="text-gray-500">Evidence of Reading</span>
                      <p className="text-lg font-bold">
                        {evaluation.evidenceOfReadingScore}
                      </p>
                    </div>
                  )}
                </div>

                {evaluation.criteriaScores ? (
                  <CriteriaScoresDisplay
                    criteriaScores={
                      evaluation.criteriaScores as {
                        criterion: string;
                        score: number;
                        maxPoints: number;
                        reasoning: string;
                      }[]
                    }
                  />
                ) : (
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
                )}

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
                  const isStudentA = pairing?.studentAId === studentId;
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
