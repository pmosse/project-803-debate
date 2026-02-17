import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pairings, memos, users } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createRoom } from "@/lib/daily/client";
import Anthropic from "@anthropic-ai/sdk";

interface MemoForPairing {
  studentId: string;
  studentName: string;
  position: string;
  thesis: string;
  keyClaims: string[];
  stanceStrength: string;
}

interface ClaudePair {
  student_a_id: string;
  student_b_id: string;
  debate_topic: string;
  reason: string;
}

async function clusterAndPairWithClaude(
  studentMemos: MemoForPairing[]
): Promise<{ pairs: ClaudePair[]; unpaired: string[] }> {
  const anthropic = new Anthropic();

  const studentSummaries = studentMemos
    .map(
      (m) =>
        `${m.studentName} (ID: ${m.studentId}):
  - Position: ${m.position}
  - Thesis: ${m.thesis}
  - Key Claims: ${m.keyClaims.join("; ")}
  - Stance Strength: ${m.stanceStrength}`
    )
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are an expert at designing academic debates. Given these student memo analyses, create optimal debate pairings.

RULES:
1. Pair students who will have the most productive disagreement — this means maximum divergence in their specific arguments, not just their overall position.
2. Two students with the SAME overall position (both "net_positive") CAN be paired if their specific claims and reasoning differ significantly. For example, one might argue Walmart creates jobs while another argues Walmart lowers prices — they can debate which factor matters more.
3. Two students with OPPOSING positions should be paired when their specific claims directly contradict each other, creating clear debate lines.
4. Prioritize pairing students whose claims reference the SAME readings but draw different conclusions.
5. If there's an odd number of students, leave the one whose arguments overlap most with an already-paired student as unpaired.

STUDENTS:
${studentSummaries}

Respond with valid JSON only, no markdown:
{
  "pairs": [
    {
      "student_a_id": "...",
      "student_b_id": "...",
      "debate_topic": "A short phrase describing the core disagreement",
      "reason": "One sentence explaining why these two should debate, referring to students by name"
    }
  ],
  "unpaired": ["student_id_1"]
}`,
      },
    ],
  });

  let text =
    response.content[0].type === "text" ? response.content[0].text : "";
  // Strip markdown code fences if Claude wraps the JSON
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  const parsed = JSON.parse(text);
  return parsed;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "instructor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assignmentId } = await req.json();
  if (!assignmentId) {
    return NextResponse.json(
      { error: "assignmentId required" },
      { status: 400 }
    );
  }

  // Get all analyzed memos for this assignment
  const analyzedMemos = await db
    .select()
    .from(memos)
    .where(eq(memos.assignmentId, assignmentId));

  const analyzed = analyzedMemos.filter((m) => m.status === "analyzed");
  if (analyzed.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 analyzed memos to generate pairings" },
      { status: 400 }
    );
  }

  // Get student names
  const studentIds = analyzed.map((m) => m.studentId);
  const studentRows = await db
    .select()
    .from(users)
    .where(inArray(users.id, studentIds));

  const studentMap = new Map(studentRows.map((s) => [s.id, s]));

  // Build memo summaries for Claude
  const memoSummaries: MemoForPairing[] = analyzed.map((m) => {
    const student = studentMap.get(m.studentId);
    const analysis = m.analysis as any;
    return {
      studentId: m.studentId,
      studentName: student?.name || "Unknown",
      position: m.positionBinary || "unclassified",
      thesis: analysis?.thesis || "",
      keyClaims: analysis?.key_claims || [],
      stanceStrength: analysis?.stance_strength || "moderate",
    };
  });

  // Use Claude to create intelligent pairings
  let pairingResult: { pairs: ClaudePair[]; unpaired: string[] };

  try {
    pairingResult = await clusterAndPairWithClaude(memoSummaries);
  } catch (err: any) {
    console.error("Claude pairing failed, using fallback:", err.message);
    // Fallback: simple opposing position matching
    return fallbackPairing(assignmentId, analyzed);
  }

  // Create Daily rooms and insert pairings
  const createdPairings = [];
  for (const pair of pairingResult.pairs) {
    const roomName: string = `debate-${assignmentId.slice(0, 8)}-${Date.now()}-${createdPairings.length}`;
    let room: { url: string; id: string } = { url: "", id: roomName };
    try {
      room = await createRoom(roomName);
    } catch {
      room = {
        url: `http://localhost:3000/debate/room/${roomName}`,
        id: roomName,
      };
    }

    const reason = pair.debate_topic
      ? `${pair.debate_topic} — ${pair.reason}`
      : pair.reason;

    const [newPairing] = await db
      .insert(pairings)
      .values({
        assignmentId,
        studentAId: pair.student_a_id,
        studentBId: pair.student_b_id,
        debateRoomUrl: room.url,
        debateRoomId: room.id,
        matchmakingReason: reason,
        status: "paired",
      })
      .returning();

    createdPairings.push(newPairing);
  }

  return NextResponse.json({
    pairings: createdPairings,
    unpaired: pairingResult.unpaired,
  });
}

// Fallback pairing when Claude is unavailable
async function fallbackPairing(assignmentId: string, analyzed: any[]) {
  const positive = analyzed.filter((m) => m.positionBinary === "net_positive");
  const negative = analyzed.filter((m) => m.positionBinary === "net_negative");

  const pairs = [];
  const count = Math.min(positive.length, negative.length);

  for (let i = 0; i < count; i++) {
    const roomName = `debate-${assignmentId.slice(0, 8)}-${Date.now()}-${i}`;
    let room = { url: "", id: roomName };
    try {
      room = await createRoom(roomName);
    } catch {
      room = {
        url: `http://localhost:3000/debate/room/${roomName}`,
        id: roomName,
      };
    }

    const [newPairing] = await db
      .insert(pairings)
      .values({
        assignmentId,
        studentAId: positive[i].studentId,
        studentBId: negative[i].studentId,
        debateRoomUrl: room.url,
        debateRoomId: room.id,
        matchmakingReason: "Opposing positions (fallback matching)",
        status: "paired",
      })
      .returning();

    pairs.push(newPairing);
  }

  const unpairedPositive = positive.slice(count).map((m: any) => m.studentId);
  const unpairedNegative = negative.slice(count).map((m: any) => m.studentId);

  return NextResponse.json({
    pairings: pairs,
    unpaired: [...unpairedPositive, ...unpairedNegative],
  });
}
