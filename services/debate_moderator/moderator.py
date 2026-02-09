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

Your role:
1. If a student makes a vague claim, generate a specific follow-up question that forces them to cite a reading
2. If a student misstates a finding from one of the readings, flag it gently
3. Suggest cross-examination questions that probe the weakest parts of each student's argument
4. Keep interventions brief (1-2 sentences max)
5. Only intervene when necessary — let the students drive the conversation

Output JSON:
{{
  "should_intervene": true/false,
  "intervention_type": "question" | "flag" | "redirect" | "none",
  "target_student": "A" | "B" | "both",
  "message": "Your intervention text"
}}

Return ONLY valid JSON."""


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
        )

        try:
            # Use Haiku for speed during live moderation
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
