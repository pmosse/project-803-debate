import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createRoom, createMeetingToken, deleteRoom } from "@/lib/daily/client";

export async function POST() {
  const session = await auth();
  if (!session || (session.user as any).role !== "instructor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roomName = `test-${Date.now()}`;
  const room = await createRoom(roomName);
  const token = await createMeetingToken(roomName, session.user.name || "Instructor");

  return NextResponse.json({
    roomUrl: room.url,
    roomName: room.name,
    token,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).role !== "instructor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomName } = await req.json();
  if (!roomName || typeof roomName !== "string") {
    return NextResponse.json({ error: "roomName required" }, { status: 400 });
  }

  await deleteRoom(roomName);
  return NextResponse.json({ ok: true });
}
