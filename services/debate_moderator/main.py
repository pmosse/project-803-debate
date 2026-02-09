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

# Active sessions
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


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    context = get_session_context(session_id)
    if not context:
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close()
        return

    moderator = Moderator(
        assignment_title=context["assignment_title"],
        student_a_thesis=context["student_a_thesis"],
        student_b_thesis=context["student_b_thesis"],
        assignment_id=context["assignment_id"],
        reading_indexer_url=READING_INDEXER_URL,
    )

    stt = DeepgramSTTHandler()
    transcript: list[dict] = []
    last_intervention_time = 0
    current_phase = "opening_a"

    async def handle_stt_result(speaker: str, text: str, is_final: bool):
        nonlocal last_intervention_time

        # Send transcript to frontend
        await websocket.send_json({
            "type": "transcript",
            "speaker": speaker,
            "text": text,
            "is_final": is_final,
            "timestamp": time.time(),
        })

        if is_final and text.strip():
            transcript.append({
                "speaker": speaker,
                "text": text,
                "timestamp": time.time(),
                "phase": current_phase,
            })

            # Check if moderation is appropriate (during cross-exam phases)
            now = time.time()
            if (
                "crossexam" in current_phase
                and now - last_intervention_time >= 30
            ):
                intervention = await moderator.evaluate_utterance(
                    text, speaker, current_phase, transcript[-10:]
                )
                if intervention and intervention.get("should_intervene"):
                    last_intervention_time = now
                    await websocket.send_json({
                        "type": "intervention",
                        "intervention_type": intervention.get("intervention_type", "question"),
                        "target_student": intervention.get("target_student", "both"),
                        "message": intervention.get("message", ""),
                    })

            # Persist transcript periodically
            if len(transcript) % 5 == 0:
                save_transcript(session_id, transcript)

    stt.on_result = handle_stt_result

    try:
        while True:
            data = await websocket.receive_json()

            if data["type"] == "audio":
                # Forward audio to Deepgram STT
                await stt.send_audio(data["audio"], data.get("speaker", "Unknown"))

            elif data["type"] == "phase_command":
                current_phase = data.get("phase", current_phase)

            elif data["type"] == "end":
                # Final transcript save
                save_transcript(session_id, transcript)
                break

    except WebSocketDisconnect:
        # Save transcript on disconnect
        save_transcript(session_id, transcript)
    finally:
        await stt.close()


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
