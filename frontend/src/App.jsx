import { useState, useEffect, useRef } from 'react';
import {
    sendChatMessage,
    verifyOtpAndResume,
    fetchAuditLogs,
    verifyAuditLedger,
    fetchEscalations,
    fetchMemberProfile,
    fetchCards,
    fetchMembers,
    resolveEscalation,
    markEscalationInReview,
} from './api/client';

(function () {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap';
    document.head.appendChild(l);
})();

// ─── Global Toast Utility ─────────────────────────────────────────────────────
export function showToast(message, type = 'info') {
    window.dispatchEvent(new CustomEvent('amex-toast', { detail: { message, type } }));
}

// ─── Floating Toast Notification System ───────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
    if (!toasts || toasts.length === 0) return null;
    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            pointerEvents: 'none',
        }}>
            {toasts.map(toast => {
                const bg = toast.type === 'success' ? '#065F46' : toast.type === 'warning' ? '#92400E' : toast.type === 'error' ? '#991B1B' : '#0F2847';
                const border = toast.type === 'success' ? '#059669' : toast.type === 'warning' ? '#D97706' : toast.type === 'error' ? '#DC2626' : '#016FD0';
                return (
                    <div
                        key={toast.id}
                        style={{
                            pointerEvents: 'auto',
                            background: bg,
                            border: `1px solid ${border}`,
                            color: '#fff',
                            padding: '12px 18px',
                            borderRadius: 10,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                            fontSize: 13,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            animation: 'fade-in 0.25s ease',
                            maxWidth: 400,
                        }}
                    >
                        <span>{toast.type === 'success' ? '✓' : toast.type === 'warning' ? '⚠' : toast.type === 'error' ? '✕' : 'ℹ'}</span>
                        <span style={{ flex: 1 }}>{toast.message}</span>
                        {onDismiss && (
                            <button
                                onClick={() => onDismiss(toast.id)}
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, padding: 0 }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Default Personas for Mock Testing ────────────────────────────────────────
const DEFAULT_PERSONAS = [
    {
        id: 'RKA-00-8821',
        name: 'Riya Kapoor',
        email: 'riya.kapoor@gmail.com',
        phone: '+1 (917) 555-8234',
        credit_score: 812,
        annual_spend: 94200,
        member_since: 2019,
        tier: 'Platinum',
        card_count: 3,
        avatar: 'RK',
        avatar_bg: 'linear-gradient(135deg,#016FD0,#0A1628)',
        persona_tag: 'Policy Edge-Case (90-Day Fee Denial & Tier Cap)',
        tag_color: '#DC2626',
        tag_bg: 'rgba(220,38,38,0.1)',
        test_case_desc: 'Fee waiver processed 45d ago triggers automated 90-day denial; $12k limit increase capped at $10,000 tier maximum with OTP.',
    },
    {
        id: 'MVA-01-4419',
        name: 'Marcus Vance',
        email: 'marcus.vance@example.com',
        phone: '+1 (415) 555-0199',
        credit_score: 750,
        annual_spend: 42000,
        member_since: 2021,
        tier: 'Gold',
        card_count: 1,
        avatar: 'MV',
        avatar_bg: 'linear-gradient(135deg,#C9A84C,#8B6914)',
        persona_tag: 'Instant Approval (Waiver >90 Days Cleared)',
        tag_color: '#059669',
        tag_bg: 'rgba(5,150,105,0.1)',
        test_case_desc: 'Fee waiver last processed 120 days ago (>90d rule passes cleanly); triggers instant autonomous waiver approval without denial.',
    },
    {
        id: 'ERO-02-9930',
        name: 'Elena Rostova',
        email: 'elena.rostova@luxuryholdings.com',
        phone: '+1 (310) 555-9930',
        credit_score: 845,
        annual_spend: 215000,
        member_since: 2015,
        tier: 'Centurion',
        card_count: 1,
        avatar: 'ER',
        avatar_bg: 'linear-gradient(135deg,#262626,#0A1628)',
        persona_tag: 'Underwriter Escalation ($50,000 High-Risk)',
        tag_color: '#7C3AED',
        tag_bg: 'rgba(124,58,237,0.1)',
        test_case_desc: 'High-value $50k credit request exceeds auto-approval limits; generates formal SR ticket dossier for senior underwriter handoff.',
    },
];

// Helper to ensure all cards have proper themes & gradients
function enrichCard(c, holderName = 'RIYA KAPOOR') {
    if (!c) return null;
    let color = ['#016FD0', '#003D8F'];
    let textColor = '#fff';
    let network = 'Cash Back';

    if (c.tier === 'Centurion') {
        color = ['#232526', '#090909'];
        textColor = '#f5f5f5';
        network = 'Centurion Black';
    } else if (c.tier === 'Platinum') {
        color = ['#8B8B8B', '#2C2C2C'];
        textColor = '#fff';
        network = 'Centurion';
    } else if (c.tier === 'Gold') {
        color = ['#C9A84C', '#8B6914'];
        textColor = '#fff';
        network = 'Rewards';
    }

    return {
        id: c.id,
        name: c.name || c.card_name || 'AmEx Card',
        last4: c.last4 || '0000',
        tier: c.tier || 'Platinum',
        limit: c.limit || c.credit_limit || 5000,
        balance: c.balance || c.current_balance || 0,
        is_locked: !!c.is_locked,
        lock_reason: c.lock_reason,
        color,
        textColor,
        network,
        holderName,
    };
}

// ─── Default Card Data ────────────────────────────────────────────────────────
const DEFAULT_CARDS = [
    { id: 'c1', name: 'Platinum Card', last4: '8234', tier: 'Platinum', limit: 8500, balance: 2340.50, color: ['#8B8B8B', '#2C2C2C'], textColor: '#fff', network: 'Centurion', holderName: 'RIYA KAPOOR' },
    { id: 'c2', name: 'Gold Card', last4: '5612', tier: 'Gold', limit: 5000, balance: 870.20, color: ['#C9A84C', '#8B6914'], textColor: '#fff', network: 'Rewards', holderName: 'RIYA KAPOOR' },
    { id: 'c3', name: 'Blue Cash Preferred', last4: '9901', tier: 'Blue Cash Preferred', limit: 3200, balance: 155.00, color: ['#016FD0', '#003D8F'], textColor: '#fff', network: 'Cash Back', holderName: 'RIYA KAPOOR' },
];

// ─── SVG Logos ────────────────────────────────────────────────────────────────
function AmexMark({ size = 36 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="6" fill="#016FD0" />
            <text x="4" y="14" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="6.5" fill="white" letterSpacing="0.5">AMERICAN</text>
            <text x="4" y="24" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="6.5" fill="white" letterSpacing="0.5">EXPRESS</text>
            <circle cx="28" cy="18" r="6" fill="rgba(255,255,255,0.2)" />
            <circle cx="28" cy="16" r="4" fill="rgba(255,255,255,0.3)" />
        </svg>
    );
}

function AmexWordmark() {
    return (
        <svg width="110" height="26" viewBox="0 0 220 52" fill="none">
            <rect width="220" height="52" rx="5" fill="#016FD0" />
            <text x="12" y="20" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="12" fill="white" letterSpacing="1.8">AMERICAN</text>
            <text x="12" y="38" fontFamily="Arial Black,Arial" fontWeight="900" fontSize="12" fill="white" letterSpacing="1.8">EXPRESS</text>
            <g transform="translate(172,6) scale(0.9)">
                <path d="M20 2C14 2 9 7 9 13s5 11 11 11 11-5 11-11S26 2 20 2z" fill="rgba(255,255,255,0.18)" />
                <path d="M11 24h18c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H11c-1.1 0-2-.9-2-2V26c0-1.1.9-2 2-2z" fill="rgba(255,255,255,0.18)" />
                <path d="M20 5c-4 0-7 3-7 7s3 7 7 7 7-3 7-7-3-7-7-7z" fill="rgba(255,255,255,0.3)" />
            </g>
        </svg>
    );
}

// ─── Physical Card Component ──────────────────────────────────────────────────
function PhysicalCard({ card, small = false, selected = false, onClick, holderName }) {
    const w = small ? 200 : 340;
    const h = small ? 126 : 214;
    const displayName = (card?.holderName || holderName || 'RIYA KAPOOR').toUpperCase();
    return (
        <div
            onClick={onClick}
            style={{
                width: w, height: h, borderRadius: small ? 12 : 18,
                background: `linear-gradient(135deg,${card.color[0]},${card.color[1]})`,
                cursor: onClick ? 'pointer' : 'default', flexShrink: 0,
                boxShadow: selected ? `0 0 0 3px #016FD0,0 ${small ? 8 : 16}px ${small ? 24 : 40}px rgba(0,0,0,0.25)` : `0 ${small ? 4 : 8}px ${small ? 16 : 32}px rgba(0,0,0,0.2)`,
                transition: 'box-shadow 0.2s,transform 0.2s',
                transform: selected && small ? 'scale(1.02)' : 'scale(1)',
                position: 'relative', overflow: 'hidden', color: card.textColor, fontFamily: "'DM Mono',monospace"
            }}
        >
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%)', borderRadius: 'inherit' }} />
            <div style={{ position: 'absolute', top: small ? 12 : 20, left: small ? 12 : 20 }}>
                <svg width={small ? 50 : 84} height={small ? 20 : 32} viewBox="0 0 84 32">
                    <text x="0" y="13" fontFamily="Arial Black,Arial" fontWeight="900" fontSize={small ? 7 : 11} fill="white" letterSpacing="1.2">AMERICAN</text>
                    <text x="0" y="26" fontFamily="Arial Black,Arial" fontWeight="900" fontSize={small ? 7 : 11} fill="white" letterSpacing="1.2">EXPRESS</text>
                </svg>
            </div>
            <div style={{ position: 'absolute', top: small ? 8 : 14, right: small ? 10 : 18, opacity: 0.22 }}>
                <svg width={small ? 32 : 52} height={small ? 40 : 64} viewBox="0 0 52 64" fill="white">
                    <ellipse cx="26" cy="16" rx="13" ry="15" />
                    <path d="M8 32h36c2.2 0 4 1.8 4 4v24c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4V36c0-2.2 1.8-4 4-4z" />
                    <ellipse cx="26" cy="13" rx="9" ry="11" fill="rgba(0,0,0,0.15)" />
                </svg>
            </div>
            <div style={{ position: 'absolute', top: small ? 40 : 68, left: small ? 12 : 20, width: small ? 22 : 36, height: small ? 16 : 26, background: 'rgba(255,215,0,0.7)', borderRadius: small ? 3 : 5 }}>
                <div style={{ position: 'absolute', top: '30%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.2)' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '40%', width: '1px', background: 'rgba(0,0,0,0.2)' }} />
            </div>
            <div style={{ position: 'absolute', bottom: small ? 36 : 60, left: small ? 12 : 20, fontSize: small ? 9 : 15, letterSpacing: small ? '0.12em' : '0.2em', opacity: 0.9 }}>
                •••• •••• •••• {card.last4}
            </div>
            <div style={{ position: 'absolute', bottom: small ? 14 : 22, left: small ? 12 : 20 }}>
                <div style={{ fontSize: small ? 7 : 11, opacity: 0.6, letterSpacing: '0.1em', marginBottom: 2 }}>{displayName}</div>
                <div style={{ fontSize: small ? 8 : 13, fontWeight: 700, letterSpacing: '0.06em', fontFamily: 'Inter,sans-serif' }}>{card.name.toUpperCase()}</div>
            </div>
            <div style={{ position: 'absolute', bottom: small ? 14 : 22, right: small ? 10 : 18, fontSize: small ? 6 : 9, opacity: 0.7, letterSpacing: '0.08em', textAlign: 'right' }}>{card.network}</div>
        </div>
    );
}

// ─── Active Card Pill ─────────────────────────────────────────────────────────
function ActiveCardPill({ card, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 6px', border: '1.5px solid var(--border-subtle)', borderRadius: 24, background: '#fff', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#016FD0')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
        >
            <div style={{ width: 22, height: 14, borderRadius: 3, background: `linear-gradient(135deg,${card.color[0]},${card.color[1]})`, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amex-navy)' }}>•••• {card.last4}</span>
            <span style={{ fontSize: 10, color: 'rgba(10,22,40,0.4)', fontWeight: 500 }}>{card.tier}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(10,22,40,0.4)" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
        </button>
    );
}

// ─── Card Selector Modal ──────────────────────────────────────────────────────
function CardSelectorModal({ cards, onSelect, onClose, activeCardId }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fade-in 0.2s ease' }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: '28px 28px 24px', width: 520, boxShadow: '0 24px 80px rgba(0,0,0,0.2)', animation: 'fade-in 0.25s ease' }}>
                <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--amex-navy)' }}>Select a Card</p>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(10,22,40,0.45)' }}>Choose which card to use for servicing and chat</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {cards.map(card => {
                        const pct = Math.min(100, Math.round((card.balance / card.limit) * 100));
                        const isActive = card.id === activeCardId;
                        return (
                            <button
                                key={card.id}
                                onClick={() => onSelect(card)}
                                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', border: `1.5px solid ${isActive ? '#016FD0' : 'var(--border-subtle)'}`, borderRadius: 14, background: isActive ? 'rgba(1,111,208,0.04)' : '#fff', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <PhysicalCard card={card} small={true} selected={isActive} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--amex-navy)' }}>{card.name}</p>
                                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(10,22,40,0.45)', fontFamily: "'DM Mono',monospace" }}>•••• {card.last4}</p>
                                        </div>
                                        {isActive && <span style={{ fontSize: 10, fontWeight: 700, color: '#016FD0', background: 'rgba(1,111,208,0.1)', padding: '3px 8px', borderRadius: 20, alignSelf: 'flex-start' }}>ACTIVE</span>}
                                    </div>
                                    <div style={{ marginBottom: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(10,22,40,0.45)', marginBottom: 4 }}>
                                            <span>Balance</span>
                                            <span>${card.balance.toLocaleString()} / ${card.limit.toLocaleString()}</span>
                                        </div>
                                        <div style={{ height: 4, background: 'rgba(10,22,40,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#DC2626' : '#016FD0', borderRadius: 4 }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(10,22,40,0.06)', color: 'rgba(10,22,40,0.5)', fontWeight: 500 }}>{card.tier}</span>
                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(10,22,40,0.06)', color: 'rgba(10,22,40,0.5)', fontWeight: 500 }}>{card.network}</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <button onClick={onClose} style={{ marginTop: 16, width: '100%', padding: '11px', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'rgba(10,22,40,0.5)', cursor: 'pointer' }}>Cancel</button>
            </div>
        </div>
    );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
    NewChat: () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
    History: () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M3.05 11a9 9 0 1 0 .5-3.5M3 4v4h4" /></svg>,
    Audit: () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>,
    Settings: () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>,
    Profile: () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>,
    Mic: () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>,
    Keyboard: () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="6" width="18" height="12" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></svg>,
    Send: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>,
    Shield: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>,
    Copy: () => <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>,
    ChevronL: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>,
    ChevronR: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>,
    Phone: () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>,
    X: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>,
    ExtLink: () => <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>,
    Escalate: () => <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>,
    Edit: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>,
    Check: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>,
    Download: () => <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>,
    Trash: () => <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>,
    ChatBubble: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>,
    Filter: () => <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>,
    Search: () => <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>,
};

function SpeakerHumanIcon({ size = 64, color = '#fff' }) {
    return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="18" r="10" fill={color} opacity="0.9" />
            <path d="M14 52c0-9.941 8.059-18 18-18s18 8.059 18 18" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.9" />
            <path d="M46 28a8 8 0 0 1 0-11" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <path d="M50 32a14 14 0 0 0 0-19" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
        </svg>
    );
}

// ─── Audit Badge ──────────────────────────────────────────────────────────────
function AuditBadge({ id, hash, onView }) {
    const [copied, setCopied] = useState(false);
    return (
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(1,111,208,0.06)', border: '1px solid rgba(1,111,208,0.15)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--amex-navy)', fontFamily: "'DM Mono',monospace", flexWrap: 'wrap' }}>
            <Icon.Shield />
            <span style={{ color: '#016FD0', fontWeight: 500 }}>Logged as {id}</span>
            <span style={{ color: 'rgba(10,22,40,0.4)' }}>·</span>
            <span>Hash: {hash ? (hash.length > 14 ? hash.substring(0, 14) + '...' : hash) : 'N/A'}</span>
            <button
                onClick={() => {
                    if (hash) {
                        navigator.clipboard?.writeText(hash);
                        setCopied(true);
                        showToast(`SHA-256 Hash (${hash.substring(0, 10)}...) copied to clipboard`, 'info');
                        setTimeout(() => setCopied(false), 1500);
                    }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : 'rgba(10,22,40,0.4)', padding: 0 }}
                title="Copy SHA-256 Hash"
            >
                <Icon.Copy />
            </button>
            {onView && (
                <>
                    <span style={{ color: 'rgba(10,22,40,0.4)' }}>·</span>
                    <button onClick={onView} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#016FD0', fontSize: 11, fontWeight: 500, padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                        View Audit Log <Icon.ExtLink />
                    </button>
                </>
            )}
        </div>
    );
}

function TypingIndicator({ label }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--amex-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>AI</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: '8px 14px' }}>
                {label ? (
                    <span style={{ fontSize: 13, color: 'rgba(10,22,40,0.5)', fontStyle: 'italic' }}>{label}</span>
                ) : (
                    [0, 1, 2].map(i => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amex-blue)', display: 'inline-block', animation: `dots-typing 1.2s ease ${i * 0.2}s infinite` }} />
                    ))
                )}
            </div>
        </div>
    );
}

function ChatBubble({ from, children }) {
    const isUser = from === 'user';
    return (
        <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 6, animation: 'fade-in 0.3s ease' }}>
            {!isUser && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--amex-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, alignSelf: 'flex-end' }}>
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>AI</span>
                </div>
            )}
            <div style={{
                maxWidth: '72%', padding: '11px 15px',
                borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: isUser ? 'var(--amex-blue)' : '#fff',
                color: isUser ? '#fff' : 'var(--amex-navy)',
                border: isUser ? 'none' : '1px solid var(--border-subtle)',
                fontSize: 14, lineHeight: 1.55,
                boxShadow: isUser ? '0 2px 12px rgba(1,111,208,0.18)' : '0 1px 4px rgba(0,0,0,0.04)'
            }}>
                {children}
            </div>
            {isUser && (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#1A3A5C,#0A1628)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8, alignSelf: 'flex-end' }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>RK</span>
                </div>
            )}
        </div>
    );
}

