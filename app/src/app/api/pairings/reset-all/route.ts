import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pairings, debateSessions, evaluations } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isPrivilegedRole } from "@/lib/auth/roles";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isPrivilegedRole((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assignmentId } = await req.json();
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
  }

  // Get all pairings for this assignment
  const assignmentPairings = await db
    .select()
    .from(pairings)
    .where(eq(pairings.assignmentId, assignmentId));

  if (assignmentPairings.length === 0) {
    return NextResponse.json({ message: "No pairings to reset" });
  }

  const pairingIds = assignmentPairings.map((p) => p.id);

  // Get all debate sessions for these pairings
  const sessions = await db
    .select()
    .from(debateSessions)
    .where(inArray(debateSessions.pairingId, pairingIds));

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

  await db
    .delete(pairings)
    .where(inArray(pairings.id, pairingIds));

  return NextResponse.json({
    deleted: {
      pairings: pairingIds.length,
      debateSessions: sessionIds.length,
    },
  });
}
