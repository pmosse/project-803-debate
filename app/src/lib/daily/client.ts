const DAILY_API_URL = process.env.DAILY_API_URL || "https://api.daily.co/v1";
const DAILY_API_KEY = process.env.DAILY_API_KEY || "";

interface DailyRoom {
  id: string;
  name: string;
  url: string;
}

export async function createRoom(roomName: string): Promise<DailyRoom> {
  const response = await fetch(`${DAILY_API_URL}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        enable_recording: "cloud",
        enable_chat: false,
        max_participants: 2,
        exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Daily.co API error: ${response.statusText}`);
  }

  return response.json();
}

export async function createMeetingToken(
  roomName: string,
  userName: string
): Promise<string> {
  const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        is_owner: false,
        exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Daily.co token error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.token;
}

export async function deleteRoom(roomName: string): Promise<void> {
  await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
  });
}
