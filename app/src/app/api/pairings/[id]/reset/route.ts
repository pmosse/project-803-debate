import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pairings, debateSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any).role !== "instructor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Delete any debate sessions for this pairing
  const sessions = await db
    .select()
    .from(debateSessions)
    .where(eq(debateSessions.pairingId, id));

  for (const s of sessions) {
    await db.delete(debateSessions).where(eq(debateSessions.id, s.id));
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
