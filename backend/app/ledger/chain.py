# backend/app/ledger/chain.py
import datetime
import hashlib
import json
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.database import AuditLedger


GENESIS_HASH = "0" * 64


def calculate_hash(prev_hash: str, timestamp_str: str, action_id: str, outcome: str, payload: dict) -> str:
    """Computes a deterministic SHA-256 hash across all record fields."""
    serialized_payload = json.dumps(payload, sort_keys=True)
    raw_block = f"{prev_hash}|{timestamp_str}|{action_id}|{outcome}|{serialized_payload}"
    return hashlib.sha256(raw_block.encode("utf-8")).hexdigest()


def record_audit_action(
    db: Session,
    action_id: str,
    member_id: str,
    card_id: str,
    action_type: str,
    policy_evaluated: str,
    outcome: str,
    payload: Dict[str, Any],
) -> AuditLedger:
    """
    Appends a new cryptographically-sealed action record to the audit ledger.
    """
    # 1. Fetch the latest block to chain against its hash
    latest_block = db.query(AuditLedger).order_by(AuditLedger.id.desc()).first()
    prev_hash = latest_block.sha256_hash if latest_block else GENESIS_HASH

    # 2. Capture timestamp and compute SHA-256 seal
    now = datetime.datetime.utcnow()
    timestamp_str = now.isoformat()
    block_hash = calculate_hash(prev_hash, timestamp_str, action_id, outcome, payload)

    # 3. Persist immutable record in SQLite
    entry = AuditLedger(
        action_id=action_id,
        timestamp=now,
        member_id=member_id,
        card_id=card_id,
        action_type=action_type,
        policy_evaluated=policy_evaluated,
        outcome=outcome,
        payload_json=json.dumps(payload),
        sha256_hash=block_hash,
        prev_hash=prev_hash,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def verify_chain_integrity(db: Session) -> Tuple[bool, Dict[str, Any]]:
    """
    Scans the entire ledger from genesis block to tip.
    Re-calculates every SHA-256 hash and verifies pointer chains.
    Returns (True, stats) if pristine, or (False, breach_info) if tampered.
    """
    blocks = db.query(AuditLedger).order_by(AuditLedger.id.asc()).all()
    if not blocks:
        return True, {"message": "Ledger is empty.", "verified_blocks": 0}

    expected_prev_hash = GENESIS_HASH

    for idx, block in enumerate(blocks):
        # Verification Check 1: Pointer check (does prev_hash point to the prior block?)
        if block.prev_hash != expected_prev_hash:
            return False, {
                "error": "Broken chain pointer detected!",
                "block_index": idx,
                "action_id": block.action_id,
                "expected_prev_hash": expected_prev_hash,
                "found_prev_hash": block.prev_hash,
            }

        # Verification Check 2: Content integrity (was the payload or outcome modified?)
        payload = json.loads(block.payload_json)
        recalculated_hash = calculate_hash(
            block.prev_hash,
            block.timestamp.isoformat(),
            block.action_id,
            block.outcome,
            payload,
        )

        if recalculated_hash != block.sha256_hash:
            return False, {
                "error": "Data tampering detected! Hash mismatch.",
                "block_index": idx,
                "action_id": block.action_id,
                "stored_hash": block.sha256_hash,
                "recalculated_hash": recalculated_hash,
            }

        # Advance pointer for next block
        expected_prev_hash = block.sha256_hash

    return True, {
        "status": "VERIFIED_PRISTINE",
        "total_blocks": len(blocks),
        "tip_hash": expected_prev_hash,
    }
