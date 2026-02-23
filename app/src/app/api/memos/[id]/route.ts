import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

  await db.delete(memos).where(eq(memos.id, id));

  return NextResponse.json({ ok: true });
}
