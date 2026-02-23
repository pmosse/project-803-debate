import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  emailVerifications,
  users,
  assignmentEnrollments,
  assignments,
  classMemberships,
} from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  assignmentId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input" },
      { status: 400 }
    );
  }

  const { email, code, assignmentId, firstName, lastName, password } =
    parsed.data;
  const emailLower = email.toLowerCase();

  // Find valid verification code
  const now = new Date();
  const [verification] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, emailLower),
        eq(emailVerifications.code, code),
        eq(emailVerifications.assignmentId, assignmentId),
        eq(emailVerifications.verified, 0),
        gte(emailVerifications.expiresAt, now)
      )
    )
    .limit(1);

  if (!verification) {
    return NextResponse.json(
      { error: "Invalid or expired code" },
      { status: 400 }
    );
  }

  // Mark code as verified
  await db
    .update(emailVerifications)
    .set({ verified: 1 })
    .where(eq(emailVerifications.id, verification.id));

  // Get assignment to determine course code
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  // Check if user already exists
  let [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1);

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create new user
    const passwordHash = await bcrypt.hash(password, 10);
    const [newUser] = await db
      .insert(users)
      .values({
        name: `${firstName} ${lastName}`,
        email: emailLower,
        passwordHash,
        role: "student",
        courseCode: assignment?.courseCode || "DEFAULT",
      })
      .returning();
    userId = newUser.id;
  }

  // Check if already enrolled
  const [existing] = await db
    .select()
    .from(assignmentEnrollments)
    .where(
      and(
        eq(assignmentEnrollments.assignmentId, assignmentId),
        eq(assignmentEnrollments.studentId, userId)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(assignmentEnrollments).values({
      assignmentId,
      studentId: userId,
    });
  }

  // Auto-join class if assignment has classId
  if (assignment?.classId) {
    const [existingMembership] = await db
      .select()
      .from(classMemberships)
      .where(
        and(
          eq(classMemberships.classId, assignment.classId),
          eq(classMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!existingMembership) {
      await db.insert(classMemberships).values({
        classId: assignment.classId,
        userId,
      });
    }
  }

  return NextResponse.json({ success: true, studentId: userId });
}
