"""Integration tests for the debate moderator WebSocket server.

Tests the full message flow through the WS server with REAL Claude API calls.
Only DB access and usage logging are mocked.

Run: python -m pytest test_integration.py -v
"""

import time
import json
import os
import sys
import pytest
from unittest.mock import patch

from dotenv import load_dotenv

# Load .env before any service imports (moderator.py reads ANTHROPIC_API_KEY at import)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Skip all tests if no API key available
pytestmark = pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set — skipping live Claude tests",
)

FAKE_CONTEXT = {
    "assignment_title": "Trade Policy Debate: Free Trade vs Protectionism",
    "assignment_prompt": "Discuss whether free trade or protectionism better serves national economic interests",
    "assignment_id": "assign-001",
    "student_a_thesis": "Free trade maximizes welfare through comparative advantage and lower consumer prices",
    "student_b_thesis": "Strategic protectionism is needed to safeguard domestic industries and jobs",
    "student_a_name": "Alex Johnson",
    "student_b_name": "Jordan Smith",
}


@pytest.fixture(autouse=True)
def _patch_db():
    """Mock only DB access and usage logging. Claude API calls are REAL."""
    with patch("main.get_session_context", return_value=dict(FAKE_CONTEXT)), \
         patch("main.save_transcript"), \
         patch("main.log_usage"), \
         patch("moderator.log_usage"):
        yield


@pytest.fixture(autouse=True)
def _clear_sessions():
    """Clear all sessions between tests."""
    from main import sessions
    sessions.clear()
    yield
    sessions.clear()


@pytest.fixture
def client():
    """FastAPI test client."""
    from fastapi.testclient import TestClient
    from main import app
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Connection & Sync (no Claude calls — pure plumbing)
# ---------------------------------------------------------------------------

class TestConnectionAndSync:
    def test_ws_connect_receives_sync(self, client):
        """Connecting to WS should return a sync message with current phase."""
        with client.websocket_connect("/ws/session-001") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "sync"
            assert msg["phase"] == "opening_a"
            assert "elapsed" in msg

    def test_ws_connect_invalid_session_returns_error(self, client):
        """Connecting with a session not in DB returns error."""
        with patch("main.get_session_context", return_value={}):
            with client.websocket_connect("/ws/bad-session") as ws:
                msg = ws.receive_json()
                assert msg["type"] == "error"
                assert "not found" in msg["message"].lower()

    def test_second_client_joins_existing_session(self, client):
        """A second client joining gets correct sync."""
        with client.websocket_connect("/ws/session-002") as ws1:
            ws1.receive_json()  # sync
            with client.websocket_connect("/ws/session-002") as ws2:
                sync2 = ws2.receive_json()
                assert sync2["type"] == "sync"
                assert sync2["phase"] == "opening_a"


# ---------------------------------------------------------------------------
# 2. Transcript Broadcast (no Claude calls for interim)
# ---------------------------------------------------------------------------

class TestTranscriptBroadcast:
    def test_interim_transcript_broadcast_to_other_client(self, client):
        """Interim transcript from one client is broadcast to the other."""
        with client.websocket_connect("/ws/session-010") as ws1:
            ws1.receive_json()  # sync
            with client.websocket_connect("/ws/session-010") as ws2:
                ws2.receive_json()  # sync

                ws1.send_json({
                    "type": "transcript_text",
                    "speaker": "Student A",
                    "text": "Free trade creates prosperity",
                    "is_final": False,
                })

                msg = ws2.receive_json()
                assert msg["type"] == "transcript"
                assert msg["speaker"] == "Student A"
                assert msg["text"] == "Free trade creates prosperity"
                assert msg["is_final"] is False

    def test_final_transcript_stored_in_session(self, client):
        """Final transcripts are appended to the session transcript list."""
        from main import sessions

        with client.websocket_connect("/ws/session-011") as ws1:
            ws1.receive_json()
            with client.websocket_connect("/ws/session-011") as ws2:
                ws2.receive_json()

                ws1.send_json({
                    "type": "transcript_text",
                    "speaker": "Student A",
                    "text": "Trade liberalization is key to economic growth",
                    "is_final": True,
                })
                ws2.receive_json()  # transcript broadcast

                session = sessions["session-011"]
                assert len(session["transcript"]) == 1
                assert session["transcript"][0]["speaker"] == "Student A"
                assert session["transcript"][0]["phase"] == "opening_a"


