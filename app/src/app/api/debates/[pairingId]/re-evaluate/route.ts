import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { debateSessions, evaluations } from "@/lib/db/schema";
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

  const sessions = await db
    .select()
    .from(debateSessions)
    .where(eq(debateSessions.pairingId, pairingId));

  if (sessions.length === 0) {
    return NextResponse.json({ error: "No debate sessions found" }, { status: 404 });
  }

  const completedSession = sessions.find((s) => s.status === "completed");
  if (!completedSession) {
    return NextResponse.json({ error: "No completed debate session" }, { status: 400 });
  }

  // Delete existing evaluations so the evaluator can re-create them
  await db
    .delete(evaluations)
    .where(inArray(evaluations.debateSessionId, sessions.map((s) => s.id)));

  // Trigger evaluator
  const evaluatorUrl = process.env.EVALUATOR_URL || "http://localhost:8005";
  const res = await fetch(`${evaluatorUrl}/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debate_session_id: completedSession.id }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Evaluator failed: ${text}` }, { status: 502 });
  }

  return NextResponse.json({ message: "Evaluation re-triggered successfully" });
}
