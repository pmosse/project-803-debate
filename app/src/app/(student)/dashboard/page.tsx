import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assignments, memos, pairings } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FileText, Calendar } from "lucide-react";

function getStudentStatus(
  memo: { status: string } | undefined,
  pairing: { status: string } | undefined
): string {
  if (!memo) return "not_started";
  if (memo.status === "error") return "error";
  if (memo.status !== "analyzed") return memo.status;
  if (!pairing) return "analyzed";
  return pairing.status;
}

export default async function StudentDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const allAssignments = await db.select().from(assignments);

  const studentMemos = await db
    .select()
    .from(memos)
    .where(eq(memos.studentId, session.user.id));

  const studentPairings = await db
    .select()
    .from(pairings)
    .where(
      or(
        eq(pairings.studentAId, session.user.id),
        eq(pairings.studentBId, session.user.id)
      )
    );

  const assignmentCards = allAssignments.map((assignment) => {
    const memo = studentMemos.find((m) => m.assignmentId === assignment.id);
    const pairing = studentPairings.find(
      (p) => p.assignmentId === assignment.id
    );
    const status = getStudentStatus(memo, pairing);
    return { ...assignment, status, memo, pairing };
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My Assignments</h1>

      {assignmentCards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="text-gray-500">
              No assignments yet. Check back soon.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assignmentCards.map((a) => (
            <Link key={a.id} href={`/assignment/${a.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle>{a.title}</CardTitle>
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      {a.memoDeadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Memo due:{" "}
                          {new Date(a.memoDeadline).toLocaleDateString()}
                        </span>
                      )}
                      {a.debateDeadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Debate by:{" "}
                          {new Date(a.debateDeadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
