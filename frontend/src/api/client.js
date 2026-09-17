// frontend/src/api/client.js

const API_BASE = '/api';

/**
 * Fetch member profile and active cards from SQLite
 */
export async function fetchMemberProfile(memberId = 'RKA-00-8821') {
    const res = await fetch(`${API_BASE}/member?member_id=${memberId}`);
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
}

/**
 * Fetch the permanent cryptographic audit ledger
 */
export async function fetchAuditLogs() {
    const res = await fetch(`${API_BASE}/audit-logs`);
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
}

/**
 * Cryptographic integrity verification: re-hashes the ledger from genesis to tip
 */
export async function verifyAuditLedger() {
    const res = await fetch(`${API_BASE}/audit-logs/verify`);
    if (!res.ok) throw new Error('Failed to verify audit ledger');
    return res.json();
}

/**
 * Fetch all Service Request escalation tickets
 */
export async function fetchEscalations() {
    const res = await fetch(`${API_BASE}/escalations`);
    if (!res.ok) throw new Error('Failed to fetch escalations');
    return res.json();
}

/**
 * Send natural language message to the Multi-Agent Workflow
 */
export async function sendChatMessage(message, cardId = 'c1', memberId = 'RKA-00-8821') {
    const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            card_id: cardId,
            member_id: memberId,
        }),
    });
    if (!res.ok) throw new Error(`Agent error: ${res.statusText}`);
    return res.json();
}

/**
 * Human-in-the-Loop: Submit OTP to resume suspended workflow
 */
export async function verifyOtpAndResume(otp, cardId = 'c1', memberId = 'RKA-00-8821', requestedLimit = 10000) {
    const res = await fetch(`${API_BASE}/chat/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            otp,
            card_id: cardId,
            member_id: memberId,
            requested_limit: requestedLimit,
        }),
    });
    if (!res.ok) throw new Error(`Auth error: ${res.statusText}`);
    return res.json();
}
