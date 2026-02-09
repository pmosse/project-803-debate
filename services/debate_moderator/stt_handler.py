import os
import asyncio
import base64
from typing import Callable, Awaitable


class DeepgramSTTHandler:
    """Handles streaming speech-to-text via Deepgram."""

    def __init__(self):
        self.api_key = os.getenv("DEEPGRAM_API_KEY", "")
        self.ws = None
        self.on_result: Callable[[str, str, bool], Awaitable[None]] | None = None
        self._current_speaker = "Unknown"

    async def connect(self):
        """Connect to Deepgram streaming API."""
        if not self.api_key:
            return

        try:
            import websockets

            url = (
                "wss://api.deepgram.com/v1/listen"
                "?model=nova-3"
                "&punctuate=true"
                "&diarize=true"
                "&interim_results=true"
                "&encoding=linear16"
                "&sample_rate=16000"
                "&channels=1"
            )
            headers = {"Authorization": f"Token {self.api_key}"}
            self.ws = await websockets.connect(url, extra_headers=headers)

            # Start receiving loop
            asyncio.create_task(self._receive_loop())
        except Exception as e:
            print(f"Deepgram connection error: {e}")

    async def _receive_loop(self):
        """Receive transcription results from Deepgram."""
        if not self.ws:
            return

        try:
            async for message in self.ws:
                import json

                data = json.loads(message)
                channel = data.get("channel", {})
                alternatives = channel.get("alternatives", [])

                if alternatives:
                    transcript = alternatives[0].get("transcript", "")
                    is_final = data.get("is_final", False)

                    if transcript.strip() and self.on_result:
                        await self.on_result(
                            self._current_speaker, transcript, is_final
                        )
        except Exception as e:
            print(f"Deepgram receive error: {e}")

    async def send_audio(self, audio_base64: str, speaker: str = "Unknown"):
        """Send audio chunk to Deepgram."""
        self._current_speaker = speaker

        if not self.ws:
            await self.connect()

        if self.ws:
            try:
                audio_bytes = base64.b64decode(audio_base64)
                await self.ws.send(audio_bytes)
            except Exception as e:
                print(f"Deepgram send error: {e}")

    async def close(self):
        """Close the Deepgram connection."""
        if self.ws:
            try:
                await self.ws.close()
            except Exception:
                pass
