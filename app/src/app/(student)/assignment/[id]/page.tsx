import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assignments, memos, pairings } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExternalLink, Calendar } from "lucide-react";
import { MemoUpload } from "@/components/student/memo-upload";
import { PositionConfirmation } from "@/components/student/position-confirmation";
import { MemoDeleteButton } from "@/components/student/memo-delete-button";
import { MemoProcessingStatus } from "@/components/student/memo-processing-status";

export default async function AssignmentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, id))
    .limit(1);

  if (!assignment) redirect("/dashboard");

  const [memo] = await db
    .select()
    .from(memos)
    .where(
      and(eq(memos.assignmentId, id), eq(memos.studentId, session.user.id))
    )
    .limit(1);

  const [pairing] = await db
    .select()
    .from(pairings)
    .where(
      and(
        eq(pairings.assignmentId, id),
        or(
          eq(pairings.studentAId, session.user.id),
          eq(pairings.studentBId, session.user.id)
        )
      )
    )
    .limit(1);

  const readingLinks = (assignment.readingLinks || []) as {
    title: string;
    url: string;
  }[];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {assignment.title}
          </h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            {assignment.memoDeadline && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Memo due:{" "}
                {new Date(assignment.memoDeadline).toLocaleDateString()}
              </span>
            )}
            {assignment.debateDeadline && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Debate by:{" "}
                {new Date(assignment.debateDeadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Assignment prompt */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {assignment.promptText}
            </div>
          </CardContent>
        </Card>

        {/* Upload / Status section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Your Memo
              <div className="flex items-center gap-2">
                {memo && <StatusBadge status={memo.status} />}
                {memo && <MemoDeleteButton memoId={memo.id} />}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!memo ? (
              <MemoUpload
                assignmentId={assignment.id}
              />
            ) : memo.status === "analyzed" && memo.analysis && !memo.studentConfirmed ? (
              <PositionConfirmation
                memoId={memo.id}
                position={memo.positionBinary || "unclassified"}
                thesis={(memo.analysis as any).thesis}
              />
            ) : memo.status === "error" ? (
              <div className="space-y-4">
                <p className="text-sm text-red-600">
                  There was an error processing your memo. Please try uploading
                  again.
                </p>
                <MemoUpload assignmentId={assignment.id} />
              </div>
            ) : memo.status === "analyzed" && memo.studentConfirmed ? (
              <p className="text-sm text-green-600">
                Your memo has been analyzed and your position confirmed. You will
                be paired with a classmate soon.
              </p>
            ) : (
              <MemoProcessingStatus status={memo.status} />
            )}
          </CardContent>
        </Card>

        {/* Pairing status */}
        {pairing && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Debate Status
                <StatusBadge status={pairing.status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pairing.status === "completed" ? (
                <p className="text-sm text-green-600">
                  Your debate has been completed. Your instructor will review the
                  results.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    You&apos;ve been paired with a classmate for your debate.
                  </p>
                  {pairing.debateRoomUrl && (
                    <a
                      href={`/debate/${pairing.id}`}
                      className="inline-flex items-center gap-2 rounded-md bg-[#1D4F91] px-4 py-2 text-sm font-medium text-white hover:bg-[#163d70]"
                    >
                      Join Debate
                    </a>
                  )}
                  {assignment.debateDeadline && (
                    <p className="text-xs text-gray-500">
                      Complete by:{" "}
                      {new Date(assignment.debateDeadline).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Rubric */}
        {assignment.rubricText && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rubric</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {assignment.rubricText}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Required Readings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Required Readings</CardTitle>
          </CardHeader>
          <CardContent>
            {readingLinks.length === 0 ? (
              <p className="text-sm text-gray-500">No readings linked.</p>
            ) : (
              <ul className="space-y-3">
                {readingLinks.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 text-sm text-[#1D4F91] hover:underline"
                    >
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
