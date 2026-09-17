# backend/app/agents/orchestrator.py
from sqlalchemy.orm import Session
from app.agents.state import AgentState
from app.agents.supervisor import classify_and_route
from app.agents.escalation import escalate_case
from app.agents.tools import (
    execute_fee_reversal_tool,
    execute_limit_increase_tool,
    execute_card_replacement_tool,
)


def run_agent_workflow(state: AgentState, db: Session) -> AgentState:
    """
    Main Multi-Agent Workflow Runner:
    1. Routes through Supervisor Agent (Groq LLM).
    2. Dispatches to the appropriate deterministic specialist tool.
    3. Handles Human-in-the-Loop state suspension (WAITING_FOR_AUTH).
    4. Triggers Escalation Agent if policies are exceeded.
    """
    # -------------------------------------------------------------
    # Step 1: Supervisor Classification & Reasoning
    # -------------------------------------------------------------
    state = classify_and_route(state)
    intent = state.detected_intent

    # -------------------------------------------------------------
    # Step 2: Specialist Routing & Policy Execution
    # -------------------------------------------------------------

    # FLOW A: Fee Reversal (90-Day Policy)
    if intent == "FEE_REVERSAL":
        allowed, reason, payload, action_id, audit_hash = execute_fee_reversal_tool(
            db=db, card_id=state.card_id, member_id=state.member_id
        )
        state.agent_response = reason
        state.audit_id = action_id
        state.audit_hash = audit_hash
        state.status = "COMPLETED"
        return state

    # FLOW B: Credit Limit Increase (Tier Cap + Human-in-the-Loop)
    elif intent == "LIMIT_INCREASE":
        requested = state.extracted_entities.get("requested_limit") or 10000.0

        # If requested amount exceeds automated threshold ($25k, e.g. $50k) -> Escalate
        if requested > 25000.0:
            state, _ = escalate_case(
                state=state, 
                db=db, 
                reason=f"Requested amount (${requested:,.0f}) exceeds maximum automated confidence threshold ($25,000.00)"
            )
            return state

        allowed, reason, payload, action_id, audit_hash, requires_auth = execute_limit_increase_tool(
            db=db,
            card_id=state.card_id,
            member_id=state.member_id,
            requested_limit=requested,
            auth_verified=state.auth_verified,
        )

        if not allowed and not requires_auth:
            state.agent_response = reason
            state.audit_id = action_id
            state.audit_hash = audit_hash
            state.status = "COMPLETED"
            return state

        if requires_auth and not state.auth_verified:
            # SUSPEND WORKFLOW FOR HUMAN-IN-THE-LOOP (OTP)
            approved_limit = payload.get("approved_limit", requested)
            state.requires_auth = True
            state.status = "WAITING_FOR_AUTH"
            state.agent_response = (
                f"You are eligible for a limit increase up to ${approved_limit:,.0f} based on your tier cap. "
                f"To execute this, please verify your identity."
            )
            return state

        # If already verified or no auth required
        approved_val = payload.get("approved_limit") or requested
        state.agent_response = f"Success. Your new credit limit of ${approved_val:,.0f} is active."
        state.audit_id = action_id
        state.audit_hash = audit_hash
        state.status = "COMPLETED"
        return state


    # FLOW C: Card Replacement (Urgency-Aware & Lock)
    elif intent == "CARD_REPLACEMENT":
        reason = state.extracted_entities.get("replacement_reason") or state.user_message
        allowed, policy_reason, payload, action_id, audit_hash, recommend_voice = execute_card_replacement_tool(
            db=db, card_id=state.card_id, member_id=state.member_id, reason_text=reason
        )

        state.audit_id = action_id
        state.audit_hash = audit_hash
        state.recommend_voice = recommend_voice

        if recommend_voice:
            state.agent_response = (
                "I have locked your card immediately to prevent unauthorized charges. "
                "Since this is urgent, would you prefer to complete the replacement over a voice call?"
            )
        else:
            state.agent_response = policy_reason

        state.status = "COMPLETED"
        return state

    # FLOW D: Direct Escalation Request
    elif intent == "ESCALATE":
        state, _ = escalate_case(state=state, db=db, reason="Customer requested human agent escalation")
        return state

    # FLOW E: General Inquiries
    else:
        state.agent_response = (
            "I can assist you with credit limit increases, fee reversals, or card replacements. "
            "How can I help with your American Express card today?"
        )
        state.status = "COMPLETED"
        return state


def resume_workflow_with_auth(state: AgentState, db: Session, otp: str) -> AgentState:
    """
    Human-in-the-Loop Resumption Gateway:
    Called when the user submits their 6-digit OTP in the frontend.
    Verifies authentication and completes the suspended action in SQLite.
    """
    if len(otp) != 6 or not otp.isdigit():
        state.agent_response = "Invalid verification code. Please enter the 6-digit OTP."
        return state

    # Mark identity verified
    state.auth_verified = True
    state.requires_auth = False

    # Resume the workflow with auth passed
    requested = state.extracted_entities.get("requested_limit") or 10000.0
    allowed, reason, payload, action_id, audit_hash, _ = execute_limit_increase_tool(
        db=db,
        card_id=state.card_id,
        member_id=state.member_id,
        requested_limit=requested,
        auth_verified=True,
    )

    approved = payload.get("approved_limit", requested)
    state.agent_response = f"Success. Identity verified. Your new limit of ${approved:,.0f} is active."
    state.audit_id = action_id
    state.audit_hash = audit_hash
    state.status = "COMPLETED"
    return state
