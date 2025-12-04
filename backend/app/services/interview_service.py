# app/services/interview_service.py
from collections import Counter, defaultdict
from typing import List, Dict, Any, Tuple

from sqlalchemy.orm import Session
from app.models.interview import InterviewSession, InterviewMessage
from app.services.llm import ask_gemini
from app.services.audio import analyze_text_sentiment, synthesize_reply_audio


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
        trainee_name=data.trainee_name,
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
        content=reply_text,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # 🔊 Generate TTS for the first assistant reply
    try:
        tts_url = synthesize_reply_audio(
            session_id=session.session_id,
            message_id=msg.id,
            text=msg.content,
        )
        msg.tts_url = tts_url
        db.commit()
        db.refresh(msg)
    except Exception as e:
        # Optional: log error, but don't break the flow if TTS fails
        print(f"[TTS] Error generating audio for greeting: {e}")

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
        sentiment=sentiment,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

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
        content=reply,
    )
    db.add(a_msg)
    db.commit()
    db.refresh(a_msg)

    # 🔊 Generate TTS for assistant reply
    try:
        tts_url = synthesize_reply_audio(
            session_id=session.session_id,
            message_id=a_msg.id,
            text=a_msg.content,
        )
        a_msg.tts_url = tts_url
        db.commit()
        db.refresh(a_msg)
    except Exception as e:
        print(f"[TTS] Error generating audio for reply: {e}")

    return user_msg, a_msg, history

# ----------------------------
# Evaluation
# ----------------------------
async def evaluate_session(
    db: Session, session_id: str
) -> Tuple[str, str, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Evaluate a full mock interview session:
    - Builds an annotated transcript with sentiment
    - Asks Gemini for a markdown-style evaluation
    - Computes structured sentiment stats for visualizations

    Returns:
        evaluation_text (str)
        explanation (str)
        sentiment_timeline (list[dict])
        sentiment_summary (dict)
    """
    session: InterviewSession | None = (
        db.query(InterviewSession).filter_by(session_id=session_id).first()
    )
    if not session:
        raise ValueError("Session not found")

    history: List[InterviewMessage] = (
        db.query(InterviewMessage)
        .filter_by(session_id=session_id)
        .order_by(InterviewMessage.created_at.asc())
        .all()
    )

    # ---------- Build annotated transcript for Gemini ----------
    def format_sentiment_for_llm(sent: Any) -> str:
        if not sent:
            return "none"
        try:
            label = sent.get("sentiment_label")
            score = sent.get("sentiment_score")
            emotions = sent.get("emotions", [])
            top_emotions = ", ".join(
                f"{e.get('label')} ({e.get('score'):.2f})"
                for e in emotions[:3]
                if isinstance(e, dict) and "label" in e and "score" in e
            )
            return f"label={label}, score={score:.2f}, emotions=[{top_emotions}]"
        except Exception:
            return str(sent)

    annotated_lines: List[str] = []
    for m in history:
        ann = format_sentiment_for_llm(m.sentiment)
        annotated_lines.append(f"{m.role.upper()}: {m.content} [sentiment={ann}]")

    hist_str = "\n".join(annotated_lines)

    # ---------- Call Gemini for qualitative evaluation ----------
    prompt = f"""
You are an interview evaluator.

Evaluate this mock interview:

Job: {session.job_title} at {session.company}
Matched skills: {session.matched_skills}

Full annotated transcript (each line shows role, content, and sentiment):
{hist_str}

Provide:
- An overall numeric score out of 10 (e.g., "Overall score: 7.5/10")
- Key strengths (bullet list)
- Key weaknesses (bullet list)
- 3–5 concrete improvement suggestions
- A transparent explanation that explicitly references sentiment/emotion patterns
  (e.g., "Your answers started confident but became more negative when discussing X...").

Use **plain text** with markdown-style headings and bullet points.
Do NOT wrap the answer in code fences.
"""

    evaluation_text = await ask_gemini(prompt)

    # You can later parse out an "explanation" section if desired.
    explanation = (
        "The evaluation above includes the model's rationale and references "
        "to sentiment patterns."
    )

    # ---------- Build sentiment_timeline for D3 ----------
    sentiment_timeline: List[Dict[str, Any]] = []
    for idx, m in enumerate(history):
        sentiment_timeline.append(
            {
                "index": idx,
                "role": m.role,
                "content": m.content,
                "sentiment": m.sentiment,
            }
        )

    # ---------- Build sentiment_summary for charts ----------
    total_messages = len(history)
    user_messages = sum(1 for m in history if m.role == "user")
    assistant_messages = sum(1 for m in history if m.role == "assistant")

    user_with_sentiment = [
        m for m in history if m.role == "user" and m.sentiment is not None
    ]

    counts_by_label: Counter[str] = Counter()
    score_buckets: Dict[str, list[float]] = defaultdict(list)

    for m in user_with_sentiment:
        try:
            label = m.sentiment.get("sentiment_label")
            score = float(m.sentiment.get("sentiment_score", 0.0))
        except Exception:
            continue

        if not label:
            continue

        counts_by_label[label] += 1
        score_buckets[label].append(score)

    avg_sentiment_score_by_label: Dict[str, float] = {}
    for label, scores in score_buckets.items():
        if scores:
            avg_sentiment_score_by_label[label] = sum(scores) / len(scores)

    sentiment_summary: Dict[str, Any] = {
        "total_messages": total_messages,
        "user_messages": user_messages,
        "assistant_messages": assistant_messages,
        "counts_by_label": dict(counts_by_label),
        "avg_sentiment_score_by_label": avg_sentiment_score_by_label,
    }

    return evaluation_text, explanation, sentiment_timeline, sentiment_summary
