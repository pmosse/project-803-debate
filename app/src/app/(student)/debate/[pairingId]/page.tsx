import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { pairings, assignments, memos, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { DebateSession } from "@/components/debate/debate-session";

export default async function DebatePage({
  params,
}: {
  params: Promise<{ pairingId: string }>;
}) {
  const { pairingId } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const [pairing] = await db
    .select()
    .from(pairings)
    .where(eq(pairings.id, pairingId))
    .limit(1);

  if (!pairing) redirect("/dashboard");

  // Verify the student is part of this pairing
  const isStudentA = pairing.studentAId === session.user.id;
  const isStudentB = pairing.studentBId === session.user.id;
  if (!isStudentA && !isStudentB) redirect("/dashboard");

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, pairing.assignmentId))
    .limit(1);

  // Fetch opponent name and memo analysis for personalized instructions
  const opponentId = isStudentA ? pairing.studentBId : pairing.studentAId;
  const [opponent] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, opponentId))
    .limit(1);

  const opponentName = opponent?.name || "Opponent";

  const [opponentMemo] = await db
    .select({ analysis: memos.analysis })
    .from(memos)
    .where(
      and(
        eq(memos.assignmentId, pairing.assignmentId),
        eq(memos.studentId, opponentId)
      )
    )
    .limit(1);

  const opponentThesis = opponentMemo?.analysis?.thesis || "";
  const opponentClaims = opponentMemo?.analysis?.key_claims || [];

  if (pairing.status === "completed") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="rounded-lg bg-green-50 p-8">
          <h2 className="text-xl font-semibold text-green-800">
            Debate Completed
          </h2>
          <p className="mt-2 text-green-600">
            Your instructor will review the results.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DebateSession
      pairingId={pairingId}
      assignmentTitle={assignment?.title || "Debate"}
      roomUrl={pairing.debateRoomUrl || ""}
      studentRole={isStudentA ? "A" : "B"}
      studentName={session.user.name}
      opponentName={opponentName}
      opponentThesis={opponentThesis}
      opponentClaims={opponentClaims}
    />
  );
}