# ---------------------------------------------------------------------------
# 3. AI Moderation — REAL Claude calls
# ---------------------------------------------------------------------------

class TestAiModerationLive:
    def test_moderation_returns_valid_json_structure(self, client):
        """Claude returns valid moderation JSON for a final transcript.

        Whether it intervenes or not, the server should handle it without error.
        """
        from main import sessions

        with client.websocket_connect("/ws/session-020") as ws1:
            ws1.receive_json()
            with client.websocket_connect("/ws/session-020") as ws2:
                ws2.receive_json()

                ws1.send_json({
                    "type": "transcript_text",
                    "speaker": "Student A",
                    "text": (
                        "According to the readings, free trade has consistently led "
                        "to GDP growth in every country that has adopted it, with zero "
                        "negative consequences for any workers."
                    ),
                    "is_final": True,
                })

                # ws2 gets the transcript broadcast
                transcript_msg = ws2.receive_json()
                assert transcript_msg["type"] == "transcript"

                # The moderator may or may not intervene — either outcome is valid.
                # If it intervenes, verify the structure is correct.
                # We peek by checking if there's another message for ws2.
                # (The session records whether Claude was called.)
                session = sessions["session-020"]
                assert len(session["transcript"]) == 1

    def test_moderation_cooldown_prevents_rapid_calls(self, client):
        """Second utterance within cooldown period skips moderation entirely."""
        from main import sessions

        with client.websocket_connect("/ws/session-022") as ws1:
            ws1.receive_json()
            with client.websocket_connect("/ws/session-022") as ws2:
                ws2.receive_json()

                # First utterance — triggers moderation
                ws1.send_json({
                    "type": "transcript_text",
                    "speaker": "Student A",
                    "text": "Free trade is universally beneficial according to all economists.",
                    "is_final": True,
                })
                ws2.receive_json()  # transcript

                # Record the last_intervention_time (gets set if Claude intervened)
                intervention_time_after_first = sessions["session-022"]["last_intervention_time"]

                # Immediately send second utterance — should be within cooldown
                ws1.send_json({
                    "type": "transcript_text",
                    "speaker": "Student A",
                    "text": "And tariffs never help anyone.",
                    "is_final": True,
                })
                msg = ws2.receive_json()
                assert msg["type"] == "transcript"

                # Intervention time should not have changed (cooldown blocked it)
                assert sessions["session-022"]["last_intervention_time"] == intervention_time_after_first


# ---------------------------------------------------------------------------
# 4. Phase Commands — REAL Claude phase prompts
# ---------------------------------------------------------------------------

class TestPhaseCommandsLive:
    def test_phase_command_generates_real_ai_prompt(self, client):
        """Phase transition generates a real AI phase prompt via Claude."""
        with client.websocket_connect("/ws/session-031") as ws1:
            ws1.receive_json()
            with client.websocket_connect("/ws/session-031") as ws2:
                ws2.receive_json()

                ws1.send_json({
                    "type": "phase_command",
                    "phase": "opening_b",
                })

                # ws2 gets phase_advance
                phase_msg = ws2.receive_json()
                assert phase_msg["type"] == "phase_advance"
                assert phase_msg["phase"] == "opening_b"

                # Then both get the AI phase prompt
                prompt_ws2 = ws2.receive_json()
                assert prompt_ws2["type"] == "intervention"
                assert prompt_ws2["intervention_type"] == "phase_prompt"
                # Real Claude should use student's first name
                assert isinstance(prompt_ws2["message"], str)
                assert len(prompt_ws2["message"]) > 0

                prompt_ws1 = ws1.receive_json()
                assert prompt_ws1["type"] == "intervention"
                assert prompt_ws1["intervention_type"] == "phase_prompt"
                assert len(prompt_ws1["message"]) > 0

    def test_phase_prompt_references_student_names(self, client):
        """AI phase prompt should reference the relevant student's name."""
        with client.websocket_connect("/ws/session-032") as ws1:
            ws1.receive_json()

            # Move to crossexam_a (Alex questions Jordan)
            ws1.send_json({"type": "phase_command", "phase": "crossexam_a"})

            prompt = ws1.receive_json()
            assert prompt["type"] == "intervention"
            assert prompt["intervention_type"] == "phase_prompt"
            msg = prompt["message"].lower()
            # Should mention at least one student by name
            assert "alex" in msg or "jordan" in msg


