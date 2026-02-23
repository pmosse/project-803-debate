import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assignments, emailVerifications } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { sendVerificationCode } from "@/lib/email/client";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  assignmentId: z.string().uuid(),
  accessCode: z.string().optional(),
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

  const { email, assignmentId, accessCode } = parsed.data;

  // Get assignment
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) {
    return NextResponse.json(
      { error: "Assignment not found" },
      { status: 404 }
    );
  }

  // Validate email domain
  if (assignment.emailDomain) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain !== assignment.emailDomain.toLowerCase()) {
      return NextResponse.json(
        { error: `Email must end with @${assignment.emailDomain}` },
        { status: 400 }
      );
    }
  }

  // Validate access code
  if (assignment.accessCode) {
    if (!accessCode || accessCode !== assignment.accessCode) {
      return NextResponse.json(
        { error: "Invalid access code" },
        { status: 400 }
      );
    }
  }

  // Rate limit: max 5 codes per email per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCodes = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, email.toLowerCase()),
        eq(emailVerifications.assignmentId, assignmentId),
        gte(emailVerifications.createdAt, oneHourAgo)
      )
    );

  if (recentCodes.length >= 5) {
    return NextResponse.json(
      { error: "Too many verification attempts. Try again later." },
      { status: 429 }
    );
  }

  // Generate 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await db.insert(emailVerifications).values({
    email: email.toLowerCase(),
    code,
    assignmentId,
    expiresAt,
  });

  // Send email
  try {
    await sendVerificationCode({
      to: email,
      code,
      assignmentTitle: assignment.title,
    });
  } catch (e) {
    console.error("Failed to send verification email:", e);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
