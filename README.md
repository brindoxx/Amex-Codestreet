# AmEx Intelligate — End-to-End Servicing Agent 💳🤖

> **AmEx Codestreet 2026 — Submission**  
> *Your card, resolved instantly — an omnichannel conversational agent for automated card servicing, with a verifiable audit trail and context-complete human escalation.*

---

## 📌 Project Overview

**Team Name:** hello-all  
**Member:** Mrinal Subudhi  
**Selected Problem Statement:** End-to-End Servicing Agent  

**AmEx Intelligate** is an autonomous card servicing platform built to resolve high-frequency, routine card member requests—specifically **Fee Reversals**, **Credit Limit Increases**, and **Replacement Card Orders**—within a single interaction.

### Key Highlights
* **Supervisor Multi-Agent Workflow:** Groq LLM semantic classification routes requests dynamically to deterministic banking tools.
* **Deterministic Policy Engine:** Pure Python business rules strictly enforce 90-day waiver intervals, tier caps, and instant card locking—eliminating model hallucinations.
* **Human-in-the-Loop (HITL) Security:** State suspension for inline OTP verification before high-impact account mutations.
* **Tamper-Evident SHA-256 Audit Ledger:** Every policy check and decision is cryptographically hash-chained in SQLite.
* **Context-Complete Escalation:** High-risk requests ($50k) generate structured Service Request tickets (`SR-XXXXXX`) with turnaround times.

---

## 🛠️ Technology Stack

### Frontend
* **Framework:** React 19 (Vite)
* **Language:** JavaScript (JSX)
* **Styling:** Custom AmEx Design System & CSS animations

### Backend & Orchestration
* **API Framework:** FastAPI (Python 3.11+)
* **Agent Engine:** Groq API (Qwen 2.5 / Llama 3) with deterministic tool execution
* **Database & Ledger:** SQLite with SHA-256 cryptographic chain
* **Security:** Human-in-the-Loop state machine

---

## 📂 Repository Structure

```text
Amex-Intelligate/
├── frontend/                     # React + Vite frontend application
│   ├── src/
│   │   ├── api/                  # Backend API client
│   │   ├── components/           # UI components
│   │   ├── App.jsx               # Main application shell & screens
│   │   └── index.css             # AmEx design tokens
│   ├── index.html
│   ├── vite.config.js            # Vite configuration & backend proxy
│   └── package.json
├── backend/                      # Python FastAPI & Agentic Backend
│   ├── app/
│   │   ├── agents/               # Supervisor, Orchestrator, Escalation, Tools
│   │   ├── policies/             # Deterministic Banking Policy Engine
│   │   ├── ledger/               # Cryptographic SHA-256 Hash Chaining
│   │   ├── models/               # SQLAlchemy SQLite models
│   │   └── main.py               # FastAPI REST & Conversational endpoints
│   ├── seed.py                   # Realistic database seeder
│   ├── test_phase1.py            # Policy & Cryptographic Ledger test suite
│   ├── test_phase2.py            # Multi-Agent live Groq test suite
│   ├── requirements.txt
│   └── .env.example
├── .gitignore                    # Fullstack ignore rules (protects .env & databases)
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Run the Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Set up your Groq API key in backend/.env
# GROQ_API_KEY=your_key_here
# GROQ_MODEL=qwen/qwen3.8-27b

# Seed the SQLite database
python seed.py

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
Interactive API docs will be available at `http://127.0.0.1:8000/docs`.

### 2. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.
