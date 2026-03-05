import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isPrivilegedRole } from "@/lib/auth/roles";
import { readFile } from "fs/promises";
import path from "path";

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

  if (!memo || !memo.filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    memo.studentId !== session.user.id &&
    !isPrivilegedRole((session.user as any).role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  const absolutePath = path.resolve(uploadDir, memo.filePath);
  const file = await readFile(absolutePath);
  const filename = path.basename(memo.filePath);

  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
