/**
 * Email notification system for ThermaShift.
 * Uses Resend (free tier: 3,000 emails/month).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = 'admin@thermashift.net';
const FROM_EMAIL = RESEND_API_KEY ? 'ThermaShift <notifications@thermashift.net>' : null;

async function sendEmail(to, subject, html, text) {
  if (!RESEND_API_KEY) {
    console.log(`\n[EMAIL NOT SENT — configure RESEND_API_KEY]\n  To: ${to}\n  Subject: ${subject}\n`);
    return { id: 'console-fallback' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: Array.isArray(to) ? to : [to], subject, html, text }),
  });

  if (!res.ok) throw new Error(`Resend error: ${res.status} — ${await res.text()}`);
  return res.json();
}

// ─── New Lead ───────────────────────────────────────────────
export async function sendLeadNotification(lead) {
  const subject = `New Lead: ${lead.name || 'Unknown'} — ${lead.company || 'No company'}`;
  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0a1628;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:20px;">New Lead from ThermaShift Chat</h1>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#64748b;width:120px;">Name</td><td style="padding:8px 0;font-weight:600;">${lead.name || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;font-weight:600;"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Company</td><td style="padding:8px 0;font-weight:600;">${lead.company || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Phone</td><td style="padding:8px 0;font-weight:600;">${lead.phone || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Role</td><td style="padding:8px 0;font-weight:600;">${lead.role || '—'}</td></tr>
        </table>
        <div style="margin-top:16px;font-size:13px;color:#94a3b8;">
          ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
        </div>
      </div>
    </div>`;

  // Send to admin AND don't email the lead themselves (that comes with the review)
  return sendEmail(NOTIFY_EMAIL, subject, html, `New Lead: ${lead.name} (${lead.email}) from ${lead.company}`);
}

// ─── Review Complete ────────────────────────────────────────
export async function sendReviewNotification(data) {
  const savings = (data.estimated_annual_savings || 0).toLocaleString();
  const wasteHeat = (data.waste_heat_revenue_potential || 0).toLocaleString();

  // Email to the PROSPECT with their review results
  const prospectSubject = `Your ThermaShift Cooling Efficiency Review Is Ready`;
  const prospectHtml = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0a1628,#0d2847);color:#fff;padding:32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0 0 8px;font-size:22px;">Your Cooling Efficiency Review</h1>
        <p style="margin:0;opacity:0.8;font-size:14px;">ThermaShift — Cooling Intelligence. Environmental Impact.</p>
      </div>
      <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;">
        <h2 style="color:#0a1628;font-size:18px;margin:0 0 20px;">Key Findings</h2>

        <div style="display:flex;gap:16px;margin-bottom:24px;">
          <div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#00a3e0;">$${savings}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Est. Annual Savings</div>
          </div>
          <div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#00a3e0;">${data.target_pue || '—'}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Target PUE</div>
          </div>
          ${data.waste_heat_revenue_potential > 0 ? `
          <div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#10b981;">$${wasteHeat}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Waste Heat Revenue/yr</div>
          </div>` : ''}
        </div>

        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
          <h3 style="margin:0 0 12px;font-size:15px;color:#0a1628;">Executive Summary</h3>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;">${(data.review_summary || '').replace(/\n/g, '<br>')}</p>
        </div>

        <div style="text-align:center;margin-top:24px;">
          <a href="https://thermashift.net/contact" style="display:inline-block;background:#00a3e0;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Schedule Your Free Consultation</a>
          <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;">Or reply to this email — Alex will get back to you.</p>
        </div>
      </div>
      <div style="padding:16px 32px;font-size:12px;color:#94a3b8;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        ThermaShift — Cooling Intelligence. Environmental Impact.<br>
        <a href="https://thermashift.net" style="color:#00a3e0;">thermashift.net</a>
      </div>
    </div>`;

  // Send to prospect
  if (data.email || data.lead_email) {
    await sendEmail(data.email || data.lead_email, prospectSubject, prospectHtml,
      `Your ThermaShift Review:\nEst. Savings: $${savings}/yr\nTarget PUE: ${data.target_pue}\nWaste Heat Revenue: $${wasteHeat}/yr`);
  }

  // Also notify Steve
  const adminSubject = `Review Generated: ${data.name || data.lead_email} — $${savings} savings identified`;
  const adminHtml = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0a1628;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:20px;">Review Generated — Ready for Follow-up</h1>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p><strong>Lead:</strong> ${data.name || '—'} (${data.email || data.lead_email})</p>
        <p><strong>Company:</strong> ${data.company || '—'}</p>
        <p><strong>Phone:</strong> ${data.phone || '—'}</p>
        <p><strong>Est. Savings:</strong> $${savings}/yr</p>
        <p><strong>Target PUE:</strong> ${data.target_pue}</p>
        <p><strong>Waste Heat:</strong> $${wasteHeat}/yr</p>
        <p><strong>Recommended:</strong> ${(data.recommended_services || []).join(', ')}</p>
        <p style="margin-top:16px;padding:12px;background:#fff;border-radius:8px;font-size:14px;">${(data.review_summary || '').slice(0, 500)}...</p>
        <p style="margin-top:12px;font-size:13px;color:#94a3b8;">Review has been emailed to the prospect. Follow up within 24 hours.</p>
      </div>
    </div>`;

  return sendEmail(NOTIFY_EMAIL, adminSubject, adminHtml, `Review for ${data.email}: $${savings} savings`);
}

// ─── Proposal Sent ──────────────────────────────────────────
export async function sendProposalNotification(data) {
  const value = (data.estimated_value || data.total_value || 0).toLocaleString();
  const services = Array.isArray(data.services) ? data.services.join(', ') : data.services;

  const subject = `Proposal Sent: ${services} — $${value}`;
  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0a1628;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:20px;">Proposal Created</h1>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <p><strong>Lead:</strong> ${data.lead_email}</p>
        <p><strong>Services:</strong> ${services}</p>
        <p><strong>Value:</strong> $${value}</p>
        <p><strong>Timeline:</strong> ${data.timeline_weeks || 8} weeks</p>
        <p><strong>Payment:</strong> 30% deposit → 40% midpoint → 30% completion</p>
        <p style="margin-top:16px;font-size:13px;color:#94a3b8;">Deposit invoice auto-generated. Work begins after deposit is paid.</p>
      </div>
    </div>`;

  return sendEmail(NOTIFY_EMAIL, subject, html, `Proposal: ${services} for ${data.lead_email} — $${value}`);
}