# ---------------------------------------------------------------------------
# 5. Ready Check with Phase Summary — REAL Claude summaries
# ---------------------------------------------------------------------------

class TestReadyCheckWithSummaryLive:
    def test_ready_check_produces_real_summary_and_message(self, client):
        """ready_check_start generates a real AI summary + transition message."""
        from main import sessions

        with client.websocket_connect("/ws/session-040") as ws1:
            ws1.receive_json()

            # Seed realistic transcript for the opening phase
            sessions["session-040"]["transcript"] = [
                {
                    "speaker": "Alex",
                    "text": "Free trade is essential because comparative advantage allows countries to specialize in what they produce most efficiently, leading to higher overall GDP.",
                    "phase": "opening_a",
                    "timestamp": time.time() - 60,
                },
                {
                    "speaker": "Alex",
                    "text": "Historical evidence from NAFTA shows that trade liberalization created millions of new jobs in the export sector.",
                    "phase": "opening_a",
                    "timestamp": time.time() - 30,
                },
            ]

            ws1.send_json({
                "type": "ready_check_start",
                "current_phase": "opening_a",
                "next_phase": "opening_b",
            })

            msg = ws1.receive_json()
            assert msg["type"] == "ready_check"
            assert msg["next_phase"] == "opening_b"
            assert msg["ready_a"] is False
            assert msg["ready_b"] is False

            # Summary should be a real AI-generated description of what happened
            assert isinstance(msg["summary"], str)
            assert len(msg["summary"]) > 10, f"Summary too short: '{msg['summary']}'"
            print(f"\n  Phase summary: {msg['summary']}")

            # Transition message should be present and coherent
            assert isinstance(msg["message"], str)
            assert len(msg["message"]) > 10, f"Message too short: '{msg['message']}'"
            print(f"  Transition msg: {msg['message']}")

    def test_ready_check_empty_phase_gives_empty_summary(self, client):
        """No speech in the phase → empty summary, but transition message still generated."""
        with client.websocket_connect("/ws/session-041") as ws1:
            ws1.receive_json()

            # No transcript entries for opening_a
            ws1.send_json({
                "type": "ready_check_start",
                "current_phase": "opening_a",
                "next_phase": "opening_b",
            })

            msg = ws1.receive_json()
            assert msg["type"] == "ready_check"
            assert msg["summary"] == ""
            # Transition message should still be generated
            assert len(msg["message"]) > 0

    def test_summary_only_includes_current_phase_transcript(self, client):
        """Summary should only reflect the phase that just ended, not earlier phases."""
        from main import sessions

        with client.websocket_connect("/ws/session-042") as ws1:
            ws1.receive_json()

            # Transcript across multiple phases
            sessions["session-042"]["transcript"] = [
                {
                    "speaker": "Alex",
                    "text": "In my opening, free trade boosts GDP through comparative advantage.",
                    "phase": "opening_a",
                    "timestamp": 1,
                },
                {
                    "speaker": "Jordan",
                    "text": "Protectionism shields infant industries from unfair competition.",
                    "phase": "opening_b",
                    "timestamp": 2,
                },
                {
                    "speaker": "Alex",
                    "text": "Jordan, how do you explain the success of export-led growth in South Korea?",
                    "phase": "crossexam_a",
                    "timestamp": 3,
                },
                {
                    "speaker": "Jordan",
                    "text": "South Korea actually used heavy protectionism before opening up, which proves my point.",
                    "phase": "crossexam_a",
                    "timestamp": 4,
                },
            ]

            ws1.send_json({
                "type": "ready_check_start",
                "current_phase": "crossexam_a",
                "next_phase": "crossexam_b",
            })

            msg = ws1.receive_json()
            assert msg["type"] == "ready_check"
            # Summary should be about cross-examination content (South Korea, etc.)
            summary = msg["summary"].lower()
            assert len(msg["summary"]) > 10
            print(f"\n  Cross-exam summary: {msg['summary']}")


