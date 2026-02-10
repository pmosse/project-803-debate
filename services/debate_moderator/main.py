import os
import json
import time
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
import psycopg2
from moderator import Moderator
from stt_handler import DeepgramSTTHandler

load_dotenv()

app = FastAPI(title="Debate Moderator", version="1.0.0")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://debates:debates@localhost:5433/debates")
READING_INDEXER_URL = os.getenv("READING_INDEXER_URL", "http://localhost:8002")

# Active sessions: session_id -> { "connections": set[WebSocket], "transcript": list, ... }
sessions: dict[str, dict] = {}


def get_db():
    return psycopg2.connect(DATABASE_URL)


def get_session_context(session_id: str) -> dict:
    """Load debate context from the database."""
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            """SELECT ds.id, ds.pairing_id, p.assignment_id, p.student_a_id, p.student_b_id
            FROM debate_sessions ds
            JOIN pairings p ON p.id = ds.pairing_id
            WHERE ds.id = %s""",
            (session_id,),
        )
        row = cur.fetchone()
        if not row:
            return {}

        _, pairing_id, assignment_id, student_a_id, student_b_id = row

        # Get assignment
        cur.execute("SELECT title, prompt_text FROM assignments WHERE id = %s", (assignment_id,))
        assignment = cur.fetchone()

        # Get memos for both students
        cur.execute(
            "SELECT student_id, analysis FROM memos WHERE assignment_id = %s AND student_id IN (%s, %s)",
            (assignment_id, student_a_id, student_b_id),
        )
        memos = {}
        for memo_row in cur.fetchall():
            sid, analysis = memo_row
            memos[sid] = analysis if isinstance(analysis, dict) else json.loads(analysis) if analysis else {}

        return {
            "assignment_title": assignment[0] if assignment else "",
            "assignment_prompt": assignment[1] if assignment else "",
            "assignment_id": assignment_id,
            "student_a_thesis": memos.get(student_a_id, {}).get("thesis", ""),
            "student_b_thesis": memos.get(student_b_id, {}).get("thesis", ""),
        }
    finally:
        cur.close()
        conn.close()


def save_transcript(session_id: str, transcript: list):
    """Persist transcript to database."""
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(
            "UPDATE debate_sessions SET transcript = %s::jsonb WHERE id = %s",
            (json.dumps(transcript), session_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


async def broadcast(session_id: str, message: dict, exclude: WebSocket | None = None):
    """Send a message to all connections in a session."""
    session = sessions.get(session_id)
    if not session:
        return
    dead = []
    for ws in session["connections"]:
        if ws is exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        session["connections"].discard(ws)


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    context = get_session_context(session_id)
    if not context:
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close()
        return

    # Initialize or join existing session
    if session_id not in sessions:
        moderator = Moderator(
            assignment_title=context["assignment_title"],
            student_a_thesis=context["student_a_thesis"],
            student_b_thesis=context["student_b_thesis"],
            assignment_id=context["assignment_id"],
            reading_indexer_url=READING_INDEXER_URL,
        )
        stt = DeepgramSTTHandler()

        sessions[session_id] = {
            "connections": set(),
            "moderator": moderator,
            "stt": stt,
            "transcript": [],
            "last_intervention_time": 0,
            "current_phase": "opening_a",
        }

        async def handle_stt_result(speaker: str, text: str, is_final: bool):
            s = sessions.get(session_id)
            if not s:
                return

            msg = {
                "type": "transcript",
                "speaker": speaker,
                "text": text,
                "is_final": is_final,
                "timestamp": time.time(),
            }
            # Broadcast transcript to all connections
            await broadcast(session_id, msg)

            if is_final and text.strip():
                s["transcript"].append({
                    "speaker": speaker,
                    "text": text,
                    "timestamp": time.time(),
                    "phase": s["current_phase"],
                })

                now = time.time()
                if (
                    "crossexam" in s["current_phase"]
                    and now - s["last_intervention_time"] >= 30
                ):
                    intervention = await s["moderator"].evaluate_utterance(
                        text, speaker, s["current_phase"], s["transcript"][-10:]
                    )
                    if intervention and intervention.get("should_intervene"):
                        s["last_intervention_time"] = now
                        await broadcast(session_id, {
                            "type": "intervention",
                            "intervention_type": intervention.get("intervention_type", "question"),
                            "target_student": intervention.get("target_student", "both"),
                            "message": intervention.get("message", ""),
                        })

                if len(s["transcript"]) % 5 == 0:
                    save_transcript(session_id, s["transcript"])

        stt.on_result = handle_stt_result

    session = sessions[session_id]
    session["connections"].add(websocket)

    try:
        while True:
            data = await websocket.receive_json()

            if data["type"] == "audio":
                await session["stt"].send_audio(data["audio"], data.get("speaker", "Unknown"))

            elif data["type"] == "phase_command":
                session["current_phase"] = data.get("phase", session["current_phase"])

            elif data["type"] == "phase_advance":
                # Relay phase advance to all OTHER connections
                await broadcast(session_id, {"type": "phase_advance"}, exclude=websocket)

            elif data["type"] == "end":
                save_transcript(session_id, session["transcript"])
                break

    except WebSocketDisconnect:
        pass
    finally:
        session["connections"].discard(websocket)
        # Clean up session if no more connections
        if not session["connections"]:
            save_transcript(session_id, session["transcript"])
            await session["stt"].close()
            del sessions[session_id]


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
