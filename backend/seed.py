# backend/seed.py
import datetime
import hashlib
import json
from app.models.database import (
    SessionLocal, init_db, Member, Card, 
    FeeWaiverHistory, AuditLedger
)


def compute_sha256(prev_hash: str, timestamp: str, action_id: str, outcome: str, payload: dict) -> str:
    """Computes a SHA-256 hash chaining previous record to current record."""
    raw_str = f"{prev_hash}|{timestamp}|{action_id}|{outcome}|{json.dumps(payload, sort_keys=True)}"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()


def seed_database():
    print("Initializing SQLite database tables...")
    init_db()

    db = SessionLocal()

    try:
        # Check if already seeded
        if db.query(Member).first():
            print("Database is already seeded. Skipping.")
            return

        print("Seeding Members...")
        # 1. Primary Member: Riya Kapoor (The Policy Edge-Case Persona)
        riya = Member(
            id="RKA-00-8821",
            name="Riya Kapoor",
            email="riya.kapoor@gmail.com",
            phone="+1 (917) 555-8234",
            credit_score=812,
            annual_spend=94200.0,
            member_since=2019,
        )

        # 2. Secondary Member: Marcus Vance (The Instant-Approval Persona)
        marcus = Member(
            id="MVA-01-4419",
            name="Marcus Vance",
            email="marcus.vance@example.com",
            phone="+1 (415) 555-0199",
            credit_score=750,
            annual_spend=42000.0,
            member_since=2021,
        )
        db.add_all([riya, marcus])
        db.flush()

        print("Seeding Cards...")
        # Riya's 3 Cards
        card_platinum = Card(
            id="c1",
            member_id=riya.id,
            card_name="Platinum Card",
            last4="8234",
            tier="Platinum",
            credit_limit=8500.0,
            balance=2340.50,
            is_locked=False,
        )
        card_gold = Card(
            id="c2",
            member_id=riya.id,
            card_name="Gold Card",
            last4="5612",
            tier="Gold",
            credit_limit=5000.0,
            balance=870.20,
            is_locked=False,
        )
        card_blue = Card(
            id="c3",
            member_id=riya.id,
            card_name="Blue Cash Preferred",
            last4="9901",
            tier="Blue Cash Preferred",
            credit_limit=3200.0,
            balance=155.00,
            is_locked=False,
        )
        # Marcus's Card
        card_marcus = Card(
            id="c4",
            member_id=marcus.id,
            card_name="Gold Card",
            last4="1104",
            tier="Gold",
            credit_limit=6000.0,
            balance=1200.00,
            is_locked=False,
        )
        db.add_all([card_platinum, card_gold, card_blue, card_marcus])
        db.flush()

        print("Seeding Fee Waiver History...")
        now = datetime.datetime.utcnow()

        # Riya had a fee waiver on Gold card exactly 45 days ago! (Will trigger 90-day policy denial)
        waiver_riya_45d = FeeWaiverHistory(
            card_id=card_gold.id,
            waiver_date=now - datetime.timedelta(days=45),
            fee_amount=39.0,
            status="APPROVED",
        )

        # Marcus had a fee waiver 120 days ago! (>90 days, so eligible for instant approval)
        waiver_marcus_120d = FeeWaiverHistory(
            card_id=card_marcus.id,
            waiver_date=now - datetime.timedelta(days=120),
            fee_amount=39.0,
            status="APPROVED",
        )
        db.add_all([waiver_riya_45d, waiver_marcus_120d])

        print("Seeding Initial Cryptographic Audit Ledger...")
        # Genesis Block
        genesis_prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        ts_1 = (now - datetime.timedelta(days=80)).isoformat()
        payload_1 = {"card_last4": "8234", "fee_waived": 39.0, "reason": "Late Payment"}
        hash_1 = compute_sha256(genesis_prev_hash, ts_1, "FEE-821", "Approved", payload_1)

        log1 = AuditLedger(
            action_id="FEE-821",
            timestamp=now - datetime.timedelta(days=80),
            member_id=riya.id,
            card_id=card_platinum.id,
            action_type="FEE",
            policy_evaluated="90-Day Waiver Cleared",
            outcome="Approved",
            payload_json=json.dumps(payload_1),
            sha256_hash=hash_1,
            prev_hash=genesis_prev_hash,
        )

        # Chained Block 2
        ts_2 = (now - datetime.timedelta(days=60)).isoformat()
        payload_2 = {"card_last4": "9901", "delivery": "Expedited Courier", "reason": "Damaged Chip"}
        hash_2 = compute_sha256(hash_1, ts_2, "REP-104", "Approved", payload_2)

        log2 = AuditLedger(
            action_id="REP-104",
            timestamp=now - datetime.timedelta(days=60),
            member_id=riya.id,
            card_id=card_blue.id,
            action_type="REPLACE",
            policy_evaluated="Lost/Stolen — Priority Flag",
            outcome="Approved",
            payload_json=json.dumps(payload_2),
            sha256_hash=hash_2,
            prev_hash=hash_1,
        )

        db.add_all([log1, log2])
        db.commit()
        print("Database successfully seeded with realistic AmEx accounts!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
