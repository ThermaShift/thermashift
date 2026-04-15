/**
 * ThermaShift Automated Cold Email Outreach System
 * Sends personalized cold emails to data center prospects.
 * Manages follow-up sequences and tracks engagement.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Steve Betancur <steve@thermashift.net>';
const CALENDLY_LINK = 'https://calendly.com/thermashift/consultation';

// ─── Email Templates ────────────────────────────────────────

const TEMPLATES = {
  // Day 1: Initial cold outreach
  cold_intro: (prospect) => ({
    subject: `${prospect.company} — cooling efficiency question`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#334155;font-size:15px;line-height:1.7;">
        <p>Hi ${prospect.first_name || 'there'},</p>
        ${prospect.talking_point ? `<p>${prospect.talking_point}</p>` : ''}
        <p>I run ThermaShift — we help data centers cut cooling costs by 15-30% and monetize waste heat. Most facilities we analyze are leaving $200K-$500K/year on the table from cooling inefficiency alone.</p>
        <p>We're offering a <strong>complimentary cooling efficiency assessment</strong> for facilities in ${prospect.region || 'the Southeast'}. It takes about 10 minutes of your time and you get a detailed report with:</p>
        <ul style="color:#334155;">
          <li>Estimated annual savings potential</li>
          <li>PUE improvement targets</li>
          <li>Waste heat revenue opportunity</li>
          <li>Specific recommendations for your cooling setup</li>
        </ul>
        <p>No commitment, no sales pitch — just useful data. Interested?</p>
        <p>Steve Betancur<br>
        ThermaShift — Cooling Intelligence. Environmental Impact.<br>
        <a href="https://thermashift.net" style="color:#00a3e0;">thermashift.net</a> | <a href="tel:+17866056239" style="color:#00a3e0;">(786) 605-6239</a></p>
      </div>`
  }),

  // Day 3: Follow-up with value add
  cold_followup_1: (prospect) => ({
    subject: `Re: ${prospect.company} — cooling efficiency question`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#334155;font-size:15px;line-height:1.7;">
        <p>Hi ${prospect.first_name || 'there'},</p>
        <p>Quick follow-up on my note from earlier this week. I wanted to share one stat that might be relevant:</p>
        <p style="padding:16px 20px;background:#f0f9ff;border-left:4px solid #00a3e0;margin:16px 0;">
          <strong>The Section 179D tax deduction for energy-efficient buildings expires June 30, 2026.</strong> Every dollar invested in cooling efficiency before that date generates a tax deduction. After that, the window closes.
        </p>
        <p>Our free assessment identifies the specific improvements that qualify — and most facilities find six-figure savings they didn't know existed.</p>
        <p>Worth 15 minutes? <a href="${CALENDLY_LINK}" style="color:#00a3e0;font-weight:600;">Pick a time here</a> or just reply to this email.</p>
        <p>Steve<br>ThermaShift</p>
      </div>`
  }),

  // Day 7: Final follow-up, create urgency
  cold_followup_2: (prospect) => ({
    subject: `Re: ${prospect.company} — last note from me`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#334155;font-size:15px;line-height:1.7;">
        <p>Hi ${prospect.first_name || 'there'},</p>
        <p>Last email from me on this — I know you're busy running ${prospect.company || 'your facility'}.</p>
        <p>Three quick numbers and I'll leave you alone:</p>
        <ol style="color:#334155;">
          <li><strong>40%</strong> — the share of data center energy costs that go to cooling</li>
          <li><strong>$200K-$500K/year</strong> — typical savings our assessments uncover</li>
          <li><strong>76 days</strong> — until the Section 179D tax deduction expires</li>
        </ol>
        <p>If the timing isn't right, no hard feelings. But if you want those numbers for ${prospect.company || 'your facility'}, the free assessment is still on the table.</p>
        <p>Just reply "interested" and I'll take it from there.</p>
        <p>Steve<br>ThermaShift<br><a href="https://thermashift.net" style="color:#00a3e0;">thermashift.net</a></p>
      </div>`
  }),
};

// ─── Prospect Management ────────────────────────────────────

/**
 * Add prospects to the outreach pipeline.
 * Saves to Supabase prospects table and schedules email sequence.
 */
