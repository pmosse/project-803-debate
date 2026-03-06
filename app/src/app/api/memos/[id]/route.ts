import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memos, aiUsage, pairings } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { isPrivilegedRole } from "@/lib/auth/roles";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [memo] = await db
    .select()
    .from(memos)
    .where(eq(memos.id, id))
    .limit(1);

  if (!memo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the student who uploaded or an instructor can view
  if (
    memo.studentId !== session.user.id &&
    !isPrivilegedRole((session.user as any).role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(memo);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [memo] = await db
    .select()
    .from(memos)
    .where(eq(memos.id, id))
    .limit(1);

  if (!memo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the student who uploaded or an instructor can delete
  if (
    memo.studentId !== session.user.id &&
    !isPrivilegedRole((session.user as any).role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Students cannot delete analyzed memos (professors still can)
  if (
    memo.status === "analyzed" &&
    !isPrivilegedRole((session.user as any).role)
  ) {
    return NextResponse.json(
      { error: "Cannot delete a memo that has already been analyzed" },
      { status: 400 }
    );
  }

  // Block deletion if student has a pairing for this assignment
  const [existingPairing] = await db
    .select({ id: pairings.id })
    .from(pairings)
    .where(
      and(
        eq(pairings.assignmentId, memo.assignmentId),
        or(
          eq(pairings.studentAId, memo.studentId),
          eq(pairings.studentBId, memo.studentId)
        )
      )
    )
    .limit(1);

  if (existingPairing) {
    return NextResponse.json(
      { error: "Cannot delete memo: student has an active pairing. Reset the case first." },
      { status: 400 }
    );
  }

  await db.update(aiUsage).set({ memoId: null }).where(eq(aiUsage.memoId, id));
  await db.delete(memos).where(eq(memos.id, id));

  return NextResponse.json({ ok: true });
}
