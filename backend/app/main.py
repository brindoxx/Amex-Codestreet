# backend/app/main.py
import json
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import get_db, init_db, Member, Card, AuditLedger, ServiceRequest
from app.agents.state import AgentState
from app.agents.orchestrator import run_agent_workflow, resume_workflow_with_auth
from app.ledger.chain import verify_chain_integrity

# Initialize FastAPI App
app = FastAPI(
    title="AmEx Intelligate API",
    description="Autonomous Card Servicing Multi-Agent Backend with Cryptographic Audit Ledger",
    version="2.0.0",
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Ensure database schema is created on boot."""
    init_db()


# -------------------------------------------------------------------
# Request / Response Schemas
# -------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str
    card_id: str = "c1"
    member_id: str = "RKA-00-8821"
    session_id: Optional[str] = "web_session"


class OtpVerificationRequest(BaseModel):
    otp: str
    card_id: str = "c1"
    member_id: str = "RKA-00-8821"
    session_id: Optional[str] = "web_session"
    requested_limit: Optional[float] = 10000.0


# -------------------------------------------------------------------
# Core Servicing Endpoints
# -------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    return {"status": "online", "system": "AmEx Intelligate Multi-Agent Platform"}


@app.get("/api/member")
def get_member_profile(member_id: str = "RKA-00-8821", db: Session = Depends(get_db)):
    """Fetch member details, credit score, and associated cards."""
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    cards = db.query(Card).filter(Card.member_id == member_id).all()
    return {
        "id": member.id,
        "name": member.name,
        "email": member.email,
        "phone": member.phone,
        "credit_score": member.credit_score,
        "annual_spend": member.annual_spend,
        "member_since": member.member_since,
        "cards": [
            {
                "id": c.id,
                "name": c.card_name,
                "last4": c.last4,
                "tier": c.tier,
                "limit": c.credit_limit,
                "balance": c.balance,
                "is_locked": c.is_locked,
                "lock_reason": c.lock_reason,
            }
            for c in cards
        ],
    }


@app.get("/api/cards")
def get_cards(member_id: str = "RKA-00-8821", db: Session = Depends(get_db)):
    """Fetch cards for active member."""
    cards = db.query(Card).filter(Card.member_id == member_id).all()
    return [
        {
            "id": c.id,
            "name": c.card_name,
            "last4": c.last4,
            "tier": c.tier,
            "limit": c.credit_limit,
            "balance": c.balance,
            "is_locked": c.is_locked,
            "lock_reason": c.lock_reason,
        }
        for c in cards
    ]


@app.get("/api/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    """Fetch the permanent, cryptographically hash-chained audit ledger."""
    logs = db.query(AuditLedger).order_by(AuditLedger.id.desc()).all()
    return [
        {
            "id": l.action_id,
            "ts": l.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "member_id": l.member_id,
            "card_id": l.card_id,
            "type": l.action_type,
            "policy": l.policy_evaluated,
            "outcome": l.outcome,
            "hash": f"{l.sha256_hash[:10]}...",
            "full_hash": l.sha256_hash,
            "prev_hash": l.prev_hash,
            "payload": json.loads(l.payload_json),
        }
        for l in logs
    ]


@app.get("/api/audit-logs/verify")
def verify_audit_ledger(db: Session = Depends(get_db)):
    """
    Cryptographic verification endpoint:
    Recalculates every SHA-256 block hash from genesis to tip.
    Returns status: VERIFIED_PRISTINE or flags tampering.
    """
    is_pristine, stats = verify_chain_integrity(db)
    return {
        "pristine": is_pristine,
        "details": stats,
    }


@app.get("/api/escalations")
def get_escalations(db: Session = Depends(get_db)):
    """Fetch generated Service Request tickets for the internal agent console."""
    tickets = db.query(ServiceRequest).order_by(ServiceRequest.created_at.desc()).all()
    return [
        {
            "sr_number": t.sr_number,
            "member_id": t.member_id,
            "card_id": t.card_id,
            "intent": t.intent,
            "reason": t.reason,
            "customer_sentiment": t.customer_sentiment,
            "llm_summary": t.llm_summary,
            "recommended_action": t.recommended_action,
            "status": t.status,
            "estimated_tat_hours": t.estimated_tat_hours,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }
        for t in tickets
    ]


# -------------------------------------------------------------------
# Agent Conversational Endpoints
# -------------------------------------------------------------------

@app.post("/api/chat")
def handle_chat_message(req: ChatRequest, db: Session = Depends(get_db)):
    """
    Primary Conversational Endpoint:
    Dispatches customer message through the Multi-Agent Workflow.
    """
    initial_state = AgentState(
        session_id=req.session_id or "web_session",
        member_id=req.member_id,
        card_id=req.card_id,
        user_message=req.message,
    )

    final_state = run_agent_workflow(initial_state, db)

    return {
        "response": final_state.agent_response,
        "intent": final_state.detected_intent,
        "urgency": final_state.urgency_level,
        "status": final_state.status,
        "requires_auth": final_state.requires_auth,
        "audit_id": final_state.audit_id,
        "audit_hash": f"0x{final_state.audit_hash[:8].upper()}..." if final_state.audit_hash else None,
        "recommend_voice": final_state.recommend_voice,
        "sr_number": final_state.sr_ticket_number,
        "is_escalated": final_state.is_escalated,
    }


@app.post("/api/chat/verify-otp")
def verify_otp_and_resume(req: OtpVerificationRequest, db: Session = Depends(get_db)):
    """
    Human-in-the-Loop Resumption Endpoint:
    Receives OTP entered by customer, resumes the suspended workflow, updates SQLite, and writes the audit block.
    """
    state = AgentState(
        session_id=req.session_id or "web_session",
        member_id=req.member_id,
        card_id=req.card_id,
        user_message="OTP_VERIFY",
        extracted_entities={"requested_limit": req.requested_limit},
    )

    resumed_state = resume_workflow_with_auth(state, db, otp=req.otp)

    # Fetch updated card limit to return to frontend
    card = db.query(Card).filter(Card.id == req.card_id).first()

    return {
        "response": resumed_state.agent_response,
        "status": resumed_state.status,
        "auth_verified": resumed_state.auth_verified,
        "audit_id": resumed_state.audit_id,
        "audit_hash": f"0x{resumed_state.audit_hash[:8].upper()}..." if resumed_state.audit_hash else None,
        "new_limit": card.credit_limit if card else None,
    }
