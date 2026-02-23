import os
import threading
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://debates:debates@localhost:5433/debates")

# Pricing per million tokens (input/output) or per second
PRICING = {
    # Claude Sonnet
    "claude-sonnet-4-5-20250929": {"input": 3.0, "output": 15.0},
    # Claude Haiku
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.0},
    # Deepgram (per second)
    "deepgram": {"per_second": 0.0043},
}


def _estimate_cost(
    service: str,
    model: str | None,
    input_tokens: int | None,
    output_tokens: int | None,
    duration_seconds: float | None,
) -> float:
    if service == "deepgram" and duration_seconds:
        rate = PRICING.get("deepgram", {}).get("per_second", 0.0043)
        return duration_seconds * rate

    if model and model in PRICING:
        pricing = PRICING[model]
        cost = 0.0
        if input_tokens:
            cost += (input_tokens / 1_000_000) * pricing.get("input", 0)
        if output_tokens:
            cost += (output_tokens / 1_000_000) * pricing.get("output", 0)
        return cost

    return 0.0


def _do_log(
    service: str,
    model: str | None,
    call_type: str,
    input_tokens: int | None,
    output_tokens: int | None,
    duration_seconds: float | None,
    assignment_id: str | None,
    pairing_id: str | None,
    memo_id: str | None,
):
    try:
        cost = _estimate_cost(service, model, input_tokens, output_tokens, duration_seconds)
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO ai_usage
            (service, model, call_type, input_tokens, output_tokens,
             duration_seconds, estimated_cost, assignment_id, pairing_id, memo_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                service,
                model,
                call_type,
                input_tokens,
                output_tokens,
                duration_seconds,
                cost,
                assignment_id,
                pairing_id,
                memo_id,
            ),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[usage_logger] Error logging usage: {e}")


def log_usage(
    service: str,
    model: str | None,
    call_type: str,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    duration_seconds: float | None = None,
    assignment_id: str | None = None,
    pairing_id: str | None = None,
    memo_id: str | None = None,
):
    """Fire-and-forget usage logging via daemon thread."""
    t = threading.Thread(
        target=_do_log,
        args=(service, model, call_type, input_tokens, output_tokens,
              duration_seconds, assignment_id, pairing_id, memo_id),
        daemon=True,
    )
    t.start()
