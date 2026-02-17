import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { debateSessions, pairings, memos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pairingId: string }> }
) {
  const { pairingId } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pairing] = await db
    .select()
    .from(pairings)
    .where(eq(pairings.id, pairingId))
    .limit(1);

  if (!pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  const isStudentA = pairing.studentAId === session.user.id;
  const isStudentB = pairing.studentBId === session.user.id;
  if (!isStudentA && !isStudentB) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [debateSession] = await db
    .select()
    .from(debateSessions)
    .where(eq(debateSessions.pairingId, pairingId))
    .limit(1);

  if (!debateSession) {
    return NextResponse.json({ error: "No session found" }, { status: 404 });
  }

  // Fetch both memos
  const studentMemos = await db
    .select({ studentId: memos.studentId, analysis: memos.analysis })
    .from(memos)
    .where(eq(memos.assignmentId, pairing.assignmentId));

  const memoA = studentMemos.find((m) => m.studentId === pairing.studentAId);
  const memoB = studentMemos.find((m) => m.studentId === pairing.studentBId);

  const transcript = debateSession.transcript || [];
  const transcriptText = transcript
    .map((t) => `[${t.phase}] ${t.speaker}: ${t.text}`)
    .join("\n");

  const studentLabel = isStudentA ? "A" : "B";

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are an AI debate coach. A university debate just finished. Generate a personalized debrief for Student ${studentLabel}.

STUDENT A THESIS: ${memoA?.analysis?.thesis || "Unknown"}
STUDENT B THESIS: ${memoB?.analysis?.thesis || "Unknown"}

DEBATE TRANSCRIPT:
${transcriptText.slice(-3000)}

Write 2-3 sentences for Student ${studentLabel}:
1. What they did well (be specific, reference something from the transcript)
2. One concrete thing they could improve next time

Be encouraging but honest. Address them directly as "you". Do NOT use markdown.`,
        },
      ],
    });

    const debrief = response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ debrief, studentRole: studentLabel });
  } catch (e) {
    console.error("Debrief generation error:", e);
    return NextResponse.json(
      { error: "Failed to generate debrief" },
      { status: 500 }
    );
  }
}
