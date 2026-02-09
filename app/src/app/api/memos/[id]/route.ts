import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
    (session.user as any).role !== "instructor"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(memo);
}