// ─── Real OTP Verification Widget ─────────────────────────────────────────────
function InlineAuthWidget({ onComplete, card }) {
    const [otp, setOtp] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setSent(true), 400);
        return () => clearTimeout(t);
    }, []);

    const handleSubmit = async () => {
        if (otp.length === 6 && !loading) {
            setLoading(true);
            await onComplete(otp);
            setLoading(false);
        }
    };

    return (
        <div style={{ background: '#fff', border: '1.5px solid rgba(1,111,208,0.25)', borderRadius: 14, padding: '16px 18px', maxWidth: 360, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12, fontWeight: 600, color: 'var(--amex-blue)', letterSpacing: '0.04em' }}>
                <Icon.Shield /> IDENTITY VERIFICATION
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--surface)', borderRadius: 8, marginBottom: 14, fontSize: 11, color: 'rgba(10,22,40,0.6)' }}>
                <div style={{ width: 18, height: 11, borderRadius: 2, background: `linear-gradient(135deg,${card.color[0]},${card.color[1]})` }} />
                <span style={{ fontFamily: "'DM Mono',monospace" }}>{card.name} •••• {card.last4}</span>
            </div>

            {sent ? (
                <>
                    <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, fontSize: 12, color: '#15803D', lineHeight: 1.6, marginBottom: 12 }}>
                        To proceed, we have sent a one-time passcode to your registered email <strong>r***@gmail.com</strong> and SMS <strong>•••••• {card.last4}</strong>.
                    </div>
                    <label style={{ fontSize: 11, color: 'rgba(10,22,40,0.5)', fontWeight: 500, letterSpacing: '0.04em' }}>ENTER 6-DIGIT OTP</label>
                    <input
                        maxLength={6}
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="• • • • • •"
                        style={{ width: '100%', marginTop: 6, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 20, letterSpacing: '0.4em', fontFamily: "'DM Mono',monospace", outline: 'none', textAlign: 'center' }}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={loading || otp.length !== 6}
                        style={{
                            marginTop: 10, width: '100%', padding: '10px 0',
                            background: otp.length === 6 ? 'var(--amex-blue)' : 'rgba(1,111,208,0.3)',
                            color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor: otp.length === 6 ? 'pointer' : 'default'
                        }}
                    >
                        {loading ? 'Verifying & Executing...' : 'Verify & Execute'}
                    </button>
                </>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(10,22,40,0.5)', fontSize: 13 }}>
                    <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid #016FD0', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    Sending secure code…
                </div>
            )}
        </div>
    );
}

// ─── Live Voice Call View ─────────────────────────────────────────────────────
const VOICE_TRANSCRIPT = [
    { from: 'agent', text: 'Good afternoon, Riya. This is AmEx Intelligate. How can I assist you today?' },
    { from: 'user', text: "Hi, I'd like to request a credit limit increase on my Platinum card." },
    { from: 'agent', text: "Absolutely. I can see you're eligible for an increase up to $10,000 on your Platinum card ending in 8234. I'll need to verify your identity first — an OTP has been sent to your registered email and phone." },
    { from: 'user', text: 'Got it. The code is 4 8 2 1 9 3.' },
    { from: 'agent', text: 'Perfect, identity verified. Processing your limit increase to $10,000 now. This will take effect within 15 minutes.' },
];

