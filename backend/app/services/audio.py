# app/services/audio.py
from faster_whisper import WhisperModel
from transformers import pipeline
import tempfile, os
from pathlib import Path
from TTS.api import TTS

# ------------------------
# Whisper (ASR)
# ------------------------
whisper_model = WhisperModel("small", device="cpu", compute_type="int8")

# ------------------------
# Sentiment + Emotion
# ------------------------
sentiment_pipe = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english",
)

emotion_pipe = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    return_all_scores=True,
)

def analyze_text_sentiment(text: str):
    """Return sentiment + emotion scores for a piece of text."""
    s = sentiment_pipe(text)[0]
    e = emotion_pipe(text)[0]
    return {
        "sentiment_label": s["label"],
        "sentiment_score": float(s["score"]),
        "emotions": [{"label": x["label"], "score": float(x["score"])} for x in e],
    }


async def transcribe_audio(file):
    """Save uploaded audio to a temp file and transcribe with Whisper."""
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        segments, _ = whisper_model.transcribe(tmp_path, language="en")
        transcript = " ".join([seg.text for seg in segments]).strip()
    finally:
        os.remove(tmp_path)

    return transcript


# ------------------------
# TTS (assistant replies)
# ------------------------

# IMPORTANT: Resolve project root and media/audio directory explicitly
# __file__ -> app/services/audio.py
# parents[0] = services
# parents[1] = app
# parents[2] = project root (where Docker WORKDIR is /app)
BASE_DIR = Path(__file__).resolve().parents[2]
MEDIA_DIR = BASE_DIR / "media"
AUDIO_DIR = MEDIA_DIR / "audio"

AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# Coqui TTS model (same as you had, just moved below)
tts = TTS(
    model_name="tts_models/en/ljspeech/tacotron2-DDC",
    progress_bar=False,
)


def synthesize_reply_audio(session_id: str, message_id: int, text: str) -> str:
    """
    Generate assistant TTS reply and return a relative URL.

    Files are saved under:
        /app/media/audio/<session_id>_reply_<message_id>.wav

    And exposed via:
        /media/audio/<session_id>_reply_<message_id>.wav
    """
    if not text or not text.strip():
        return ""

    filename = f"{session_id}_reply_{message_id}.wav"
    filepath = AUDIO_DIR / filename

    print(f"[TTS] Synthesizing audio to: {filepath}")

    tts.tts_to_file(
        text=text,
        file_path=str(filepath),
    )

    url_path = f"/media/audio/{filename}"
    print(f"[TTS] Exposed URL path: {url_path}")

    return url_path
