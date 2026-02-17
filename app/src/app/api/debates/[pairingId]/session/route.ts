import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { debateSessions, pairings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pairingId: string }> }
) {
  const { pairingId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pairing] = await db
    .select()
    .from(pairings)
    .where(eq(pairings.id, pairingId))
    .limit(1);

  if (!pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  if (
    pairing.studentAId !== session.user.id &&
    pairing.studentBId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check for existing session
  const [existing] = await db
    .select()
    .from(debateSessions)
    .where(eq(debateSessions.pairingId, pairingId))
    .limit(1);

  if (existing) {
    return NextResponse.json(existing);
  }

  // Create new session
  const [debateSession] = await db
    .insert(debateSessions)
    .values({
      pairingId,
      transcript: [],
      phasesLog: [],
      aiInterventions: [],
      status: "waiting",
    })
    .returning();

  // Update pairing status
  await db
    .update(pairings)
    .set({ status: "in_progress" })
    .where(eq(pairings.id, pairingId));

  return NextResponse.json(debateSession, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pairingId: string }> }
) {
  const { pairingId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const [existing] = await db
    .select()
    .from(debateSessions)
    .where(eq(debateSessions.pairingId, pairingId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "No session found" }, { status: 404 });
  }

  const updates: Record<string, any> = {};
  if (body.status) updates.status = body.status;
  if (body.transcript) updates.transcript = body.transcript;
  if (body.phasesLog) updates.phasesLog = body.phasesLog;
  if (body.aiInterventions) updates.aiInterventions = body.aiInterventions;
  if (body.durationSeconds) updates.durationSeconds = body.durationSeconds;
  if (body.consentA !== undefined) updates.consentA = body.consentA;
  if (body.consentB !== undefined) updates.consentB = body.consentB;
  if (body.status === "active") updates.startedAt = new Date();
  if (body.status === "completed") {
    updates.endedAt = new Date();
    // Also update pairing status
    await db
      .update(pairings)
      .set({ status: "completed" })
      .where(eq(pairings.id, pairingId));

    // Trigger evaluation asynchronously (fire-and-forget)
    const evaluatorUrl = process.env.EVALUATOR_URL || "http://localhost:8005";
    fetch(`${evaluatorUrl}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debate_session_id: existing.id }),
    }).catch((err) => console.error("Evaluator trigger failed:", err));
  }

  await db
    .update(debateSessions)
    .set(updates)
    .where(eq(debateSessions.id, existing.id));

  const [updated] = await db
    .select()
    .from(debateSessions)
    .where(eq(debateSessions.id, existing.id))
    .limit(1);

  return NextResponse.json(updated);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pairingId: string }> }
) {
  const { pairingId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [debateSession] = await db
    .select()
    .from(debateSessions)
    .where(eq(debateSessions.pairingId, pairingId))
    .limit(1);

  if (!debateSession) {
    return NextResponse.json({ error: "No session found" }, { status: 404 });
  }

  return NextResponse.json(debateSession);
}
