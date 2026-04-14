-- ============================================================
-- ThermaShift Full Sales Pipeline — Supabase SQL
-- Run at: https://supabase.com/dashboard/project/auqklthrpvsqyelfjood/sql
-- ============================================================

-- ─── LEADS ──────────────────────────────────────────────────
-- Every person who talks to Alex or fills out the contact form
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  phone TEXT,
  role TEXT,
  source TEXT DEFAULT 'chat_widget',
  status TEXT DEFAULT 'new',
  notes TEXT,
  next_follow_up TIMESTAMPTZ
);

-- ─── CONVERSATIONS ──────────────────────────────────────────
-- Every chat session (and later, voice call transcripts)
CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT NOT NULL UNIQUE,
  lead_id BIGINT REFERENCES leads(id),
  lead_email TEXT,
  messages JSONB NOT NULL,
  message_count INTEGER DEFAULT 0,
  summary TEXT,
  services_discussed TEXT[],
  sentiment TEXT,
  converted BOOLEAN DEFAULT FALSE
);

-- ─── AUDITS ─────────────────────────────────────────────────
-- Cooling efficiency review data collected by Alex + generated report
CREATE TABLE IF NOT EXISTS audits (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  lead_id BIGINT REFERENCES leads(id),
  lead_email TEXT NOT NULL,
  status TEXT DEFAULT 'collecting',

  -- Facility data (collected by Alex through conversation)
  facility_name TEXT,
  facility_location TEXT,
  rack_count INTEGER,
  avg_power_per_rack_kw NUMERIC,
  total_power_mw NUMERIC,
  current_pue NUMERIC,
  cooling_type TEXT,
  facility_size_sqft INTEGER,
  planned_expansion BOOLEAN DEFAULT FALSE,
  expansion_details TEXT,

  -- Business context
  biggest_challenge TEXT,
  timeline TEXT,
  tracking_esg BOOLEAN DEFAULT FALSE,
  esg_details TEXT,
  current_cooling_spend_annual NUMERIC,
  gpu_workloads BOOLEAN DEFAULT FALSE,

  -- Generated review results (filled by Claude API)
  review_generated_at TIMESTAMPTZ,
  estimated_annual_savings NUMERIC,
  target_pue NUMERIC,
  waste_heat_revenue_potential NUMERIC,
  recommended_services TEXT[],
  review_summary TEXT,
  review_full_report JSONB,
  review_pdf_url TEXT,

  -- Delivery tracking
  review_sent_at TIMESTAMPTZ,
  review_discussed_at TIMESTAMPTZ,
  call_scheduled_at TIMESTAMPTZ
);

-- ─── PROPOSALS ──────────────────────────────────────────────
-- Service proposals generated from audit findings
CREATE TABLE IF NOT EXISTS proposals (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  lead_id BIGINT REFERENCES leads(id),
  audit_id BIGINT REFERENCES audits(id),
  lead_email TEXT NOT NULL,
  status TEXT DEFAULT 'draft',

  -- Proposal details
  title TEXT NOT NULL,
  services JSONB NOT NULL,
  total_value NUMERIC NOT NULL,
  payment_structure JSONB NOT NULL,
  scope_of_work TEXT,
  timeline_weeks INTEGER,
  valid_until TIMESTAMPTZ,

  -- Acceptance
  accepted_at TIMESTAMPTZ,
  accepted_signature TEXT,
  accepted_ip TEXT,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT
);

-- ─── INVOICES ───────────────────────────────────────────────
-- Individual invoices (milestone-based or monthly)
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  invoice_number TEXT NOT NULL UNIQUE,
  lead_id BIGINT REFERENCES leads(id),
  proposal_id BIGINT REFERENCES proposals(id),
  lead_email TEXT NOT NULL,
  status TEXT DEFAULT 'draft',

  -- Invoice details
  title TEXT NOT NULL,
  line_items JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  due_date TIMESTAMPTZ,
  notes TEXT,

  -- Payment type
  payment_type TEXT DEFAULT 'milestone',
  milestone_name TEXT,
  milestone_number INTEGER,
  is_deposit BOOLEAN DEFAULT FALSE,

  -- Payment tracking
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,

  -- Work gate: services CANNOT start until this is paid
  work_authorized BOOLEAN DEFAULT FALSE,
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ
);

-- ─── PAYMENTS ───────────────────────────────────────────────
-- Payment transaction log
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  invoice_id BIGINT REFERENCES invoices(id),
  lead_id BIGINT REFERENCES leads(id),
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  receipt_url TEXT,
  failure_reason TEXT
);

-- ─── SUBSCRIPTIONS ──────────────────────────────────────────
-- Monthly recurring services (Thermal Intelligence Platform)
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  lead_id BIGINT REFERENCES leads(id),
  lead_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  service_name TEXT NOT NULL,
  monthly_amount NUMERIC NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ
);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anon key full access (tighten with service_role later)
CREATE POLICY "anon_leads" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_conversations" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_audits" ON audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_proposals" ON proposals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_subscriptions" ON subscriptions FOR ALL USING (true) WITH CHECK (true);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(lead_email);
CREATE INDEX IF NOT EXISTS idx_audits_lead ON audits(lead_email);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_email);
CREATE INDEX IF NOT EXISTS idx_invoices_lead ON invoices(lead_email);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_lead ON subscriptions(lead_email);

-- ============================================================
-- DONE! Full sales pipeline: lead → audit → proposal → invoice → payment
-- ============================================================
