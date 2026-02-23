import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPrivilegedRole } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { classes, classMemberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session || !isPrivilegedRole((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      code: classes.code,
    })
    .from(classMemberships)
    .innerJoin(classes, eq(classMemberships.classId, classes.id))
    .where(eq(classMemberships.userId, session.user.id));

  return NextResponse.json(rows);
}
