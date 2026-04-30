/**
 * Gmail IMAP poller — pulls unread replies from Steve's inbox, matches them
 * to outreach prospects, stores the inbound message, and triggers AI draft
 * generation. Runs as a cron from chat-proxy.js every 5 minutes.
 *
 * Required env:
 *   IMAP_HOST=imap.gmail.com (default)
 *   IMAP_PORT=993 (default)
 *   IMAP_USER=luxorfy@gmail.com
 *   IMAP_PASSWORD=<Gmail App Password — 16 chars, generated at https://myaccount.google.com/apppasswords>
 *
 * If IMAP_USER/IMAP_PASSWORD aren't set, the cron silently no-ops.
 *
 * Once configured, every 5 min:
 *   1. Connect IMAP, search UNSEEN messages since the latest stored received_at
 *   2. For each one whose From: matches an outreach_prospect.email:
 *      - Save inbound to prospect_messages (direction='inbound', status='received')
 *      - Mark prospect.status='replied' and outreach_emails.replied_at on the matching sent
 *      - Cancel any pending follow-up sends for this prospect
 *      - Generate AI draft via ai-closer.generateReply()
 *      - Save draft to prospect_messages (direction='outbound', ai_generated=true, status='pending_review')
 *      - Email Steve so he can review
 *   3. Mark messages as \\Seen so they don't re-process
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { generateReply } from './ai-closer.js';

const env = () => ({
  host: process.env.IMAP_HOST || 'imap.gmail.com',
  port: Number(process.env.IMAP_PORT || 993),
  user: process.env.IMAP_USER,
  pass: process.env.IMAP_PASSWORD,
  resendKey: process.env.RESEND_API_KEY,
  steveEmail: process.env.STEVE_NOTIFY_EMAIL || 'luxorfy@gmail.com',
});

const SUPABASE_REVIEW_URL = 'https://thermashift.net/dashboard'; // Steve's admin dashboard

function lastNonQuotedLine(text) {
  if (!text) return '';
  // Strip Gmail-style quote blocks that begin with "On <date>, <name> wrote:"
  const stripped = text.split(/\n\s*On .*wrote:\n/i)[0]
                       .split(/\n>+\s/)[0]
                       .trim();
  return stripped;
}

async function notifySteve(sb, prospect, inbound, draft) {
  const e = env();
  if (!e.resendKey) return;
  const subject = `[AI draft ready] ${prospect.first_name || prospect.email} replied — ${prospect.company || ''}`;
  const toolList = (draft.tool_calls || []).map(t => `<li><strong>${t.name}</strong>: ${JSON.stringify(t.input)}</li>`).join('');
  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;color:#334155;font-size:14px;line-height:1.6;">
      <p><strong>${prospect.first_name || ''} ${prospect.last_name || ''}</strong> at <strong>${prospect.company || ''}</strong> just replied.</p>
      <p style="background:#f1f5f9;padding:12px;border-left:3px solid #94a3b8;font-size:13px;white-space:pre-wrap;">${(inbound.body || '').slice(0, 800)}</p>
      <p><strong>AI draft:</strong></p>
      <p style="background:#fff;padding:12px;border:1px solid #e2e8f0;font-size:13px;white-space:pre-wrap;">${draft.reply_text}</p>
      ${toolList ? `<p><strong>AI tool calls:</strong></p><ul style="font-size:12px;color:#64748b;">${toolList}</ul>` : ''}
      <p><a href="${SUPABASE_REVIEW_URL}" style="color:#0ea5e9;">Review and approve →</a></p>
    </div>`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${e.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'ThermaShift Closer <alerts@thermashift.net>',
      to: [e.steveEmail],
      subject, html,
    }),
  }).catch(err => console.error('notifySteve error:', err.message));
}

export async function pollInbox(sb) {
  const e = env();
  if (!e.user || !e.pass) {
    return { connected: false, note: 'IMAP_USER/IMAP_PASSWORD not set' };
  }

  const client = new ImapFlow({
    host: e.host, port: e.port, secure: true,
    auth: { user: e.user, pass: e.pass },
    logger: false,
  });

  let processed = 0, drafted = 0, errors = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Fetch unseen messages from the last 7 days
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const uids = await client.search({ unseen: true, since });
      if (!uids?.length) return { connected: true, processed: 0, drafted: 0 };

      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(uid, { source: true, envelope: true, flags: true });
          if (!msg?.source) continue;

          const parsed = await simpleParser(msg.source);
          const fromEmail = (parsed.from?.value?.[0]?.address || '').toLowerCase();
          const subject = parsed.subject || '';
          const bodyText = lastNonQuotedLine(parsed.text || '');
          const bodyHtml = parsed.html || '';
          const messageId = parsed.messageId || '';
          const inReplyTo = parsed.inReplyTo || '';

          if (!fromEmail) continue;

          // Look up prospect
          const prospects = await sb('outreach_prospects', 'GET', null,
            `?email=eq.${encodeURIComponent(fromEmail)}&limit=1`);
          const prospect = prospects?.[0];
          if (!prospect) {
            // Not an outreach reply — leave unread and skip
            continue;
          }

          // De-dupe: if we already have this message_id, skip
          if (messageId) {
            const existing = await sb('prospect_messages', 'GET', null,
              `?message_id=eq.${encodeURIComponent(messageId)}&limit=1`);
            if (existing?.[0]) {
              await client.messageFlagsAdd(uid, ['\\Seen']);
              continue;
            }
          }

          // Save inbound message
          const [inbound] = await sb('prospect_messages', 'POST', {
            prospect_id: prospect.id,
            prospect_email: fromEmail,
            direction: 'inbound',
            subject,
            body: bodyText,
            body_html: bodyHtml,
            message_id: messageId,
            in_reply_to: inReplyTo,
            status: 'received',
            received_at: parsed.date?.toISOString() || new Date().toISOString(),
          });

          // Mark prospect as replied + cancel pending follow-ups
          await sb('outreach_prospects', 'PATCH',
            { status: 'replied', replied_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            `?id=eq.${prospect.id}`);
          await sb('outreach_emails', 'PATCH',
            { status: 'skipped' },
            `?prospect_email=eq.${encodeURIComponent(fromEmail)}&status=eq.pending`);

          processed++;

          // Build full thread for AI context
          const thread = await sb('prospect_messages', 'GET', null,
            `?prospect_id=eq.${prospect.id}&order=created_at.asc&limit=20`);

          // Generate AI draft
          let draft;
          try {
            draft = await generateReply(prospect, thread || []);
          } catch (err) {
            console.error(`AI draft generation failed for ${fromEmail}:`, err.message);
            errors++;
            await client.messageFlagsAdd(uid, ['\\Seen']);
            continue;
          }

          // Save AI draft
          const [draftRow] = await sb('prospect_messages', 'POST', {
            prospect_id: prospect.id,
            prospect_email: fromEmail,
            direction: 'outbound',
            subject: subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`,
            body: draft.reply_text,
            ai_generated: true,
            ai_reasoning: draft.stop_reason || '',
            ai_tool_calls: draft.tool_calls,
            in_reply_to: messageId,
            status: 'pending_review',
          });

          drafted++;

          // Notify Steve
          await notifySteve(sb, prospect, inbound, draft);

          // Mark inbound message as seen so we don't re-process
          await client.messageFlagsAdd(uid, ['\\Seen']);

        } catch (err) {
          console.error(`pollInbox error on uid=${uid}:`, err.message);
          errors++;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return { connected: true, processed, drafted, errors };
}
