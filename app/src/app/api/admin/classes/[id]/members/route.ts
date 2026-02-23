import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { classes, classMemberships, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any).role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [classRow] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);

  if (!classRow) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const members = await db
    .select({
      id: users.id,
      membershipId: classMemberships.id,
      name: users.name,
      email: users.email,
      role: users.role,
      joinedAt: classMemberships.joinedAt,
    })
    .from(classMemberships)
    .innerJoin(users, eq(classMemberships.userId, users.id))
    .where(eq(classMemberships.classId, id));

  return NextResponse.json({
    ...classRow,
    members,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any).role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { userId, email } = await req.json();

  if (!userId && !email) {
    return NextResponse.json({ error: "userId or email is required" }, { status: 400 });
  }

  let user;
  if (userId) {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
  } else {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
  }

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(classMemberships)
    .where(
      and(
        eq(classMemberships.classId, id),
        eq(classMemberships.userId, user.id)
      )
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "User is already a member" }, { status: 409 });
  }

  const [membership] = await db
    .insert(classMemberships)
    .values({ classId: id, userId: user.id })
    .returning();

  return NextResponse.json(membership, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as any).role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { membershipId } = await req.json();
  if (!membershipId) {
    return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
  }

  await db
    .delete(classMemberships)
    .where(eq(classMemberships.id, membershipId));

  return NextResponse.json({ success: true });
}
