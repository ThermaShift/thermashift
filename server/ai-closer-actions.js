/**
 * Approve / reject AI drafts; execute their tool calls; place outbound
 * Vapi calls when scheduled time arrives.
 *
 * Wired into chat-proxy.js as admin endpoints + a 60-second cron.
 */

import { EMAIL_SIGNATURE_HTML, EMAIL_SIGNATURE_TEXT } from './ai-closer.js';

const env = () => ({
  resendKey: process.env.RESEND_API_KEY,
  vapiKey: process.env.VAPI_PRIVATE_KEY,
  vapiPhoneId: process.env.VAPI_PHONE_NUMBER_ID || process.env.VAPI_PHONE_NUMBER,
  vapiAssistantId: process.env.VAPI_ASSISTANT_ID,
});

const FROM_EMAIL = 'Steve Betancur <steve@thermashift.net>';

// ─── Send a draft (approved by Steve) ───────────────────────

export async function sendDraft(sb, draftId, options = {}) {
  const { editedBody, approvedBy } = options;
  const drafts = await sb('prospect_messages', 'GET', null,
    `?id=eq.${draftId}&direction=eq.outbound&limit=1`);
  const draft = drafts?.[0];
  if (!draft) throw new Error('draft_not_found');
  if (draft.status === 'sent' || draft.status === 'auto_sent') throw new Error('already_sent');

  const body = editedBody || draft.body;
  const html = body.replace(/\n/g, '<br>') + EMAIL_SIGNATURE_HTML;
  const text = body + EMAIL_SIGNATURE_TEXT;

  const e = env();
  if (!e.resendKey) throw new Error('RESEND_API_KEY not configured');

  const headers = {
    'Authorization': `Bearer ${e.resendKey}`,
    'Content-Type': 'application/json',
  };
  // Thread the reply into the original conversation if we have a message_id
  const payload = {
    from: FROM_EMAIL,
    to: [draft.prospect_email],
    subject: draft.subject,
    html, text,
  };
  if (draft.in_reply_to) {
    payload.headers = {
      'In-Reply-To': draft.in_reply_to,
      'References': draft.in_reply_to,
    };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers, body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`resend_${res.status}: ${await res.text()}`);
  const data = await res.json();

  await sb('prospect_messages', 'PATCH', {
    body: editedBody || draft.body,
    status: 'sent',
    approved_by: approvedBy || 'steve',
    approved_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    resend_id: data.id,
    updated_at: new Date().toISOString(),
  }, `?id=eq.${draft.id}`);

  // Execute any tool calls now that the draft is approved
  await executeDraftTools(sb, draft);

  return { sent: true, resend_id: data.id };
}

// ─── Reject a draft ─────────────────────────────────────────

export async function rejectDraft(sb, draftId, reason) {
  await sb('prospect_messages', 'PATCH', {
    status: 'rejected',
    ai_reasoning: reason || 'rejected by Steve',
    updated_at: new Date().toISOString(),
  }, `?id=eq.${draftId}`);
  return { rejected: true };
}

// ─── Execute tool calls attached to an approved draft ───────

