import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import psycopg2

# Load .env BEFORE importing modules that read env vars at module level
load_dotenv()

from scorer import score_student
from summarizer import generate_summary

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

        # Get assignment (including rubric_criteria)
        cur.execute(
            "SELECT prompt_text, rubric_text, rubric_criteria FROM assignments WHERE id = %s",
            (assignment_id,),
        )
        assignment = cur.fetchone()
        prompt_text = assignment[0] if assignment else ""
        rubric_text = assignment[1] if assignment else ""
        rubric_criteria_raw = assignment[2] if assignment else None

        # Parse rubric_criteria from jsonb
        rubric_criteria = None
        if rubric_criteria_raw:
            if isinstance(rubric_criteria_raw, list):
                rubric_criteria = rubric_criteria_raw
            elif isinstance(rubric_criteria_raw, str):
                rubric_criteria = json.loads(rubric_criteria_raw)

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
                rubric_criteria=rubric_criteria,
                assignment_id=assignment_id,
                pairing_id=pairing_id,
            )

            # Extract criteria_scores if present
            criteria_scores = scores.get("criteria_scores")

            # Generate summary
            summary = generate_summary(
                scores, transcript_data, label,
                criteria_scores=criteria_scores,
                assignment_id=assignment_id,
                pairing_id=pairing_id,
            )

            # Store evaluation
            cur.execute(
                """INSERT INTO evaluations
                (debate_session_id, student_id, score, confidence,
                 evidence_of_reading_score, opening_clarity, rebuttal_quality,
                 reading_accuracy, evidence_use, integrity_flags,
                 criteria_scores, ai_summary, pass_fail)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)
                RETURNING id""",
                (
                    session_id,
                    student_id,
                    scores["overall_score"],
                    scores.get("confidence", 0),
                    scores.get("evidence_of_reading", 0),
                    scores.get("opening_clarity", 0),
                    scores.get("rebuttal_quality", 0),
                    scores.get("reading_accuracy", 0),
                    scores.get("evidence_use", 0),
                    json.dumps(scores.get("integrity_flags", [])),
                    json.dumps(criteria_scores) if criteria_scores else None,
                    summary,
                    scores["pass_fail"],
                ),
            )

            results.append({
                "student_id": student_id,
                "scores": {k: v for k, v in scores.items() if not k.startswith("_")},
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
