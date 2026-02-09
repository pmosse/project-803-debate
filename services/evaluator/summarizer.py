import os
import json
from anthropic import Anthropic

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SUMMARY_PROMPT = """Based on the following debate evaluation and transcript, write a 2-3 paragraph
instructor-ready narrative summary of this student's performance.

STUDENT: {student_label}

SCORES:
- Overall: {overall_score}/100
- Opening Clarity: {opening_clarity}/100
- Rebuttal Quality: {rebuttal_quality}/100
- Reading Accuracy: {reading_accuracy}/100
- Evidence Use: {evidence_use}/100
- Evidence of Reading: {evidence_of_reading}/100
- Pass/Fail: {pass_fail}
- Confidence: {confidence}

INTEGRITY FLAGS: {integrity_flags}

KEY TRANSCRIPT MOMENTS:
{transcript_excerpt}

Write a clear, actionable narrative that highlights:
1. What the student did well
2. Areas for improvement
3. Any concerns about engagement with readings
4. Notable exchanges during the debate

Keep it professional and constructive."""


def generate_summary(
    scores: dict,
    transcript: list[dict],
    student_label: str,
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

    prompt = SUMMARY_PROMPT.format(
        student_label=student_label,
        overall_score=scores.get("overall_score", 0),
        opening_clarity=scores.get("opening_clarity", 0),
        rebuttal_quality=scores.get("rebuttal_quality", 0),
        reading_accuracy=scores.get("reading_accuracy", 0),
        evidence_use=scores.get("evidence_use", 0),
        evidence_of_reading=scores.get("evidence_of_reading", 0),
        pass_fail=scores.get("pass_fail", "review"),
        confidence=scores.get("confidence", 0),
        integrity_flags=json.dumps(scores.get("integrity_flags", [])),
        transcript_excerpt=transcript_excerpt or "No transcript available",
    )

    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.content[0].text.strip()