async function executeDraftTools(sb, draft) {
  const tools = draft.ai_tool_calls || [];
  for (const t of tools) {
    try {
      switch (t.name) {
        case 'mark_qualified':
          await sb('outreach_prospects', 'PATCH',
            { status: 'qualified', qualified_at: new Date().toISOString(), notes: t.input.reason || 'AI-marked qualified', updated_at: new Date().toISOString() },
            `?email=eq.${encodeURIComponent(draft.prospect_email)}`);
          break;
        case 'mark_not_interested':
          await sb('outreach_prospects', 'PATCH',
            { status: 'opted_out', notes: t.input.reason || 'AI-marked not interested', updated_at: new Date().toISOString() },
            `?email=eq.${encodeURIComponent(draft.prospect_email)}`);
          await sb('outreach_emails', 'PATCH', { status: 'skipped' },
            `?prospect_email=eq.${encodeURIComponent(draft.prospect_email)}&status=eq.pending`);
          break;
        case 'escalate_to_human':
          await sb('outreach_prospects', 'PATCH',
            { status: 'escalated', escalated_at: new Date().toISOString(), escalation_reason: t.input.reason || '', updated_at: new Date().toISOString() },
            `?email=eq.${encodeURIComponent(draft.prospect_email)}`);
          break;
        case 'schedule_outbound_call': {
          const prospects = await sb('outreach_prospects', 'GET', null,
            `?email=eq.${encodeURIComponent(draft.prospect_email)}&limit=1`);
          const prospect = prospects?.[0];
          if (!prospect) break;
          const phone = t.input.phone || prospect.phone;
          if (!phone) {
            console.warn(`schedule_outbound_call: no phone for ${draft.prospect_email}`);
            break;
          }
          await sb('scheduled_calls', 'POST', {
            prospect_id: prospect.id,
            prospect_email: draft.prospect_email,
            prospect_phone: phone,
            prospect_name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
            scheduled_at: t.input.scheduled_at_utc,
            status: 'scheduled',
            context_summary: t.input.context_summary || '',
          });
          if (t.input.phone && !prospect.phone) {
            await sb('outreach_prospects', 'PATCH', { phone: t.input.phone, updated_at: new Date().toISOString() },
              `?id=eq.${prospect.id}`);
          }
          break;
        }
        // propose_calendly is informational only — the link is in the reply text
        case 'propose_calendly': break;
      }
    } catch (err) {
      console.error(`executeDraftTools (${t.name}):`, err.message);
    }
  }
}

// ─── Outbound call cron — places due Vapi calls ─────────────

export async function placeDueCalls(sb) {
  const e = env();
  if (!e.vapiKey || !e.vapiPhoneId) {
    return { placed: 0, note: 'VAPI not configured' };
  }
  const now = new Date().toISOString();
  const due = await sb('scheduled_calls', 'GET', null,
    `?status=eq.scheduled&scheduled_at=lte.${now}&order=scheduled_at.asc&limit=5`);
  if (!due?.length) return { placed: 0 };

  let placed = 0, errors = 0;
  for (const call of due) {
    try {
      const firstMsg = `Hi ${call.prospect_name?.split(' ')[0] || 'there'} — this is Steve from ThermaShift calling about your reply on cooling efficiency. Do you have a few minutes?`;
      const sysAddon = call.context_summary ? `\nCONTEXT FROM EMAIL THREAD:\n${call.context_summary}` : '';

      const payload = {
        phoneNumberId: e.vapiPhoneId,
        customer: { number: call.prospect_phone, name: call.prospect_name || undefined },
        ...(e.vapiAssistantId
          ? { assistantId: e.vapiAssistantId, assistantOverrides: { firstMessage: firstMsg, variableValues: { context: call.context_summary || '' } } }
          : {
              assistant: {
                firstMessage: firstMsg,
                voice: { provider: '11labs', voiceId: 'burt' },
                model: { provider: 'anthropic', model: 'claude-3-5-haiku-20241022',
                  messages: [{ role: 'system', content: `You are Steve from ThermaShift. Have a 5-10 minute consultative call. Goal: book a discovery meeting or assessment. Be warm, listen, ask 2-3 SPIN questions, then propose next step.${sysAddon}` }],
                },
                maxDurationSeconds: 600,
              },
            }),
      };

      const res = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: { Authorization: `Bearer ${e.vapiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.text();
        await sb('scheduled_calls', 'PATCH',
          { status: 'failed', error: `vapi_${res.status}: ${err.slice(0, 300)}`, updated_at: new Date().toISOString() },
          `?id=eq.${call.id}`);
        errors++;
        continue;
      }
      const data = await res.json();
      await sb('scheduled_calls', 'PATCH',
        { status: 'placed', vapi_call_id: data.id, placed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        `?id=eq.${call.id}`);
      placed++;
    } catch (err) {
      console.error('placeDueCalls error:', err.message);
      errors++;
    }
  }
  return { placed, errors };
}