function VoiceCallView({ onEnd, card, currentUser }) {
    const [messages, setMessages] = useState([]);
    const [status, setStatus] = useState('speaking'); // 'speaking' | 'listening' | 'thinking'
    const [elapsed, setElapsed] = useState(0);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const endRef = useRef(null);
    const recognizerRef = useRef(null);
    const isMountedRef = useRef(true);
    const bars = [0.4, 0.7, 1, 0.85, 0.6, 0.9, 0.5, 0.75, 1, 0.65, 0.8, 0.45, 0.7, 0.55, 0.9, 0.5, 0.65, 0.8, 0.7, 0.4];

    const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Member';

    // Elapsed session timer
    useEffect(() => {
        isMountedRef.current = true;
        const tick = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => {
            isMountedRef.current = false;
            clearInterval(tick);
            stopSpeech();
            try {
                recognizerRef.current?.stop();
            } catch { }
        };
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, status, currentTranscript]);

    const startListening = () => {
        if (!isMountedRef.current) return;
        setStatus('listening');
        setCurrentTranscript('');

        const recognizer = createSpeechRecognizer({
            onResult: (text, isFinal) => {
                if (!isMountedRef.current) return;
                setCurrentTranscript(text);
                if (isFinal && text.trim()) {
                    handleUserSpeech(text.trim());
                }
            },
            onEnd: () => { },
            onError: () => {
                if (isMountedRef.current) setStatus('listening');
            }
        });

        if (recognizer) {
            recognizerRef.current = recognizer;
            try {
                recognizer.start();
            } catch { }
        }
    };

    const handleUserSpeech = async (userText) => {
        try {
            recognizerRef.current?.stop();
        } catch { }
        setMessages(prev => [...prev, { from: 'user', text: userText }]);
        setCurrentTranscript('');
        setStatus('thinking');

        try {
            const data = await sendChatMessage(userText, card?.id, currentUser?.id || 'RKA-00-8821');
            const agentReply = data.response;
            if (!isMountedRef.current) return;

            setMessages(prev => [...prev, { from: 'agent', text: agentReply }]);
            setStatus('speaking');

            speakAmexVoice(agentReply, {
                onEnd: () => {
                    if (isMountedRef.current) startListening();
                }
            });
        } catch {
            if (!isMountedRef.current) return;
            const errReply = "I am ready to assist. Please speak your request regarding credit limits, fee waivers, or card replacement.";
            setMessages(prev => [...prev, { from: 'agent', text: errReply }]);
            setStatus('speaking');
            speakAmexVoice(errReply, {
                onEnd: () => {
                    if (isMountedRef.current) startListening();
                }
            });
        }
    };

    // Initial greeting on connect
    useEffect(() => {
        const welcomeText = `Good afternoon, ${firstName}. This is American Express Intelligate. How can I assist you with your ${card?.name || 'Card'} today?`;
        setMessages([{ from: 'agent', text: welcomeText }]);
        setStatus('speaking');

        const timer = setTimeout(() => {
            speakAmexVoice(welcomeText, {
                onEnd: () => {
                    if (isMountedRef.current) startListening();
                }
            });
        }, 400);

        return () => clearTimeout(timer);
    }, [card?.id]);

    const handleInterrupt = () => {
        stopSpeech();
        startListening();
    };

    const handleEndCall = () => {
        stopSpeech();
        try {
            recognizerRef.current?.stop();
        } catch { }
        onEnd();
    };

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--amex-navy)' }}>
            <div style={{ padding: '14px 24px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'speaking' ? '#4ADE80' : status === 'listening' ? '#38BDF8' : '#FBBF24', boxShadow: `0 0 8px ${status === 'speaking' ? '#4ADE80' : status === 'listening' ? '#38BDF8' : '#FBBF24'}` }} />
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Live Voice Session</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>·</span>
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{fmt(elapsed)}</span>
                </div>
                <ActiveCardPill card={card} onClick={() => { }} />
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Visualizer & Agent Stage */}
                <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', borderRight: '1px solid rgba(255,255,255,0.07)', gap: 28 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {status === 'speaking' && (
                            <>
                                <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', border: '1.5px solid rgba(74,222,128,0.15)', animation: 'pulse-ring 2.4s ease-out infinite' }} />
                                <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', border: '1.5px solid rgba(74,222,128,0.22)', animation: 'pulse-ring 2.4s ease-out 0.6s infinite' }} />
                                <div style={{ position: 'absolute', width: 106, height: 106, borderRadius: '50%', border: '1.5px solid rgba(74,222,128,0.3)', animation: 'pulse-ring 2.4s ease-out 1.2s infinite' }} />
                            </>
                        )}
                        {status === 'listening' && (
                            <>
                                <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', border: '1.5px solid rgba(56,189,248,0.3)', animation: 'pulse-ring 2.0s ease-out infinite' }} />
                                <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '1.5px solid rgba(56,189,248,0.4)', animation: 'pulse-ring 2.0s ease-out 0.8s infinite' }} />
                            </>
                        )}
                        <div style={{
                            width: 84, height: 84, borderRadius: '50%',
                            background: status === 'speaking' ? 'linear-gradient(135deg,#016FD0,#003D8F)' : status === 'listening' ? 'linear-gradient(135deg,#0284C7,#0369A1)' : 'linear-gradient(135deg,#4B5563,#1F2937)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: status === 'speaking' ? '0 0 32px rgba(1,111,208,0.5)' : status === 'listening' ? '0 0 32px rgba(56,189,248,0.5)' : 'none',
                            animation: status === 'speaking' ? 'glow-pulse 2s ease-in-out infinite' : 'none'
                        }}>
                            {status === 'listening' ? <Icon.Mic /> : <SpeakerHumanIcon size={50} color="#fff" />}
                        </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#fff' }}>AmEx Intelligate</p>
                        <p style={{ margin: 0, fontSize: 12, color: status === 'speaking' ? '#4ADE80' : status === 'listening' ? '#38BDF8' : '#FBBF24', fontWeight: 500 }}>
                            {status === 'speaking' && 'AI Voice Agent · Speaking'}
                            {status === 'listening' && 'Listening to you… (Speak now)'}
                            {status === 'thinking' && 'Analyzing policy & ledger…'}
                        </p>
                    </div>

                    {/* Audio Waveform Bars */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 48, width: 220 }}>
                        {bars.map((h, i) => (
                            <div
                                key={i}
                                className={status === 'speaking' ? 'voice-bar' : ''}
                                style={{
                                    flex: 1,
                                    height: status === 'speaking' ? `${h * 100}%` : status === 'listening' ? '28%' : '14%',
                                    background: status === 'speaking' ? 'rgba(74,222,128,0.75)' : status === 'listening' ? 'rgba(56,189,248,0.6)' : 'rgba(255,255,255,0.2)',
                                    borderRadius: 3,
                                    '--dur': `${0.45 + (i % 4) * 0.12}s`,
                                    animationDelay: `${i * 0.06}s`,
                                    transition: 'height 0.2s, background 0.2s'
                                }}
                            />
                        ))}
                    </div>

                    {/* Voice Controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 200 }}>
                        {status === 'speaking' ? (
                            <button
                                onClick={handleInterrupt}
                                style={{ padding: '9px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                title="Interrupt assistant and speak"
                            >
                                <Icon.Mic /> Speak / Interrupt
                            </button>
                        ) : status === 'listening' ? (
                            <button
                                onClick={() => {
                                    if (currentTranscript.trim()) handleUserSpeech(currentTranscript.trim());
                                }}
                                style={{ padding: '9px 16px', background: 'rgba(56,189,248,0.2)', border: '1px solid rgba(56,189,248,0.5)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#38BDF8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            >
                                <Icon.Mic /> {currentTranscript ? 'Send Voice →' : 'Listening…'}
                            </button>
                        ) : null}

                        <button
                            onClick={handleEndCall}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 22px', background: 'rgba(220,38,38,0.2)', border: '1.5px solid rgba(220,38,38,0.5)', borderRadius: 24, fontSize: 13, fontWeight: 600, color: '#FCA5A5', cursor: 'pointer' }}
                        >
                            <Icon.X /> End Call
                        </button>
                    </div>
                </div>

                {/* Live Transcript Pane */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Live Audio Transcript — Synced with Intelligate</span>
                        <span style={{ fontSize: 11, color: '#38BDF8', background: 'rgba(56,189,248,0.1)', padding: '2px 8px', borderRadius: 4 }}>Web Speech API</span>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start', animation: 'fade-in 0.35s ease' }}>
                                {msg.from === 'agent' && (
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(1,111,208,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, alignSelf: 'flex-end', flexShrink: 0 }}>
                                        <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>AI</span>
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: '70%', padding: '9px 13px',
                                    borderRadius: msg.from === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                    background: msg.from === 'user' ? 'rgba(1,111,208,0.7)' : 'rgba(255,255,255,0.08)',
                                    color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 1.55,
                                    border: msg.from === 'agent' ? '1px solid rgba(255,255,255,0.1)' : 'none'
                                }}>
                                    {msg.text}
                                </div>
                                {msg.from === 'user' && (
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8, alignSelf: 'flex-end', flexShrink: 0 }}>
                                        <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>{currentUser?.avatar || 'ME'}</span>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Live speaking preview for user */}
                        {currentTranscript && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'fade-in 0.2s ease' }}>
                                <div style={{ maxWidth: '70%', padding: '9px 13px', borderRadius: '16px 16px 4px 16px', background: 'rgba(1,111,208,0.35)', color: 'rgba(255,255,255,0.7)', fontSize: 13, border: '1px dashed rgba(56,189,248,0.5)', fontStyle: 'italic' }}>
                                    {currentTranscript}…
                                </div>
                            </div>
                        )}

                        {status === 'thinking' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(1,111,208,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>AI</span>
                                </div>
                                <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
                                    {[0, 1, 2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', display: 'inline-block', animation: `dots-typing 1.2s ease ${i * 0.2}s infinite` }} />)}
                                </div>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>

                    <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                        🔒 256-Bit Encrypted Voice Stream · Real-Time Multi-Agent Intelligate Routing
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Screen 0: Authentic Card Member Sign In ──────────────────────────────────
function ScreenLogin({ onLogin, availablePersonas = DEFAULT_PERSONAS }) {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e?.preventDefault();
        const trimmed = userId.trim();
        if (!trimmed) {
            setError('Please enter your User ID or Member ID');
            return;
        }
        setError('');
        setLoading(true);

        setTimeout(() => {
            // Find matching card member
            const matched = availablePersonas.find(
                p => p.id?.toLowerCase() === trimmed.toLowerCase() ||
                    p.email?.toLowerCase() === trimmed.toLowerCase() ||
                    p.name?.toLowerCase().includes(trimmed.toLowerCase())
            ) || {
                id: trimmed,
                name: trimmed.includes('@') ? trimmed.split('@')[0].toUpperCase() : trimmed.toUpperCase(),
                email: trimmed.includes('@') ? trimmed : `${trimmed.toLowerCase()}@example.com`,
                tier: 'Platinum',
                credit_score: 790,
                annual_spend: 65000,
                member_since: 2022,
                avatar: trimmed.slice(0, 2).toUpperCase(),
                avatar_bg: 'linear-gradient(135deg,#016FD0,#0A1628)',
            };

            setLoading(false);
            showToast(`Welcome back, ${matched.name}`, 'success');
            onLogin(matched);
        }, 250);
    };

    return (
        <div style={{
            minHeight: '100vh',
            width: '100vw',
            background: 'radial-gradient(ellipse at 50% 25%, #0B223D 0%, #06111F 60%, #02060D 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: "'Inter',system-ui,sans-serif",
            color: '#fff',
            boxSizing: 'border-box',
            position: 'relative',
        }}>
            {/* Ambient Background Glow */}
            <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 520, height: 260, background: 'rgba(1,111,208,0.14)', filter: 'blur(120px)', pointerEvents: 'none' }} />

            {/* Login Card */}
            <div style={{
                width: '100%',
                maxWidth: 420,
                background: 'rgba(10, 22, 40, 0.88)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 20,
                boxShadow: '0 24px 70px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(24px)',
                padding: '38px 32px',
                zIndex: 1,
                boxSizing: 'border-box',
            }}>
                {/* Brand Header */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: 14 }}>
                        <AmexWordmark />
                    </div>
                    <h1 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                        Card Member Sign In
                    </h1>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(255, 255, 255, 0.5)' }}>
                        Intelligate Autonomous Servicing
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#FCA5A5', fontSize: 12, marginBottom: 16 }}>
                        {error}
                    </div>
                )}

                {/* Single Member Sign In Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)', marginBottom: 6 }}>
                            User ID or Member ID
                        </label>
                        <input
                            type="text"
                            value={userId}
                            onChange={e => setUserId(e.target.value)}
                            placeholder="Enter your User ID"
                            autoComplete="username"
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: 10,
                                border: '1px solid rgba(255, 255, 255, 0.16)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#fff',
                                fontSize: 14,
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.15s',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'var(--amex-blue)')}
                            onBlur={e => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.16)')}
                        />
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)' }}>
                                Password
                            </label>
                            <span style={{ fontSize: 11, color: '#38BDF8', cursor: 'pointer' }}>
                                Forgot Password?
                            </span>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Password"
                            autoComplete="current-password"
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: 10,
                                border: '1px solid rgba(255, 255, 255, 0.16)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#fff',
                                fontSize: 14,
                                outline: 'none',
                                boxSizing: 'border-box',
                                transition: 'border-color 0.15s',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'var(--amex-blue)')}
                            onBlur={e => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.16)')}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255, 255, 255, 0.65)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={e => setRememberMe(e.target.checked)}
                                style={{ accentColor: '#016FD0', width: 14, height: 14, cursor: 'pointer' }}
                            />
                            Remember User ID
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: 6,
                            padding: '13px 0',
                            borderRadius: 10,
                            border: 'none',
                            background: 'var(--amex-blue)',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(1, 111, 208, 0.35)',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        {loading ? 'Signing In...' : 'Log In →'}
                    </button>
                </form>

                {/* Quick Test ID Helper */}
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Quick Demo IDs
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {availablePersonas.map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                    setUserId(p.id);
                                    setPassword('••••••••');
                                    setError('');
                                }}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    border: `1px solid ${userId === p.id ? '#016FD0' : 'rgba(255, 255, 255, 0.1)'}`,
                                    background: userId === p.id ? 'rgba(1, 111, 208, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                    color: userId === p.id ? '#38BDF8' : 'rgba(255, 255, 255, 0.65)',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {p.id}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer Security Note */}
                <div style={{ marginTop: 18, textAlign: 'center', fontSize: 11, color: 'rgba(255, 255, 255, 0.35)' }}>
                    🔒 256-Bit Encrypted · SHA-256 Chained Ledger
                </div>
            </div>
        </div>
    );
}

