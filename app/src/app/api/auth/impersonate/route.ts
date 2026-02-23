import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateImpersonateToken } from "@/lib/auth/config";
import { isPrivilegedRole } from "@/lib/auth/roles";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isPrivilegedRole((session.user as any).role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studentId } = await req.json();
  if (!studentId) {
    return NextResponse.json({ error: "studentId required" }, { status: 400 });
  }

  const token = generateImpersonateToken(studentId);
  return NextResponse.json({ studentId, token });
}
