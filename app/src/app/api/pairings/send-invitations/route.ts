import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pairings, users, assignments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendDebateInvitation } from "@/lib/email/client";
import { isPrivilegedRole } from "@/lib/auth/roles";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isPrivilegedRole((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assignmentId } = await req.json();
  if (!assignmentId) {
    return NextResponse.json(
      { error: "assignmentId required" },
      { status: 400 }
    );
  }

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

  const allPairings = await db
    .select()
    .from(pairings)
    .where(eq(pairings.assignmentId, assignmentId));

  let sent = 0;
  for (const pairing of allPairings) {
    if (pairing.status !== "paired") continue;

    const [studentA] = await db
      .select()
      .from(users)
      .where(eq(users.id, pairing.studentAId))
      .limit(1);
    const [studentB] = await db
      .select()
      .from(users)
      .where(eq(users.id, pairing.studentBId))
      .limit(1);

    const debateLink = `${process.env.NEXTAUTH_URL}/debate/${pairing.id}`;
    const deadline = assignment.debateDeadline
      ? new Date(assignment.debateDeadline).toLocaleDateString()
      : "TBD";

    for (const student of [studentA, studentB]) {
      if (!student?.email) continue;
      try {
        await sendDebateInvitation({
          to: student.email,
          studentName: student.name,
          assignmentTitle: assignment.title,
          debateLink,
          debateDeadline: deadline,
        });
        sent++;
      } catch {
        // Log but continue
      }
    }

    await db
      .update(pairings)
      .set({ status: "invited", emailSentAt: new Date() })
      .where(eq(pairings.id, pairing.id));
  }

  return NextResponse.json({ sent });
}
