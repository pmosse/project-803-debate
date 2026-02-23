import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assignments,
  pairings,
  debateSessions,
  evaluations,
  memos,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isPrivilegedRole } from "@/lib/auth/roles";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !isPrivilegedRole((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify assignment exists
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, id))
    .limit(1);

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  // Get all pairings for this assignment
  const assignmentPairings = await db
    .select()
    .from(pairings)
    .where(eq(pairings.assignmentId, id));

  const pairingIds = assignmentPairings.map((p) => p.id);

  // Get all debate sessions
  const sessions = pairingIds.length > 0
    ? await db
        .select()
        .from(debateSessions)
        .where(inArray(debateSessions.pairingId, pairingIds))
    : [];

  const sessionIds = sessions.map((s) => s.id);

  // Delete in FK order: evaluations → debate sessions → pairings
  if (sessionIds.length > 0) {
    await db
      .delete(evaluations)
      .where(inArray(evaluations.debateSessionId, sessionIds));
    await db
      .delete(debateSessions)
      .where(inArray(debateSessions.id, sessionIds));
  }

  if (pairingIds.length > 0) {
    await db
      .delete(pairings)
      .where(inArray(pairings.id, pairingIds));
  }

  // Reset memos back to analyzed state (clear runtime changes)
  await db
    .update(memos)
    .set({
      status: "analyzed",
      studentConfirmed: 0,
    })
    .where(eq(memos.assignmentId, id));

  return NextResponse.json({
    message: "Assignment reset successfully",
    deleted: {
      pairings: pairingIds.length,
      debateSessions: sessionIds.length,
    },
  });
}