export async function addProspects(prospects, sb) {
  const results = [];
  for (const prospect of prospects) {
    try {
      // Check if already in pipeline
      const existing = await sb('outreach_prospects', 'GET', null,
        `?email=eq.${encodeURIComponent(prospect.email)}&limit=1`);
      if (existing?.length > 0) {
        results.push({ email: prospect.email, status: 'already_exists' });
        continue;
      }

      // Save prospect
      const record = {
        email: prospect.email,
        first_name: prospect.first_name || '',
        last_name: prospect.last_name || '',
        company: prospect.company || '',
        title: prospect.title || '',
        linkedin_url: prospect.linkedin_url || '',
        region: prospect.region || 'Southeast US',
        talking_point: prospect.talking_point || '',
        source: prospect.source || 'manual',
        status: 'queued',
        created_at: new Date().toISOString(),
      };

      const saved = await sb('outreach_prospects', 'POST', record);
      const prospectId = saved?.[0]?.id;

      // Schedule 3-email sequence
      const now = Date.now();
      const sequence = [
        { template: 'cold_intro', delay_ms: 0 },                          // Now
        { template: 'cold_followup_1', delay_ms: 3 * 24 * 60 * 60 * 1000 }, // Day 3
        { template: 'cold_followup_2', delay_ms: 7 * 24 * 60 * 60 * 1000 }, // Day 7
      ];

      for (const step of sequence) {
        await sb('outreach_emails', 'POST', {
          prospect_id: prospectId,
          prospect_email: prospect.email,
          template: step.template,
          scheduled_at: new Date(now + step.delay_ms).toISOString(),
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }

      results.push({ email: prospect.email, status: 'queued', prospect_id: prospectId });
      console.log(`Prospect added: ${prospect.first_name} ${prospect.last_name} at ${prospect.company} (${prospect.email})`);
    } catch (err) {
      results.push({ email: prospect.email, status: 'error', error: err.message });
      console.error(`Failed to add prospect ${prospect.email}:`, err.message);
    }
  }
  return results;
}

// ─── Send Due Emails ────────────────────────────────────────

/**
 * Process and send all due outreach emails.
 * Called by cron every 15 minutes.
 */
export async function processDueOutreach(sb) {
  if (!RESEND_API_KEY) {
    return { processed: 0, note: 'RESEND_API_KEY not configured' };
  }

  const now = new Date().toISOString();

  // Get pending emails that are due
  const due = await sb('outreach_emails', 'GET', null,
    `?status=eq.pending&scheduled_at=lte.${now}&order=scheduled_at.asc&limit=10`);

  if (!due?.length) return { processed: 0 };

  let processed = 0;
  for (const email of due) {
    try {
      // Get prospect data
      const prospects = await sb('outreach_prospects', 'GET', null,
        `?id=eq.${email.prospect_id}&limit=1`);
      const prospect = prospects?.[0];

      if (!prospect) {
        await sb('outreach_emails', 'PATCH', { status: 'skipped' }, `?id=eq.${email.id}`);
        continue;
      }

      // Check if prospect has replied or opted out
      if (prospect.status === 'replied' || prospect.status === 'opted_out' || prospect.status === 'converted') {
        await sb('outreach_emails', 'PATCH', { status: 'skipped' }, `?id=eq.${email.id}`);
        continue;
      }

      // Get template and generate email
      const template = TEMPLATES[email.template];
      if (!template) {
        await sb('outreach_emails', 'PATCH', { status: 'skipped' }, `?id=eq.${email.id}`);
        continue;
      }

      const { subject, html } = template(prospect);

      // Send via Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [prospect.email],
          subject,
          html,
          reply_to: 'steve@thermashift.net',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend: ${res.status} — ${err}`);
      }

      const result = await res.json();

      // Mark as sent
      await sb('outreach_emails', 'PATCH', {
        status: 'sent',
        sent_at: now,
        resend_id: result.id,
      }, `?id=eq.${email.id}`);

      // Update prospect status
      if (email.template === 'cold_intro') {
        await sb('outreach_prospects', 'PATCH', { status: 'contacted' }, `?id=eq.${prospect.id}`);
      }

      console.log(`Outreach email sent: ${email.template} → ${prospect.email}`);
      processed++;

      // Rate limit: wait 2 seconds between emails to avoid spam flags
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Outreach email ${email.id} failed:`, err.message);
      await sb('outreach_emails', 'PATCH', { status: 'failed' }, `?id=eq.${email.id}`);
    }
  }

  return { processed };
}