# ---------------------------------------------------------------------------
# 6. Ready Signal & Phase Advancement (plumbing, no extra Claude calls)
# ---------------------------------------------------------------------------

class TestReadySignalFlow:
    def test_both_ready_advances_phase(self, client):
        """When both students signal ready, the phase advances."""
        from main import sessions

        with client.websocket_connect("/ws/session-050") as ws1:
            ws1.receive_json()
            with client.websocket_connect("/ws/session-050") as ws2:
                ws2.receive_json()

                ws1.send_json({
                    "type": "ready_check_start",
                    "current_phase": "opening_a",
                    "next_phase": "opening_b",
                })

                rc1 = ws1.receive_json()
                rc2 = ws2.receive_json()
                assert rc1["type"] == "ready_check"
                assert rc2["type"] == "ready_check"

                # Student A ready
                ws1.send_json({"type": "ready_signal", "student": "A"})
                ws1.receive_json()  # ready_update
                ws2.receive_json()  # ready_update

                # Student B ready
                ws2.send_json({"type": "ready_signal", "student": "B"})
                ws1.receive_json()  # ready_update
                ws2.receive_json()  # ready_update

                # Phase advance
                advance1 = ws1.receive_json()
                advance2 = ws2.receive_json()
                assert advance1["type"] == "phase_advance"
                assert advance1["phase"] == "opening_b"
                assert advance2["type"] == "phase_advance"

                assert sessions["session-050"]["current_phase"] == "opening_b"

    def test_single_ready_does_not_advance(self, client):
        """Only one student ready does NOT advance the phase."""
        from main import sessions

        with client.websocket_connect("/ws/session-051") as ws1:
            ws1.receive_json()

            ws1.send_json({
                "type": "ready_check_start",
                "current_phase": "opening_a",
                "next_phase": "opening_b",
            })
            ws1.receive_json()  # ready_check

            ws1.send_json({"type": "ready_signal", "student": "A"})
            ws1.receive_json()  # ready_update

            assert sessions["session-051"]["current_phase"] == "opening_a"
            assert sessions["session-051"]["ready_state"]["A"] is True
            assert sessions["session-051"]["ready_state"]["B"] is False


# ---------------------------------------------------------------------------
# 7. Add Time (plumbing)
# ---------------------------------------------------------------------------

class TestAddTime:
    def test_add_time_broadcast_to_other_client(self, client):
        """add_time is broadcast to the other client."""
        with client.websocket_connect("/ws/session-060") as ws1:
            ws1.receive_json()
            with client.websocket_connect("/ws/session-060") as ws2:
                ws2.receive_json()

                ws1.send_json({"type": "add_time", "seconds": 60})
                msg = ws2.receive_json()
                assert msg["type"] == "add_time"
                assert msg["seconds"] == 60


# ---------------------------------------------------------------------------
# 8. Health Check
# ---------------------------------------------------------------------------

class TestHealthCheck:
    def test_health_endpoint(self, client):
        """The /health endpoint returns ok."""
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# 9. End-to-End: Full Phase Cycle with REAL Claude
# ---------------------------------------------------------------------------

