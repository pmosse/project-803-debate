import os
import asyncio
import base64
import json
from typing import Callable, Awaitable


class DeepgramSTTHandler:
    """Handles streaming speech-to-text via Deepgram.

    Uses a separate Deepgram WebSocket connection per speaker so that
    each stream receives clean single-speaker audio. This avoids
    interleaving artifacts and incorrect speaker attribution.
    """

    def __init__(self):
        self.api_key = os.getenv("DEEPGRAM_API_KEY", "")
        self.on_result: Callable[[str, str, bool], Awaitable[None]] | None = None
        # Per-speaker connections: speaker_label -> websocket
        self._connections: dict[str, object] = {}
        self._lock = asyncio.Lock()

    def _deepgram_url(self) -> str:
        return (
            "wss://api.deepgram.com/v1/listen"
            "?model=nova-3"
            "&language=multi"
            "&punctuate=true"
            "&smart_format=true"
            "&interim_results=true"
            "&endpointing=700"
            "&encoding=linear16"
            "&sample_rate=16000"
            "&channels=1"
        )

    async def _get_connection(self, speaker: str):
        """Get or create a Deepgram connection for a specific speaker."""
        if speaker in self._connections and self._connections[speaker]:
            return self._connections[speaker]

        async with self._lock:
            # Double-check after acquiring lock
            if speaker in self._connections and self._connections[speaker]:
                return self._connections[speaker]

            if not self.api_key:
                return None

            try:
                import websockets

                headers = {"Authorization": f"Token {self.api_key}"}
                ws = await websockets.connect(
                    self._deepgram_url(), extra_headers=headers
                )
                self._connections[speaker] = ws

                # Start receive loop for this speaker's connection
                asyncio.create_task(self._receive_loop(speaker, ws))
                return ws
            except Exception as e:
                print(f"Deepgram connection error for {speaker}: {e}")
                return None

    async def _receive_loop(self, speaker: str, ws):
        """Receive transcription results from a speaker-specific Deepgram connection."""
        try:
            async for message in ws:
                data = json.loads(message)
                channel = data.get("channel", {})
                alternatives = channel.get("alternatives", [])

                if alternatives:
                    transcript = alternatives[0].get("transcript", "")
                    is_final = data.get("is_final", False)

                    if transcript.strip() and self.on_result:
                        await self.on_result(speaker, transcript, is_final)
        except Exception as e:
            print(f"Deepgram receive error for {speaker}: {e}")
        finally:
            # Connection closed — remove so it can be re-created
            self._connections.pop(speaker, None)

    async def send_audio(self, audio_base64: str, speaker: str = "Unknown"):
        """Send audio chunk to the speaker-specific Deepgram connection."""
        ws = await self._get_connection(speaker)
        if ws:
            try:
                audio_bytes = base64.b64decode(audio_base64)
                await ws.send(audio_bytes)
            except Exception as e:
                print(f"Deepgram send error for {speaker}: {e}")
                # Remove broken connection so it reconnects
                self._connections.pop(speaker, None)

    async def close(self):
        """Close all Deepgram connections."""
        for speaker, ws in list(self._connections.items()):
            try:
                await ws.close()
            except Exception:
                pass
        self._connections.clear()
