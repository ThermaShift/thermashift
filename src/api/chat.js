// ────────────────────────────────────────────────────────────
// Client-side chat helpers.
// As of 2026-06-02 the SYSTEM_PROMPT and the direct-to-Anthropic dev
// path have been removed from this file. The prompt now lives ONLY in
// server/alex-prompt.js — it contains the entire pricing playbook +
// objection handling + competitor intel and was a positioning leak
// when shipped in the public bundle.
// All chat requests now route through /api/chat (server-side proxy),
// which (a) enforces the prompt, (b) hard-caps max_tokens, (c) per-IP
// rate-limits, and (d) ignores caller-supplied system/model/max_tokens.
// ────────────────────────────────────────────────────────────

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

function getEndpoint() {
  // Always go through the server proxy — even in dev.
  return isDev ? 'http://localhost:3001/api/chat' : '/api/chat';
}

function getProxyBase() {
  return isDev ? 'http://localhost:3001' : '';
}

/**
 * Send a chat message and get a streamed response.
 * The system prompt + model + max_tokens are all server-enforced now;
 * the client only sends `messages` and `stream`.
 */
export async function sendChatMessage(messages, onChunk, signal) {
  const response = await fetch(getEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, stream: true }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Chat API error (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          fullText += parsed.delta.text;
          onChunk(parsed.delta.text);
        }
        if (parsed.text) {
          fullText += parsed.text;
          onChunk(parsed.text);
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }

  return fullText;
}

/**
 * Extract lead contact data from Alex's response.
 * Returns null if no lead data found.
 */
export function extractLeadData(text) {
  // Check for audit block first (which includes lead data)
  const auditMatch = text.match(/```json:audit\s*\n([\s\S]*?)\n```/);
  if (auditMatch) {
    try {
      const data = JSON.parse(auditMatch[1]);
      return { name: data.name, email: data.email, company: data.company, phone: data.phone };
    } catch { /* fall through */ }
  }
  // Check for standalone lead block
  const leadMatch = text.match(/```json:lead\s*\n([\s\S]*?)\n```/);
  if (leadMatch) {
    try { return JSON.parse(leadMatch[1]); } catch { return null; }
  }
  return null;
}

/**
 * Extract audit/facility data from Alex's response.
 */
export function extractAuditData(text) {
  const match = text.match(/```json:audit\s*\n([\s\S]*?)\n```/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

/**
 * Extract proposal request from Alex's response.
 */
export function extractProposalData(text) {
  const match = text.match(/```json:proposal\s*\n([\s\S]*?)\n```/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

/**
 * Remove all hidden JSON blocks from display text.
 */
export function cleanResponseText(text) {
  return text
    .replace(/\s*```json:(?:lead|audit|proposal)\s*\n[\s\S]*?\n```\s*/g, '')
    .trim();
}

// ─── Server API calls ───────────────────────────────────────

export async function saveLead(leadData) {
  const res = await fetch(`${getProxyBase()}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leadData),
  });
  if (!res.ok) { console.error('Failed to save lead'); return null; }
  return res.json();
}

export async function saveConversation(data) {
  const res = await fetch(`${getProxyBase()}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) { console.error('Failed to save conversation'); return null; }
  return res.json();
}

export async function submitAudit(auditData) {
  const res = await fetch(`${getProxyBase()}/api/audits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auditData),
  });
  if (!res.ok) { console.error('Failed to submit audit'); return null; }
  return res.json();
}

/**
 * Audit polling — pass the auditToken returned by submitAudit() so the
 * request carries the HMAC gate added 2026-06-02. Without a valid token
 * the endpoint returns 401 (closing the open-enumeration path that let
 * anyone walk /api/audits/1, 2, 3...).
 */
export async function getAuditStatus(auditId, auditToken) {
  const url = auditToken
    ? `${getProxyBase()}/api/audits/${auditId}?t=${encodeURIComponent(auditToken)}`
    : `${getProxyBase()}/api/audits/${auditId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export async function submitProposal(proposalData) {
  const res = await fetch(`${getProxyBase()}/api/proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proposalData),
  });
  if (!res.ok) { console.error('Failed to submit proposal'); return null; }
  return res.json();
}

export async function lookupReturningVisitor(email) {
  const res = await fetch(`${getProxyBase()}/api/leads/lookup/${encodeURIComponent(email)}`);
  if (!res.ok) return null;
  return res.json();
}

// SYSTEM_PROMPT export removed — it now lives in server/alex-prompt.js.