// ─── Switch Persona Modal ─────────────────────────────────────────────────────
function SwitchPersonaModal({ availablePersonas, currentPersona, onSelect, onClose, onSignOut }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fade-in 0.2s ease' }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: '28px', width: 560, maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,0.3)', animation: 'fade-in 0.25s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--amex-navy)' }}>Switch Active Mock Persona</p>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,22,40,0.4)', fontSize: 18 }}>✕</button>
                </div>
                <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(10,22,40,0.5)' }}>
                    Switch card member context instantly to test policy rules and workflows:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {availablePersonas.map(persona => {
                        const isCurrent = currentPersona?.id === persona.id;
                        return (
                            <button
                                key={persona.id}
                                onClick={() => { onSelect(persona); onClose(); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '14px 16px',
                                    borderRadius: 12,
                                    border: `1.5px solid ${isCurrent ? 'var(--amex-blue)' : 'var(--border-subtle)'}`,
                                    background: isCurrent ? 'rgba(1,111,208,0.06)' : '#fff',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: persona.avatar_bg || 'var(--amex-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{persona.avatar || 'AM'}</span>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--amex-navy)' }}>{persona.name}</p>
                                            {isCurrent && <span style={{ fontSize: 10, fontWeight: 700, background: '#016FD0', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>ACTIVE</span>}
                                        </div>
                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(10,22,40,0.5)' }}>
                                            {persona.id} · Score: {persona.credit_score} · {persona.persona_tag ? persona.persona_tag.split('(')[0].trim() : 'Active Member'}
                                        </p>
                                    </div>
                                </div>
                                <span style={{ fontSize: 12, color: 'var(--amex-blue)', fontWeight: 600 }}>Switch →</span>
                            </button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button
                        onClick={onSignOut}
                        style={{ flex: 1, padding: '11px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#DC2626', cursor: 'pointer' }}
                    >
                        Sign Out to Login Portal
                    </button>
                    <button
                        onClick={onClose}
                        style={{ padding: '11px 20px', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontSize: 13, color: 'rgba(10,22,40,0.6)', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Screen 1: Landing ────────────────────────────────────────────────────────
function ScreenLanding({ onStartChat, activeCard, onCardClick, currentUser }) {
    const [inputVal, setInputVal] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognizerRef = useRef(null);

    const card = activeCard || DEFAULT_CARDS[0];

    const toggleListening = () => {
        if (isListening) {
            recognizerRef.current?.stop();
            setIsListening(false);
            return;
        }

        stopSpeech();
        const recognizer = createSpeechRecognizer({
            onResult: (text, isFinal) => {
                setInputVal(text);
                if (isFinal) {
                    setIsListening(false);
                }
            },
            onEnd: () => setIsListening(false),
            onError: () => setIsListening(false)
        });

        if (recognizer) {
            recognizerRef.current = recognizer;
            recognizer.start();
            setIsListening(true);
        }
    };

    const handleSubmit = (e) => {
        e?.preventDefault();
        if (inputVal.trim()) {
            onStartChat(inputVal.trim());
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 40px' }}>
            <div style={{ marginBottom: 28 }}>
                <PhysicalCard card={card} holderName={currentUser?.name} />
            </div>

            <div style={{ marginBottom: 28, textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--amex-blue)', margin: '0 0 10px', textTransform: 'uppercase' }}>
                    American Express · Intelligate
                </p>
                <h1 style={{ fontSize: 32, fontWeight: 300, color: 'var(--amex-navy)', margin: '0 0 8px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                    How can I help you today,<br />
                    <span style={{ fontWeight: 700 }}>{currentUser?.name ? currentUser.name.split(' ')[0] : 'Member'}?</span>
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                    <div style={{ width: 16, height: 10, borderRadius: 2, background: `linear-gradient(135deg,${card.color?.[0] || '#016FD0'},${card.color?.[1] || '#003D8F'})` }} />
                    <span style={{ fontSize: 13, color: 'rgba(10,22,40,0.5)' }}>{card.name} •••• {card.last4}</span>
                    <button onClick={onCardClick} style={{ fontSize: 11, color: '#016FD0', fontWeight: 600, background: 'rgba(1,111,208,0.08)', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 4 }}>
                        Switch Card
                    </button>
                </div>
            </div>

            <div style={{ width: '100%', maxWidth: 560, position: 'relative' }}>
                <form onSubmit={handleSubmit}>
                    <input
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        placeholder="Ask me anything about this card…"
                        style={{ width: '100%', padding: '16px 88px 16px 20px', border: '1.5px solid var(--border-subtle)', borderRadius: 14, fontSize: 15, outline: 'none', background: '#fff', boxShadow: '0 4px 24px rgba(1,111,208,0.08)', color: 'var(--amex-navy)' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--amex-blue)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                    />
                    <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                            type="button"
                            onClick={toggleListening}
                            style={{
                                background: isListening ? '#EF4444' : 'transparent',
                                border: 'none',
                                borderRadius: '50%',
                                width: 32,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: isListening ? '#fff' : 'rgba(10,22,40,0.5)',
                                transition: 'all 0.15s',
                                boxShadow: isListening ? '0 0 12px rgba(239,68,68,0.5)' : 'none'
                            }}
                            title={isListening ? "Listening... click to stop" : "Speak your message"}
                        >
                            <Icon.Mic />
                        </button>
                        <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amex-blue)', padding: 4 }}>
                            <Icon.Send />
                        </button>
                    </div>
                </form>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                {[
                    { label: 'Reverse a fee', prompt: 'Can you please reverse the late fee on my card?' },
                    { label: 'Limit increase', prompt: 'I would like to raise my purchasing power to $9,500.' },
                    { label: 'Replace card', prompt: 'I lost my card on the train and need a priority replacement.' }
                ].map(chip => (
                    <button
                        key={chip.label}
                        onClick={() => onStartChat(chip.prompt)}
                        style={{ padding: '9px 18px', background: '#fff', border: '1.5px solid var(--border-subtle)', borderRadius: 24, fontSize: 13, fontWeight: 500, color: 'var(--amex-navy)', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#016FD0'; e.currentTarget.style.color = '#016FD0'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--amex-navy)'; }}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            <p style={{ marginTop: 24, fontSize: 10, color: 'rgba(10,22,40,0.28)', letterSpacing: '0.04em' }}>
                All interactions are encrypted and immutably logged · AES-256 · SHA-256 Ledger
            </p>
        </div>
    );
}

// ─── Screen 2: Unified Live Chat Screen (No Duplicate Text Bug) ───────────────
function ScreenLiveChat({ initialPrompt, card, onCardClick, onAudit, onVoiceSwitch, onCardUpdated, currentUser }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [pendingAuth, setPendingAuth] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [speakingMsgId, setSpeakingMsgId] = useState(null);
    const recognizerRef = useRef(null);
    const endRef = useRef(null);

    const toggleListening = () => {
        if (isListening) {
            recognizerRef.current?.stop();
            setIsListening(false);
            return;
        }

        stopSpeech();
        setSpeakingMsgId(null);
        const recognizer = createSpeechRecognizer({
            onResult: (text, isFinal) => {
                setInput(text);
                if (isFinal) {
                    setIsListening(false);
                }
            },
            onEnd: () => setIsListening(false),
            onError: () => setIsListening(false)
        });

        if (recognizer) {
            recognizerRef.current = recognizer;
            recognizer.start();
            setIsListening(true);
        }
    };

    const handleToggleSpeak = (msgId, text) => {
        if (speakingMsgId === msgId) {
            stopSpeech();
            setSpeakingMsgId(null);
            return;
        }
        setSpeakingMsgId(msgId);
        speakAmexVoice(text, {
            onEnd: () => setSpeakingMsgId(null)
        });
    };

    // Guard against React.StrictMode double firing initialPrompt
    const sentPromptRef = useRef(null);
    const prevCardRef = useRef(card?.id);
    const prevUserRef = useRef(currentUser?.id);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading, pendingAuth]);

    // Handle switching cards in active chat
    useEffect(() => {
        if (prevCardRef.current && card?.id && prevCardRef.current !== card.id) {
            showToast(`Card context switched to ${card.name} (•••• ${card.last4})`, 'info');
            setMessages(prev => [
                ...prev,
                {
                    id: `sys_card_${Date.now()}`,
                    from: 'system',
                    text: `Switched active servicing context to ${card.name} (•••• ${card.last4})`
                }
            ]);
        }
        prevCardRef.current = card?.id;
    }, [card?.id, card?.name, card?.last4]);

    // Handle switching user/persona in active chat
    useEffect(() => {
        if (prevUserRef.current && currentUser?.id && prevUserRef.current !== currentUser.id) {
            setMessages([]);
            setPendingAuth(false);
            sentPromptRef.current = null;
        }
        prevUserRef.current = currentUser?.id;
    }, [currentUser?.id]);

    const handleSend = async (queryText) => {
        const text = (queryText || input).trim();
        if (!text || loading) return;

        // Add user bubble with unique ID
        const userMsg = { id: `u_${Date.now()}_${Math.random()}`, from: 'user', text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const data = await sendChatMessage(text, card.id, currentUser?.id || 'RKA-00-8821');
            setLoading(false);

            const agentMsg = {
                id: `a_${Date.now()}_${Math.random()}`,
                from: 'agent',
                text: data.response,
                requiresAuth: data.requires_auth,
                recommendVoice: data.recommend_voice,
                auditId: data.audit_id,
                auditHash: data.audit_hash,
                srNumber: data.sr_number,
            };
            setMessages(prev => [...prev, agentMsg]);

            if (data.requires_auth) {
                setPendingAuth(true);
                showToast('Authentication Required: Enter Card Details & OTP', 'info');
            }

            if (data.recommend_voice) {
                showToast('Card Locked Immediately · Voice Switch Recommended', 'warning');
            }

            if (data.is_escalated) {
                showToast(`Request Escalated to Human Underwriter (${data.sr_number})`, 'info');
            }
        } catch (err) {
            setLoading(false);
            setMessages(prev => [
                ...prev,
                { id: `err_${Date.now()}`, from: 'agent', text: `Backend connection error: ${err.message}. Ensure Uvicorn server is running.` }
            ]);
            showToast(`API Error: ${err.message}`, 'error');
        }
    };

    // Auto-trigger initial prompt once safely
    useEffect(() => {
        if (initialPrompt && sentPromptRef.current !== initialPrompt) {
            sentPromptRef.current = initialPrompt;
            handleSend(initialPrompt);
        }
    }, [initialPrompt]);

    const handleOtpComplete = async (otpCode) => {
        try {
            const res = await verifyOtpAndResume(otpCode, card.id, currentUser?.id || 'RKA-00-8821');
            setPendingAuth(false);
            setMessages(prev => [
                ...prev,
                {
                    id: `a_auth_${Date.now()}`,
                    from: 'agent',
                    text: res.response,
                    auditId: res.audit_id,
                    auditHash: res.audit_hash,
                }
            ]);
            showToast('Identity Verified! New Limit active & sealed in ledger.', 'success');
            if (onCardUpdated) {
                onCardUpdated();
            }
        } catch (err) {
            showToast(`OTP verification failed: ${err.message}`, 'error');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--amex-blue)', textTransform: 'uppercase' }}>
                    Chat Session · Intelligent Servicing
                </p>
                <ActiveCardPill card={card} onClick={onCardClick} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', color: 'rgba(10,22,40,0.4)', marginTop: 40, fontSize: 13 }}>
                        Ready to assist. Ask a question about your {card.name} or choose a service request.
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id}>
                        {msg.from === 'system' ? (
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                                <span style={{ fontSize: 11, color: 'rgba(10,22,40,0.55)', background: 'rgba(1,111,208,0.06)', border: '1px solid rgba(1,111,208,0.12)', padding: '4px 12px', borderRadius: 20, fontWeight: 500 }}>
                                    ℹ️ {msg.text}
                                </span>
                            </div>
                        ) : (
                            <ChatBubble from={msg.from}>
                                {msg.from === 'agent' && msg.recommendVoice && (
                                    <div style={{ marginBottom: 10 }}>
                                        <span style={{ background: '#FEF2F2', color: '#DC2626', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>Card Locked</span>
                                    </div>
                                )}
                                <div>{msg.text}</div>

                                {msg.from === 'agent' && (
                                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSpeak(msg.id, msg.text)}
                                            style={{
                                                background: speakingMsgId === msg.id ? 'rgba(1,111,208,0.12)' : 'rgba(0,0,0,0.04)',
                                                border: 'none',
                                                borderRadius: 6,
                                                padding: '3px 8px',
                                                cursor: 'pointer',
                                                fontSize: 11,
                                                fontWeight: 600,
                                                color: speakingMsgId === msg.id ? 'var(--amex-blue)' : 'rgba(10,22,40,0.5)',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                transition: 'all 0.15s'
                                            }}
                                            title={speakingMsgId === msg.id ? "Stop voice" : "Listen to response"}
                                        >
                                            <SpeakerHumanIcon size={12} color={speakingMsgId === msg.id ? '#016FD0' : 'rgba(10,22,40,0.5)'} />
                                            <span>{speakingMsgId === msg.id ? 'Speaking…' : 'Listen'}</span>
                                        </button>
                                    </div>
                                )}

                                {msg.auditId && (
                                    <AuditBadge
                                        id={msg.auditId}
                                        hash={msg.auditHash}
                                        onView={() => onAudit && onAudit(msg.auditId)}
                                    />
                                )}

                                {msg.recommendVoice && (
                                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                                        <button
                                            onClick={onVoiceSwitch}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--amex-blue)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            <Icon.Phone /> Switch to Voice Call
                                        </button>
                                    </div>
                                )}
                            </ChatBubble>
                        )}
                    </div>
                ))}

                {pendingAuth && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 40 }}>
                        <InlineAuthWidget onComplete={handleOtpComplete} card={card} />
                    </div>
                )}

                {loading && <TypingIndicator label="Intelligate supervisor analyzing & checking policies..." />}
                <div ref={endRef} />
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', background: '#fff' }}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                    }}
                    style={{ display: 'flex', gap: 10, alignItems: 'center' }}
                >
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder={`Message Intelligate · ${card.name} •••• ${card.last4}`}
                        style={{ flex: 1, padding: '11px 16px', border: '1.5px solid var(--border-subtle)', borderRadius: 10, fontSize: 14, outline: 'none', background: 'var(--surface)', color: 'var(--amex-navy)' }}
                        onFocus={e => (e.target.style.borderColor = 'var(--amex-blue)')}
                        onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                    />
                    <button
                        type="button"
                        onClick={toggleListening}
                        style={{
                            width: 40, height: 40,
                            background: isListening ? '#EF4444' : 'var(--surface)',
                            border: '1.5px solid var(--border-subtle)',
                            borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            color: isListening ? '#fff' : 'rgba(10,22,40,0.6)',
                            flexShrink: 0,
                            transition: 'all 0.15s',
                            boxShadow: isListening ? '0 0 12px rgba(239,68,68,0.5)' : 'none'
                        }}
                        title={isListening ? "Listening... click to stop" : "Speak your message"}
                    >
                        <Icon.Mic />
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        style={{ width: 40, height: 40, background: 'var(--amex-blue)', border: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0, opacity: loading || !input.trim() ? 0.6 : 1 }}
                    >
                        <Icon.Send />
                    </button>
                </form>
                <p style={{ margin: '8px 0 0', fontSize: 10, color: 'rgba(10,22,40,0.3)', textAlign: 'center' }}>
                    Intelligate · Encrypted · All actions are immutably logged
                </p>
            </div>
        </div>
    );
}

// ─── Screen 5: Audit Log with Real Ledger & Verification ──────────────────────
const FALLBACK_AUDIT_ROWS = [
    { ts: '2025-07-23 14:32:11', id: 'LIM-2291', type: 'LIMIT', policy: 'Tier Cap Applied', outcome: 'Approved', hash: '8f4b3a9c1d5e2a4b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b', card: 'Platinum •••• 8234' },
    { ts: '2025-07-23 14:18:05', id: 'FEE-883', type: 'FEE', policy: '90-Day Waiver — 45d since last', outcome: 'Denied', hash: '2c7e9a3f8b1a4c6e8d0b2f4a6c8e0d2b4f6a8c0e2d4b6f8a0c2e4d6b8f0a2c4e', card: 'Gold •••• 5612' },
    { ts: '2025-06-30 09:04:22', id: 'FEE-821', type: 'FEE', policy: '90-Day Waiver Cleared', outcome: 'Approved', hash: 'a1d3e7c2f0b4d6a8c0e2f4a6b8d0c2e4f6a8b0d2c4e6f8a0b2d4c6e8f0a2b4d6', card: 'Platinum •••• 8234' },
    { ts: '2025-06-15 11:55:43', id: 'REP-104', type: 'REPLACE', policy: 'Lost/Stolen — Priority Flag', outcome: 'Approved', hash: '5b9c1e4a2d8f0b2c4e6a8d0f2b4c6e8a0d2f4b6c8e0a2d4f6b8c0e2a4d6f8b0c', card: 'Blue Cash •••• 9901' },
    { ts: '2025-05-08 16:20:09', id: 'LIM-1987', type: 'LIMIT', policy: 'Exceeds Max Threshold ($50k)', outcome: 'Denied', hash: 'c4f2a8e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7', card: 'Platinum •••• 8234' },
];

function FilterChip({ label, options, value, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const h = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const active = value !== '';

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                    border: `1.5px solid ${active ? '#016FD0' : 'var(--border-subtle)'}`,
                    borderRadius: 20, background: active ? 'rgba(1,111,208,0.08)' : '#fff',
                    color: active ? '#016FD0' : 'rgba(10,22,40,0.6)', fontSize: 12, fontWeight: active ? 600 : 500,
                    cursor: 'pointer', whiteSpace: 'nowrap'
                }}
            >
                <Icon.Filter />
                {label}{active ? ` · ${value}` : ''}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 160, overflow: 'hidden' }}>
                    <button onClick={() => { onChange(''); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', fontSize: 12, background: value === '' ? 'rgba(1,111,208,0.06)' : 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,22,40,0.5)', fontStyle: 'italic' }}>All</button>
                    {options.map(o => (
                        <button key={o} onClick={() => { onChange(o); setOpen(false); }} style={{ display: 'block', width: '100%', padding: '8px 14px', textAlign: 'left', fontSize: 12, background: value === o ? 'rgba(1,111,208,0.06)' : 'none', border: 'none', cursor: 'pointer', color: value === o ? '#016FD0' : 'var(--amex-navy)', fontWeight: value === o ? 600 : 400 }}>{o}</button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ScreenAudit({ highlightId }) {
    const [rows, setRows] = useState(FALLBACK_AUDIT_ROWS);
    const [selectedRow, setSelectedRow] = useState(null);
    const [fCard, setFCard] = useState('');
    const [fType, setFType] = useState('');
    const [fOutcome, setFOutcome] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null);

    useEffect(() => {
        fetchAuditLogs()
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    const mapped = data.map(d => ({
                        id: d.action_id || d.id,
                        ts: d.timestamp ? d.timestamp.replace('T', ' ').substring(0, 19) : 'Just now',
                        card: d.card_last4 ? `•••• ${d.card_last4}` : 'Platinum •••• 8234',
                        type: d.action_type || 'LIMIT',
                        policy: d.policy_evaluated || 'Standard Policy',
                        outcome: d.outcome || 'Approved',
                        hash: d.hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                        raw: d
                    }));
                    setRows(mapped);
                }
            })
            .catch(() => { });
    }, []);

    const handleVerifyLedger = async () => {
        setVerifying(true);
        try {
            const res = await verifyAuditLedger();
            setVerifyResult(res);
        } catch (err) {
            setVerifyResult({ valid: false, message: err.message });
        }
        setVerifying(false);
    };

    const oc = (o) => o === 'Approved' ? { bg: '#F0FDF4', text: '#15803D' } : o === 'Denied' ? { bg: '#FEF2F2', text: '#DC2626' } : { bg: '#FFFBEB', text: '#D97706' };
    const filtered = rows.filter(r => (!fCard || r.card.toLowerCase().includes(fCard.toLowerCase())) && (!fType || r.type.toUpperCase() === fType.toUpperCase()) && (!fOutcome || r.outcome === fOutcome));
    const anyFilter = fCard || fType || fOutcome;

    return (
        <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                            <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--amex-blue)', textTransform: 'uppercase' }}>
                                Verifiable Audit Log Ledger
                            </p>
                            <p style={{ margin: 0, fontSize: 13, color: 'rgba(10,22,40,0.45)' }}>
                                Immutable · SHA-256 Hash Chain · Member: Riya Kapoor · Real Database Feed
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                                onClick={handleVerifyLedger}
                                disabled={verifying}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                                    background: 'rgba(1,111,208,0.08)', border: '1.5px solid #016FD0',
                                    borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#016FD0', cursor: 'pointer'
                                }}
                            >
                                <Icon.Shield /> {verifying ? 'Verifying Hashes...' : 'Verify Ledger Integrity'}
                            </button>
                            {anyFilter && (
                                <button onClick={() => { setFCard(''); setFType(''); setFOutcome(''); }} style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </div>

                    {verifyResult && (
                        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: verifyResult.valid ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${verifyResult.valid ? '#BBF7D0' : '#FECACA'}`, color: verifyResult.valid ? '#15803D' : '#DC2626', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {verifyResult.valid ? <Icon.Check /> : <Icon.X />}
                            <span>{verifyResult.message || (verifyResult.valid ? 'Cryptographic audit ledger 100% verified.' : 'Verification error.')}</span>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <FilterChip label="Card" options={['Platinum', 'Gold', 'Blue Cash']} value={fCard} onChange={setFCard} />
                        <FilterChip label="Type" options={['Limit', 'Fee', 'Replace']} value={fType} onChange={setFType} />
                        <FilterChip label="Outcome" options={['Approved', 'Denied', 'Partially Approved']} value={fOutcome} onChange={setFOutcome} />
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
                    {filtered.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'rgba(10,22,40,0.35)' }}>
                            <Icon.Filter />
                            <p style={{ marginTop: 10, fontSize: 13 }}>No records match the selected filters.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
                                    {['Timestamp', 'Action ID', 'Card', 'Type', 'Policy Evaluated', 'Outcome', 'SHA-256 Hash'].map(h => (
                                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(10,22,40,0.4)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(row => {
                                    const c = oc(row.outcome);
                                    const hi = row.id === highlightId;
                                    return (
                                        <tr
                                            key={row.id}
                                            onClick={() => setSelectedRow(row)}
                                            style={{ borderBottom: '1px solid var(--border-subtle)', background: hi ? 'rgba(1,111,208,0.06)' : 'transparent', cursor: 'pointer' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(1,111,208,0.04)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = hi ? 'rgba(1,111,208,0.06)' : 'transparent')}
                                        >
                                            <td style={{ padding: '12px', fontSize: 11, fontFamily: "'DM Mono',monospace", color: 'rgba(10,22,40,0.6)', whiteSpace: 'nowrap' }}>{row.ts}</td>
                                            <td style={{ padding: '12px', fontSize: 12, fontWeight: 600, color: 'var(--amex-blue)', fontFamily: "'DM Mono',monospace" }}>{row.id}</td>
                                            <td style={{ padding: '12px', fontSize: 11, color: 'rgba(10,22,40,0.6)', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{row.card}</td>
                                            <td style={{ padding: '12px', fontSize: 12, color: 'var(--amex-navy)' }}>{row.type}</td>
                                            <td style={{ padding: '12px', fontSize: 12, color: 'rgba(10,22,40,0.7)', maxWidth: 180 }}>{row.policy}</td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.text }}>{row.outcome}</span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: 'rgba(10,22,40,0.5)' }}>
                                                        {row.hash.substring(0, 10)}...
                                                    </span>
                                                    <button onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(row.hash); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,22,40,0.3)', padding: 0 }} title="Copy full SHA-256 hash">
                                                        <Icon.Copy />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {selectedRow && (
                <div style={{ width: 340, borderLeft: '1px solid var(--border-subtle)', background: '#fff', display: 'flex', flexDirection: 'column', animation: 'slide-in-right 0.25s ease' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--amex-navy)' }}>{selectedRow.id}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(10,22,40,0.45)', fontFamily: "'DM Mono',monospace" }}>{selectedRow.ts}</p>
                        </div>
                        <button onClick={() => setSelectedRow(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,22,40,0.4)', padding: 4 }}>
                            <Icon.X />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(10,22,40,0.4)', textTransform: 'uppercase' }}>Raw Log Entry</p>
                        <pre style={{ background: 'var(--amex-navy)', color: '#A8D8FF', padding: 14, borderRadius: 10, fontSize: 10, lineHeight: 1.7, fontFamily: "'DM Mono',monospace", overflowX: 'auto', margin: 0 }}>
                            {JSON.stringify(selectedRow.raw || {
                                id: selectedRow.id,
                                timestamp: selectedRow.ts,
                                member_id: "RKA-00-8821",
                                card: selectedRow.card,
                                action_type: selectedRow.type,
                                policy_evaluated: selectedRow.policy,
                                outcome: selectedRow.outcome,
                                auth_method: "OTP_VERIFIED",
                                agent_version: "intelligate-v2.4.1",
                                hash: selectedRow.hash
                            }, null, 2)}
                        </pre>
                        <div style={{ marginTop: 16, padding: '12px', background: 'rgba(1,111,208,0.05)', borderRadius: 10, border: '1px solid rgba(1,111,208,0.12)' }}>
                            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: 'var(--amex-blue)' }}>Immutability Verified</p>
                            <p style={{ margin: 0, fontSize: 11, color: 'rgba(10,22,40,0.55)', lineHeight: 1.5 }}>
                                This record is cryptographically sealed in the SQLite audit ledger. Any modification would invalidate the hash chain.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Screen 6: Escalation (Original 2-Column Agent Layout + Dynamic Tickets) ──
function ScreenEscalation({ cards, currentUser, onRefreshCards }) {
    const [expanded, setExpanded] = useState(false);
    const [liveEscalations, setLiveEscalations] = useState([]);
    const [resolving, setResolving] = useState(false);

    const refreshTickets = () => {
        fetchEscalations()
            .then(data => {
                if (Array.isArray(data)) setLiveEscalations(data);
            })
            .catch(() => { });
    };

    useEffect(() => {
        refreshTickets();
    }, []);

    const latestTicket = liveEscalations.length > 0 ? liveEscalations[0] : null;

    const handleApprove = async () => {
        if (!latestTicket) {
            showToast('No active escalation ticket to approve', 'warning');
            return;
        }
        setResolving(true);
        try {
            await resolveEscalation(latestTicket.sr_number, 'APPROVE', 25000.0);
            showToast(`Ticket ${latestTicket.sr_number} approved! Limit adjusted to $25,000.`, 'success');
            refreshTickets();
            if (onRefreshCards) onRefreshCards();
        } catch (err) {
            showToast(`Approval failed: ${err.message}`, 'error');
        } finally {
            setResolving(false);
        }
    };

    const handleReview = async () => {
        if (!latestTicket) {
            showToast('No active escalation ticket', 'warning');
            return;
        }
        setResolving(true);
        try {
            await markEscalationInReview(latestTicket.sr_number);
            showToast(`Ticket ${latestTicket.sr_number} assigned to underwriter review queue.`, 'info');
            refreshTickets();
        } catch (err) {
            showToast(`Review failed: ${err.message}`, 'error');
        } finally {
            setResolving(false);
        }
    };

    const isApproved = latestTicket?.status === 'APPROVED';
    const isUnderReview = latestTicket?.status === 'UNDER_REVIEW';

    return (
        <div style={{ height: '100%', overflowY: 'auto', padding: '24px', background: 'var(--surface)' }}>
            <div style={{ padding: '10px 16px', background: '#0A1628', color: '#fff', borderRadius: 8, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon.Escalate />
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em' }}>AGENT ESCALATION VIEW — INTERNAL USE ONLY</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    Agent: Sarah M. · ID 44-7821 {latestTicket ? `· Active Ticket: ${latestTicket.sr_number}` : ''}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
                {/* Left Column: Member Info */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border-subtle)', padding: '20px', alignSelf: 'start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: currentUser?.avatar_bg || 'linear-gradient(135deg,#016FD0,#0A1628)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{currentUser?.avatar || 'AM'}</span>
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--amex-navy)' }}>{currentUser?.name || 'Riya Kapoor'}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(10,22,40,0.45)' }}>ID: {currentUser?.id || 'RKA-00-8821'}</p>
                        </div>
                    </div>

                    {[
                        ['Tier', currentUser?.tier || 'Platinum'],
                        ['Member Since', `${currentUser?.member_since || 2019} · Member`],
                        ['Cards Held', `${cards?.length || 1} Active`],
                        ['Credit Score', `${currentUser?.credit_score || 812} (Excellent)`],
                        ['Annual Spend', `$${(currentUser?.annual_spend || 94200).toLocaleString()}`],
                        ['Auth Status', 'OTP Verified ✓']
                    ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(10,22,40,0.06)', fontSize: 12 }}>
                            <span style={{ color: 'rgba(10,22,40,0.45)' }}>{k}</span>
                            <span style={{ color: 'var(--amex-navy)', fontWeight: 600 }}>{v}</span>
                        </div>
                    ))}

                    <p style={{ margin: '14px 0 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(10,22,40,0.35)', textTransform: 'uppercase' }}>Active Cards</p>
                    {cards.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 11, color: 'rgba(10,22,40,0.6)' }}>
                            <div style={{ width: 20, height: 12, borderRadius: 2, background: `linear-gradient(135deg,${c.color[0]},${c.color[1]})` }} />
                            <span style={{ fontFamily: "'DM Mono',monospace" }}>{c.name} •••• {c.last4}</span>
                        </div>
                    ))}
                </div>

                {/* Right Column: Escalation Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${isApproved ? '#10B981' : isUnderReview ? '#F59E0B' : 'rgba(220,38,38,0.2)'}`, padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isApproved ? '#10B981' : isUnderReview ? '#F59E0B' : '#DC2626' }} />
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: isApproved ? '#10B981' : isUnderReview ? '#D97706' : '#DC2626', textTransform: 'uppercase' }}>
                                    Escalation Context Summary {latestTicket ? `(${latestTicket.sr_number})` : ''}
                                </p>
                            </div>
                            {latestTicket?.status && (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: isApproved ? '#ECFDF5' : isUnderReview ? '#FEF3C7' : '#FEF2F2', color: isApproved ? '#059669' : isUnderReview ? '#D97706' : '#DC2626' }}>
                                    {latestTicket.status}
                                </span>
                            )}
                        </div>

                        {[
                            ['Intent', latestTicket ? (latestTicket.intent || latestTicket.category) : 'Credit Limit Increase'],
                            ['Requested Amount', latestTicket ? (String(latestTicket.intent || '').includes('LIMIT') ? '$50,000' : 'Special Processing') : '$50,000'],
                            ['Target Card', cards?.[0] ? `${cards[0].name} •••• ${cards[0].last4}` : 'Platinum •••• 8234'],
                            ['System Action Taken', latestTicket?.status === 'APPROVED' ? 'Approved by Senior Underwriter' : 'Denied & Handed to Underwriting'],
                            ['Reason', latestTicket ? (latestTicket.reason || latestTicket.root_cause) : 'Requested amount exceeds maximum automated confidence threshold ($10,000)'],
                            ['Customer Sentiment', latestTicket ? latestTicket.customer_sentiment : 'High Priority — Expressed Urgency'],
                            ['Estimated TAT', latestTicket ? `${latestTicket.estimated_tat_hours} Hours` : '4 Hours'],
                        ].map(([k, v]) => (
                            <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(10,22,40,0.06)', fontSize: 13 }}>
                                <span style={{ color: 'rgba(10,22,40,0.45)' }}>{k}</span>
                                <span style={{ color: 'var(--amex-navy)', fontWeight: k === 'System Action Taken' || k === 'Reason' ? 600 : 400 }}>{v}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border-subtle)', padding: '20px' }}>
                        <button onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--amex-navy)', width: '100%' }}>
                            <span>Chat Transcript Dossier</span>
                            <span style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'block' }}>
                                <Icon.ChevronR />
                            </span>
                        </button>
                        {expanded && (
                            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <ChatBubble from="user">I demand you raise my credit limit to $50,000 right now for urgent expenses.</ChatBubble>
                                <ChatBubble from="agent">Your tier allows automated increases up to $10,000. A $50,000 request requires manual underwriter review. Escalating to a senior specialist now.</ChatBubble>
                                <ChatBubble from="user">I have an excellent credit score and never missed a payment.</ChatBubble>
                            </div>
                        )}
                    </div>

                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border-subtle)', padding: '20px' }}>
                        <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: 'rgba(10,22,40,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Underwriter Actions</p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                disabled={resolving || isApproved}
                                onClick={handleApprove}
                                style={{
                                    flex: 1, padding: '11px',
                                    background: isApproved ? '#059669' : 'var(--amex-blue)',
                                    color: '#fff', border: 'none', borderRadius: 10,
                                    fontSize: 13, fontWeight: 600, cursor: isApproved ? 'default' : 'pointer',
                                    opacity: resolving ? 0.7 : 1
                                }}
                            >
                                {isApproved ? '✓ Approved ($25,000 Limit Active)' : 'Approve Manual Increase ($25k)'}
                            </button>
                            <button
                                disabled={resolving || isApproved}
                                onClick={handleReview}
                                style={{
                                    flex: 1, padding: '11px',
                                    background: '#fff', color: 'var(--amex-navy)',
                                    border: '1.5px solid var(--border-subtle)', borderRadius: 10,
                                    fontSize: 13, cursor: isApproved ? 'default' : 'pointer',
                                    opacity: isApproved ? 0.5 : 1
                                }}
                            >
                                {isUnderReview ? 'Under Review ⏳' : 'Request Credit Review'}
                            </button>
                            <button
                                onClick={() => showToast('Ticket forwarded to Senior Risk Supervisor queue', 'info')}
                                style={{ padding: '11px 16px', background: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}
                            >
                                Escalate
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Screen 7: Member Profile ─────────────────────────────────────────────────
const TRANSACTIONS = [
    { date: 'Jul 22, 2025', desc: 'Nobu New York', amount: -284.50, cat: '🍽️', card: 'Platinum' },
    { date: 'Jul 21, 2025', desc: 'United Airlines', amount: -1120.00, cat: '✈️', card: 'Gold' },
    { date: 'Jul 20, 2025', desc: 'Whole Foods Market', amount: -67.30, cat: '🛒', card: 'Blue Cash' },
    { date: 'Jul 19, 2025', desc: 'Tesla Supercharger', amount: -14.20, cat: '⚡', card: 'Blue Cash' },
    { date: 'Jul 18, 2025', desc: 'Annual Fee Waiver Credit', amount: +695.00, cat: '↩️', card: 'Platinum' },
    { date: 'Jul 17, 2025', desc: 'Saks Fifth Avenue', amount: -340.00, cat: '🛍️', card: 'Platinum' },
    { date: 'Jul 16, 2025', desc: 'The Capital Grille', amount: -198.75, cat: '🍽️', card: 'Gold' },
];

function PreferenceToggle({ label, defaultEnabled }) {
    const [on, setOn] = useState(defaultEnabled);
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 13, color: 'var(--amex-navy)' }}>{label}</span>
            <button onClick={() => setOn(v => !v)} style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: on ? '#016FD0' : 'rgba(10,22,40,0.15)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
            </button>
        </div>
    );
}

