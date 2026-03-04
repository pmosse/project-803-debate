import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pairings, debateSessions, evaluations, aiUsage } from "@/lib/db/schema";
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

  // Delete in FK order: ai_usage → evaluations → debate sessions
  await db.delete(aiUsage).where(eq(aiUsage.pairingId, id));

  const sessions = await db
    .select()
    .from(debateSessions)
    .where(eq(debateSessions.pairingId, id));

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length > 0) {
    await db.delete(evaluations).where(inArray(evaluations.debateSessionId, sessionIds));
    await db.delete(debateSessions).where(inArray(debateSessions.id, sessionIds));
  }

  // Reset pairing status back to "paired"
  const [updated] = await db
    .update(pairings)
    .set({ status: "paired" })
    .where(eq(pairings.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  return NextResponse.json({ pairing: updated });
}
