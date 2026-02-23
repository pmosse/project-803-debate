import os
import sys
import json
from anthropic import Anthropic

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.usage_logger import log_usage

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

EVALUATION_PROMPT = """You are evaluating a student's performance in an AI-moderated oral debate.

ASSIGNMENT: {assignment_prompt}

RUBRIC: {rubric}

STUDENT'S MEMO:
{memo_text}

FULL DEBATE TRANSCRIPT:
{transcript}

THIS STUDENT IS: {student_label}

Evaluate on these dimensions (0-100 each):
1. Opening clarity: Was the opening statement clear, well-structured, and thesis-driven?
2. Rebuttal quality: Did the student effectively counter their opponent's arguments?
3. Reading accuracy: Did the student correctly represent findings from the assigned readings?
4. Evidence use: Did the student cite specific evidence from readings to support claims?

Also assess:
- Evidence-of-reading score (0-100): Overall, how confident are you that this student genuinely read and understood the assigned materials?
- Overall score (0-100): Holistic assessment
- Pass/Fail recommendation with confidence (0-1)
- Integrity flags: Any of these detected?
  * Student couldn't explain a key mechanism they referenced in memo
  * Student couldn't connect claim to reading evidence
  * Student contradicted memo thesis without plausible reason
  * Overly polished but shallow answers that never cite specifics

Output ONLY valid JSON:
{{
  "overall_score": number,
  "confidence": number,
  "evidence_of_reading": number,
  "opening_clarity": number,
  "rebuttal_quality": number,
  "reading_accuracy": number,
  "evidence_use": number,
  "pass_fail": "pass" | "fail" | "review",
  "integrity_flags": ["flag1", ...]
}}"""

STRUCTURED_EVALUATION_PROMPT = """You are evaluating a student's performance in an AI-moderated oral debate.

ASSIGNMENT: {assignment_prompt}

STUDENT'S MEMO:
{memo_text}

FULL DEBATE TRANSCRIPT:
{transcript}

THIS STUDENT IS: {student_label}

RUBRIC CRITERIA:
{criteria_text}

Score this student on EACH criterion listed above. For each criterion, assign a score from 0 to its max points.
Also provide an overall score (0-100), confidence (0-1), pass/fail recommendation, and any integrity flags.

Integrity flags to check:
- Student couldn't explain a key mechanism they referenced in memo
- Student couldn't connect claim to reading evidence
- Student contradicted memo thesis without plausible reason
- Overly polished but shallow answers that never cite specifics

Output ONLY valid JSON:
{{
  "criteria_scores": [
    {{"criterion": "criterion name", "score": number, "max_points": number, "reasoning": "brief explanation"}},
    ...
  ],
  "overall_score": number,
  "confidence": number,
  "pass_fail": "pass" | "fail" | "review",
  "integrity_flags": ["flag1", ...]
}}"""


def score_student(
    assignment_prompt: str,
    rubric: str,
    memo_text: str,
    transcript: list[dict],
    student_label: str,
    rubric_criteria: list[dict] | None = None,
    assignment_id: str | None = None,
    pairing_id: str | None = None,
) -> dict:
    """Score a student's debate performance using Claude."""
    transcript_text = "\n".join(
        f"{t.get('speaker', 'Unknown')}: {t.get('text', '')}" for t in transcript
    )

    if rubric_criteria and len(rubric_criteria) > 0:
        # Structured rubric evaluation
        criteria_text = "\n".join(
            f"- {c['name']} (max {c['maxPoints']} pts): {c.get('description', '')}"
            for c in rubric_criteria
        )
        prompt = STRUCTURED_EVALUATION_PROMPT.format(
            assignment_prompt=assignment_prompt,
            memo_text=memo_text or "No memo available",
            transcript=transcript_text or "No transcript available",
            student_label=student_label,
            criteria_text=criteria_text,
        )
    else:
        # Legacy free-text rubric evaluation
        prompt = EVALUATION_PROMPT.format(
            assignment_prompt=assignment_prompt,
            rubric=rubric or "No rubric provided",
            memo_text=memo_text or "No memo available",
            transcript=transcript_text or "No transcript available",
            student_label=student_label,
        )

    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])

    scores = json.loads(text)

    # Validate and default
    if "overall_score" not in scores:
        scores["overall_score"] = 0
    if "confidence" not in scores:
        scores["confidence"] = 0
    if "pass_fail" not in scores:
        scores["pass_fail"] = "review"
    if "integrity_flags" not in scores:
        scores["integrity_flags"] = []

    # For legacy prompt, ensure dimension scores exist
    if not rubric_criteria:
        for field in ["evidence_of_reading", "opening_clarity", "rebuttal_quality",
                      "reading_accuracy", "evidence_use"]:
            if field not in scores:
                scores[field] = 0

    log_usage(
        service="claude",
        model=response.model,
        call_type="evaluation",
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        assignment_id=assignment_id,
        pairing_id=pairing_id,
    )

    return scores
