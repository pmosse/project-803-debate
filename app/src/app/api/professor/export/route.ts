import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluations, users, debateSessions, pairings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isPrivilegedRole } from "@/lib/auth/roles";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isPrivilegedRole((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignmentId = req.nextUrl.searchParams.get("assignment_id");
  if (!assignmentId) {
    return NextResponse.json(
      { error: "assignment_id required" },
      { status: 400 }
    );
  }

  // Get all pairings for this assignment
  const allPairings = await db
    .select()
    .from(pairings)
    .where(eq(pairings.assignmentId, assignmentId));

  // Get all debate sessions and evaluations
  const rows: string[] = [];
  rows.push(
    "Student Name,Email,Score,Confidence,Evidence of Reading,Opening Clarity,Rebuttal Quality,Reading Accuracy,Evidence Use,Pass/Fail,Integrity Flags"
  );

  for (const pairing of allPairings) {
    const [ds] = await db
      .select()
      .from(debateSessions)
      .where(eq(debateSessions.pairingId, pairing.id))
      .limit(1);

    if (!ds) continue;

    const evals = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.debateSessionId, ds.id));

    for (const ev of evals) {
      const [student] = await db
        .select()
        .from(users)
        .where(eq(users.id, ev.studentId))
        .limit(1);

      const flags = (ev.integrityFlags as string[] | null)?.join("; ") || "";
      rows.push(
        [
          `"${student?.name || ""}"`,
          `"${student?.email || ""}"`,
          ev.score,
          ev.confidence,
          ev.evidenceOfReadingScore,
          ev.openingClarity,
          ev.rebuttalQuality,
          ev.readingAccuracy,
          ev.evidenceUse,
          ev.passFail,
          `"${flags}"`,
        ].join(",")
      );
    }
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="debate-scores-${assignmentId}.csv"`,
    },
  });
}
