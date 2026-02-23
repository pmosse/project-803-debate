import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pairings, debateSessions, evaluations } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isPrivilegedRole } from "@/lib/auth/roles";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pairingId: string }> }
) {
  const session = await auth();
  if (!session || !isPrivilegedRole((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pairingId } = await params;

  // Get debate sessions for this pairing
  const sessions = await db
    .select()
    .from(debateSessions)
    .where(eq(debateSessions.pairingId, pairingId));

  if (sessions.length === 0) {
    return NextResponse.json({ error: "No debate sessions found" }, { status: 404 });
  }

  const sessionIds = sessions.map((s) => s.id);

  // Delete evaluations
  await db
    .delete(evaluations)
    .where(inArray(evaluations.debateSessionId, sessionIds));

  // Reset debate sessions back to waiting state
  for (const s of sessions) {
    await db
      .update(debateSessions)
      .set({
        status: "waiting",
        transcript: null,
        phasesLog: null,
        aiInterventions: null,
        startedAt: null,
        endedAt: null,
        durationSeconds: null,
      })
      .where(eq(debateSessions.id, s.id));
  }

  // Reset pairing status back to paired
  await db
    .update(pairings)
    .set({ status: "paired" })
    .where(eq(pairings.id, pairingId));

  return NextResponse.json({ message: "Debate evaluation reset successfully" });
}
