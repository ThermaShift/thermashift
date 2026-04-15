import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { sendLeadNotification, sendReviewNotification, sendProposalNotification } from './email.js';
import { generateReview } from './review-generator.js';
import { calculateLeadScore } from './lead-scoring.js';
import { getFollowUpSchedule, processDueFollowUps } from './follow-ups.js';
import { sendPostCallSMS } from './sms.js';
import { generateReviewPDF } from './pdf-generator.js';

try {
  const require = createRequire(import.meta.url);
  const dotenv = require('dotenv');
  dotenv.config();
} catch { /* rely on env vars */ }

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const IS_PRODUCTION = existsSync(DIST_DIR);

const PORT = process.env.PORT || (IS_PRODUCTION ? 80 : 3001);
const API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;

const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

if (!API_KEY) {
  console.error('ERROR: Set ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable.');
  process.exit(1);
}

const app = express();

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));

// ─── Supabase helper ────────────────────────────────────────
async function sb(table, method, body, query = '') {
  const url = `${SUPABASE_URL}/${table}${query}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  if (method === 'PATCH') headers['Prefer'] = 'return=representation';

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${res.status} — ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── Invoice number generator ───────────────────────────────
function generateInvoiceNumber() {
  const d = new Date();
  const prefix = `TS-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${seq}`;
}

// ═══════════════════════════════════════════════════════════
// CHAT PROXY
// ═══════════════════════════════════════════════════════════
app.post('/api/chat', async (req, res) => {
  const { model, max_tokens, system, messages, stream } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 2048,
        system: system || '',
        messages,
        stream: stream !== false,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(anthropicRes.status).json({ error: errText });
    }

    if (stream !== false) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const reader = anthropicRes.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch (e) { console.error('Stream error:', e.message); }
      finally { res.end(); }
    } else {
      res.json(await anthropicRes.json());
    }
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Internal proxy error' });
  }
});

// ═══════════════════════════════════════════════════════════
// LEADS
// ═══════════════════════════════════════════════════════════
app.post('/api/leads', async (req, res) => {
  const { name, email, company, phone, role, source, notes } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const existing = await sb('leads', 'GET', null, `?email=eq.${encodeURIComponent(email)}&limit=1`);
    let lead;

    if (existing?.length > 0) {
      const updates = { updated_at: new Date().toISOString() };
      if (name && !existing[0].name) updates.name = name;
      if (company && !existing[0].company) updates.company = company;
      if (phone && !existing[0].phone) updates.phone = phone;
      if (role && !existing[0].role) updates.role = role;
      if (notes) updates.notes = (existing[0].notes || '') + '\n' + notes;
      const result = await sb('leads', 'PATCH', updates, `?id=eq.${existing[0].id}`);
      lead = result?.[0] || { ...existing[0], ...updates };
    } else {
      const newLead = {
        name, email, company, phone, role,
        source: source || 'chat_widget', status: 'new', notes,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      const result = await sb('leads', 'POST', newLead);
      lead = result?.[0] || newLead;

      try { await sendLeadNotification(lead); console.log(`Email sent for new lead: ${email}`); }
      catch (e) { console.error('Email failed:', e.message); }
    }

    // Score the lead
    try {
      const audits = await sb('audits', 'GET', null, `?lead_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`);
      const scoring = calculateLeadScore(lead, audits?.[0] || null);
      await sb('leads', 'PATCH', {
        lead_score: scoring.score,
        score_breakdown: JSON.stringify(scoring.breakdown),
      }, `?email=eq.${encodeURIComponent(email)}`);
      lead.lead_score = scoring.score;
      console.log(`Lead ${email} scored: ${scoring.score}/100 (${scoring.tier})`);
    } catch (e) { console.error('Scoring failed:', e.message); }

    res.json({ success: true, lead_id: lead.id, is_new: !existing?.length, lead_score: lead.lead_score });
  } catch (err) {
    console.error('Lead error:', err.message);
    res.status(500).json({ error: 'Failed to save lead' });
  }
});

// ═══════════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════════
app.post('/api/conversations', async (req, res) => {
  const { session_id, lead_id, lead_email, messages } = req.body;
  if (!session_id || !messages) return res.status(400).json({ error: 'session_id and messages required' });

  try {
    const existing = await sb('conversations', 'GET', null, `?session_id=eq.${encodeURIComponent(session_id)}&limit=1`);
    const data = {
      messages: JSON.stringify(messages),
      message_count: messages.length,
      lead_id, lead_email,
      updated_at: new Date().toISOString(),
    };

    if (existing?.length > 0) {
      await sb('conversations', 'PATCH', data, `?session_id=eq.${encodeURIComponent(session_id)}`);
    } else {
      await sb('conversations', 'POST', { session_id, ...data, created_at: new Date().toISOString() });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Conversation error:', err.message);
    res.status(500).json({ error: 'Failed to save conversation' });
  }
});

// ═══════════════════════════════════════════════════════════
// AUDITS — The money maker
// ═══════════════════════════════════════════════════════════
app.post('/api/audits', async (req, res) => {
  const audit = req.body;
  if (!audit.lead_email) return res.status(400).json({ error: 'lead_email required' });

  try {
    // Calculate total power if not provided
    if (!audit.total_power_mw && audit.rack_count && audit.avg_power_per_rack_kw) {
      audit.total_power_mw = (audit.rack_count * audit.avg_power_per_rack_kw / 1000);
    }

    // Save audit record as 'generating'
    const auditRecord = {
      lead_email: audit.lead_email || audit.email,
      status: 'generating',
      facility_name: audit.facility_name,
      facility_location: audit.facility_location,
      rack_count: audit.rack_count,
      avg_power_per_rack_kw: audit.avg_power_per_rack_kw,
      total_power_mw: audit.total_power_mw,
      current_pue: audit.current_pue,
      cooling_type: audit.cooling_type,
      facility_size_sqft: audit.facility_size_sqft,
      planned_expansion: audit.planned_expansion,
      expansion_details: audit.expansion_details,
      biggest_challenge: audit.biggest_challenge,
      timeline: audit.timeline,
      tracking_esg: audit.tracking_esg,
      current_cooling_spend_annual: audit.current_cooling_spend_annual,
      gpu_workloads: audit.gpu_workloads,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Link to lead
    try {
      const leads = await sb('leads', 'GET', null, `?email=eq.${encodeURIComponent(audit.lead_email)}&limit=1`);
      if (leads?.length > 0) auditRecord.lead_id = leads[0].id;
    } catch { /* ok */ }

    const result = await sb('audits', 'POST', auditRecord);
    const auditId = result?.[0]?.id;
    console.log(`Audit ${auditId} created for ${audit.lead_email} — generating review...`);

    // Return immediately, generate review in background
    res.json({ success: true, audit_id: auditId, status: 'generating' });

    // Generate review asynchronously
    try {
      const review = await generateReview(audit);

      await sb('audits', 'PATCH', {
        status: 'completed',
        review_generated_at: new Date().toISOString(),
        estimated_annual_savings: review.estimated_annual_savings,
        target_pue: review.target_pue,
        waste_heat_revenue_potential: review.waste_heat_revenue_potential,
        recommended_services: review.recommended_services,
        review_summary: review.review_summary,
        review_full_report: JSON.stringify(review.detailed_findings),
        updated_at: new Date().toISOString(),
      }, `?id=eq.${auditId}`);

      console.log(`Audit ${auditId} review generated! Savings: $${review.estimated_annual_savings?.toLocaleString()}`);

      // Update lead status
      if (auditRecord.lead_id) {
        await sb('leads', 'PATCH', { status: 'qualified', updated_at: new Date().toISOString() }, `?id=eq.${auditRecord.lead_id}`);
      }

      // Re-score lead with audit data
      try {
        const leads = await sb('leads', 'GET', null, `?email=eq.${encodeURIComponent(audit.lead_email)}&limit=1`);
        if (leads?.[0]) {
          const scoring = calculateLeadScore(leads[0], { ...audit, ...review });
          await sb('leads', 'PATCH', {
            lead_score: scoring.score,
            score_breakdown: JSON.stringify(scoring.breakdown),
          }, `?id=eq.${leads[0].id}`);
          console.log(`Lead ${audit.lead_email} re-scored after review: ${scoring.score}/100 (${scoring.tier})`);
        }
      } catch (e) { console.error('Re-scoring failed:', e.message); }

      // Email the review to the prospect
      try {
        await sendReviewNotification({ ...audit, ...review, audit_id: auditId });
        await sb('audits', 'PATCH', { review_sent_at: new Date().toISOString() }, `?id=eq.${auditId}`);
        console.log(`Review emailed to ${audit.lead_email}`);

        // Schedule follow-up emails
        try {
          const followUps = getFollowUpSchedule(audit.lead_email, auditRecord.lead_id, auditId, {
            name: audit.name, company: audit.company,
            estimated_annual_savings: review.estimated_annual_savings,
            target_pue: review.target_pue, current_pue: audit.current_pue,
            waste_heat_revenue_potential: review.waste_heat_revenue_potential,
            recommended_services: review.recommended_services,
          });
          for (const fu of followUps) {
            await sb('follow_ups', 'POST', fu);
          }
          console.log(`Scheduled ${followUps.length} follow-up emails for ${audit.lead_email}`);
        } catch (e) { console.error('Follow-up scheduling failed:', e.message); }
      } catch (e) { console.error('Review email failed:', e.message); }

    } catch (genErr) {
      console.error(`Audit ${auditId} review generation failed:`, genErr.message);
      await sb('audits', 'PATCH', { status: 'failed', updated_at: new Date().toISOString() }, `?id=eq.${auditId}`);
    }

  } catch (err) {
    console.error('Audit error:', err.message);
    res.status(500).json({ error: 'Failed to save audit' });
  }
});

// Get audit status (polled by frontend)
app.get('/api/audits/:id', async (req, res) => {
  try {
    const result = await sb('audits', 'GET', null, `?id=eq.${req.params.id}&limit=1`);
    if (!result?.length) return res.status(404).json({ error: 'Audit not found' });
    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit' });
  }
});

// Get audit review as PDF
app.get('/api/audits/:id/pdf', async (req, res) => {
  try {
    const result = await sb('audits', 'GET', null, `?id=eq.${req.params.id}&limit=1`);
    if (!result?.length) return res.status(404).json({ error: 'Audit not found' });
    const audit = result[0];
    if (audit.status !== 'completed') return res.status(400).json({ error: 'Review not yet generated' });

    let lead = null;
    if (audit.lead_id) {
      const leads = await sb('leads', 'GET', null, `?id=eq.${audit.lead_id}&limit=1`);
      lead = leads?.[0];
    }

    const pdfBuffer = generateReviewPDF(audit, lead);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ThermaShift-Review-${audit.id}.pdf"`);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    console.error('PDF generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ═══════════════════════════════════════════════════════════
// PROPOSALS
// ═══════════════════════════════════════════════════════════
app.post('/api/proposals', async (req, res) => {
  const { lead_email, lead_id, audit_id, services, estimated_value, timeline_weeks, notes } = req.body;
  if (!lead_email || !services) return res.status(400).json({ error: 'lead_email and services required' });

  try {
    // Build milestone payment structure (30% deposit, 40% midpoint, 30% completion)
    const deposit = Math.round(estimated_value * 0.30);
    const midpoint = Math.round(estimated_value * 0.40);
    const final_payment = estimated_value - deposit - midpoint;

    const proposal = {
      lead_email, lead_id, audit_id,
      status: 'sent',
      title: `ThermaShift Service Proposal — ${Array.isArray(services) ? services.join(' + ') : services}`,
      services: JSON.stringify(Array.isArray(services) ? services : [services]),
      total_value: estimated_value,
      payment_structure: JSON.stringify({
        type: 'milestone',
        milestones: [
          { name: 'Deposit (before work begins)', amount: deposit, percentage: 30, due: 'Upon acceptance' },
          { name: 'Midpoint Delivery', amount: midpoint, percentage: 40, due: `Week ${Math.ceil((timeline_weeks || 8) / 2)}` },
          { name: 'Final Delivery', amount: final_payment, percentage: 30, due: `Week ${timeline_weeks || 8}` },
        ],
      }),
      scope_of_work: notes || '',
      timeline_weeks: timeline_weeks || 8,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await sb('proposals', 'POST', proposal);
    const proposalId = result?.[0]?.id;
    console.log(`Proposal ${proposalId} created for ${lead_email}: $${estimated_value}`);

    // Update lead status
    if (lead_id) {
      await sb('leads', 'PATCH', { status: 'proposal', updated_at: new Date().toISOString() }, `?id=eq.${lead_id}`);
    }

    // Email the proposal
    try {
      await sendProposalNotification({ ...proposal, id: proposalId, services, estimated_value });
      console.log(`Proposal emailed to ${lead_email}`);
    } catch (e) { console.error('Proposal email failed:', e.message); }

    // Auto-generate the deposit invoice
    try {
      const invoice = {
        invoice_number: generateInvoiceNumber(),
        lead_id, lead_email, proposal_id: proposalId,
        status: 'sent',
        title: `Deposit — ${Array.isArray(services) ? services[0] : services}`,
        line_items: JSON.stringify([{
          description: `Project deposit (30%) — ${Array.isArray(services) ? services.join(', ') : services}`,
          amount: deposit,
        }]),
        subtotal: deposit, tax_rate: 0, tax_amount: 0, total: deposit,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Due in 7 days
        payment_type: 'milestone',
        milestone_name: 'Deposit',
        milestone_number: 1,
        is_deposit: true,
        work_authorized: false, // CANNOT start work until paid
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await sb('invoices', 'POST', invoice);
      console.log(`Deposit invoice ${invoice.invoice_number} created: $${deposit}`);
    } catch (e) { console.error('Invoice creation failed:', e.message); }

    res.json({ success: true, proposal_id: proposalId });
  } catch (err) {
    console.error('Proposal error:', err.message);
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

// ═══════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════
app.get('/api/invoices/:id', async (req, res) => {
  try {
    const result = await sb('invoices', 'GET', null, `?id=eq.${req.params.id}&limit=1`);
    if (!result?.length) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch invoice' }); }
});

// Get all invoices for a lead
app.get('/api/leads/:email/invoices', async (req, res) => {
  try {
    const invoices = await sb('invoices', 'GET', null,
      `?lead_email=eq.${encodeURIComponent(req.params.email)}&order=created_at.desc`);
    res.json(invoices || []);
  } catch { res.status(500).json({ error: 'Failed to fetch invoices' }); }
});

// ═══════════════════════════════════════════════════════════
// STRIPE PAYMENT (when configured)
// ═══════════════════════════════════════════════════════════
app.post('/api/payments/create-checkout', async (req, res) => {
  if (!STRIPE_SECRET) return res.status(503).json({ error: 'Stripe not configured' });

  const { invoice_id } = req.body;
  if (!invoice_id) return res.status(400).json({ error: 'invoice_id required' });

  try {
    const invoices = await sb('invoices', 'GET', null, `?id=eq.${invoice_id}&limit=1`);
    if (!invoices?.length) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = invoices[0];

    // Create Stripe checkout session
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': invoice.title,
        'line_items[0][price_data][unit_amount]': String(Math.round(invoice.total * 100)), // cents
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'success_url': `${req.headers.origin || 'https://thermashift.net'}/payment/success?invoice=${invoice.invoice_number}`,
        'cancel_url': `${req.headers.origin || 'https://thermashift.net'}/payment/cancel`,
        'customer_email': invoice.lead_email,
        'metadata[invoice_id]': String(invoice.id),
        'metadata[invoice_number]': invoice.invoice_number,
      }),
    });

    if (!stripeRes.ok) {
      const err = await stripeRes.text();
      throw new Error(`Stripe error: ${stripeRes.status} — ${err}`);
    }

    const session = await stripeRes.json();
    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook — handles payment confirmation
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  // In production, verify webhook signature with STRIPE_WEBHOOK_SECRET
  try {
    const event = JSON.parse(req.body);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;

      if (invoiceId) {
        // Mark invoice as paid
        await sb('invoices', 'PATCH', {
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'stripe',
          stripe_payment_intent_id: session.payment_intent,
          work_authorized: true, // NOW work can begin
          updated_at: new Date().toISOString(),
        }, `?id=eq.${invoiceId}`);

        // Log payment
        await sb('payments', 'POST', {
          invoice_id: parseInt(invoiceId),
          amount: session.amount_total / 100,
          currency: 'usd',
          status: 'completed',
          payment_method: 'stripe',
          stripe_payment_intent_id: session.payment_intent,
          receipt_url: session.receipt_url || null,
          created_at: new Date().toISOString(),
        });

        // Update lead status
        const invoices = await sb('invoices', 'GET', null, `?id=eq.${invoiceId}&limit=1`);
        if (invoices?.[0]?.lead_id) {
          await sb('leads', 'PATCH', { status: 'won', updated_at: new Date().toISOString() }, `?id=eq.${invoices[0].lead_id}`);
        }

        console.log(`Payment received for invoice ${invoiceId}: $${session.amount_total / 100}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// ═══════════════════════════════════════════════════════════
// LEAD HISTORY
// ═══════════════════════════════════════════════════════════
app.get('/api/leads/:email/history', async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  try {
    const leads = await sb('leads', 'GET', null, `?email=eq.${encodeURIComponent(email)}&limit=1`);
    if (!leads?.length) return res.json({ lead: null, conversations: [], audits: [], proposals: [], invoices: [], call_logs: [] });

    const [conversations, audits, proposals, invoices, call_logs] = await Promise.all([
      sb('conversations', 'GET', null, `?lead_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=5`),
      sb('audits', 'GET', null, `?lead_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=3`),
      sb('proposals', 'GET', null, `?lead_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=3`),
      sb('invoices', 'GET', null, `?lead_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=10`),
      sb('call_logs', 'GET', null, `?lead_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=5`).catch(() => []),
    ]);

    res.json({ lead: leads[0], conversations, audits, proposals, invoices, call_logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ═══════════════════════════════════════════════════════════
// VAPI VOICE CALL WEBHOOK
// ═══════════════════════════════════════════════════════════
app.post('/api/webhooks/vapi', async (req, res) => {
  try {
    const event = req.body;
    const type = event.message?.type || event.type;
    console.log(`Vapi webhook: ${type}`);

    if (type === 'end-of-call-report') {
      const report = event.message || event;
      const callId = report.call?.id;
      const transcript = report.transcript;
      const summary = report.summary;
      const duration = report.call?.duration || report.durationSeconds;
      const endedReason = report.endedReason;
      const cost = report.cost;
      const recordingUrl = report.recordingUrl || report.call?.recordingUrl;
      const customerNumber = report.call?.customer?.number;

      // Try to find lead by phone number
      let leadId = null;
      let leadEmail = null;
      if (customerNumber) {
        try {
          const leads = await sb('leads', 'GET', null, `?phone=eq.${encodeURIComponent(customerNumber)}&limit=1`);
          if (leads?.[0]) {
            leadId = leads[0].id;
            leadEmail = leads[0].email;
          }
        } catch { /* ok */ }
      }

      // Save call log
      const callLog = {
        vapi_call_id: callId,
        lead_id: leadId,
        lead_email: leadEmail,
        lead_phone: customerNumber,
        phone_number: report.call?.phoneNumber?.number || '+17866056239',
        direction: report.call?.direction || 'inbound',
        duration_seconds: duration,
        status: 'completed',
        summary: summary,
        transcript: JSON.stringify(transcript),
        recording_url: recordingUrl,
        assistant_id: report.call?.assistantId,
        ended_reason: endedReason,
        cost: cost,
        created_at: new Date().toISOString(),
      };

      await sb('call_logs', 'POST', callLog);
      console.log(`Call log saved: ${callId} (${duration}s, ${customerNumber || 'unknown'})`);

      // Send post-call SMS follow-up
      if (customerNumber && duration > 30) {
        try {
          const leadName = leadEmail ? (await sb('leads', 'GET', null, `?email=eq.${encodeURIComponent(leadEmail)}&limit=1`))?.[0]?.name : null;
          await sendPostCallSMS(customerNumber, leadName);
        } catch (e) { console.error('Post-call SMS failed:', e.message); }
      }

      // Notify Steve of the call
      try {
        const RESEND_KEY = process.env.RESEND_API_KEY;
        if (RESEND_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'ThermaShift <notifications@thermashift.net>',
              to: ['admin@thermashift.net'],
              subject: `Voice Call: ${customerNumber || 'Unknown'} (${Math.round(duration / 60)}min)`,
              html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:#0a1628;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
                  <h1 style="margin:0;font-size:20px;">Alex Handled a Phone Call</h1>
                </div>
                <div style="background:#f8fafc;padding:24px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
                  <p><strong>Caller:</strong> ${customerNumber || 'Unknown'}</p>
                  <p><strong>Duration:</strong> ${Math.round(duration / 60)} minutes</p>
                  <p><strong>Ended:</strong> ${endedReason || 'Normal'}</p>
                  ${leadEmail ? `<p><strong>Lead:</strong> ${leadEmail}</p>` : ''}
                  ${summary ? `<p><strong>Summary:</strong> ${summary}</p>` : ''}
                  ${recordingUrl ? `<p><a href="${recordingUrl}">Listen to Recording</a></p>` : ''}
                </div>
              </div>`,
            }),
          });
        }
      } catch (e) { console.error('Call notification email failed:', e.message); }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Vapi webhook error:', err.message);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// ═══════════════════════════════════════════════════════════
// FOLLOW-UP EMAIL PROCESSOR
// ═══════════════════════════════════════════════════════════
app.post('/api/follow-ups/process', async (req, res) => {
  try {
    const result = await processDueFollowUps(sb);
    res.json(result);
  } catch (err) {
    console.error('Follow-up processing error:', err.message);
    res.status(500).json({ error: 'Failed to process follow-ups' });
  }
});

// ═══════════════════════════════════════════════════════════
// ADMIN DASHBOARD API (protected)
// ═══════════════════════════════════════════════════════════

// Admin auth middleware — checks password hash in x-admin-token header
const ADMIN_HASH = '6a1cf8ff6fa4491a4b3d9e22d6ef2ea31f2873c631fce4401ee49d6be788762f';
async function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Admin authentication required' });
  try {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    if (hash !== ADMIN_HASH) return res.status(403).json({ error: 'Invalid admin credentials' });
    next();
  } catch {
    return res.status(500).json({ error: 'Auth check failed' });
  }
}

// Get all leads with scores, sorted by score
app.get('/api/admin/leads', adminAuth, async (req, res) => {
  try {
    const leads = await sb('leads', 'GET', null, '?order=lead_score.desc.nullsfirst,created_at.desc&limit=50');
    res.json(leads || []);
  } catch { res.status(500).json({ error: 'Failed to fetch leads' }); }
});

// Get pipeline summary stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const [leads, audits, proposals, invoices, callLogs] = await Promise.all([
      sb('leads', 'GET', null, '?select=id,status,lead_score,created_at&order=created_at.desc&limit=500'),
      sb('audits', 'GET', null, '?select=id,status,estimated_annual_savings,created_at&order=created_at.desc&limit=100'),
      sb('proposals', 'GET', null, '?select=id,status,total_value,created_at&order=created_at.desc&limit=100'),
      sb('invoices', 'GET', null, '?select=id,status,total,paid_at&order=created_at.desc&limit=100'),
      sb('call_logs', 'GET', null, '?select=id,duration_seconds,created_at&order=created_at.desc&limit=100').catch(() => []),
    ]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const thisWeek = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const stats = {
      total_leads: leads?.length || 0,
      new_leads_today: leads?.filter(l => l.created_at >= today).length || 0,
      new_leads_week: leads?.filter(l => l.created_at >= thisWeek).length || 0,
      hot_leads: leads?.filter(l => l.lead_score >= 75).length || 0,
      warm_leads: leads?.filter(l => l.lead_score >= 50 && l.lead_score < 75).length || 0,
      audits_completed: audits?.filter(a => a.status === 'completed').length || 0,
      audits_pending: audits?.filter(a => a.status === 'generating' || a.status === 'collecting').length || 0,
      total_savings_identified: audits?.reduce((sum, a) => sum + (a.estimated_annual_savings || 0), 0) || 0,
      proposals_sent: proposals?.filter(p => p.status === 'sent').length || 0,
      proposals_accepted: proposals?.filter(p => p.status === 'accepted').length || 0,
      total_pipeline_value: proposals?.reduce((sum, p) => sum + (p.total_value || 0), 0) || 0,
      invoices_paid: invoices?.filter(i => i.status === 'paid').length || 0,
      total_revenue: invoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0) || 0,
      total_calls: callLogs?.length || 0,
      total_call_minutes: Math.round((callLogs?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0) / 60),
    };

    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get recent activity feed for dashboard
