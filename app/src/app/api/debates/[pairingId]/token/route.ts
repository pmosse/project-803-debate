import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pairings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createMeetingToken } from "@/lib/daily/client";

export async function GET(
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

  const isA = pairing.studentAId === session.user.id;
  const isB = pairing.studentBId === session.user.id;
  if (!isA && !isB) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!pairing.debateRoomId) {
    return NextResponse.json(
      { error: "No debate room configured for this pairing" },
      { status: 400 }
    );
  }

  const userName = isA ? "Student A" : "Student B";
  const token = await createMeetingToken(pairing.debateRoomId, userName);

  return NextResponse.json({
    token,
    roomUrl: pairing.debateRoomUrl,
  });
}