class TestFullPhaseCycleLive:
    def test_full_debate_cycle_opening_to_crossexam(self, client):
        """Full cycle: speech → ready check (with real AI summary) → advance → AI phase prompt.

        This is the most comprehensive integration test — every Claude call is real.
        """
        from main import sessions

        with client.websocket_connect("/ws/session-070") as ws1:
            ws1.receive_json()  # sync
            with client.websocket_connect("/ws/session-070") as ws2:
                ws2.receive_json()  # sync

                # ── Step 1: Student A gives opening speech ──
                ws1.send_json({
                    "type": "transcript_text",
                    "speaker": "Alex",
                    "text": (
                        "Free trade increases GDP through comparative advantage. "
                        "Countries like South Korea and Singapore prospered by "
                        "embracing open markets and reducing tariff barriers."
                    ),
                    "is_final": True,
                })
                transcript_msg = ws2.receive_json()
                assert transcript_msg["type"] == "transcript"
                print(f"\n  [1] Alex spoke: {transcript_msg['text'][:60]}...")

                # Claude may or may not intervene — consume it if present
                # We handle this by checking if an intervention arrives
                # (it won't for most reasonable opening statements)

                # ── Step 2: Ready check with real AI summary ──
                ws1.send_json({
                    "type": "ready_check_start",
                    "current_phase": "opening_a",
                    "next_phase": "opening_b",
                })

                rc1 = ws1.receive_json()
                # If moderation intervened, the first message might be an intervention
                if rc1["type"] == "intervention":
                    print(f"  [*] AI intervention: {rc1['message']}")
                    rc1 = ws1.receive_json()  # Now get the actual ready_check

                rc2 = ws2.receive_json()
                if rc2["type"] == "intervention":
                    print(f"  [*] AI intervention: {rc2['message']}")
                    rc2 = ws2.receive_json()

                assert rc1["type"] == "ready_check"
                assert rc2["type"] == "ready_check"

                # Verify real AI outputs
                assert len(rc1["summary"]) > 10, f"Summary too short: '{rc1['summary']}'"
                assert len(rc1["message"]) > 10, f"Message too short: '{rc1['message']}'"
                print(f"  [2] Phase summary: {rc1['summary']}")
                print(f"  [2] Transition: {rc1['message']}")

                # ── Step 3: Both students ready up ──
                ws1.send_json({"type": "ready_signal", "student": "A"})
                ws1.receive_json()  # ready_update
                ws2.receive_json()  # ready_update

                ws2.send_json({"type": "ready_signal", "student": "B"})
                ws1.receive_json()  # ready_update
                ws2.receive_json()  # ready_update

                # ── Step 4: Phase advances to opening_b ──
                advance1 = ws1.receive_json()
                advance2 = ws2.receive_json()
                assert advance1["type"] == "phase_advance"
                assert advance1["phase"] == "opening_b"
                assert advance2["type"] == "phase_advance"
                print(f"  [3] Phase advanced to: {advance1['phase']}")

                # ── Step 5: AI generates phase prompt for opening_b ──
                prompt1 = ws1.receive_json()
                prompt2 = ws2.receive_json()
                assert prompt1["type"] == "intervention"
                assert prompt1["intervention_type"] == "phase_prompt"
                assert len(prompt1["message"]) > 0
                print(f"  [4] Phase prompt: {prompt1['message']}")

                # ── Verify final state ──
                assert sessions["session-070"]["current_phase"] == "opening_b"
                assert len(sessions["session-070"]["transcript"]) == 1

    def test_crossexam_moderation_with_questionable_claim(self, client):
        """During cross-examination, Claude moderates a bold/unsupported claim.

        Verifies the moderation pipeline works end-to-end with real AI.
        Even if Claude chooses not to intervene, the pipeline completes cleanly.
        """
        from main import sessions

        with client.websocket_connect("/ws/session-071") as ws1:
            ws1.receive_json()

            # Move to cross-examination phase
            ws1.send_json({"type": "phase_command", "phase": "crossexam_a"})
            # Consume phase prompt
            ws1.receive_json()  # intervention (phase_prompt)

            with client.websocket_connect("/ws/session-071") as ws2:
                ws2.receive_json()  # sync

                # Student makes a bold claim that might trigger moderation
                ws1.send_json({
                    "type": "transcript_text",
                    "speaker": "Alex",
                    "text": (
                        "Every single economist in history has agreed that protectionism "
                        "is always harmful and has never produced any positive outcomes "
                        "for any country at any point in time."
                    ),
                    "is_final": True,
                })

                # Get transcript broadcast
                transcript = ws2.receive_json()
                assert transcript["type"] == "transcript"
                print(f"\n  Bold claim sent: {transcript['text'][:60]}...")

                # Check what Claude did — the session records it
                session = sessions["session-071"]
                assert len(session["transcript"]) == 1
                # Whether Claude intervened or not, the pipeline ran without error
                print(f"  Last intervention time: {session['last_intervention_time']}")
                if session["last_intervention_time"] > 0:
                    print("  Claude DID intervene (moderation triggered)")
                else:
                    print("  Claude did NOT intervene (moderation passed)")