function ScreenProfile({ cards, currentUser, onSignOut }) {
    const [editField, setEditField] = useState(null);
    const totalBalance = cards.reduce((s, c) => s + c.balance, 0);
    const totalLimit = cards.reduce((s, c) => s + c.limit, 0);

    return (
        <div style={{ height: '100%', overflowY: 'auto', background: 'var(--surface)' }}>
            <div style={{ background: 'linear-gradient(135deg,var(--amex-navy) 0%,#1A3A5C 100%)', padding: '32px 32px 28px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -40, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(1,111,208,0.12)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: 20, right: 100, width: 120, height: 120, borderRadius: '50%', background: 'rgba(1,111,208,0.08)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative', flexWrap: 'wrap' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', background: currentUser?.avatar_bg || 'linear-gradient(135deg,#016FD0,#0057A8)', border: '3px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{currentUser?.avatar || 'AM'}</span>
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>{currentUser?.name || 'Riya Kapoor'}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Member ID: {currentUser?.id || 'RKA-00-8821'} · Member Since {currentUser?.member_since || 2019}</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(201,168,76,0.25)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}>{(currentUser?.tier || 'PLATINUM').toUpperCase()} MEMBER</span>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)' }}>{cards.length} ACTIVE {cards.length === 1 ? 'CARD' : 'CARDS'}</span>
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>CREDIT SCORE</p>
                            <p style={{ margin: '4px 0 0', fontSize: 30, fontWeight: 700, color: (currentUser?.credit_score || 812) >= 800 ? '#4ADE80' : '#FBBF24' }}>{currentUser?.credit_score || 812}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{(currentUser?.credit_score || 812) >= 800 ? 'Excellent' : 'Very Good'}</p>
                        </div>
                        <button
                            onClick={onSignOut}
                            style={{ padding: '9px 18px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#FCA5A5', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(8px)' }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ padding: '24px 32px 32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
                    {[
                        { label: 'Total Balance', value: `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, sub: `of $${totalLimit.toLocaleString()} limit` },
                        { label: 'Annual Spend', value: `$${(currentUser?.annual_spend || 94200).toLocaleString()}`, sub: 'YTD 2026' },
                        { label: 'Reward Points', value: (currentUser?.credit_score || 800) > 800 ? '284,500' : '96,200', sub: 'Membership Rewards®' },
                        { label: 'Waiver Policy', value: currentUser?.id === 'MVA-01-4419' ? 'Eligible' : 'Cooldown', sub: currentUser?.id === 'MVA-01-4419' ? 'Last waiver >90d' : 'Next waiver in Nov' },
                    ].map(s => (
                        <div key={s.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border-subtle)', padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                            <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(10,22,40,0.4)', textTransform: 'uppercase' }}>{s.label}</p>
                            <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 700, color: 'var(--amex-navy)' }}>{s.value}</p>
                            <p style={{ margin: 0, fontSize: 11, color: 'rgba(10,22,40,0.4)' }}>{s.sub}</p>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 22 }}>
                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border-subtle)', padding: '22px' }}>
                        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--amex-navy)' }}>Personal Information</p>
                        {[
                            { label: 'Full Name', value: currentUser?.name || 'Riya Kapoor', key: 'name' },
                            { label: 'Email', value: currentUser?.email || 'riya.kapoor@gmail.com', key: 'email' },
                            { label: 'Phone', value: currentUser?.phone || '+1 (917) 555-8234', key: 'phone' },
                            { label: 'Address', value: '142 Park Ave, New York, NY 10017', key: 'address' },
                            { label: 'Member Since', value: `${currentUser?.member_since || 2019}`, key: 'since' },
                            { label: 'Nationality', value: 'United States', key: 'nat' }
                        ].map(f => (
                            <div key={f.key} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(10,22,40,0.35)', textTransform: 'uppercase' }}>{f.label}</p>
                                    {editField === f.key ? (
                                        <input defaultValue={f.value} style={{ fontSize: 13, border: '1px solid #016FD0', borderRadius: 6, padding: '3px 8px', outline: 'none', color: 'var(--amex-navy)' }} onBlur={() => setEditField(null)} autoFocus />
                                    ) : (
                                        <p style={{ margin: 0, fontSize: 13, color: 'var(--amex-navy)', fontWeight: 500 }}>{f.value}</p>
                                    )}
                                </div>
                                <button onClick={() => setEditField(editField === f.key ? null : f.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: editField === f.key ? '#16a34a' : 'rgba(10,22,40,0.3)', padding: 4 }}>
                                    {editField === f.key ? <Icon.Check /> : <Icon.Edit />}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border-subtle)', padding: '22px' }}>
                            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--amex-navy)' }}>Notification Preferences</p>
                            {[
                                { label: 'Spend Alerts', enabled: true },
                                { label: 'Travel Notifications', enabled: true },
                                { label: 'Paper Statements', enabled: false },
                                { label: 'Marketing Emails', enabled: false }
                            ].map(p => (
                                <PreferenceToggle key={p.label} label={p.label} defaultEnabled={p.enabled} />
                            ))}
                        </div>

                        <div style={{ background: 'linear-gradient(135deg,#0A1628,#1A3A5C)', borderRadius: 16, padding: '22px' }}>
                            <AmexWordmark />
                            <p style={{ margin: '14px 0 4px', fontSize: 14, fontWeight: 700, color: '#fff' }}>Centurion Lounge Access</p>
                            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                                Unlimited access for you and 2 guests at 40+ global locations.
                            </p>
                            <button style={{ marginTop: 14, padding: '8px 16px', background: 'rgba(1,111,208,0.8)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                Find Lounges
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border-subtle)', padding: '22px', marginBottom: 22 }}>
                    <p style={{ margin: '0 0 18px', fontSize: 13, fontWeight: 700, color: 'var(--amex-navy)' }}>Your Cards</p>
                    <div style={{ display: 'flex', gap: 18, overflowX: 'auto', paddingBottom: 8 }}>
                        {cards.map(card => {
                            const pct = Math.min(100, Math.round((card.balance / card.limit) * 100));
                            return (
                                <div key={card.id} style={{ minWidth: 210 }}>
                                    <PhysicalCard card={card} small={true} />
                                    <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface)', borderRadius: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                                            <span style={{ color: 'rgba(10,22,40,0.5)' }}>Balance</span>
                                            <span style={{ fontWeight: 600 }}>${card.balance.toLocaleString()} / ${card.limit.toLocaleString()}</span>
                                        </div>
                                        <div style={{ height: 4, background: 'rgba(10,22,40,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#DC2626' : '#016FD0', borderRadius: 4 }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button style={{ flex: 1, padding: '5px', fontSize: 11, fontWeight: 600, background: 'rgba(1,111,208,0.08)', color: '#016FD0', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Manage</button>
                                            <button style={{ flex: 1, padding: '5px', fontSize: 11, background: '#fff', color: 'rgba(10,22,40,0.5)', border: '1px solid var(--border-subtle)', borderRadius: 6, cursor: 'pointer' }}>Lock</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--border-subtle)', padding: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--amex-navy)' }}>Recent Transactions</p>
                        <button style={{ fontSize: 12, color: '#016FD0', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>View All</button>
                    </div>
                    {TRANSACTIONS.map((tx, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: i < TRANSACTIONS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.amount > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(1,111,208,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                                {tx.cat}
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--amex-navy)' }}>{tx.desc}</p>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(10,22,40,0.4)' }}>{tx.date} · {tx.card}</p>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 600, color: tx.amount > 0 ? '#16a34a' : 'var(--amex-navy)', fontFamily: "'DM Mono',monospace" }}>
                                {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Screen 8: Conversation History ───────────────────────────────────────────
const HISTORY_ROWS = [
    { id: 'H001', channel: 'chat', topic: 'Credit limit increase', date: '23 Jul 2026', rel: '3 days ago', card: 'Platinum •• 8234', status: 'Resolved' },
    { id: 'H002', channel: 'voice', topic: 'Lost card — Platinum •• 8234', date: '20 Jul 2026', rel: '6 days ago', card: 'Platinum •• 8234', status: 'Escalated' },
    { id: 'H003', channel: 'chat', topic: 'Late fee reversal request', date: '15 Jul 2026', rel: '11 days ago', card: 'Gold •• 5612', status: 'Resolved' },
    { id: 'H004', channel: 'voice', topic: 'Card replacement — Gold card', date: '10 Jul 2026', rel: '16 days ago', card: 'Gold •• 5612', status: 'Resolved' },
    { id: 'H005', channel: 'chat', topic: 'Fee waiver policy enquiry', date: '04 Jul 2026', rel: '22 days ago', card: 'Blue Cash •• 9901', status: 'Resolved' },
    { id: 'H006', channel: 'chat', topic: 'Limit increase — $50k request', date: '28 Jun 2026', rel: '28 days ago', card: 'Platinum •• 8234', status: 'Escalated' },
];

function ScreenHistory() {
    const [selected, setSelected] = useState(new Set());
    const [search, setSearch] = useState('');
    const [preview, setPreview] = useState(null);

    const toggle = (id) => setSelected(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });

    const filtered = HISTORY_ROWS.filter(r => r.topic.toLowerCase().includes(search.toLowerCase()) || r.card.toLowerCase().includes(search.toLowerCase()));
    const statusStyle = (s) => s === 'Resolved' ? { bg: '#F0FDF4', text: '#15803D' } : { bg: '#FFFBEB', text: '#D97706' };
    const previewRow = HISTORY_ROWS.find(r => r.id === preview);

    return (
        <div style={{ display: 'flex', height: '100%', background: 'var(--surface)' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ padding: '20px 28px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                            <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'var(--amex-navy)' }}>Conversation History</p>
                            <p style={{ margin: 0, fontSize: 12, color: 'rgba(10,22,40,0.4)' }}>Closed conversations are automatically retained for 120 days. Audit records are cryptographically sealed.</p>
                        </div>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by topic or card…"
                                style={{ padding: '9px 14px 9px 36px', border: '1.5px solid var(--border-subtle)', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff', width: 240, color: 'var(--amex-navy)' }}
                                onFocus={e => (e.target.style.borderColor = '#016FD0')}
                                onBlur={e => (e.target.style.borderColor = 'var(--border-subtle)')}
                            />
                            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(10,22,40,0.35)', pointerEvents: 'none' }}>
                                <Icon.Search />
                            </span>
                        </div>
                    </div>

                    {selected.size > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(1,111,208,0.06)', border: '1px solid rgba(1,111,208,0.15)', borderRadius: 10, marginTop: 10, animation: 'fade-in 0.2s ease' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amex-blue)' }}>{selected.size} selected</span>
                            <div style={{ flex: 1 }} />
                            <button onClick={() => alert('Transcript archive exported.')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#fff', border: '1.5px solid var(--border-subtle)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--amex-navy)', cursor: 'pointer' }}>
                                <Icon.Download /> Export
                            </button>
                            <button onClick={() => setSelected(new Set())} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#DC2626', cursor: 'pointer' }}>
                                <Icon.Trash /> Delete
                            </button>
                            <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,22,40,0.4)', padding: 4 }}>
                                <Icon.X />
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filtered.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', color: 'rgba(10,22,40,0.35)', gap: 8 }}>
                            <Icon.Search />
                            <p style={{ margin: 0, fontSize: 13 }}>No conversations match "{search}"</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-subtle)', background: '#fff' }}>
                                    <th style={{ width: 40, padding: '10px 16px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selected.size === filtered.length && filtered.length > 0}
                                            onChange={e => setSelected(e.target.checked ? new Set(filtered.map(r => r.id)) : new Set())}
                                            style={{ cursor: 'pointer', accentColor: '#016FD0' }}
                                        />
                                    </th>
                                    {['', 'Topic', 'Date', 'Card', 'Status', ''].map((h, i) => (
                                        <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(10,22,40,0.4)', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(row => {
                                    const ss = statusStyle(row.status);
                                    const isSel = selected.has(row.id);
                                    return (
                                        <tr
                                            key={row.id}
                                            style={{ borderBottom: '1px solid var(--border-subtle)', background: isSel ? 'rgba(1,111,208,0.04)' : '#fff', transition: 'background 0.12s', cursor: 'pointer' }}
                                            onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'rgba(10,22,40,0.02)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = isSel ? 'rgba(1,111,208,0.04)' : '#fff'; }}
                                        >
                                            <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                                                <input type="checkbox" checked={isSel} onChange={() => toggle(row.id)} style={{ cursor: 'pointer', accentColor: '#016FD0' }} />
                                            </td>
                                            <td style={{ padding: '14px 12px', width: 32 }} onClick={() => setPreview(row.id)}>
                                                <div style={{ width: 28, height: 28, borderRadius: 8, background: row.channel === 'voice' ? 'rgba(201,168,76,0.12)' : 'rgba(1,111,208,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: row.channel === 'voice' ? '#C9A84C' : '#016FD0' }}>
                                                    {row.channel === 'voice' ? <Icon.Phone /> : <Icon.ChatBubble />}
                                                </div>
                                            </td>
                                            <td style={{ padding: '14px 12px' }} onClick={() => setPreview(row.id)}>
                                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--amex-navy)' }}>{row.topic}</p>
                                                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(10,22,40,0.4)' }}>
                                                    {row.date} · <span style={{ color: 'rgba(10,22,40,0.35)' }}>{row.rel}</span>
                                                </p>
                                            </td>
                                            <td style={{ padding: '14px 12px' }} onClick={() => setPreview(row.id)}>
                                                <span style={{ fontSize: 12, color: 'rgba(10,22,40,0.6)', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{row.card}</span>
                                            </td>
                                            <td style={{ padding: '14px 12px' }} onClick={() => setPreview(row.id)}>
                                                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: ss.bg, color: ss.text, whiteSpace: 'nowrap' }}>{row.status}</span>
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'right', color: 'rgba(10,22,40,0.25)' }} onClick={() => setPreview(row.id)}>
                                                <Icon.ChevronR />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {preview && previewRow && (
                <div style={{ width: 360, borderLeft: '1px solid var(--border-subtle)', background: '#fff', display: 'flex', flexDirection: 'column', animation: 'slide-in-right 0.25s ease', flexShrink: 0 }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--amex-navy)', maxWidth: 260 }}>{previewRow.topic}</p>
                            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(10,22,40,0.45)' }}>{previewRow.date} · {previewRow.card}</p>
                        </div>
                        <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,22,40,0.4)', padding: 4, flexShrink: 0 }}>
                            <Icon.X />
                        </button>
                    </div>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: statusStyle(previewRow.status).bg, color: statusStyle(previewRow.status).text }}>{previewRow.status}</span>
                        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(10,22,40,0.06)', color: 'rgba(10,22,40,0.5)', fontWeight: 500 }}>{previewRow.channel === 'voice' ? 'Voice' : 'Chat'}</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(10,22,40,0.35)', textTransform: 'uppercase' }}>Read-only Transcript</p>
                        <ChatBubble from="user">
                            {previewRow.id === 'H001' ? 'I need to increase my credit limit to $12,000.' :
                                previewRow.id === 'H002' ? 'I lost my Platinum card on the train.' :
                                    previewRow.id === 'H003' ? 'Can you reverse the $39 late fee on my Gold account?' :
                                        'Please assist with my account.'}
                        </ChatBubble>
                        <ChatBubble from="agent">
                            {previewRow.id === 'H001' ? 'You are eligible for a limit increase up to $10,000 based on your Platinum tier. Your new limit is now active.' :
                                previewRow.id === 'H002' ? 'I have locked your Platinum card immediately. I am escalating this to our card services team.' :
                                    previewRow.id === 'H003' ? 'A fee was waived 45 days ago. Our policy allows one waiver per 90 days. Next eligible date: Sep 12.' :
                                        'Thank you, Riya. I have noted your request and processed it.'}
                        </ChatBubble>
                        {previewRow.status === 'Resolved' && (
                            <div style={{ marginTop: 4 }}>
                                <AuditBadge id="LIM-2291" hash="8f4b3a9c1d5e..." />
                            </div>
                        )}
                    </div>
                    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                        <p style={{ margin: 0, fontSize: 11, color: 'rgba(10,22,40,0.35)', textAlign: 'center' }}>Read-only · This conversation is closed</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ screen, setScreen, collapsed, setCollapsed, currentUser }) {
    const nav = [
        { id: 'landing', label: 'New Conversation', icon: <Icon.NewChat /> },
        { id: 'history', label: 'Conversation History', icon: <Icon.History /> },
        { id: 'audit', label: 'Audit Log Ledger', icon: <Icon.Audit /> },
        { id: 'escalation', label: 'Escalation View', icon: <Icon.Escalate /> },
        { id: 'profile', label: 'Member Profile', icon: <Icon.Profile /> },
        { id: 'settings', label: 'Settings', icon: <Icon.Settings /> },
    ];

    return (
        <div style={{
            width: collapsed ? 64 : 224, flexShrink: 0, background: 'var(--amex-navy)', display: 'flex',
            flexDirection: 'column', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden',
            borderRight: '1px solid rgba(255,255,255,0.06)'
        }}>
            <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', minHeight: 70, display: 'flex', alignItems: 'center', gap: 10 }}>
                <AmexMark size={36} />
                {!collapsed && (
                    <div>
                        <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.1 }}>INTELLIGATE</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, letterSpacing: '0.12em' }}>SERVICING AGENT</div>
                    </div>
                )}
            </div>

            <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {nav.map((item, idx) => {
                    const isActive = screen === item.id && item.id !== 'settings';
                    return (
                        <button
                            key={idx}
                            onClick={() => {
                                if (item.id === 'settings') {
                                    alert('Settings: Intelligate v2.4.1 · Groq Multi-Agent · SQLite Chained Ledger');
                                } else {
                                    setScreen(item.id);
                                }
                            }}
                            title={collapsed ? item.label : undefined}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px',
                                borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                                background: isActive ? 'rgba(1,111,208,0.3)' : 'transparent',
                                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.15s',
                                overflow: 'hidden', whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                                    e.currentTarget.style.color = '#fff';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                                }
                            }}
                        >
                            <span style={{ flexShrink: 0 }}>{item.icon}</span>
                            {!collapsed && <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>}
                        </button>
                    );
                })}
            </nav>

            <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <button
                    onClick={() => setScreen('profile')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', whiteSpace: 'nowrap' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    title={`${currentUser?.name || 'Member'} Profile`}
                >
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: currentUser?.avatar_bg || 'linear-gradient(135deg,#016FD0,#0057A8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{currentUser?.avatar || 'RK'}</span>
                    </div>
                    {!collapsed && <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>{currentUser?.name || 'Riya Kapoor'}</span>}
                </button>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end', gap: 4, padding: '6px 10px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', marginTop: 4 }}
                >
                    {collapsed ? <Icon.ChevronR /> : <><Icon.ChevronL /><span style={{ fontSize: 10 }}>Collapse</span></>}
                </button>
            </div>
        </div>
    );
}

// ─── Main Application Container ───────────────────────────────────────────────
export default function App() {
    const [screen, setScreen] = useState('profile');
    const [collapsed, setCollapsed] = useState(false);
    const [voiceMode, setVoiceMode] = useState(false);
    const [auditHighlight, setAuditHighlight] = useState();
    const [cards, setCards] = useState(DEFAULT_CARDS);
    const [activeCard, setActiveCard] = useState(DEFAULT_CARDS[0]);
    const [showCardSel, setShowCardSel] = useState(false);
    const [chatPrompt, setChatPrompt] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [personas, setPersonas] = useState(DEFAULT_PERSONAS);

    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const saved = localStorage.getItem('amex_current_user');
            return saved ? JSON.parse(saved) : DEFAULT_PERSONAS[0];
        } catch {
            return DEFAULT_PERSONAS[0];
        }
    });

    // End active sessions on startup; always require login first
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        try {
            localStorage.removeItem('amex_logged_in');
        } catch { }
    }, []);

    // Toast event listener
    useEffect(() => {
        const handler = (e) => {
            const { message, type } = e.detail || {};
            if (!message) return;
            const id = `t_${Date.now()}_${Math.random()}`;
            setToasts(prev => [...prev, { id, message, type: type || 'info' }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 4000);
        };
        window.addEventListener('amex-toast', handler);
        return () => window.removeEventListener('amex-toast', handler);
    }, []);

    // Load available personas from backend API
    useEffect(() => {
        fetchMembers()
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setPersonas(data);
                    setCurrentUser(curr => {
                        const matched = data.find(m => m.id === curr?.id);
                        return matched || curr;
                    });
                }
            })
            .catch(() => { });
    }, []);

    // Refresh cards for active member from backend database
    const refreshCards = (memberId = currentUser?.id) => {
        fetchCards(memberId || 'RKA-00-8821')
            .then(serverCards => {
                if (Array.isArray(serverCards) && serverCards.length > 0) {
                    const enriched = serverCards.map(sc => enrichCard(sc, currentUser?.name));
                    setCards(enriched);
                    setActiveCard(curr => {
                        const match = enriched.find(c => c.id === curr?.id || c.last4 === curr?.last4);
                        return match || enriched[0];
                    });
                }
            })
            .catch(() => { });
    };

    useEffect(() => {
        if (currentUser?.id) {
            refreshCards(currentUser.id);
        }
    }, [currentUser?.id]);

    const handleLogin = (user) => {
        setCurrentUser(user);
        setIsLoggedIn(true);
        try {
            localStorage.setItem('amex_current_user', JSON.stringify(user));
        } catch { }
        setScreen('profile');
    };

    const handleSignOut = () => {
        setIsLoggedIn(false);
        try {
            localStorage.removeItem('amex_logged_in');
            localStorage.removeItem('amex_current_user');
        } catch { }
        setScreen('profile');
        showToast('Signed out of AmEx Servicing', 'info');
    };

    const goToAudit = (id) => {
        setAuditHighlight(id);
        setScreen('audit');
    };

    const handleStartChat = (prompt) => {
        setChatPrompt(prompt);
        setVoiceMode(false);
        setScreen('chat');
    };

    const isChatScreen = screen === 'chat';
    const SCREEN_LABELS = {
        landing: 'Home',
        chat: 'Active Chat Session',
        audit: 'Audit Log Ledger',
        escalation: 'Escalation View',
        profile: 'Member Profile',
        history: 'Conversation History',
    };

    const showVoiceOverlay = voiceMode && isChatScreen;

    // Login Gate
    if (!isLoggedIn) {
        return (
            <>
                <ScreenLogin onLogin={handleLogin} availablePersonas={personas} />
                <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
            </>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--surface)', fontFamily: "'Inter',system-ui,sans-serif", overflow: 'hidden' }}>
            {/* Sidebar */}
            <Sidebar
                screen={screen}
                setScreen={s => { setScreen(s); setVoiceMode(false); }}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                currentUser={currentUser}
            />

            {/* Main Stage */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <header style={{ height: 56, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AmexWordmark />
                        <span style={{ color: 'var(--border-subtle)', fontSize: 18, lineHeight: 1 }}>|</span>
                        <span style={{ fontSize: 12, color: 'rgba(10,22,40,0.4)', fontWeight: 500 }}>{SCREEN_LABELS[screen]}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Member Identity Badge */}
                        <button
                            onClick={() => setScreen('profile')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                                borderRadius: 20, border: '1px solid var(--border-subtle)',
                                background: 'var(--surface)', cursor: 'pointer', fontSize: 12,
                                fontWeight: 600, color: 'var(--amex-navy)', transition: 'all 0.15s'
                            }}
                            title="View your profile"
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--amex-blue)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                        >
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                            <span>{currentUser?.name || 'Card Member'}</span>
                            <span style={{ fontSize: 10, color: 'rgba(10,22,40,0.4)', fontWeight: 500 }}>({currentUser?.tier || 'Platinum'})</span>
                        </button>

                        {/* Sign Out Button */}
                        <button
                            onClick={handleSignOut}
                            style={{
                                padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)',
                                background: '#fff', color: '#DC2626', fontSize: 11, fontWeight: 600,
                                cursor: 'pointer', transition: 'all 0.15s'
                            }}
                            title="Sign out of your account"
                            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                        >
                            Sign Out
                        </button>

                        {isChatScreen && !showVoiceOverlay && (
                            <ActiveCardPill card={activeCard} onClick={() => setShowCardSel(true)} />
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '3px' }}>
                            <button
                                onClick={() => setVoiceMode(false)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                                    borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: !voiceMode ? '#fff' : 'transparent',
                                    color: !voiceMode ? 'var(--amex-blue)' : 'rgba(10,22,40,0.4)',
                                    fontSize: 12, fontWeight: 600,
                                    boxShadow: !voiceMode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <Icon.Keyboard /> Chat
                            </button>
                            <button
                                onClick={() => {
                                    setVoiceMode(true);
                                    if (!isChatScreen) setScreen('chat');
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                                    borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: voiceMode ? '#fff' : 'transparent',
                                    color: voiceMode ? 'var(--amex-blue)' : 'rgba(10,22,40,0.4)',
                                    fontSize: 12, fontWeight: 600,
                                    boxShadow: voiceMode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <SpeakerHumanIcon size={16} color={voiceMode ? '#016FD0' : 'rgba(10,22,40,0.4)'} /> Voice
                            </button>
                        </div>

                        <button
                            onClick={() => setScreen('profile')}
                            style={{ width: 32, height: 32, borderRadius: '50%', background: currentUser?.avatar_bg || 'linear-gradient(135deg,#016FD0,#0A1628)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title={`${currentUser?.name || 'Member'} Profile`}
                        >
                            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{currentUser?.avatar || 'RK'}</span>
                        </button>
                    </div>
                </header>

                <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    {showVoiceOverlay ? (
                        <VoiceCallView onEnd={() => setVoiceMode(false)} card={activeCard} currentUser={currentUser} />
                    ) : (
                        <>
                            {screen === 'landing' && (
                                <ScreenLanding
                                    onStartChat={handleStartChat}
                                    activeCard={activeCard}
                                    onCardClick={() => setShowCardSel(true)}
                                    currentUser={currentUser}
                                />
                            )}
                            {screen === 'chat' && (
                                <ScreenLiveChat
                                    initialPrompt={chatPrompt}
                                    card={activeCard}
                                    onCardClick={() => setShowCardSel(true)}
                                    onAudit={goToAudit}
                                    onVoiceSwitch={() => setVoiceMode(true)}
                                    onCardUpdated={refreshCards}
                                    currentUser={currentUser}
                                />
                            )}
                            {screen === 'audit' && (
                                <ScreenAudit highlightId={auditHighlight} />
                            )}
                            {screen === 'escalation' && (
                                <ScreenEscalation
                                    cards={cards}
                                    currentUser={currentUser}
                                    onRefreshCards={refreshCards}
                                />
                            )}
                            {screen === 'profile' && (
                                <ScreenProfile
                                    cards={cards}
                                    currentUser={currentUser}
                                    onSignOut={handleSignOut}
                                />
                            )}
                            {screen === 'history' && (
                                <ScreenHistory />
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* Card Selector Modal */}
            {showCardSel && (
                <CardSelectorModal
                    cards={cards}
                    onSelect={c => { setActiveCard(c); setShowCardSel(false); }}
                    onClose={() => setShowCardSel(false)}
                    activeCardId={activeCard.id}
                />
            )}

            {/* Floating Toasts */}
            <ToastContainer toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
        </div>
    );
}

// ── Web Speech API Controllers ─────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// 1. Text-to-Speech (TTS)
export const speakAmexVoice = (text, { onStart, onEnd } = {}) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Barge-in: stop any ongoing speech

    // Clean markdown/bullet formatting for natural speech
    const cleanText = text.replace(/[*_#`]/g, '').replace(/https?:\/\/\S+/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Prefer a polished English concierge voice
    const voices = window.speechSynthesis.getVoices();
    const amexVoice = voices.find(v =>
        v.name.includes('Google UK English Female') ||
        v.name.includes('Samantha') ||
        v.name.includes('Natural') ||
        (v.lang.startsWith('en') && !v.localService)
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    if (amexVoice) utterance.voice = amexVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;

    window.speechSynthesis.speak(utterance);
};

export const stopSpeech = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
};

// 2. Speech-to-Text (STT)
export const createSpeechRecognizer = ({ onResult, onEnd, onError }) => {
    if (!SpeechRecognition) {
        alert('Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return null;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        onResult(transcript, event.results[0].isFinal);
    };

    if (onEnd) recognition.onend = onEnd;
    if (onError) recognition.onerror = onError;

    return recognition;
};
