# backend/app/agents/supervisor.py
import os
import json
from dotenv import load_dotenv
from groq import Groq
from app.agents.state import AgentState

load_dotenv()


def get_groq_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key.startswith("your_"):
        raise ValueError("GROQ_API_KEY is missing or invalid in backend/.env. Please add your Groq API key.")
    return Groq(api_key=api_key)


SUPERVISOR_SYSTEM_PROMPT = """
You are the Supervisor Agent for American Express Intelligate, an autonomous card servicing platform.
You must semantically analyze the customer's message, classify their underlying intent, extract relevant numerical amounts or reasons, and gauge emotional urgency.

Do NOT rely on rigid keywords; use deep language understanding:
- Indirect phrasing like "raise my purchasing power" or "expand my spending ceiling" is LIMIT_INCREASE.
- Any mention of misplaced, missing, stolen, damaged cards, or fraud is CARD_REPLACEMENT.
- Any request regarding unexpected charges, penalty fees, late costs, or interest waivers is FEE_REVERSAL.
- Frustration, demands for managers/supervisors, or complaints is ESCALATE.

You must respond ONLY with valid JSON in this exact structure:
{
  "intent": "FEE_REVERSAL" | "LIMIT_INCREASE" | "CARD_REPLACEMENT" | "GENERAL_QUERY" | "ESCALATE",
  "urgency": "LOW" | "MEDIUM" | "HIGH",
  "customer_sentiment": "CALM" | "ANXIOUS" | "FRUSTRATED",
  "entities": {
    "requested_limit": float or null,
    "fee_type": string or null,
    "replacement_reason": string or null
  },
  "preliminary_acknowledgment": string
}
"""


def classify_and_route(state: AgentState) -> AgentState:
    """
    Supervisor Node: Uses Groq LLM semantic reasoning to classify intent and extract entities.
    """
    client = get_groq_client()
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    response = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SUPERVISOR_SYSTEM_PROMPT},
            {"role": "user", "content": f"Customer Card: {state.card_id}. Message: '{state.user_message}'"},
        ],
        temperature=0.1,
    )
    
    result = json.loads(response.choices[0].message.content)

    # Populate Agent State with LLM's semantic interpretation
    state.detected_intent = result.get("intent", "GENERAL_QUERY")
    state.urgency_level = result.get("urgency", "LOW")
    state.extracted_entities = result.get("entities", {})
    return state
