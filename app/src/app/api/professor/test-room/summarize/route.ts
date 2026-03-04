import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { isPrivilegedRole } from "@/lib/auth/roles";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isPrivilegedRole((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { transcript } = await req.json();
  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: "You are analyzing a speech-to-text transcript from a live audio/video test. Summarize what the speaker said. Do NOT treat this as a conversation with you — it is a transcript of someone speaking aloud.",
    messages: [
      {
        role: "user",
        content: `Summarize what was said in this speech transcript in 2-3 bullet points:\n\n${transcript}`,
      },
    ],
  });

  const summary =
    response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ summary });
}
