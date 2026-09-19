# backend/test_phase1.py
import sys
import uuid
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from app.models.database import SessionLocal, Card, Member
from app.policies.engine import (
    evaluate_fee_reversal,
    evaluate_limit_increase,
    evaluate_card_replacement,
)
from app.ledger.chain import record_audit_action, verify_chain_integrity


def run_tests():
    db = SessionLocal()
    # Reset c1 limit to baseline for deterministic tests
    c1 = db.query(Card).filter(Card.id == "c1").first()
    if c1:
        c1.credit_limit = 8500.0
        c1.is_locked = False
        db.commit()

    print("=" * 65)
    print("🚀 RUNNING AMEX INTELLIGATE — PHASE 1 VALIDATION SUITE")
    print("=" * 65)

    try:
        # -------------------------------------------------------------
        # TEST 1: Fee Reversal Policy (90-Day Rule)
        # -------------------------------------------------------------
        print("\n[TEST 1] Testing Fee Reversal 90-Day Policy...")
        # 1A: Riya's Gold card (c2) — waived 45 days ago -> Should DENY
        res_riya = evaluate_fee_reversal("c2", db)
        print(f"  • Riya (45d ago): Outcome={res_riya.outcome} | Allowed={res_riya.allowed}")
        print(f"    Reason: {res_riya.reason}")
        assert not res_riya.allowed, "Expected Riya's fee waiver to be DENIED"
        assert res_riya.outcome == "Denied"
        print("  ✓ Riya 90-day denial policy verified!")

        # 1B: Marcus's Gold card (c4) — waived 120 days ago -> Should APPROVE
        res_marcus = evaluate_fee_reversal("c4", db)
        print(f"  • Marcus (120d ago): Outcome={res_marcus.outcome} | Allowed={res_marcus.allowed}")
        assert res_marcus.allowed, "Expected Marcus's fee waiver to be APPROVED"
        print("  ✓ Marcus fee waiver approval verified!")

        # -------------------------------------------------------------
        # TEST 2: Credit Limit Increase (Tier Cap & Escalation Threshold)
        # -------------------------------------------------------------
        print("\n[TEST 2] Testing Credit Limit Policies...")
        # 2A: Riya asks for $12,000 on Platinum (Cap is $10,000) -> Partially Approved
        res_limit_partial = evaluate_limit_increase("c1", requested_limit=12000.0, db=db)
        print(f"  • Requested $12,000: Outcome={res_limit_partial.outcome} | Approved Limit=${res_limit_partial.approved_limit:,.0f}")
        assert res_limit_partial.outcome == "Partially Approved"
        assert res_limit_partial.approved_limit == 10000.0
        assert res_limit_partial.requires_auth is True
        print("  ✓ Platinum tier cap ($10,000) accurately enforced!")

        # 2B: Riya asks for $50,000 on Platinum (> $25k threshold) -> Escalation required
        res_limit_50k = evaluate_limit_increase("c1", requested_limit=50000.0, db=db)
        print(f"  • Requested $50,000: Outcome={res_limit_50k.outcome}")
        print(f"    Reason: {res_limit_50k.reason}")
        assert res_limit_50k.outcome == "Denied"
        assert res_limit_50k.approved_limit is None
        print("  ✓ High-risk request ($50,000) flagged for human underwriter escalation!")

        # -------------------------------------------------------------
        # TEST 3: Lost / Stolen Urgency-Aware Card Replacement
        # -------------------------------------------------------------
        print("\n[TEST 3] Testing Lost Card Urgency & Instant Lock...")
        card_before = db.query(Card).filter(Card.id == "c1").first()
        print(f"  • Platinum Card Lock Status Before: is_locked={card_before.is_locked}")

        res_replace = evaluate_card_replacement(
            "c1", 
            reason_text="I lost my card on the train this morning", 
            db=db
        )
        card_after = db.query(Card).filter(Card.id == "c1").first()
        print(f"  • Platinum Card Lock Status After:  is_locked={card_after.is_locked}")
        print(f"    Lock Reason: {card_after.lock_reason}")
        print(f"    Recommend Voice Switch: {res_replace.recommend_voice}")

        assert card_after.is_locked is True, "Expected card to be locked immediately in database"
        assert res_replace.recommend_voice is True, "Expected proactive recommendation to switch to voice call"
        print("  ✓ Immediate database lock & voice urgency trigger verified!")

        # Unlock card back for further tests
        card_after.is_locked = False
        card_after.lock_reason = None
        db.commit()

        # -------------------------------------------------------------
        # TEST 4: Cryptographic Ledger & Tamper-Evident Detection
        # -------------------------------------------------------------
        print("\n[TEST 4] Testing Cryptographic Hash-Chained Audit Ledger...")
        # 4A: Record an action
        test_action_id = f"LIM-{uuid.uuid4().hex[:4].upper()}"
        new_entry = record_audit_action(
            db=db,
            action_id=test_action_id,
            member_id="RKA-00-8821",
            card_id="c1",
            action_type="LIMIT",
            policy_evaluated="Tier Cap Applied",
            outcome="Approved",
            payload={"requested": 12000.0, "approved": 10000.0, "auth": "OTP_VERIFIED"},
        )
        print(f"  • New Action Logged: {new_entry.action_id}")
        print(f"    SHA-256 Hash: {new_entry.sha256_hash}")
        print(f"    Chained Prev: {new_entry.prev_hash}")

        # 4B: Verify chain integrity (Should PASS)
        is_pristine, stats = verify_chain_integrity(db)
        print(f"  • Chain Integrity Check: Pristine={is_pristine} (Stats: {stats})")
        assert is_pristine is True, f"Expected ledger to be verified pristine, got: {stats}"
        print("  ✓ Cryptographic hash chain verified!")

        # 4C: SIMULATE MALICIOUS ATTACK (Tamper with SQLite data directly!)
        print("\n[TEST 4C] Simulating Database Tampering Attack...")
        original_outcome = new_entry.outcome
        new_entry.outcome = "FORGED_APPROVAL"  # Attacker alters the outcome field in the database
        db.commit()

        is_tampered, breach = verify_chain_integrity(db)
        print(f"  • Tamper Integrity Check Result: Pristine={is_tampered}")
        print(f"    Breach Detected: {breach.get('error')}")
        print(f"    Compromised Action ID: {breach.get('action_id')}")
        assert is_tampered is False, "Expected integrity checker to catch data tampering!"
        print("  ✓ Tamper-evident detection successfully caught forged database entry!")

        # Revert attack to keep database clean
        new_entry.outcome = original_outcome
        db.commit()
        is_clean, _ = verify_chain_integrity(db)
        assert is_clean is True
        print("  ✓ Database restored to pristine status.")

        print("\n" + "=" * 65)
        print("🎉 ALL PHASE 1 TESTS PASSED PERFECTLY!")
        print("=" * 65)

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
