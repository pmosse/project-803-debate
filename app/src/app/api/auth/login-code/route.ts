import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loginCodes, users } from "@/lib/db/schema";
import { eq, gte, and } from "drizzle-orm";
import { sendLoginCode } from "@/lib/email/client";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const emailLower = email.toLowerCase().trim();

  // Check user exists
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1);

  if (!user) {
    // Don't reveal whether email exists — still return success
    return NextResponse.json({ success: true });
  }

  // Rate limit: max 5 codes per email per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCodes = await db
    .select()
    .from(loginCodes)
    .where(
      and(
        eq(loginCodes.email, emailLower),
        gte(loginCodes.createdAt, oneHourAgo)
      )
    );

  if (recentCodes.length >= 5) {
    return NextResponse.json(
      { error: "Too many codes requested. Try again later." },
      { status: 429 }
    );
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(loginCodes).values({
    email: emailLower,
    code,
    expiresAt,
  });

  try {
    await sendLoginCode({ to: emailLower, code });
  } catch (err) {
    console.error("Failed to send login code email:", err);
  }

  return NextResponse.json({ success: true });
}
