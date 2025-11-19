# app/services/audio.py
from faster_whisper import WhisperModel
from transformers import pipeline
import tempfile, os

# Whisper
whisper_model = WhisperModel("small", device="cpu", compute_type="int8")

# Sentiment + Emotion
sentiment_pipe = pipeline("sentiment-analysis",
                          model="distilbert-base-uncased-finetuned-sst-2-english")

emotion_pipe = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    return_all_scores=True,
)

def analyze_text_sentiment(text: str):
    s = sentiment_pipe(text)[0]
    e = emotion_pipe(text)[0]
    return {
        "sentiment_label": s["label"],
        "sentiment_score": float(s["score"]),
        "emotions": [{"label": x["label"], "score": float(x["score"])} for x in e]
    }

async def transcribe_audio(file):
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        segments, _ = whisper_model.transcribe(tmp_path, language="en")
        transcript = " ".join([seg.text for seg in segments]).strip()
    finally:
        os.remove(tmp_path)

    return transcript
