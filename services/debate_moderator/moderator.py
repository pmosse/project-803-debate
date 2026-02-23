import os
import sys
import json
from anthropic import Anthropic
import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.usage_logger import log_usage

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

MODERATION_PROMPT = """You are an AI debate moderator for a university oral defense.

ASSIGNMENT: {assignment_title}
{student_a_label}'S POSITION: {student_a_thesis}
{student_b_label}'S POSITION: {student_b_thesis}
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
- Use students' first names ({student_a_label} and {student_b_label}), not "Student A" or "Student B"

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
{student_a_label} THESIS: {student_a_thesis}
{student_b_label} THESIS: {student_b_thesis}

Phase guidance:
- opening_a/opening_b: Tell the speaker to present their thesis. Mention what the opponent argues.
- crossexam_a: {student_a_label} questions {student_b_label}. Hint at a weak point in {student_b_label}'s argument.
- crossexam_b: {student_b_label} questions {student_a_label}. Hint at a weak point in {student_a_label}'s argument.
- rebuttal_a/rebuttal_b: Tell the speaker to address their opponent's strongest claims.
- closing_a/closing_b: Tell the speaker to summarize why their position holds.

Use the students' first names, not "Student A" or "Student B".

Return ONLY the instruction text, no JSON, no quotes."""


class Moderator:
    def __init__(
        self,
        assignment_title: str,
        student_a_thesis: str,
        student_b_thesis: str,
        assignment_id: str,
        reading_indexer_url: str,
        student_a_name: str = "Student A",
        student_b_name: str = "Student B",
    ):
        self.assignment_title = assignment_title
        self.student_a_thesis = student_a_thesis
        self.student_b_thesis = student_b_thesis
        self.student_a_name = student_a_name
        self.student_b_name = student_b_name
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

        first_a = self.student_a_name.split(" ")[0]
        first_b = self.student_b_name.split(" ")[0]
        prompt = MODERATION_PROMPT.format(
            assignment_title=self.assignment_title,
            student_a_thesis=self.student_a_thesis,
            student_b_thesis=self.student_b_thesis,
            student_a_label=first_a,
            student_b_label=first_b,
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

            log_usage(
                service="claude",
                model=response.model,
                call_type="moderation",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                assignment_id=self.assignment_id,
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
        first_a = self.student_a_name.split(" ")[0]
        first_b = self.student_b_name.split(" ")[0]
        prompt = PHASE_PROMPT_TEMPLATE.format(
            phase=phase,
            student_a_thesis=self.student_a_thesis,
            student_b_thesis=self.student_b_thesis,
            student_a_label=first_a,
            student_b_label=first_b,
        )

        try:
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                messages=[{"role": "user", "content": prompt}],
            )
            log_usage(
                service="claude",
                model=response.model,
                call_type="phase_prompt",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                assignment_id=self.assignment_id,
            )
            return response.content[0].text.strip()
        except Exception as e:
            print(f"Phase prompt error: {e}")
            return None

    async def generate_ready_check_message(self, current_phase: str, next_phase: str) -> str | None:
        """Generate a transition message between phases."""
        first_a = self.student_a_name.split(" ")[0]
        first_b = self.student_b_name.split(" ")[0]

        # Determine who was speaking and who is next
        current_speaker = first_a if current_phase.endswith("_a") else first_b
        next_speaker = first_a if next_phase.endswith("_a") else first_b

        # Friendly phase name
        phase_names = {
            "opening": "opening statement",
            "crossexam": "cross-examination",
            "rebuttal": "rebuttal",
            "closing": "closing statement",
        }
        next_phase_base = next_phase.rsplit("_", 1)[0]
        next_phase_name = phase_names.get(next_phase_base, next_phase_base)

        prompt = (
            f"You are an AI debate moderator transitioning between phases. "
            f"{current_speaker} just finished. {next_speaker} is up next for {next_phase_name}. "
            f"Generate a brief transition message (~30 words) that thanks the previous speaker and "
            f"announces the next phase. Be encouraging and professional. "
            f"Use their first names. Return ONLY the text, no quotes."
        )

        try:
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=80,
                messages=[{"role": "user", "content": prompt}],
            )
            log_usage(
                service="claude",
                model=response.model,
                call_type="ready_check",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                assignment_id=self.assignment_id,
            )
            return response.content[0].text.strip()
        except Exception as e:
            print(f"Ready check message error: {e}")
            # Fallback template
            return f"{current_speaker}, thanks for your contribution. {next_speaker}, you're up for {next_phase_name}. Press Ready when you're set."

    async def generate_silence_nudge(self, phase: str, speaker: str) -> str | None:
        """Generate a nudge for a silent speaker."""
        if speaker == "A":
            name = self.student_a_name.split(" ")[0]
            thesis = self.student_a_thesis
        else:
            name = self.student_b_name.split(" ")[0]
            thesis = self.student_b_thesis
        prompt = (
            f"{name} has been silent for 15+ seconds during the {phase} phase. "
            f"Their thesis is: {thesis}. "
            f"Generate a single brief, encouraging prompt (1 sentence, max 15 words) to re-engage them. "
            f"Use their first name ({name}). Reference their own argument to prompt a response. Return ONLY the text."
        )

        try:
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=60,
                messages=[{"role": "user", "content": prompt}],
            )
            log_usage(
                service="claude",
                model=response.model,
                call_type="silence_nudge",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                assignment_id=self.assignment_id,
            )
            return response.content[0].text.strip()
        except Exception as e:
            print(f"Silence nudge error: {e}")
            return None
