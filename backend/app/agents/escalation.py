# backend/app/agents/escalation.py
import os
import json
import uuid
import datetime
from typing import Tuple
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from groq import Groq
from app.models.database import ServiceRequest, Member, Card
from app.agents.state import AgentState

load_dotenv()


def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key.startswith("your_"):
        raise ValueError("GROQ_API_KEY is missing or invalid in backend/.env")
    return Groq(api_key=api_key)


ESCALATION_SUMMARY_PROMPT = """
You are the Human Escalation Agent for American Express.
A card servicing interaction requires escalation to a human specialist.
Review the customer's request and the policy reason, then generate an executive triage briefing for the internal agent console.

Respond ONLY with valid JSON in this exact structure:
{
  "customer_sentiment": string (e.g., "Frustrated", "Anxious", "Neutral"),
  "escalation_priority": "CRITICAL" | "HIGH" | "MEDIUM",
  "root_cause": string (concise explanation of why automated resolution was not possible),
  "recommended_action": string (specific next step for the human agent, e.g. "Review underwriting for $50k credit line", "Expedite replacement delivery"),
  "estimated_tat_hours": integer (typically 2 to 6 hours),
  "member_message": string (clear, empathetic message to customer with estimated timeline)
}
"""


def escalate_case(state: AgentState, db: Session, reason: str) -> Tuple[AgentState, ServiceRequest]:
    """
    Escalation Node:
    1. Uses Groq LLM to synthesize customer context and recommended human action.
    2. Generates an SR ticket and saves it to SQLite.
    3. Updates AgentState with the ticket number and member response.
    """
    client = get_groq_client()
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # Fetch context from SQLite
    member = db.query(Member).filter(Member.id == state.member_id).first()
    card = db.query(Card).filter(Card.id == state.card_id).first()

    card_info = f"{card.card_name} ending in {card.last4} (Tier: {card.tier}, Limit: ${card.credit_limit:,.0f})" if card else "Card not found"
    member_info = f"{member.name} (Credit Score: {member.credit_score}, Annual Spend: ${member.annual_spend:,.0f})" if member else "Member"

    # Call LLM to synthesize the briefing
    response = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": ESCALATION_SUMMARY_PROMPT},
            {
                "role": "user", 
                "content": f"Member: {member_info}\nCard: {card_info}\nCustomer Message: '{state.user_message}'\nSystem Reason: '{reason}'"
            },
        ],
        temperature=0.2,
    )

    triage = json.loads(response.choices[0].message.content)

    # Generate unique Service Request Number
    sr_number = f"SR-{uuid.uuid4().hex[:6].upper()}"
    tat_hours = triage.get("estimated_tat_hours", 4)

    # Persist Service Request Ticket to Database
    sr_ticket = ServiceRequest(
        sr_number=sr_number,
        member_id=state.member_id,
        card_id=state.card_id,
        intent=state.detected_intent,
        reason=triage.get("root_cause", reason),
        customer_sentiment=triage.get("customer_sentiment", "Neutral"),
        llm_summary=f"Root Cause: {triage.get('root_cause', reason)}\nPriority: {triage.get('escalation_priority', 'HIGH')}",
        recommended_action=triage.get("recommended_action", "Manual Account Review"),
        status="OPEN",
        estimated_tat_hours=tat_hours,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(sr_ticket)
    db.commit()

    # Update Agent State
    state.is_escalated = True
    state.sr_ticket_number = sr_number
    state.status = "ESCALATED"
    state.agent_response = (
        f"{triage.get('member_message', 'Your request has been forwarded to our card underwriting specialists.')} "
        f"Your reference number is {sr_number}. Estimated resolution time is within {tat_hours} hours."
    )

    return state, sr_ticket
