# backend/app/agents/state.py
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List


@dataclass
class AgentState:
    """
    Shared context passing through the Agentic Workflow.
    """
    session_id: str
    member_id: str                      # e.g., "RKA-00-8821"
    card_id: str                        # e.g., "c1"
    user_message: str                   # What the customer asked
    
    # Classification & Entity Extraction (filled by Supervisor)
    detected_intent: str = "UNKNOWN"    # FEE_REVERSAL, LIMIT_INCREASE, CARD_REPLACEMENT, GENERAL_QUERY, ESCALATION
    urgency_level: str = "LOW"          # LOW, MEDIUM, HIGH
    extracted_entities: Dict[str, Any] = field(default_factory=dict)
    
    # Policy Evaluation
    policy_result: Optional[Dict[str, Any]] = None
    
    # Human-in-the-Loop (HITL) Security State
    requires_auth: bool = False
    auth_verified: bool = False
    
    # Execution & Audit Trail
    agent_response: str = ""
    audit_id: Optional[str] = None
    audit_hash: Optional[str] = None
    recommend_voice: bool = False
    
    # Escalation
    is_escalated: bool = False
    sr_ticket_number: Optional[str] = None
    
    # Workflow Status
    status: str = "PROCESSING"          # PROCESSING, WAITING_FOR_AUTH, COMPLETED, ESCALATED
    history: List[Dict[str, str]] = field(default_factory=list)
