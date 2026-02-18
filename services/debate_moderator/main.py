import os
import json
import time
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
import psycopg2

# Load .env BEFORE importing modules that read env vars at module level
load_dotenv()

from moderator import Moderator

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

        # Get student names
        cur.execute(
            "SELECT id, name FROM users WHERE id IN (%s, %s)",
            (student_a_id, student_b_id),
        )
        names = {}
        for uid, uname in cur.fetchall():
            names[uid] = uname

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
            "student_a_name": names.get(student_a_id, "Student A"),
            "student_b_name": names.get(student_b_id, "Student B"),
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
            student_a_name=context.get("student_a_name", "Student A"),
            student_b_name=context.get("student_b_name", "Student B"),
            assignment_id=context["assignment_id"],
            reading_indexer_url=READING_INDEXER_URL,
        )

        sessions[session_id] = {
            "connections": set(),
            "moderator": moderator,
            "transcript": [],
            "last_intervention_time": 0,
            "current_phase": "opening_a",
            "phase_started_at": time.time(),
            "last_speech_time": time.time(),
            "silence_nudge_sent": False,
            "silence_task": None,
        }

        async def silence_monitor():
            """Check for silence every 5s; nudge if >15s silence during active phase."""
            while session_id in sessions:
                await asyncio.sleep(5)
                s = sessions.get(session_id)
                if not s:
                    break
                phase = s["current_phase"]
                if phase in ("waiting", "consent", "completed"):
                    continue
                if s["silence_nudge_sent"]:
                    continue
                elapsed = time.time() - s["last_speech_time"]
                if elapsed >= 15:
                    # Determine who should be speaking
                    speaker = "A" if phase.endswith("_a") else "B"
                    nudge = await s["moderator"].generate_silence_nudge(phase, speaker)
                    if nudge:
                        s["silence_nudge_sent"] = True
                        await broadcast(session_id, {
                            "type": "intervention",
                            "intervention_type": "nudge",
                            "target_student": speaker,
                            "message": nudge,
                        })

        sessions[session_id]["silence_task"] = asyncio.create_task(silence_monitor())

    session = sessions[session_id]
    session["connections"].add(websocket)

    # Send current phase and elapsed time so late joiners sync up
    elapsed = time.time() - session["phase_started_at"]
    await websocket.send_json({
        "type": "sync",
        "phase": session["current_phase"],
        "elapsed": round(elapsed),
    })

    try:
        while True:
            data = await websocket.receive_json()

            if data["type"] == "transcript_text":
                speaker = data.get("speaker", "Unknown")
                text = data.get("text", "")
                is_final = data.get("is_final", False)

                # Broadcast to other client so they see transcripts in UI
                await broadcast(session_id, {
                    "type": "transcript",
                    "speaker": speaker,
                    "text": text,
                    "is_final": is_final,
                    "timestamp": time.time(),
                }, exclude=websocket)

                # Save final transcripts + run moderation
                if is_final and text.strip():
                    session["transcript"].append({
                        "speaker": speaker,
                        "text": text,
                        "timestamp": time.time(),
                        "phase": session["current_phase"],
                    })
                    session["last_speech_time"] = time.time()

                    now = time.time()
                    phase = session["current_phase"]
                    cooldown = 45 if ("opening" in phase or "closing" in phase) else 30
                    if now - session["last_intervention_time"] >= cooldown:
                        intervention = await session["moderator"].evaluate_utterance(
                            text, speaker, phase, session["transcript"][-10:]
                        )
                        if intervention and intervention.get("should_intervene"):
                            session["last_intervention_time"] = now
                            await broadcast(session_id, {
                                "type": "intervention",
                                "intervention_type": intervention.get("intervention_type", "question"),
                                "target_student": intervention.get("target_student", "both"),
                                "message": intervention.get("message", ""),
                            })

                    if len(session["transcript"]) % 5 == 0:
                        save_transcript(session_id, session["transcript"])

            elif data["type"] == "phase_command":
                new_phase = data.get("phase", session["current_phase"])
                old_phase = session["current_phase"]
                session["current_phase"] = new_phase
                session["phase_started_at"] = time.time()
                session["last_speech_time"] = time.time()
                session["silence_nudge_sent"] = False

                # Broadcast phase change to other clients (sync timers)
                if new_phase != old_phase:
                    await broadcast(session_id, {
                        "type": "phase_advance",
                        "phase": new_phase,
                    }, exclude=websocket)

                # Generate AI phase prompt on transition
                if new_phase not in ("waiting", "consent", "completed"):
                    phase_text = await session["moderator"].generate_phase_prompt(new_phase)
                    if phase_text:
                        await broadcast(session_id, {
                            "type": "intervention",
                            "intervention_type": "phase_prompt",
                            "target_student": "both",
                            "message": phase_text,
                        })

            elif data["type"] == "phase_advance":
                # Update server-side phase tracking
                new_phase = data.get("phase", session["current_phase"])
                session["current_phase"] = new_phase
                session["phase_started_at"] = time.time()
                # Relay to all OTHER connections
                await broadcast(session_id, {
                    "type": "phase_advance",
                    "phase": new_phase,
                }, exclude=websocket)

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
            if session.get("silence_task"):
                session["silence_task"].cancel()
            del sessions[session_id]


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
