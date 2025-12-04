# app/models/interview.py
from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base
import uuid

def gen_id():
    return uuid.uuid4().hex

class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    session_id = Column(String, primary_key=True, default=gen_id)
    job_id = Column(Integer)
    job_title = Column(String)
    company = Column(String)
    match_score = Column(Float)
    resume_skills = Column(JSON)
    matched_skills = Column(JSON)
    resume_profile = Column(JSON)
    trainee_name = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)

    messages = relationship("InterviewMessage", back_populates="session")


class InterviewMessage(Base):
    __tablename__ = "interview_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("interview_sessions.session_id"))
    role = Column(String)  # "user" / "assistant"
    modality = Column(String)  # "text" / "voice"
    content = Column(Text)     # raw text or transcript
    sentiment = Column(JSON)   # sentiment_label, sentiment_score
    emotions = Column(JSON)    # list of emotion scores

    created_at = Column(DateTime, default=datetime.utcnow)
    tts_url = Column(String, nullable=True)

    session = relationship("InterviewSession", back_populates="messages")
