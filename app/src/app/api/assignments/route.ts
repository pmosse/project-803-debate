import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assignments } from "@/lib/db/schema";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  promptText: z.string().min(1),
  rubricText: z.string().optional(),
  readingLinks: z
    .array(z.object({ title: z.string(), url: z.string().url() }))
    .optional(),
  memoDeadline: z.string().optional(),
  debateDeadline: z.string().optional(),
  courseCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "instructor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [assignment] = await db
    .insert(assignments)
    .values({
      title: parsed.data.title,
      promptText: parsed.data.promptText,
      rubricText: parsed.data.rubricText,
      readingLinks: parsed.data.readingLinks,
      memoDeadline: parsed.data.memoDeadline
        ? new Date(parsed.data.memoDeadline)
        : undefined,
      debateDeadline: parsed.data.debateDeadline
        ? new Date(parsed.data.debateDeadline)
        : undefined,
      courseCode: parsed.data.courseCode || (session.user as any).courseCode || "DEFAULT",
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(assignment, { status: 201 });
}
