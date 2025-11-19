# 📊 AI Career Assistant Platform  
### Resume Matching • Job Insights • AI Interview Training (Text + Voice)

An end‑to‑end, AI‑powered platform that helps users **analyze their resumes**, **discover job opportunities**, and **train for interviews** through an adaptive voice/text conversation system.

This project integrates **FastAPI**, **React**, **Gemini 2.5 Flash**, **Whisper STT**, **SBERT embeddings**, and **Explainable AI evaluation**.

Developed for **CSCE679 – Data Visualization** and expanded into a complete **AI Interview Coach**.

---

## 🗂️ Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
  - [Docker Compose](#docker-compose)
  - [Manual Setup](#manual-setup)
- [API Reference](#api-reference)
- [Credits](#credits)
- [License](#license)

---

## 🌐 Overview

The system provides a full pipeline from résumé → job match → interview practice:

### **1️⃣ Resume Understanding**
- Resume text extraction  
- Skills, responsibilities, and experience parsing  
- Embedding-based similarity scoring  
- LLM-based reranking with match explanations  

### **2️⃣ Job Insights**
- Interactive salary insights  
- Word clouds  
- Skill-match radial charts  
- U.S. salary maps  

### **3️⃣ Interview Training (NEW)**
- Start a session for any matched job  
- AI interviewer powered by **Gemini 2.5 Flash**  
- Unified endpoint for **text or voice**  
- **Whisper** transcription  
- Local **sentiment + emotion analysis**  
- Session stored in SQLite  
- Final **explainable evaluation** (score, strengths, weaknesses, emotional patterns)

---

## ✨ Features

### 📄 Resume & Job Intelligence
- PDF resume parsing with PyMuPDF  
- Skill extraction using Gemini (with Mistral fallback)  
- Job similarity via SBERT embeddings  
- Match reasoning & LLM re-ranking  
- Interactive visual dashboard (React)

### 🎤 AI Interview Coach
- Start interview sessions based on matched jobs  
- Gemini-powered dynamic follow-up questions  
- Voice or text responses through one API  
- Whisper STT + sentiment/emotion extraction  
- Full conversation history  
- End-of-session evaluation with:
  - Score  
  - Strengths  
  - Weaknesses  
  - Improvement suggestions  
  - Explanation referencing the user’s emotional tone  

### 📊 Visualization Dashboard
- Word clouds  
- Salary trend charts  
- Map-based visualization via React Leaflet  
- Interactive component-based UI with MUI + D3.js  

---

## 🛠️ Tech Stack

### Backend
- **FastAPI**
- **Google Gemini 2.5 Flash**
- **Whisper STT (Faster‑Whisper)**
- **SentenceTransformers (MiniLM)**
- **SpaCy**
- **SQLite + Alembic**

### Frontend
- **React**
- **Material UI**
- **Recharts, D3.js**
- **React Leaflet**
- **Axios**

### Deployment
- Docker Compose: Backend + Frontend  
- Optional: Ollama for fallback LLM  

---

## 📁 Project Structure

```
ResumeDashboard/
├── backend/                        # FastAPI backend (resume + interview)
│   ├── app/
│   │   ├── api/                    # Resume, jobs, interview endpoints
│   │   ├── services/               # LLM, audio, interview flow
│   │   ├── models/                 # SQLAlchemy ORM
│   │   ├── schemas/                # Pydantic validation models
│   │   ├── db/                     # Database + Alembic migrations
│   │   └── main.py                 # FastAPI entrypoint
│   └── Dockerfile
├── frontend/
│   └── dataviz-dashboard/          # React dashboard
│       ├── src/                    # Components, pages, charts, UI
│       └── Dockerfile
├── docker-compose.yml
└── README.md                       # This file
```

---

## ⚙️ Setup Instructions

### 🐳 Docker Compose (Recommended)

```bash
git clone https://github.com/CesarSP99/ai-job-interview-trainer
cd ai-job-interview-trainer

docker compose up --build
```

📌 Access:
- Backend API → `http://localhost:8000/docs`
- Frontend → `http://localhost:3000`

Ensure `.env` contains:

```env
GEMINI_API_KEY=your-key
```

---

## 🧪 Manual Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --reload
```

> http://localhost:8000/docs

### Frontend

```bash
cd frontend/dataviz-dashboard
npm install
npm start
```

> http://localhost:3000

---

## 🔗 API Reference

### **POST /resume/match**
Upload a PDF and get:
- Extracted skills
- Matched jobs
- Match reasons
- Word cloud
- Salary trends
- Resume profile breakdown

### **POST /interview/start**
Starts an interview for a chosen job.

### **POST /interview/message**
Unified text/voice input for conversation.

### **POST /interview/evaluate**
Provides structured final interview evaluation.

---

## 🙌 Credits

**Current Contributors**
- Manuel Moran  
- Cesar Salazar  
- Nhan Nguyen  

**Original Contributors**
- Rishik Gupta  
- Madelein Villegas  

Developed as part of **Spring 2025 CSCE679** and expanded into a full AI Interview Platform.

---

## 📄 License
MIT License
