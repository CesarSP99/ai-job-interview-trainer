# app/schemas/interview.py
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Literal, Dict, Any

class EmotionScore(BaseModel):
    label: str
    score: float

class SentimentResult(BaseModel):
    sentiment_label: str
    sentiment_score: float
    emotions: List[EmotionScore]

class Message(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role: Literal["user", "assistant"]
    content: str
    modality: Literal["text", "voice"] = "text"
    sentiment: Optional[SentimentResult] = None

class StartRequest(BaseModel):
    job_id: int
    job_title: str
    company: str
    match_score: float
    resume_skills: List[str]
    matched_skills: List[str]
    resume_profile: Optional[Dict[str, Any]] = None
    trainee_name: Optional[str] = None

class StartResponse(BaseModel):
    session_id: str
    first_message: Message

class ChatResponse(BaseModel):
    session_id: str
    reply: Message
    chat_history: List[Message]

class EvaluationResponse(BaseModel):
    session_id: str
    evaluation: str
    explanation: str