app.get('/api/admin/activity', adminAuth, async (req, res) => {
  try {
    const [leads, audits, proposals, calls] = await Promise.all([
      sb('leads', 'GET', null, '?select=id,name,email,company,lead_score,status,created_at&order=created_at.desc&limit=10'),
      sb('audits', 'GET', null, '?select=id,lead_email,status,estimated_annual_savings,created_at&order=created_at.desc&limit=10'),
      sb('proposals', 'GET', null, '?select=id,lead_email,status,total_value,created_at&order=created_at.desc&limit=10'),
      sb('call_logs', 'GET', null, '?select=id,lead_phone,lead_email,duration_seconds,summary,created_at&order=created_at.desc&limit=10').catch(() => []),
    ]);

    // Merge and sort by time
    const activity = [
      ...(leads || []).map(l => ({ type: 'lead', data: l, time: l.created_at })),
      ...(audits || []).map(a => ({ type: 'audit', data: a, time: a.created_at })),
      ...(proposals || []).map(p => ({ type: 'proposal', data: p, time: p.created_at })),
      ...(calls || []).map(c => ({ type: 'call', data: c, time: c.created_at })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20);

    res.json(activity);
  } catch { res.status(500).json({ error: 'Failed to fetch activity' }); }
});

// ═══════════════════════════════════════════════════════════
// RETURNING VISITOR LOOKUP
// ═══════════════════════════════════════════════════════════
app.get('/api/leads/lookup/:email', async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  try {
    const leads = await sb('leads', 'GET', null, `?email=eq.${encodeURIComponent(email)}&limit=1`);
    if (!leads?.length) return res.json({ found: false });

    const lead = leads[0];
    const audits = await sb('audits', 'GET', null, `?lead_email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`).catch(() => []);

    res.json({
      found: true,
      name: lead.name,
      company: lead.company,
      status: lead.status,
      lead_score: lead.lead_score,
      last_audit: audits?.[0] ? {
        status: audits[0].status,
        estimated_annual_savings: audits[0].estimated_annual_savings,
        target_pue: audits[0].target_pue,
        recommended_services: audits[0].recommended_services,
      } : null,
    });
  } catch { res.json({ found: false }); }
});

