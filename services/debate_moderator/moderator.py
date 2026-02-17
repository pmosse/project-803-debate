import os
import json
from anthropic import Anthropic
import httpx

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODERATION_PROMPT = """You are an AI debate moderator for a university oral defense.

ASSIGNMENT: {assignment_title}
STUDENT A MEMO POSITION: {student_a_thesis}
STUDENT B MEMO POSITION: {student_b_thesis}
CURRENT PHASE: {phase}
RECENT TRANSCRIPT:
{recent_transcript}

RELEVANT READING PASSAGES:
{reading_context}

PHASE-SPECIFIC BEHAVIOR:
{phase_instructions}

General rules:
- Keep interventions brief (1-2 sentences max)
- Only intervene when genuinely necessary — let the students drive the conversation
- If a student misquotes or contradicts a reading, use "fact_check" and include the actual passage

Output JSON:
{{
  "should_intervene": true/false,
  "intervention_type": "question" | "flag" | "redirect" | "fact_check" | "none",
  "target_student": "A" | "B" | "both",
  "message": "Your intervention text"
}}

Return ONLY valid JSON."""

PHASE_BEHAVIOR = {
    "opening": "Only intervene if the speaker makes a factually incorrect claim about a reading. Do NOT interrupt their flow otherwise.",
    "crossexam": "Actively suggest follow-up questions when answers are vague. Flag unsupported claims. Probe the weakest parts of each argument.",
    "rebuttal": "Flag any mischaracterization of the opponent's argument. Otherwise stay silent.",
    "closing": "Almost entirely silent. Only intervene if a student introduces new evidence not previously discussed.",
}

PHASE_PROMPT_TEMPLATE = """You are an AI debate moderator. Generate a single brief contextual instruction (1 sentence, max 20 words) for the start of this debate phase.

PHASE: {phase}
STUDENT A THESIS: {student_a_thesis}
STUDENT B THESIS: {student_b_thesis}

Phase guidance:
- opening_a/opening_b: Tell the speaker to present their thesis. Mention what the opponent argues.
- crossexam_a: Student A questions Student B. Hint at a weak point in B's argument.
- crossexam_b: Student B questions Student A. Hint at a weak point in A's argument.
- rebuttal_a/rebuttal_b: Tell the speaker to address their opponent's strongest claims.
- closing_a/closing_b: Tell the speaker to summarize why their position holds.

Return ONLY the instruction text, no JSON, no quotes."""


class Moderator:
    def __init__(
        self,
        assignment_title: str,
        student_a_thesis: str,
        student_b_thesis: str,
        assignment_id: str,
        reading_indexer_url: str,
    ):
        self.assignment_title = assignment_title
        self.student_a_thesis = student_a_thesis
        self.student_b_thesis = student_b_thesis
        self.assignment_id = assignment_id
        self.reading_indexer_url = reading_indexer_url
        self.http_client = httpx.AsyncClient()

    async def get_reading_context(self, claim: str) -> str:
        """Query the reading indexer for relevant passages."""
        try:
            response = await self.http_client.post(
                f"{self.reading_indexer_url}/query",
                json={
                    "assignment_id": self.assignment_id,
                    "query": claim,
                    "top_k": 3,
                },
                timeout=5.0,
            )
            if response.status_code == 200:
                results = response.json().get("results", [])
                return "\n".join(
                    f"[{r['source_title']}]: {r['chunk_text']}"
                    for r in results
                )
        except Exception:
            pass
        return "No reading passages available."

    def _get_phase_instructions(self, phase: str) -> str:
        """Return phase-specific moderation instructions."""
        for key, instructions in PHASE_BEHAVIOR.items():
            if key in phase:
                return instructions
        return PHASE_BEHAVIOR["crossexam"]

    async def evaluate_utterance(
        self,
        utterance: str,
        speaker: str,
        phase: str,
        recent_transcript: list[dict],
    ) -> dict | None:
        """Evaluate an utterance and decide whether to intervene."""
        reading_context = await self.get_reading_context(utterance)

        transcript_text = "\n".join(
            f"{t['speaker']}: {t['text']}" for t in recent_transcript
        )

        prompt = MODERATION_PROMPT.format(
            assignment_title=self.assignment_title,
            student_a_thesis=self.student_a_thesis,
            student_b_thesis=self.student_b_thesis,
            phase=phase,
            recent_transcript=transcript_text,
            reading_context=reading_context,
            phase_instructions=self._get_phase_instructions(phase),
        )

        try:
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )

            text = response.content[0].text.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text = "\n".join(lines[1:-1])

            return json.loads(text)
        except Exception as e:
            print(f"Moderation error: {e}")
            return None

    async def generate_phase_prompt(self, phase: str) -> str | None:
        """Generate a contextual nudge for a phase transition."""
        prompt = PHASE_PROMPT_TEMPLATE.format(
            phase=phase,
            student_a_thesis=self.student_a_thesis,
            student_b_thesis=self.student_b_thesis,
        )

        try:
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            print(f"Phase prompt error: {e}")
            return None

    async def generate_silence_nudge(self, phase: str, speaker: str) -> str | None:
        """Generate a nudge for a silent speaker."""
        thesis = self.student_a_thesis if speaker == "A" else self.student_b_thesis
        prompt = (
            f"A student (Student {speaker}) has been silent for 15+ seconds during the {phase} phase. "
            f"Their thesis is: {thesis}. "
            f"Generate a single brief, encouraging prompt (1 sentence, max 15 words) to re-engage them. "
            f"Reference their own argument to prompt a response. Return ONLY the text."
        )

        try:
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=60,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            print(f"Silence nudge error: {e}")
            return None
