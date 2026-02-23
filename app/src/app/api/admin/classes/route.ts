import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { classes, classMemberships } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      code: classes.code,
      description: classes.description,
      memberCount: sql<number>`(SELECT count(*) FROM class_memberships WHERE class_id = ${classes.id})`,
    })
    .from(classes)
    .orderBy(classes.name);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, code, description } = await req.json();
  if (!name || !code) {
    return NextResponse.json({ error: "Name and code are required" }, { status: 400 });
  }

  const [created] = await db
    .insert(classes)
    .values({ name, code, description: description || null })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
