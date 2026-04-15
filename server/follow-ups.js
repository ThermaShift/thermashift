/**
 * Automated follow-up email system for ThermaShift.
 * Schedules and sends follow-up emails after reviews are sent.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'ThermaShift <notifications@thermashift.net>';
const CALENDLY_LINK = 'https://calendly.com/thermashift/consultation';

// ─── Follow-up email templates ─────────────────────────────

const TEMPLATES = {
  followup_1: (data) => ({
    subject: `${data.name || 'Hi'} — Did you see your cooling review?`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#0a1628,#0d2847);color:#fff;padding:32px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:20px;">Your Cooling Review Is Waiting</h1>
        </div>
        <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;">
          <p style="font-size:15px;line-height:1.7;color:#334155;">Hey ${data.name || 'there'},</p>
          <p style="font-size:15px;line-height:1.7;color:#334155;">I sent over your cooling efficiency review yesterday — just wanted to make sure it didn't get buried in your inbox.</p>
          <p style="font-size:15px;line-height:1.7;color:#334155;">The quick version: we identified <strong>$${(data.estimated_annual_savings || 0).toLocaleString()}/year in potential savings</strong> and a path to get your PUE from ${data.current_pue || '1.58'} down to ${data.target_pue || '1.2'}.</p>
          <p style="font-size:15px;line-height:1.7;color:#334155;">Want to walk through the numbers? I can hop on a 15-minute call this week.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${CALENDLY_LINK}" style="display:inline-block;background:#00a3e0;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Schedule a Quick Call</a>
          </div>
          <p style="font-size:14px;color:#64748b;">Or just reply to this email — I'm happy to answer questions async.</p>
          <p style="font-size:15px;line-height:1.7;color:#334155;">— Alex<br>ThermaShift Cooling Consultant</p>
        </div>
        <div style="padding:16px 32px;font-size:12px;color:#94a3b8;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <a href="https://thermashift.net" style="color:#00a3e0;">thermashift.net</a> — Cooling Intelligence. Environmental Impact.
        </div>
      </div>`
  }),

  followup_2: (data) => ({
    subject: `Your facility is losing $${Math.round((data.estimated_annual_savings || 0) / 12).toLocaleString()} every month`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#0a1628,#0d2847);color:#fff;padding:32px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:20px;">The Cost of Waiting</h1>
        </div>
        <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;">
          <p style="font-size:15px;line-height:1.7;color:#334155;">Hey ${data.name || 'there'},</p>
          <p style="font-size:15px;line-height:1.7;color:#334155;">Quick thought I wanted to share:</p>
          <p style="font-size:15px;line-height:1.7;color:#334155;">Based on the review we ran for ${data.company || 'your facility'}, your current cooling setup is costing you roughly <strong>$${Math.round((data.estimated_annual_savings || 0) / 12).toLocaleString()} more than it needs to every month</strong>.</p>
          <p style="font-size:15px;line-height:1.7;color:#334155;">That adds up fast. Since we ran your review, that's already another $${Math.round((data.estimated_annual_savings || 0) / 365 * 3).toLocaleString()} in unnecessary costs.</p>
          ${data.waste_heat_revenue_potential > 0 ? `<p style="font-size:15px;line-height:1.7;color:#334155;">And you're venting waste heat worth up to <strong>$${(data.waste_heat_revenue_potential || 0).toLocaleString()}/year</strong> in potential revenue.</p>` : ''}
          <p style="font-size:15px;line-height:1.7;color:#334155;">Our clients typically see 5-10x ROI in year one. Happy to show you exactly how that breaks down for your facility.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${CALENDLY_LINK}" style="display:inline-block;background:#00a3e0;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Let's Talk Numbers</a>
          </div>
          <p style="font-size:15px;line-height:1.7;color:#334155;">— Alex<br>ThermaShift</p>
        </div>
        <div style="padding:16px 32px;font-size:12px;color:#94a3b8;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <a href="https://thermashift.net" style="color:#00a3e0;">thermashift.net</a>
        </div>
      </div>`
  }),

  followup_3: (data) => ({
    subject: `Last call — your ThermaShift review expires soon`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#0a1628,#0d2847);color:#fff;padding:32px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:20px;">One Last Thing</h1>
        </div>
        <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;">
          <p style="font-size:15px;line-height:1.7;color:#334155;">Hey ${data.name || 'there'},</p>
          <p style="font-size:15px;line-height:1.7;color:#334155;">I don't want to be a pest, so this is my last follow-up on your cooling review.</p>
          <p style="font-size:15px;line-height:1.7;color:#334155;">Here's a quick recap of what we found:</p>
          <ul style="font-size:15px;line-height:1.9;color:#334155;">
            <li><strong>$${(data.estimated_annual_savings || 0).toLocaleString()}/year</strong> in potential cooling savings</li>
            <li>PUE improvement from ${data.current_pue || '1.58'} to <strong>${data.target_pue || '1.2'}</strong></li>
            ${data.waste_heat_revenue_potential > 0 ? `<li><strong>$${(data.waste_heat_revenue_potential || 0).toLocaleString()}/year</strong> in waste heat revenue potential</li>` : ''}
            <li>Recommended: ${(data.recommended_services || ['Cooling Optimization']).join(', ')}</li>
          </ul>
          <p style="font-size:15px;line-height:1.7;color:#334155;">If the timing isn't right, no worries at all. But if you want to revisit this later, just reply to this email anytime — I'll pull up your review.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${CALENDLY_LINK}" style="display:inline-block;background:#00a3e0;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Schedule When You're Ready</a>
          </div>
          <p style="font-size:15px;line-height:1.7;color:#334155;">Wishing you the best,<br>— Alex<br>ThermaShift</p>
        </div>
        <div style="padding:16px 32px;font-size:12px;color:#94a3b8;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
          <a href="https://thermashift.net" style="color:#00a3e0;">thermashift.net</a>
        </div>
      </div>`
  }),
};

// ─── Schedule follow-ups after a review is sent ─────────────

export function getFollowUpSchedule(leadEmail, leadId, auditId, reviewData) {
  const now = Date.now();
  return [
    {
      lead_email: leadEmail,
      lead_id: leadId,
      audit_id: auditId,
      sequence_number: 1,
      scheduled_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      status: 'pending',
      subject: TEMPLATES.followup_1(reviewData).subject,
      template: 'followup_1',
    },
    {
      lead_email: leadEmail,
      lead_id: leadId,
      audit_id: auditId,
      sequence_number: 2,
      scheduled_at: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
      status: 'pending',
      subject: TEMPLATES.followup_2(reviewData).subject,
      template: 'followup_2',
    },
    {
      lead_email: leadEmail,
      lead_id: leadId,
      audit_id: auditId,
      sequence_number: 3,
      scheduled_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      status: 'pending',
      subject: TEMPLATES.followup_3(reviewData).subject,
      template: 'followup_3',
    },
  ];
}

// ─── Send a single follow-up email ──────────────────────────

export async function sendFollowUp(followUp, reviewData) {
  if (!RESEND_API_KEY) {
    console.log(`[FOLLOW-UP NOT SENT — no RESEND_API_KEY] To: ${followUp.lead_email}, Template: ${followUp.template}`);
    return null;
  }

  const template = TEMPLATES[followUp.template];
  if (!template) throw new Error(`Unknown template: ${followUp.template}`);

  const { subject, html } = template(reviewData);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [followUp.lead_email],
      subject,
      html,
    }),
  });

  if (!res.ok) throw new Error(`Resend error: ${res.status} — ${await res.text()}`);
  return res.json();
}

// ─── Process due follow-ups (called by cron/interval) ───────

export async function processDueFollowUps(sb) {
  const now = new Date().toISOString();

  // Get pending follow-ups that are due
  const due = await sb('follow_ups', 'GET', null,
    `?status=eq.pending&scheduled_at=lte.${now}&order=scheduled_at.asc&limit=20`);

  if (!due?.length) return { processed: 0 };

  let processed = 0;
  for (const followUp of due) {
    try {
      // Check if lead has already responded/converted — skip if so
      const lead = await sb('leads', 'GET', null, `?email=eq.${encodeURIComponent(followUp.lead_email)}&limit=1`);
      if (lead?.[0]?.status === 'proposal' || lead?.[0]?.status === 'won') {
        await sb('follow_ups', 'PATCH', { status: 'skipped', updated_at: now }, `?id=eq.${followUp.id}`);
        console.log(`Follow-up ${followUp.id} skipped — lead already at ${lead[0].status}`);
        continue;
      }

      // Get review data for template
      let reviewData = {};
      if (followUp.audit_id) {
        const audits = await sb('audits', 'GET', null, `?id=eq.${followUp.audit_id}&limit=1`);
        if (audits?.[0]) {
          reviewData = {
            name: lead?.[0]?.name,
            company: lead?.[0]?.company,
            estimated_annual_savings: audits[0].estimated_annual_savings,
            target_pue: audits[0].target_pue,
            current_pue: audits[0].current_pue,
            waste_heat_revenue_potential: audits[0].waste_heat_revenue_potential,
            recommended_services: audits[0].recommended_services,
          };
        }
      }

      await sendFollowUp(followUp, reviewData);
      await sb('follow_ups', 'PATCH', {
        status: 'sent',
        sent_at: now,
      }, `?id=eq.${followUp.id}`);

      console.log(`Follow-up ${followUp.id} sent to ${followUp.lead_email} (sequence ${followUp.sequence_number})`);
      processed++;
    } catch (err) {
      console.error(`Follow-up ${followUp.id} failed:`, err.message);
      await sb('follow_ups', 'PATCH', { status: 'failed' }, `?id=eq.${followUp.id}`);
    }
  }

  return { processed };
}
