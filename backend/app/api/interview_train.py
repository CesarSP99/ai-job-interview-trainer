from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import tempfile
import os

from transformers import pipeline
from faster_whisper import WhisperModel

from app.schemas.session import SessionBase

router = APIRouter(prefix="/interview", tags=["Interview"])

#
# class StartInterviewRequest(BaseModel):
#     extracted_skills: List[str]
#     matched_job_ids: List[int]
#     trainee_name: Optional[str] = None
#
# class StartInterviewResponse(BaseModel):
#     session: SessionBase
#
# class ChatRequest(BaseModel):
#     message: str
#
# class ChatResponse(BaseModel):
#     reply: str
#     session_id: str
#
# @router.post("/start", response_model=StartInterviewResponse)
# async def start_interview(data: StartInterviewRequest):
#     session = await create_session_from_match(
#         extracted_skills=data.extracted_skills,
#         matched_job_ids=data.matched_job_ids
#     )
#     # Optionally store trainee_name in session if you extend the model
#     return {"session": session}
#
# @router.post("/chat/{session_id}", response_model=ChatResponse)
# async def chat_message(session_id: str, body: ChatRequest = Body(...)):
#     session = await get_session(session_id)
#     if not session:
#         raise HTTPException(status_code=404, detail="Session not found")
#
#     await append_message(session_id, "user", body.message)
#
#     system_prompt = (
#         "You are an interview practice assistant. Use the user's extracted skills and matched job ids "
#         "to tailor questions and feedback. Keep responses concise and actionable."
#     )
#     context = {
#         "extracted_skills": session.extracted_skills,
#         "matched_job_ids": session.matched_job_ids,
#         "chat_history": session.chat_history[-10:],
#     }
#     prompt = f"{system_prompt}\n\nUser message: {body.message}\n\nContext: {context}"
#
#     try:
#         ai_text = await call_gemini(prompt, context)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"AI call failed: {e}")
#
#     await append_message(session_id, "assistant", ai_text)
#     return {"reply": ai_text, "session_id": session_id}
#
# @router.get("/chat/{session_id}/history")
# async def get_chat_history(session_id: str):
#     session = await get_session(session_id)
#     if not session:
#         raise HTTPException(status_code=404, detail="Session not found")
#     return {"chat_history": session.chat_history, "session_id": session_id}

# -------------------------
# Models for audio sentiment
# -------------------------

class EmotionScore(BaseModel):
    label: str
    score: float

class AudioSentimentResponse(BaseModel):
    session_id: str
    transcript: str
    sentiment_label: str      # POSITIVE/NEGATIVE from coarse model
    sentiment_score: float
    emotions: List[EmotionScore]  # richer emotion info

# -------------------------
# Load ML models once
# -------------------------

# Whisper for local transcription
# You can change "small" to "base"/"tiny"/etc depending on your machine
whisper_model = WhisperModel("base", device="cpu", compute_type="int8")

# Coarse sentiment (keep if you want POS/NEG for reporting)
sentiment_pipe = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english"
)

# Emotion classifier (joy, anger, sadness, etc.)
emotion_pipe = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    return_all_scores=True,   # important: get all emotions with scores
)

# -------------------------
# Interview text endpoints
# -------------------------

# @router.post("/start", response_model=StartInterviewResponse)
# async def start_interview(data: StartInterviewRequest):
#     session = await create_session_from_match(
#         extracted_skills=data.extracted_skills,
#         matched_job_ids=data.matched_job_ids
#     )
#     # Optionally store trainee_name in session if you extend the model
#     return {"session": session}
#
# @router.post("/chat/{session_id}", response_model=ChatResponse)
# async def chat_message(session_id: str, body: ChatRequest = Body(...)):
#     session = await get_session(session_id)
#     if not session:
#         raise HTTPException(status_code=404, detail="Session not found")
#
#     await append_message(session_id, "user", body.message)
#
#     system_prompt = (
#         "You are an interview practice assistant. Use the user's extracted skills and matched job ids "
#         "to tailor questions and feedback. Keep responses concise and actionable."
#     )
#     context: Dict[str, Any] = {
#         "extracted_skills": session.extracted_skills,
#         "matched_job_ids": session.matched_job_ids,
#         "chat_history": session.chat_history[-10:],
#     }
#     prompt = f"{system_prompt}\n\nUser message: {body.message}\n\nContext: {context}"
#
#     try:
#         ai_text = await call_gemini(prompt, context)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"AI call failed: {e}")
#
#     await append_message(session_id, "assistant", ai_text)
#     return {"reply": ai_text, "session_id": session_id}
#
# @router.get("/chat/{session_id}/history")
# async def get_chat_history(session_id: str):
#     session = await get_session(session_id)
#     if not session:
#         raise HTTPException(status_code=404, detail="Session not found")
#     return {"chat_history": session.chat_history, "session_id": session_id}

# -------------------------
# Audio sentiment endpoint
# -------------------------

@router.post("/audio-sentiment", response_model=AudioSentimentResponse)
async def analyze_audio_sentiment(
    session_id: str = Form(...),
    file: UploadFile = File(...)
):
    # Optional: ensure session exists
    # session = await get_session(session_id)
    # if not session:
    #     raise HTTPException(status_code=404, detail="Session not found")

    if not file:
        raise HTTPException(status_code=400, detail="Audio file is required.")

    allowed_types = {
        "audio/mpeg",
        "audio/wav",
        "audio/x-wav",
        "audio/webm",
        "audio/ogg",
        "audio/x-m4a",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}"
        )

    # Save temporarily to disk for Whisper
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
            audio_bytes = await file.read()
            tmp.write(audio_bytes)
            tmp_path = tmp.name
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to save uploaded audio.")

    try:
        # Transcribe with Whisper
        segments, info = whisper_model.transcribe(
            tmp_path,
            task="transcribe",
            language="en"  # or None to auto-detect
        )

        transcript_parts = [segment.text for segment in segments]
        transcript = " ".join(transcript_parts).strip()

        if not transcript:
            raise HTTPException(
                status_code=400,
                detail="Could not transcribe audio or transcript is empty."
            )

        # Coarse sentiment (POS/NEG)
        sentiment_result = sentiment_pipe(transcript)[0]
        sentiment_label = sentiment_result["label"]
        sentiment_score = float(sentiment_result["score"])

        # Rich emotion distribution
        emotion_raw = emotion_pipe(transcript)[0]  # because return_all_scores=True
        emotions = [
            EmotionScore(label=e["label"], score=float(e["score"]))
            for e in emotion_raw
        ]

        # (Optional) you could also append this as a "metrics" message in the session
        # await append_message(session_id, "system", f"Sentiment: {label} ({score:.3f})")

        return AudioSentimentResponse(
            session_id=session_id,
            transcript=transcript,
            sentiment_label=sentiment_label,
            sentiment_score=sentiment_score,
            emotions=emotions,
        )

    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass