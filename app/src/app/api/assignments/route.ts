import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPrivilegedRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { assignments } from "@/lib/db/schema";
import { z } from "zod";

const rubricCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  maxPoints: z.number().min(1).max(10),
});

const createSchema = z.object({
  title: z.string().min(1),
  promptText: z.string().min(1),
  rubricText: z.string().optional(),
  rubricCriteria: z
    .array(rubricCriterionSchema)
    .max(10)
    .optional()
    .transform((c) => c?.filter((x) => x.name.trim()) || undefined),
  readingLinks: z
    .array(z.object({ title: z.string(), url: z.string().url() }))
    .optional(),
  memoDeadline: z.string().optional(),
  debateDeadline: z.string().optional(),
  courseCode: z.string().optional(),
  emailDomain: z.string().optional(),
  accessCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isPrivilegedRole((session.user as any).role)) {
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

  // Auto-generate rubricText from criteria for backward compat with Python services
  let rubricText = parsed.data.rubricText;
  if (parsed.data.rubricCriteria && parsed.data.rubricCriteria.length > 0) {
    const generated = parsed.data.rubricCriteria
      .map((c) => `${c.name} (${c.maxPoints} pts): ${c.description}`)
      .join("\n");
    rubricText = rubricText ? `${generated}\n\n${rubricText}` : generated;
  }

  const [assignment] = await db
    .insert(assignments)
    .values({
      title: parsed.data.title,
      promptText: parsed.data.promptText,
      rubricText,
      rubricCriteria:
        parsed.data.rubricCriteria && parsed.data.rubricCriteria.length > 0
          ? parsed.data.rubricCriteria
          : undefined,
      readingLinks: parsed.data.readingLinks,
      memoDeadline: parsed.data.memoDeadline
        ? new Date(parsed.data.memoDeadline)
        : undefined,
      debateDeadline: parsed.data.debateDeadline
        ? new Date(parsed.data.debateDeadline)
        : undefined,
      courseCode:
        parsed.data.courseCode ||
        (session.user as any).courseCode ||
        "DEFAULT",
      emailDomain: parsed.data.emailDomain || undefined,
      accessCode: parsed.data.accessCode || undefined,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(assignment, { status: 201 });
}
