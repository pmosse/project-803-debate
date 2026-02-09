import os
import json
from anthropic import Anthropic

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

ANALYSIS_PROMPT = """You are analyzing a student memo for a university assignment.

ASSIGNMENT PROMPT:
{assignment_prompt}

STUDENT MEMO:
{memo_text}

Extract the following as JSON:
{{
  "position": "net_positive" | "net_negative",
  "thesis": "one sentence summary of their main argument",
  "key_claims": ["claim 1", "claim 2", ...],
  "citations": [{{"reading": "author/title", "how_used": "summary of usage"}}],
  "stance_strength": "strong" | "moderate" | "weak",
  "reasoning": "brief explanation of your classification"
}}

Classification rules:
- If the student argues Walmart deserves a Nobel (Economics or Peace) or that Walmart's impact is predominantly positive → "net_positive"
- If the student argues Walmart should "burn in hell" or that negative effects outweigh positives → "net_negative"
- For nuanced/mixed positions, determine which way the overall argument leans and classify accordingly
- Only use "net_positive" or "net_negative" — no middle ground for pairing purposes

Return ONLY valid JSON, no other text."""


def analyze_memo(memo_text: str, assignment_prompt: str) -> dict:
    """Analyze a student memo using Claude."""
    prompt = ANALYSIS_PROMPT.format(
        assignment_prompt=assignment_prompt,
        memo_text=memo_text,
    )

    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()

    # Extract JSON from response (handle potential markdown wrapping)
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])

    analysis = json.loads(text)

    # Validate required fields
    required = ["position", "thesis", "key_claims", "citations", "stance_strength"]
    for field in required:
        if field not in analysis:
            raise ValueError(f"Missing required field: {field}")

    if analysis["position"] not in ("net_positive", "net_negative"):
        raise ValueError(f"Invalid position: {analysis['position']}")

    return analysis
