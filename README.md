# AmEx Intelligate — End-to-End Servicing Agent 💳🤖

> **AmEx Codestreet 2026 — Round 1 Submission**  
> *Your card, resolved instantly — an omnichannel conversational agent for automated card servicing, with a verifiable audit trail and context-complete human escalation.*

---

## 📌 Project Overview

**Team Name:** hello-all  
**Member:** Mrinal Subudhi  
**Selected Problem Statement:** End-to-End Servicing Agent  

**AmEx Intelligate** is an omnichannel servicing solution built to automate high-frequency, routine card member requests—specifically **Fee Reversals**, **Credit Limit Increases**, and **Replacement Card Orders**—within a single interaction.

### Key Highlights
* **Omnichannel with Urgency Routing:** Seamlessly balances chat for routine requests and proactive voice calls for high-anxiety moments (e.g., lost/stolen cards).
* **Inline Security & Verification:** Integrated in-chat OTP and card verification widgets before taking high-impact account actions.
* **Verifiable Audit Trail:** Every policy check, tool call, and decision is recorded in a tamper-evident, hash-chained log.
* **Context-Complete Escalation:** Escalates edge-cases to human agents with structured context summaries instead of raw chat logs.

---

## 🛠️ Technology Stack

### Frontend (This Repository)
* **Framework:** React.js (Vite)
* **Language:** JavaScript (JSX)
* **Styling:** CSS3 / Custom Component Modules

### Target Backend & Orchestration (Architecture Path)
* **API Framework:** FastAPI (Python)
* **Agent Orchestrator:** LangGraph + Groq API (Llama 3.1/3.3) for explicit state management
* **Audit Database:** SQLite (Hash-chained immutable schema)

---

## 📂 Repository Structure

```text
Amex-Intelligate/
├── index.html          # Vite entry point
├── package.json        # Project dependencies & scripts
├── vite.config.js      # Vite dev server configuration
└── src/
    ├── main.jsx        # Application bootstrap
    ├── App.jsx         # Main layout shell & chat orchestrator
    ├── components/     # Reusable UI elements (Chat bubbles, OTP widgets, Audit badges)
    └── pages/          # Primary views (Chat Interface, Verifiable Audit Ledger)
