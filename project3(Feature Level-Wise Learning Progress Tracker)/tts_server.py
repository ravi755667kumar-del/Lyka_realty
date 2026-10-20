"""
Local OpenAI-Compatible TTS Server
Listens on http://localhost:5050/v1/audio/speech
Supports standard OpenAI client:
  from openai import OpenAI
  client = OpenAI(base_url="http://localhost:5050/v1", api_key="unused")
  response = client.audio.speech.create(model="tts-1", voice="nova", input="Hello student!")
"""

import os
import sys
import io
import asyncio
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import edge_tts

app = FastAPI(title="Local OpenAI TTS Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Map OpenAI voice names to ultra-realistic Edge-TTS neural voices
VOICE_MAP = {
    "nova": "en-US-AvaNeural",         # Warm, expressive, gentle female teacher
    "alloy": "en-US-JennyNeural",      # Clear, articulate neutral
    "echo": "en-US-GuyNeural",         # Confident, friendly male tutor
    "fable": "en-GB-SoniaNeural",      # British articulate female
    "onyx": "en-US-ChristopherNeural", # Deep, resonant male
    "shimmer": "en-US-EmmaNeural",     # Bright, cheerful female
    "default": "en-US-AvaNeural"
}

class SpeechRequest(BaseModel):
    model: Optional[str] = "tts-1"
    voice: Optional[str] = "nova"
    input: str
    response_format: Optional[str] = "mp3"
    speed: Optional[float] = 1.0

@app.get("/health")
@app.get("/v1/health")
async def health():
    return {"status": "ok", "service": "Local OpenAI TTS Server (Port 5050)", "voices": list(VOICE_MAP.keys())}

@app.post("/v1/audio/speech")
@app.post("/audio/speech")
async def generate_speech(req: SpeechRequest):
    text = (req.input or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text input is required")

    # Select mapped neural voice
    selected_voice = req.voice.lower() if req.voice else "nova"
    edge_voice = VOICE_MAP.get(selected_voice, VOICE_MAP["default"])

    # Calculate speech rate adjustment (e.g. +0%, +10%)
    speed_factor = req.speed if req.speed else 1.0
    if speed_factor != 1.0:
        percent = int((speed_factor - 1.0) * 100)
        rate_str = f"+{percent}%" if percent >= 0 else f"{percent}%"
    else:
        rate_str = "+0%"

    try:
        communicate = edge_tts.Communicate(text, edge_voice, rate=rate_str)
        audio_stream = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])

        audio_stream.seek(0)
        return StreamingResponse(
            audio_stream,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "X-TTS-Voice": edge_voice,
                "X-TTS-Model": req.model or "tts-1"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS Generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    port = int(os.environ.get("OPENAI_TTS_PORT", 5050))
    print(f"\n========================================================")
    print(f"[OpenAI-TTS] Server starting on http://127.0.0.1:{port}")
    print(f"[OpenAI-TTS] Compatible with: OpenAI(base_url='http://localhost:{port}/v1')")
    print(f"========================================================\n")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
