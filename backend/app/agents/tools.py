# backend/app/agents/tools.py
import uuid
import datetime
from typing import Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models.database import Card, FeeWaiverHistory
from app.policies.engine import (
    evaluate_fee_reversal, 
    evaluate_limit_increase, 
    evaluate_card_replacement
)
from app.ledger.chain import record_audit_action


def execute_fee_reversal_tool(db: Session, card_id: str, member_id: str) -> Tuple[bool, str, Dict[str, Any], str, str]:
    """
    Executes the deterministic Fee Reversal policy.
    If approved -> mutates FeeWaiverHistory and writes to the cryptographic audit ledger.
    """
    policy = evaluate_fee_reversal(card_id, db)
    action_id = f"FEE-{uuid.uuid4().hex[:4].upper()}"
    
    payload = {
        "card_id": card_id,
        "member_id": member_id,
        "fee_amount": 39.0,
        "outcome": policy.outcome,
        "reason": policy.reason,
    }

    if policy.allowed:
        # Mutate database: record the new waiver
        new_waiver = FeeWaiverHistory(
            card_id=card_id,
            waiver_date=datetime.datetime.utcnow(),
            fee_amount=39.0,
            status="APPROVED",
        )
        db.add(new_waiver)
        db.commit()

    # Always log the decision (Approved or Denied) to the immutable ledger
    audit_entry = record_audit_action(
        db=db,
        action_id=action_id,
        member_id=member_id,
        card_id=card_id,
        action_type="FEE",
        policy_evaluated=policy.policy_evaluated,
        outcome=policy.outcome,
        payload=payload,
    )

    return policy.allowed, policy.reason, payload, action_id, audit_entry.sha256_hash


def execute_limit_increase_tool(
    db: Session, 
    card_id: str, 
    member_id: str, 
    requested_limit: float, 
    auth_verified: bool
) -> Tuple[bool, str, Dict[str, Any], str, str, bool]:
    """
    Executes the Limit Increase policy.
    If auth is not verified yet, halts and returns requires_auth=True.
    If auth is verified and allowed, updates the card limit in SQLite and seals the ledger.
    """
    policy = evaluate_limit_increase(card_id, requested_limit, db)
    action_id = f"LIM-{uuid.uuid4().hex[:4].upper()}"

    # Check if we must halt for Human-in-the-loop authentication
    if policy.requires_auth and not auth_verified:
        return False, policy.reason, {"approved_limit": policy.approved_limit}, action_id, "", True

    payload = {
        "card_id": card_id,
        "member_id": member_id,
        "requested_limit": requested_limit,
        "approved_limit": policy.approved_limit,
        "auth_verified": auth_verified,
    }

    if policy.allowed and policy.approved_limit:
        card = db.query(Card).filter(Card.id == card_id).first()
        if card:
            card.credit_limit = policy.approved_limit
            db.commit()

    # Log to audit ledger
    audit_entry = record_audit_action(
        db=db,
        action_id=action_id,
        member_id=member_id,
        card_id=card_id,
        action_type="LIMIT",
        policy_evaluated=policy.policy_evaluated,
        outcome=policy.outcome,
        payload=payload,
    )

    return policy.allowed, policy.reason, payload, action_id, audit_entry.sha256_hash, False


def execute_card_replacement_tool(
    db: Session, 
    card_id: str, 
    member_id: str, 
    reason_text: str
) -> Tuple[bool, str, Dict[str, Any], str, str, bool]:
    """
    Executes the Card Replacement policy.
    If lost/stolen: locks card instantly and flags recommend_voice=True.
    """
    policy = evaluate_card_replacement(card_id, reason_text, db)
    action_id = f"REP-{uuid.uuid4().hex[:4].upper()}"

    payload = {
        "card_id": card_id,
        "member_id": member_id,
        "reason_reported": reason_text,
        "card_locked": policy.card_locked,
        "shipping": "Expedited Courier" if policy.card_locked else "Standard USPS",
    }

    audit_entry = record_audit_action(
        db=db,
        action_id=action_id,
        member_id=member_id,
        card_id=card_id,
        action_type="REPLACE",
        policy_evaluated=policy.policy_evaluated,
        outcome=policy.outcome,
        payload=payload,
    )

    return policy.allowed, policy.reason, payload, action_id, audit_entry.sha256_hash, policy.recommend_voice
