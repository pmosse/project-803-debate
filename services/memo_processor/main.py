import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from extractor import extract_text
from analyzer import analyze_memo
import psycopg2
import boto3
import tempfile

load_dotenv()

app = FastAPI(title="Memo Processor", version="1.0.0")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://debates:debates@localhost:5432/debates")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "debates")

s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
)


def get_db():
    return psycopg2.connect(DATABASE_URL)


class ProcessRequest(BaseModel):
    memo_id: str


@app.post("/process")
async def process_memo(request: ProcessRequest):
    conn = get_db()
    cur = conn.cursor()

    try:
        # Get memo record
        cur.execute(
            "SELECT id, file_path, assignment_id FROM memos WHERE id = %s",
            (request.memo_id,),
        )
        memo = cur.fetchone()
        if not memo:
            raise HTTPException(status_code=404, detail="Memo not found")

        memo_id, file_path, assignment_id = memo

        # Update status to extracting
        cur.execute(
            "UPDATE memos SET status = 'extracting' WHERE id = %s", (memo_id,)
        )
        conn.commit()

        # Download file from S3
        with tempfile.NamedTemporaryFile(suffix=os.path.splitext(file_path)[1], delete=False) as tmp:
            s3.download_fileobj(S3_BUCKET, file_path, tmp)
            tmp_path = tmp.name

        # Extract text
        try:
            extracted_text = extract_text(tmp_path)
        except Exception as e:
            cur.execute(
                "UPDATE memos SET status = 'error' WHERE id = %s", (memo_id,)
            )
            conn.commit()
            raise HTTPException(status_code=422, detail=f"Text extraction failed: {str(e)}")
        finally:
            os.unlink(tmp_path)

        # Update status and text
        cur.execute(
            "UPDATE memos SET status = 'analyzing', extracted_text = %s WHERE id = %s",
            (extracted_text, memo_id),
        )
        conn.commit()

        # Get assignment prompt for analysis
        cur.execute(
            "SELECT prompt_text FROM assignments WHERE id = %s", (assignment_id,)
        )
        assignment = cur.fetchone()
        prompt_text = assignment[0] if assignment else ""

        # Analyze with Claude
        try:
            analysis = analyze_memo(extracted_text, prompt_text)
        except Exception as e:
            cur.execute(
                "UPDATE memos SET status = 'error' WHERE id = %s", (memo_id,)
            )
            conn.commit()
            raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

        # Update memo with analysis
        import json

        position_binary = analysis.get("position", "unclassified")
        cur.execute(
            """UPDATE memos
            SET status = 'analyzed',
                analysis = %s::jsonb,
                position_binary = %s,
                analyzed_at = NOW()
            WHERE id = %s""",
            (json.dumps(analysis), position_binary, memo_id),
        )
        conn.commit()

        return {"status": "analyzed", "analysis": analysis}

    except HTTPException:
        raise
    except Exception as e:
        cur.execute(
            "UPDATE memos SET status = 'error' WHERE id = %s", (request.memo_id,)
        )
        conn.commit()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