// ═══════════════════════════════════════════════════════════
// FOLLOW-UP CRON (runs every 5 minutes)
// ═══════════════════════════════════════════════════════════
setInterval(async () => {
  try {
    const result = await processDueFollowUps(sb);
    if (result.processed > 0) {
      console.log(`Follow-up cron: sent ${result.processed} emails`);
    }
  } catch (e) { console.error('Follow-up cron error:', e.message); }
}, 5 * 60 * 1000); // Every 5 minutes

// ═══════════════════════════════════════════════════════════
// STATIC FILES (production — serves the built React app)
// ═══════════════════════════════════════════════════════════
if (IS_PRODUCTION) {
  app.use(express.static(DIST_DIR));
  // SPA fallback — all non-API routes serve index.html (Express 5 syntax)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.includes('.')) {
      res.sendFile(join(DIST_DIR, 'index.html'));
    } else {
      next();
    }
  });
  console.log('Serving static files from', DIST_DIR);
}

// ═══════════════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nThermaShift API running on http://localhost:${PORT}\n`);
  console.log('  CHAT');
  console.log('    POST /api/chat                    — Claude API proxy (streaming)');
  console.log('  CRM');
  console.log('    POST /api/leads                   — Capture lead contact info');
  console.log('    POST /api/conversations           — Log chat session');
  console.log('    GET  /api/leads/:email/history     — Full lead timeline');
  console.log('  SALES PIPELINE');
  console.log('    POST /api/audits                  — Submit audit → auto-generate review');
  console.log('    GET  /api/audits/:id              — Poll audit/review status');
  console.log('    POST /api/proposals               — Create proposal + deposit invoice');
  console.log('    GET  /api/invoices/:id            — Get invoice details');
  console.log('    GET  /api/leads/:email/invoices   — All invoices for a lead');
  console.log('  PAYMENTS');
  console.log('    POST /api/payments/create-checkout — Stripe checkout session');
  console.log('    POST /api/webhooks/stripe         — Stripe payment webhook');
  console.log('  VOICE');
  console.log('    POST /api/webhooks/vapi           — Vapi call transcript webhook');
  console.log('  FOLLOW-UPS');
  console.log('    POST /api/follow-ups/process      — Process due follow-up emails');
  console.log('  ADMIN');
  console.log('    GET  /api/admin/leads             — All leads with scores');
  console.log('    GET  /api/admin/stats             — Pipeline summary stats');
  console.log('    GET  /api/admin/activity          — Recent activity feed');
  console.log('    GET  /api/leads/lookup/:email     — Returning visitor lookup');
  console.log('');
  console.log(`  Stripe: ${STRIPE_SECRET ? 'CONFIGURED' : 'NOT CONFIGURED (add STRIPE_SECRET_KEY to .env)'}`);
  console.log(`  Resend: ${process.env.RESEND_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log('  Follow-up cron: running every 5 minutes');
  console.log('');
});
