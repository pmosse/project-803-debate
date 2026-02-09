import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import psycopg2
from scorer import score_student
from summarizer import generate_summary

load_dotenv()

app = FastAPI(title="Evaluator", version="1.0.0")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://debates:debates@localhost:5433/debates")


def get_db():
    return psycopg2.connect(DATABASE_URL)


class EvaluateRequest(BaseModel):
    debate_session_id: str


@app.post("/evaluate")
async def evaluate_debate(request: EvaluateRequest):
    conn = get_db()
    cur = conn.cursor()

    try:
        # Get debate session
        cur.execute(
            """SELECT ds.id, ds.transcript, ds.pairing_id,
                p.student_a_id, p.student_b_id, p.assignment_id
            FROM debate_sessions ds
            JOIN pairings p ON p.id = ds.pairing_id
            WHERE ds.id = %s""",
            (request.debate_session_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")

        session_id, transcript, pairing_id, student_a_id, student_b_id, assignment_id = row

        transcript_data = transcript if isinstance(transcript, list) else json.loads(transcript) if transcript else []

        # Get assignment
        cur.execute(
            "SELECT prompt_text, rubric_text FROM assignments WHERE id = %s",
            (assignment_id,),
        )
        assignment = cur.fetchone()
        prompt_text = assignment[0] if assignment else ""
        rubric_text = assignment[1] if assignment else ""

        results = []

        for student_id, label in [(student_a_id, "Student A"), (student_b_id, "Student B")]:
            # Get memo
            cur.execute(
                "SELECT extracted_text, analysis FROM memos WHERE student_id = %s AND assignment_id = %s",
                (student_id, assignment_id),
            )
            memo = cur.fetchone()
            memo_text = memo[0] if memo else ""

            # Score
            scores = score_student(
                assignment_prompt=prompt_text,
                rubric=rubric_text,
                memo_text=memo_text,
                transcript=transcript_data,
                student_label=label,
            )

            # Generate summary
            summary = generate_summary(scores, transcript_data, label)

            # Store evaluation
            cur.execute(
                """INSERT INTO evaluations
                (debate_session_id, student_id, score, confidence,
                 evidence_of_reading_score, opening_clarity, rebuttal_quality,
                 reading_accuracy, evidence_use, integrity_flags,
                 ai_summary, pass_fail)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                RETURNING id""",
                (
                    session_id,
                    student_id,
                    scores["overall_score"],
                    scores["confidence"],
                    scores["evidence_of_reading"],
                    scores["opening_clarity"],
                    scores["rebuttal_quality"],
                    scores["reading_accuracy"],
                    scores["evidence_use"],
                    json.dumps(scores.get("integrity_flags", [])),
                    summary,
                    scores["pass_fail"],
                ),
            )

            results.append({
                "student_id": student_id,
                "scores": scores,
                "summary": summary,
            })

        conn.commit()
        return {"evaluations": results}

    finally:
        cur.close()
        conn.close()


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
