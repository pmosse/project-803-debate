import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
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

  if (!memo || memo.studentId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(memos)
    .set({ studentConfirmed: 1 })
    .where(eq(memos.id, id));

  return NextResponse.json({ success: true });
}
