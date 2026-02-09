import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memos } from "@/lib/db/schema";
import { uploadFile } from "@/lib/storage/client";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const assignmentId = formData.get("assignmentId") as string;

  if (!file || !assignmentId) {
    return NextResponse.json(
      { error: "File and assignmentId are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PDF and DOCX files are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be under 10MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop();
  const key = `memos/${assignmentId}/${session.user.id}/${Date.now()}.${ext}`;

  await uploadFile(key, buffer, file.type);

  const [memo] = await db
    .insert(memos)
    .values({
      assignmentId,
      studentId: session.user.id,
      filePath: key,
      status: "uploaded",
    })
    .returning();

  // Trigger async processing
  try {
    const processorUrl = process.env.MEMO_PROCESSOR_URL;
    if (processorUrl) {
      fetch(`${processorUrl}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo_id: memo.id }),
      }).catch(() => {
        // Fire and forget - processor will handle errors
      });
    }
  } catch {
    // Processor not available - memo stays in uploaded status
  }

  return NextResponse.json({ id: memo.id, status: memo.status });
}
