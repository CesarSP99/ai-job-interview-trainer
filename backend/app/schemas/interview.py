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
    tts_url: Optional[str] = None

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

class SentimentTimelineItem(BaseModel):
    """
    One entry in the timeline of messages, with sentiment attached.
    Frontend can use this directly in D3 for line / bar charts.
    """
    index: int
    role: Literal["user", "assistant"]
    content: str
    sentiment: Optional[SentimentResult] = None


class SentimentSummary(BaseModel):
    """
    Aggregated statistics to support bar charts and summary views.
    """
    total_messages: int
    user_messages: int
    assistant_messages: int
    counts_by_label: Dict[str, int]
    avg_sentiment_score_by_label: Dict[str, float]


class EvaluationResponse(BaseModel):
    """
    Returned by /interview/evaluate.
    - evaluation: rich markdown-like text (overall score, strengths, etc.)
    - explanation: short statement about model rationale.
    - sentiment_timeline: per-turn sentiment data.
    - sentiment_summary: aggregates for charts.
    """
    session_id: str
    evaluation: str
    explanation: str
    sentiment_timeline: List[SentimentTimelineItem]
    sentiment_summary: SentimentSummary
