# app/services/interview_service.py
from sqlalchemy.orm import Session
from app.models.interview import InterviewSession, InterviewMessage
from app.services.llm import ask_gemini
from app.services.audio import analyze_text_sentiment

# ----------------------------
# Start Session
# ----------------------------
async def start_session(db: Session, data):
    session = InterviewSession(
        job_id=data.job_id,
        job_title=data.job_title,
        company=data.company,
        match_score=data.match_score,
        resume_skills=data.resume_skills,
        matched_skills=data.matched_skills,
        resume_profile=data.resume_profile,
        trainee_name=data.trainee_name
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    # First message
    prompt = f"""
You are an interview assistant helping the candidate practice for:
- Job: {data.job_title} at {data.company}
- Matched skills: {data.matched_skills[:8]}
- Candidate name: {data.trainee_name}

Greet them and ask the first interview question.
Make it short and friendly.
"""

    reply_text = await ask_gemini(prompt)

    msg = InterviewMessage(
        session_id=session.session_id,
        role="assistant",
        modality="text",
        content=reply_text
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return session, msg

# ----------------------------
# Handle message
# ----------------------------
async def process_message(db: Session, session_id: str, user_text: str, modality: str):
    session = db.query(InterviewSession).filter_by(session_id=session_id).first()
    if not session:
        return None, None, None

    # Sentiment
    sentiment = analyze_text_sentiment(user_text)

    # Store user message
    user_msg = InterviewMessage(
        session_id=session_id,
        role="user",
        modality=modality,
        content=user_text,
        sentiment=sentiment
    )
    db.add(user_msg)
    db.commit()

    # Build context
    history = db.query(InterviewMessage).filter_by(session_id=session_id).all()
    hist_str = "\n".join([f"{m.role}: {m.content}" for m in history])

    prompt = f"""
You are an interview assistant.

Job: {session.job_title}
Company: {session.company}
Matched skills: {session.matched_skills[:8]}

Chat history:
{hist_str}

Respond to the candidate.
Ask exactly one follow-up question.
Be concise.
"""

    reply = await ask_gemini(prompt)

    a_msg = InterviewMessage(
        session_id=session_id,
        role="assistant",
        modality="text",
        content=reply
    )
    db.add(a_msg)
    db.commit()
    db.refresh(a_msg)

    return user_msg, a_msg, history

# ----------------------------
# Evaluation
# ----------------------------
async def evaluate_session(db: Session, session_id: str):
    session = db.query(InterviewSession).filter_by(session_id=session_id).first()
    history = db.query(InterviewMessage).filter_by(session_id=session_id).all()

    hist_str = "\n".join(
        [f"{m.role}: {m.content} (sentiment={m.sentiment})" for m in history]
    )

    prompt = f"""
You are an interview evaluator.

Evaluate this mock interview:

Job: {session.job_title} at {session.company}
Matched skills: {session.matched_skills}

Full annotated transcript:
{hist_str}

Provide:
- Overall score /10
- Strengths
- Weaknesses
- Concrete improvement suggestions
- A transparent explanation referencing sentiment/emotion patterns

Structure your output with clear sections. Use markdown formatting. Don't include code block ticks, just plain text.
"""

    evaluation = await ask_gemini(prompt)

    # Extract explanation section (Gemini will generate it)
    explanation = "Model rationale included above."

    return evaluation, explanation
