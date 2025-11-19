# app/api/interview_train.py

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.interview import *
from app.services.audio import transcribe_audio, analyze_text_sentiment
from app.services.interview_service import start_session, process_message, evaluate_session

router = APIRouter(prefix="/interview", tags=["Interview"])

# ----------------------------
# Start Session
# ----------------------------
@router.post("/start", response_model=StartResponse)
async def start(data: StartRequest, db: Session = Depends(get_db)):
    session, first_msg = await start_session(db, data)

    # Convert SQLAlchemy InterviewMessage -> Pydantic Message
    first_message = Message(
        role=first_msg.role,
        content=first_msg.content,
        modality=first_msg.modality,
        sentiment=None,  # assistant greeting usually has no sentiment
    )

    return StartResponse(
        session_id=session.session_id,
        first_message=first_message,
    )

# ----------------------------
# Unified text + voice
# ----------------------------
@router.post("/message", response_model=ChatResponse)
async def message(
    session_id: str = Form(...),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    if not text and not file:
        raise HTTPException(400, "Either text or audio file is required.")

    if file:
        transcript = await transcribe_audio(file)
        user_text = transcript
        modality = "voice"
    else:
        user_text = text
        modality = "text"

    user_msg, assistant_msg, history = await process_message(db, session_id, user_text, modality)

    if user_msg is None or assistant_msg is None or history is None:
        raise HTTPException(status_code=404, detail="Session not found.")

    msgs = [
        Message(
            role=m.role,
            content=m.content,
            modality=m.modality,
            sentiment = SentimentResult.model_validate(m.sentiment) if m.sentiment else None
        )
        for m in history
    ]

    return ChatResponse(
        session_id=session_id,
        reply=Message(
            role="assistant",
            content=assistant_msg.content,
            modality="text"
        ),
        chat_history=msgs
    )

# ----------------------------
# End Interview / Evaluation
# ----------------------------
@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate(session_id: str = Form(...), db: Session = Depends(get_db)):
    evaluation, explanation = await evaluate_session(db, session_id)
    return EvaluationResponse(
        session_id=session_id,
        evaluation=evaluation,
        explanation=explanation
    )
