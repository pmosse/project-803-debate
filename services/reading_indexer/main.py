import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import psycopg2
import numpy as np
from sentence_transformers import SentenceTransformer

load_dotenv()

app = FastAPI(title="Reading Indexer", version="1.0.0")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://debates:debates@localhost:5433/debates")

# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")


def get_db():
    return psycopg2.connect(DATABASE_URL)


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
    """Split text into overlapping chunks by word count."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


class IndexRequest(BaseModel):
    assignment_id: str
    source_title: str
    text: str


class QueryRequest(BaseModel):
    assignment_id: str
    query: str
    top_k: int = 5


@app.post("/index")
async def index_reading(request: IndexRequest):
    """Chunk text, generate embeddings, and store in pgvector."""
    chunks = chunk_text(request.text)
    conn = get_db()
    cur = conn.cursor()

    try:
        for chunk in chunks:
            embedding = model.encode(chunk).tolist()
            cur.execute(
                """INSERT INTO reading_chunks (assignment_id, source_title, chunk_text, embedding)
                VALUES (%s, %s, %s, %s::vector)""",
                (request.assignment_id, request.source_title, chunk, str(embedding)),
            )
        conn.commit()
        return {"indexed_chunks": len(chunks)}
    finally:
        cur.close()
        conn.close()


@app.post("/query")
async def query_readings(request: QueryRequest):
    """Query reading chunks by cosine similarity."""
    query_embedding = model.encode(request.query).tolist()
    conn = get_db()
    cur = conn.cursor()

    try:
        cur.execute(
            """SELECT source_title, chunk_text,
                1 - (embedding <=> %s::vector) as similarity
            FROM reading_chunks
            WHERE assignment_id = %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s""",
            (str(query_embedding), request.assignment_id, str(query_embedding), request.top_k),
        )
        results = [
            {
                "source_title": row[0],
                "chunk_text": row[1],
                "similarity": float(row[2]),
            }
            for row in cur.fetchall()
        ]
        return {"results": results}
    finally:
        cur.close()
        conn.close()


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
