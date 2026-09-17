# backend/app/policies/engine.py
import datetime
from dataclasses import dataclass
from typing import Optional
from sqlalchemy.orm import Session
from app.models.database import Card, FeeWaiverHistory, Member


# Standard Tier Caps for automated approvals
TIER_LIMIT_CAPS = {
    "Platinum": 10000.0,
    "Gold": 7500.0,
    "Blue Cash Preferred": 5000.0,
}

# Threshold beyond which any automated increase must be escalated to a human underwriter
MAX_AUTOMATED_THRESHOLD = 25000.0


@dataclass
class PolicyResult:
    allowed: bool
    outcome: str               # "Approved", "Denied", "Partially Approved"
    policy_evaluated: str      # e.g., "90-Day Waiver Policy", "Tier Cap Applied"
    reason: str                # Human-readable explanation
    approved_limit: Optional[float] = None
    next_eligible_date: Optional[str] = None
    requires_auth: bool = False
    card_locked: bool = False
    recommend_voice: bool = False
    action_type: str = ""      # "FEE", "LIMIT", "REPLACE"


def evaluate_fee_reversal(card_id: str, db: Session) -> PolicyResult:
    """
    Policy: Maximum 1 fee waiver per 90 days per card.
    If < 90 days since last waiver -> DENIED + provides next eligible date.
    If >= 90 days (or never waived) -> APPROVED.
    """
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        return PolicyResult(
            allowed=False,
            outcome="Denied",
            policy_evaluated="Card Lookup",
            reason="Card not found.",
            action_type="FEE",
        )

    # Get the latest approved fee waiver for this card
    last_waiver = (
        db.query(FeeWaiverHistory)
        .filter(FeeWaiverHistory.card_id == card_id, FeeWaiverHistory.status == "APPROVED")
        .order_by(FeeWaiverHistory.waiver_date.desc())
        .first()
    )

    if not last_waiver:
        return PolicyResult(
            allowed=True,
            outcome="Approved",
            policy_evaluated="90-Day Waiver Cleared (First Request)",
            reason="Eligible for fee waiver. No previous waivers on record.",
            action_type="FEE",
        )

    now = datetime.datetime.utcnow()
    days_since = (now - last_waiver.waiver_date).days

    if days_since < 90:
        days_remaining = 90 - days_since
        next_date = (now + datetime.timedelta(days=days_remaining)).strftime("%B %d, %Y")
        return PolicyResult(
            allowed=False,
            outcome="Denied",
            policy_evaluated=f"90-Day Waiver Policy — {days_since}d since last",
            reason=f"Our policy allows one fee waiver every 90 days. A waiver was processed {days_since} days ago. Your next eligible date is {next_date}.",
            next_eligible_date=next_date,
            action_type="FEE",
        )

    return PolicyResult(
        allowed=True,
        outcome="Approved",
        policy_evaluated="90-Day Waiver Cleared",
        reason=f"Eligible for fee waiver. It has been {days_since} days since your last waiver.",
        action_type="FEE",
    )


def evaluate_limit_increase(card_id: str, requested_limit: float, db: Session) -> PolicyResult:
    """
    Policy:
    1. If requested > MAX_AUTOMATED_THRESHOLD ($25k, e.g. $50k) -> Escalates to human agent.
    2. If requested exceeds tier cap -> Partially Approved up to tier cap (e.g. $12k requested -> $10k approved).
    3. Requires Identity Verification (OTP) before execution.
    """
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        return PolicyResult(
            allowed=False,
            outcome="Denied",
            policy_evaluated="Card Lookup",
            reason="Card not found.",
            action_type="LIMIT",
        )

    tier_cap = TIER_LIMIT_CAPS.get(card.tier, 5000.0)

    # Escalation condition (e.g. $50k request)
    if requested_limit > MAX_AUTOMATED_THRESHOLD:
        return PolicyResult(
            allowed=False,
            outcome="Denied",
            policy_evaluated=f"Exceeds Max Automated Threshold (${MAX_AUTOMATED_THRESHOLD:,.0f})",
            reason=f"Your requested limit of ${requested_limit:,.0f} exceeds the automated approval limit for your tier. This request requires manual review by an underwriter.",
            approved_limit=None,
            requires_auth=False,
            action_type="LIMIT",
        )

    # Requested limit is lower or equal to current limit
    if requested_limit <= card.credit_limit:
        return PolicyResult(
            allowed=False,
            outcome="Denied",
            policy_evaluated="Existing Limit Sufficient",
            reason=f"Your current limit is already ${card.credit_limit:,.0f}.",
            action_type="LIMIT",
    # If already at or above tier cap
    if card.credit_limit >= tier_cap:
        return PolicyResult(
            allowed=False,
            outcome="Denied",
            policy_evaluated="Tier Cap Already Reached",
            reason=f"Your current limit of ${card.credit_limit:,.0f} is already at the maximum limit for your {card.tier} tier.",
            action_type="LIMIT",
        )

    # Requested exceeds tier cap -> Partially Approve at the tier cap!
    if requested_limit > tier_cap:
        return PolicyResult(
            allowed=True,
            outcome="Partially Approved",
            policy_evaluated="Tier Cap Applied",
            reason=f"You are eligible for a limit increase up to ${tier_cap:,.0f} based on your {card.tier} tier cap.",
            approved_limit=tier_cap,
            requires_auth=True,  # Identity verification must be passed
            action_type="LIMIT",
        )

    # Fully within tier cap
    return PolicyResult(
        allowed=True,
        outcome="Approved",
        policy_evaluated="Within Tier Cap",
        reason=f"Your request for ${requested_limit:,.0f} is within your {card.tier} tier policy.",
        approved_limit=requested_limit,
        requires_auth=True,
        action_type="LIMIT",
    )


def evaluate_card_replacement(card_id: str, reason_text: str, db: Session) -> PolicyResult:
    """
    Policy:
    - If reason indicates loss, theft, or fraud -> LOCK CARD INSTANTLY in database and recommend switching to voice.
    - If reason is just wear/tear or chip damage -> Standard re-issue without locking.
    """
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        return PolicyResult(
            allowed=False,
            outcome="Denied",
            policy_evaluated="Card Lookup",
            reason="Card not found.",
            action_type="REPLACE",
        )

    urgency_keywords = ["lost", "stolen", "theft", "train", "dropped", "fraud", "unauthorized"]
    is_urgent = any(kw in reason_text.lower() for kw in urgency_keywords)

    if is_urgent:
        # Mutate the database immediately to protect the customer
        card.is_locked = True
        card.lock_reason = f"Reported lost/stolen: {reason_text[:100]}"
        db.commit()

        return PolicyResult(
            allowed=True,
            outcome="Approved",
            policy_evaluated="Lost/Stolen — Immediate Lock & Expedited Reissue",
            reason=f"Your {card.card_name} ending in {card.last4} has been locked immediately to prevent unauthorized charges. A new card will be dispatched via expedited shipping to your address on file.",
            card_locked=True,
            recommend_voice=True,  # Urgency-aware switch to voice!
            action_type="REPLACE",
        )

    return PolicyResult(
        allowed=True,
        outcome="Approved",
        policy_evaluated="Standard Card Replacement",
        reason=f"A replacement {card.card_name} ending in {card.last4} has been ordered to your registered address.",
        card_locked=False,
        recommend_voice=False,
        action_type="REPLACE",
    )
