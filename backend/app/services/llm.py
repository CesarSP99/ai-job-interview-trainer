# app/services/llm.py
import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = genai.GenerativeModel("gemini-2.5-flash")

async def ask_gemini(prompt: str) -> str:
    resp = MODEL.generate_content(prompt)
    return resp.text if resp and resp.text else ""
