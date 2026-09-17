# backend/test_phase2.py
import sys
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
from app.models.database import SessionLocal, Card, ServiceRequest
from app.agents.state import AgentState
from app.agents.orchestrator import run_agent_workflow, resume_workflow_with_auth


def run_phase2_tests():
    db = SessionLocal()
    print("=" * 70)
    print("[*] RUNNING AMEX INTELLIGATE -- PHASE 2 MULTI-AGENT WORKFLOW TEST")
    print("=" * 70)

    try:
        # -------------------------------------------------------------
        # SCENARIO 1: Limit Increase + Human-in-the-Loop (OTP Gate)
        # -------------------------------------------------------------
        print("\n[SCENARIO 1] Semantic Limit Increase & Human-in-the-Loop Gate...")
        state_1 = AgentState(
            session_id="sess_001",
            member_id="RKA-00-8821",
            card_id="c1",  # Platinum Card (current limit $8,500, tier cap $10,000)
            user_message="I would like to raise my purchasing power to $12,000 on my Platinum card.",
        )

        print(f"  • User Message: \"{state_1.user_message}\"")
        state_1 = run_agent_workflow(state_1, db)

        print(f"  • Supervisor Classified Intent: {state_1.detected_intent}")
        print(f"  • Extracted Entities: {state_1.extracted_entities}")
        print(f"  • Workflow Status: {state_1.status}")
        print(f"  • Agent Response: {state_1.agent_response}")

        assert state_1.detected_intent == "LIMIT_INCREASE"
        assert state_1.status == "WAITING_FOR_AUTH", "Workflow should halt for OTP"
        assert state_1.requires_auth is True

        # Simulate Customer entering OTP in the frontend
        print("\n  [HITL Event] Customer enters 6-digit OTP: '482193'...")
        state_1 = resume_workflow_with_auth(state_1, db, otp="482193")
        print(f"  • Resumed Workflow Status: {state_1.status}")
        print(f"  • Final Response: {state_1.agent_response}")
        print(f"  • Audit Action ID: {state_1.audit_id} | Hash: {state_1.audit_hash[:16]}...")

        # Verify SQLite card limit was actually updated to $10,000
        card_platinum = db.query(Card).filter(Card.id == "c1").first()
        print(f"  • Database Verified Limit on c1: ${card_platinum.credit_limit:,.0f}")
        assert card_platinum.credit_limit == 10000.0, "Card limit in database should be updated to $10,000"
        print("  ✓ Scenario 1 Verified: Human-in-the-Loop execution succeeded!")

        # -------------------------------------------------------------
        # SCENARIO 2: Fee Reversal Policy (45-Day Denial)
        # -------------------------------------------------------------
        print("\n[SCENARIO 2] Fee Reversal Natural Language Request...")
        state_2 = AgentState(
            session_id="sess_002",
            member_id="RKA-00-8821",
            card_id="c2",  # Gold Card (waived 45 days ago)
            user_message="Could you please waive the penalty fee charged on my Gold account?",
        )

        print(f"  • User Message: \"{state_2.user_message}\"")
        state_2 = run_agent_workflow(state_2, db)
        print(f"  • Supervisor Classified Intent: {state_2.detected_intent}")
        print(f"  • Workflow Status: {state_2.status}")
        print(f"  • Agent Response: {state_2.agent_response}")
        print(f"  • Audit Action ID: {state_2.audit_id} | Hash: {state_2.audit_hash[:16]}...")

        assert state_2.detected_intent == "FEE_REVERSAL"
        assert "policy allows one fee waiver" in state_2.agent_response.lower()
        print("  ✓ Scenario 2 Verified: Fee Reversal policy correctly enforced!")

        # -------------------------------------------------------------
        # SCENARIO 3: Urgent Lost Card (Lock + Voice Trigger)
        # -------------------------------------------------------------
        print("\n[SCENARIO 3] Lost Card on Train (Urgency-Aware Routing)...")
        state_3 = AgentState(
            session_id="sess_003",
            member_id="RKA-00-8821",
            card_id="c1",
            user_message="I think I dropped my Platinum card on the train earlier today.",
        )

        print(f"  • User Message: \"{state_3.user_message}\"")
        state_3 = run_agent_workflow(state_3, db)
        print(f"  • Supervisor Classified Intent: {state_3.detected_intent}")
        print(f"  • Urgency Level: {state_3.urgency_level}")
        print(f"  • Recommend Voice Switch: {state_3.recommend_voice}")
        print(f"  • Agent Response: {state_3.agent_response}")

        # Verify SQLite card lock state
        card_locked = db.query(Card).filter(Card.id == "c1").first()
        print(f"  • Database Verified Lock Status: is_locked={card_locked.is_locked}")
        assert card_locked.is_locked is True, "Card must be locked in SQLite"
        assert state_3.recommend_voice is True, "Must recommend switching to voice call"
        print("  ✓ Scenario 3 Verified: Card locked and voice switch triggered!")

        # Unlock for future runs
        card_locked.is_locked = False
        db.commit()

        # -------------------------------------------------------------
        # SCENARIO 4: Escalation to Human Agent ($50k Request)
        # -------------------------------------------------------------
        print("\n[SCENARIO 4] Autonomous Escalation ($50k Limit Request)...")
        state_4 = AgentState(
            session_id="sess_004",
            member_id="RKA-00-8821",
            card_id="c1",
            user_message="I have an 812 credit score and I demand you raise my credit limit to $50,000 right now!",
        )

        print(f"  • User Message: \"{state_4.user_message}\"")
        state_4 = run_agent_workflow(state_4, db)
        print(f"  • Supervisor Classified Intent: {state_4.detected_intent}")
        print(f"  • Workflow Status: {state_4.status}")
        print(f"  • Generated SR Ticket: {state_4.sr_ticket_number}")
        print(f"  • Customer Response: {state_4.agent_response}")

        # Verify ticket persisted in SQLite
        ticket = db.query(ServiceRequest).filter(ServiceRequest.sr_number == state_4.sr_ticket_number).first()
        assert ticket is not None, "Service Request must exist in SQLite database"
        print(f"  • SQLite Ticket Verified:")
        print(f"    - Sentiment: {ticket.customer_sentiment}")
        print(f"    - Recommended Action: {ticket.recommended_action}")
        print(f"    - Estimated Turnaround: {ticket.estimated_tat_hours} hours")
        print("  ✓ Scenario 4 Verified: Human Escalation briefing generated and saved!")

        print("\n" + "=" * 70)
        print("🎉 ALL PHASE 2 MULTI-AGENT SCENARIOS PASSED WITH LIVE GROQ AI!")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run_phase2_tests()
