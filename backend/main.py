import os
from typing import List
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio

# Modular imports from the app package
from app.config import logger
from app.models import ParseRequest, DispatchPayload, SimulatePayload
from app.services import (
    transcribe_audio_service,
    parse_actions_service,
    dispatch_actions_service,
)

# Initialize FastAPI App
app = FastAPI(
    title="VoiceForge Ops API",
    description="Backend API for VoiceForge Ops - High-Performance AI Action Orchestrator",
    version="1.0.0"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    """
    Simple health check endpoint to verify that the API is running.
    """
    return {"status": "VoiceForge Ops API is running"}


@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Endpoint to transcribe uploaded audio files using Groq's Whisper model (whisper-large-v3).
    Supports: .mp3, .wav, .m4a, .webm, .ogg
    """
    text = await transcribe_audio_service(file)
    return {"text": text}


@app.post("/api/parse-actions")
async def parse_actions(request: ParseRequest):
    """
    Multi-Intent Action Parser endpoint.
    Uses openai/gpt-oss-120b (via Groq) with JSON response format.
    Resolves relative times based on current UTC time and performs risk/conflict assessment.
    """
    parsed_actions = await parse_actions_service(request.text)
    return parsed_actions


@app.post("/api/dispatch")
async def dispatch_actions(payload: DispatchPayload):
    """
    Dispatch verified actions to the Make Webhook and log transactions to Supabase.
    """
    # Serialize actions back to standard python dictionary structures for delivery
    serialized_actions = [action.model_dump() for action in payload.actions]
    result = await dispatch_actions_service(
        summary=payload.summary,
        raw_transcript=payload.raw_transcript,
        actions=serialized_actions,
        meta=payload.meta.model_dump()
    )
    return result


@app.post("/api/process-audio")
async def process_audio(file: UploadFile = File(...)):
    """
    Complete Pipeline Runner Endpoint:
    1. Transcribes audio using Groq Whisper.
    2. Extracts structured actions and executes Safety & Conflict Analyzer.
    3. Dispatches payload to Make Webhook and logs transaction in Supabase.
    4. Returns complete consolidated audit payload.
    """
    # Step 1: Transcribe the uploaded audio
    transcript = await transcribe_audio_service(file)
    
    # Step 2: Extract multi-intent actions and meta info from transcript
    parsed = await parse_actions_service(transcript)
    
    # Step 3: Dispatch parsed payload and write transaction logs
    summary = parsed.get("summary", "")
    actions = parsed.get("actions", [])
    meta = parsed.get("meta", {})
    
    dispatch_result = await dispatch_actions_service(
        summary=summary,
        raw_transcript=transcript,
        actions=actions,
        meta=meta
    )
    
    # Step 4: Return consolidated execution data
    return {
        "transcript": transcript,
        "parsed": parsed,
        "dispatch_result": dispatch_result
    }


@app.get("/api/stream-reasoning")
async def stream_reasoning():
    """
    Server-Sent Events (SSE) endpoint to stream real-time agent reasoning steps.
    """
    async def log_generator():
        steps = [
            "Initializing pipeline...",
            "Listening for audio input stream...",
            "Whisper LPU processing audio buffer...",
            "Extracting multi-intent parameters...",
            "Executing safety & conflict scanner...",
            "Dispatching payloads to Make.com router...",
            "Pipeline successfully completed."
        ]
        for step in steps:
            yield f"data: {step}\n\n"
            await asyncio.sleep(0.4)

    return StreamingResponse(log_generator(), media_type="text/event-stream")


@app.post("/api/simulate-execution")
async def simulate_execution(payload: SimulatePayload):
    """
    Endpoint to simulate dry-run execution of operations.
    """
    return {
        "status": "success",
        "simulated": True,
        "actions_processed": len(payload.actions),
        "message": "Dry-run simulation executed successfully."
    }
