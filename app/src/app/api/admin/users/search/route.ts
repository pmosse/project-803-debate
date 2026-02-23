import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { or, ilike, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const pattern = `%${q}%`;
  const results = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(or(ilike(users.name, pattern), ilike(users.email, pattern)))
    .limit(10);

  return NextResponse.json(results);
}
