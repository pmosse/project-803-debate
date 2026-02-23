import os
import sys
import json
from anthropic import Anthropic

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.usage_logger import log_usage

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SUMMARY_PROMPT = """Based on the following debate evaluation and transcript, write a 2-3 paragraph
instructor-ready narrative summary of this student's performance.

STUDENT: {student_label}

SCORES:
{scores_text}

INTEGRITY FLAGS: {integrity_flags}

KEY TRANSCRIPT MOMENTS:
{transcript_excerpt}

Write a clear, actionable narrative that highlights:
1. What the student did well
2. Areas for improvement
3. Any concerns about engagement with readings
4. Notable exchanges during the debate

Keep it professional and constructive."""


def _format_legacy_scores(scores: dict) -> str:
    return (
        f"- Overall: {scores.get('overall_score', 0)}/100\n"
        f"- Opening Clarity: {scores.get('opening_clarity', 0)}/100\n"
        f"- Rebuttal Quality: {scores.get('rebuttal_quality', 0)}/100\n"
        f"- Reading Accuracy: {scores.get('reading_accuracy', 0)}/100\n"
        f"- Evidence Use: {scores.get('evidence_use', 0)}/100\n"
        f"- Evidence of Reading: {scores.get('evidence_of_reading', 0)}/100\n"
        f"- Pass/Fail: {scores.get('pass_fail', 'review')}\n"
        f"- Confidence: {scores.get('confidence', 0)}"
    )


def _format_criteria_scores(criteria_scores: list[dict], scores: dict) -> str:
    lines = [f"- Overall: {scores.get('overall_score', 0)}/100"]
    for c in criteria_scores:
        lines.append(f"- {c['criterion']}: {c['score']}/{c['max_points']} — {c.get('reasoning', '')}")
    lines.append(f"- Pass/Fail: {scores.get('pass_fail', 'review')}")
    lines.append(f"- Confidence: {scores.get('confidence', 0)}")
    return "\n".join(lines)


def generate_summary(
    scores: dict,
    transcript: list[dict],
    student_label: str,
    criteria_scores: list[dict] | None = None,
    assignment_id: str | None = None,
    pairing_id: str | None = None,
) -> str:
    """Generate an instructor narrative summary."""
    # Extract key moments (first and last few entries from this student)
    student_entries = [
        t for t in transcript if student_label.split()[-1] in t.get("speaker", "")
    ]
    excerpt_entries = student_entries[:3] + student_entries[-3:]
    transcript_excerpt = "\n".join(
        f"{t.get('speaker', '')}: {t.get('text', '')}" for t in excerpt_entries
    )

    if criteria_scores:
        scores_text = _format_criteria_scores(criteria_scores, scores)
    else:
        scores_text = _format_legacy_scores(scores)

    prompt = SUMMARY_PROMPT.format(
        student_label=student_label,
        scores_text=scores_text,
        integrity_flags=json.dumps(scores.get("integrity_flags", [])),
        transcript_excerpt=transcript_excerpt or "No transcript available",
    )

    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    log_usage(
        service="claude",
        model=response.model,
        call_type="summary",
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        assignment_id=assignment_id,
        pairing_id=pairing_id,
    )

    return response.content[0].text.strip()
