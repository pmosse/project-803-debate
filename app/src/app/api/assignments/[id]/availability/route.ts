import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignmentEnrollments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const VALID_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const VALID_BLOCKS = ["morning", "afternoon", "evening"] as const;

const schema = z.object({
  studentId: z.string().uuid(),
  availability: z.record(
    z.enum(VALID_DAYS),
    z.array(z.enum(VALID_BLOCKS))
  ),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assignmentId } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { studentId, availability } = parsed.data;

  // Verify enrollment exists
  const [enrollment] = await db
    .select()
    .from(assignmentEnrollments)
    .where(
      and(
        eq(assignmentEnrollments.assignmentId, assignmentId),
        eq(assignmentEnrollments.studentId, studentId)
      )
    )
    .limit(1);

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    );
  }

  await db
    .update(assignmentEnrollments)
    .set({ availability })
    .where(eq(assignmentEnrollments.id, enrollment.id));

  return NextResponse.json({ success: true });
}
