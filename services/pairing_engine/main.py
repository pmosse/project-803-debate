import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import psycopg2

load_dotenv()

app = FastAPI(title="Pairing Engine", version="1.0.0")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://debates:debates@localhost:5433/debates")

STRENGTH_ORDER = {"weak": 0, "moderate": 1, "strong": 2}


def get_db():
    return psycopg2.connect(DATABASE_URL)


def compute_argument_diversity(claims_a: list[str], claims_b: list[str]) -> float:
    """Higher score = more diverse arguments between the two students."""
    if not claims_a or not claims_b:
        return 0.0
    set_a = set(c.lower() for c in claims_a)
    set_b = set(c.lower() for c in claims_b)
    if not set_a or not set_b:
        return 0.0
    # Jaccard distance: 1 - intersection/union
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return 1.0 - (intersection / union) if union > 0 else 0.0


class PairRequest(BaseModel):
    assignment_id: str


@app.post("/pair")
async def pair_students(request: PairRequest):
    conn = get_db()
    cur = conn.cursor()

    try:
        # Get all analyzed memos for this assignment
        cur.execute(
            """SELECT m.student_id, m.position_binary, m.analysis
            FROM memos m
            WHERE m.assignment_id = %s
            AND m.status = 'analyzed'
            AND m.position_binary IN ('net_positive', 'net_negative')""",
            (request.assignment_id,),
        )

        positives = []
        negatives = []

        for row in cur.fetchall():
            student_id, position, analysis = row
            analysis_data = analysis if isinstance(analysis, dict) else json.loads(analysis) if analysis else {}
            entry = {
                "student_id": student_id,
                "stance_strength": STRENGTH_ORDER.get(
                    analysis_data.get("stance_strength", "moderate"), 1
                ),
                "key_claims": analysis_data.get("key_claims", []),
            }
            if position == "net_positive":
                positives.append(entry)
            else:
                negatives.append(entry)

        # Sort by stance_strength (weakest first)
        positives.sort(key=lambda x: x["stance_strength"])
        negatives.sort(key=lambda x: x["stance_strength"])

        # Greedy matching with argument diversity
        pairs = []
        used_negatives = set()

        for pos in positives:
            best_neg = None
            best_diversity = -1

            for i, neg in enumerate(negatives):
                if i in used_negatives:
                    continue
                diversity = compute_argument_diversity(
                    pos["key_claims"], neg["key_claims"]
                )
                if diversity > best_diversity:
                    best_diversity = diversity
                    best_neg = (i, neg)

            if best_neg is not None:
                idx, neg = best_neg
                used_negatives.add(idx)
                pairs.append({
                    "student_a_id": pos["student_id"],
                    "student_b_id": neg["student_id"],
                    "reason": f"Opposing positions, argument diversity: {best_diversity:.2f}",
                })

        # Collect unpaired students
        unpaired = []
        for i, neg in enumerate(negatives):
            if i not in used_negatives:
                unpaired.append(neg["student_id"])
        if len(positives) > len(negatives):
            unpaired.extend(
                p["student_id"] for p in positives[len(negatives):]
            )

        return {"pairs": pairs, "unpaired": unpaired}

    finally:
        cur.close()
        conn.close()


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
