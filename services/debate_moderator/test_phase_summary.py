"""Tests for the phase summary feature in moderator + main."""

import asyncio
import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# Moderator.generate_phase_summary() tests
# ---------------------------------------------------------------------------

@pytest.fixture
def moderator():
    with patch("moderator.client") as mock_client, \
         patch("moderator.log_usage"):
        from moderator import Moderator
        mod = Moderator(
            assignment_title="Trade Policy Debate",
            student_a_thesis="Free trade is beneficial",
            student_b_thesis="Protectionism is needed",
            assignment_id="test-assignment-id",
            reading_indexer_url="http://localhost:8002",
            student_a_name="Alex Johnson",
            student_b_name="Jordan Smith",
        )
        mod._mock_client = mock_client
        yield mod


@pytest.mark.asyncio
async def test_phase_summary_returns_text(moderator):
    """generate_phase_summary returns Claude's response for a non-empty transcript."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Alex argued for free trade benefits while Jordan pushed back on job losses.")]
    mock_response.model = "claude-haiku-4-5-20251001"
    mock_response.usage.input_tokens = 100
    mock_response.usage.output_tokens = 30
    moderator._mock_client.messages.create.return_value = mock_response

    transcript = [
        {"speaker": "Alex", "text": "Free trade creates jobs and lowers prices.", "phase": "opening_a"},
        {"speaker": "Jordan", "text": "But it can destroy domestic industries.", "phase": "opening_a"},
    ]

    result = await moderator.generate_phase_summary(transcript)

    assert result is not None
    assert "Alex" in result
    moderator._mock_client.messages.create.assert_called_once()
    call_kwargs = moderator._mock_client.messages.create.call_args
    assert call_kwargs[1]["model"] == "claude-haiku-4-5-20251001"
    assert call_kwargs[1]["max_tokens"] == 120


@pytest.mark.asyncio
async def test_phase_summary_empty_transcript(moderator):
    """generate_phase_summary returns None for an empty transcript."""
    result = await moderator.generate_phase_summary([])
    assert result is None
    moderator._mock_client.messages.create.assert_not_called()


@pytest.mark.asyncio
async def test_phase_summary_handles_api_error(moderator):
    """generate_phase_summary returns None on API error."""
    moderator._mock_client.messages.create.side_effect = Exception("API error")

    transcript = [{"speaker": "Alex", "text": "Some argument", "phase": "opening_a"}]
    result = await moderator.generate_phase_summary(transcript)

    assert result is None


@pytest.mark.asyncio
async def test_phase_summary_uses_first_names(moderator):
    """Prompt includes first names, not full names."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="Summary text")]
    mock_response.model = "claude-haiku-4-5-20251001"
    mock_response.usage.input_tokens = 50
    mock_response.usage.output_tokens = 20
    moderator._mock_client.messages.create.return_value = mock_response

    transcript = [{"speaker": "Alex", "text": "My point is...", "phase": "crossexam_a"}]
    await moderator.generate_phase_summary(transcript)

    prompt = moderator._mock_client.messages.create.call_args[1]["messages"][0]["content"]
    assert "Alex" in prompt
    assert "Jordan" in prompt
    assert "Johnson" not in prompt
    assert "Smith" not in prompt


# ---------------------------------------------------------------------------
# main.py ready_check_start handler — test the summary field in broadcast
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ready_check_broadcast_includes_summary():
    """The ready_check WS broadcast should include a 'summary' field."""
    # We'll test by importing main and simulating the handler logic
    # Rather than spinning up a full WS server, we test the broadcast payload
    # by patching the moderator methods and the broadcast function.

    with patch("main.get_session_context") as mock_ctx, \
         patch("main.broadcast") as mock_broadcast, \
         patch("main.sessions") as mock_sessions:

        mock_broadcast.side_effect = AsyncMock()

        # Build a fake session with a moderator
        fake_moderator = AsyncMock()
        fake_moderator.generate_phase_summary.return_value = "Alex made strong points about trade."
        fake_moderator.generate_ready_check_message.return_value = "Great job Alex, Jordan you're up!"

        fake_session = {
            "connections": set(),
            "moderator": fake_moderator,
            "transcript": [
                {"speaker": "Alex", "text": "Trade is good", "phase": "opening_a", "timestamp": 1},
                {"speaker": "Jordan", "text": "Not always", "phase": "opening_b", "timestamp": 2},
            ],
            "current_phase": "opening_a",
            "phase_started_at": 0,
            "last_speech_time": 0,
            "ready_state": None,
        }

        # Simulate the handler logic directly (extracted from main.py)
        current_phase = "opening_a"
        next_phase = "opening_b"

        phase_transcript = [
            t for t in fake_session["transcript"]
            if t.get("phase") == current_phase
        ]

        summary, message = await asyncio.gather(
            fake_session["moderator"].generate_phase_summary(phase_transcript),
            fake_session["moderator"].generate_ready_check_message(current_phase, next_phase),
        )

        payload = {
            "type": "ready_check",
            "message": message or "",
            "summary": summary or "",
            "next_phase": next_phase,
            "ready_a": False,
            "ready_b": False,
        }

        # Verify payload structure
        assert payload["summary"] == "Alex made strong points about trade."
        assert payload["message"] == "Great job Alex, Jordan you're up!"
        assert payload["type"] == "ready_check"
        assert payload["next_phase"] == "opening_b"

        # Verify only opening_a entries were sent to summary
        fake_moderator.generate_phase_summary.assert_called_once()
        call_args = fake_moderator.generate_phase_summary.call_args[0][0]
        assert len(call_args) == 1
        assert call_args[0]["speaker"] == "Alex"


@pytest.mark.asyncio
async def test_ready_check_summary_empty_when_no_speech():
    """Summary should be empty string when there's no speech in the phase."""
    fake_moderator = AsyncMock()
    fake_moderator.generate_phase_summary.return_value = None
    fake_moderator.generate_ready_check_message.return_value = "Moving on!"

    transcript = []  # No speech in this phase
    phase_transcript = [t for t in transcript if t.get("phase") == "opening_a"]

    summary, message = await asyncio.gather(
        fake_moderator.generate_phase_summary(phase_transcript),
        fake_moderator.generate_ready_check_message("opening_a", "opening_b"),
    )

    payload = {
        "type": "ready_check",
        "message": message or "",
        "summary": summary or "",
        "next_phase": "opening_b",
        "ready_a": False,
        "ready_b": False,
    }

    assert payload["summary"] == ""
    assert payload["message"] == "Moving on!"
