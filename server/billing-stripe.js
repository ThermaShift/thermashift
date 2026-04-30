/**
 * ThermaShift Stripe Billing — Phase 5
 *
 * Subscription tiers map to Stripe Price IDs (created in Stripe dashboard):
 *   STRIPE_PRICE_WATCH       — Watch $99/mo
 *   STRIPE_PRICE_GUARD       — Guard $299/mo
 *   STRIPE_PRICE_PRO         — Pro $599/mo
 *   STRIPE_SECRET_KEY        — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET    — whsec_... for webhook signature verification
 *   STRIPE_BILLING_PORTAL_URL — optional, the configurable portal URL
 *
 * Endpoints (wired in chat-proxy.js):
 *   POST /api/billing/create-checkout — start a new subscription
 *   POST /api/billing/portal-session  — open the Stripe Customer Portal
 *   POST /api/webhooks/stripe-billing — Stripe sends subscription events here
 */

import Stripe from 'stripe';

const env = () => ({
  secret: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  prices: {
    watch: process.env.STRIPE_PRICE_WATCH,
    guard: process.env.STRIPE_PRICE_GUARD,
    pro: process.env.STRIPE_PRICE_PRO,
  },
});

let stripeClient = null;
function stripe() {
  const e = env();
  if (!e.secret) throw new Error('STRIPE_SECRET_KEY not configured');
  if (!stripeClient || stripeClient._key !== e.secret) {
    stripeClient = new Stripe(e.secret, { apiVersion: '2024-06-20' });
    stripeClient._key = e.secret;
  }
  return stripeClient;
}

// ─── Create checkout session for a new subscription ─────────

export async function createCheckoutSession(sb, { client_id, tier, success_url, cancel_url, customer_email }) {
  const e = env();
  const priceId = e.prices[tier];
  if (!priceId) throw new Error(`No Stripe price configured for tier ${tier}`);

  const clients = await sb('monitoring_clients', 'GET', null, `?id=eq.${client_id}&limit=1`);
  const client = clients?.[0];
  if (!client) throw new Error('client_not_found');

  let customerId = client.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: customer_email || client.billing_email || client.primary_contact_email,
      name: client.company,
      metadata: { client_id: String(client.id) },
    });
    customerId = customer.id;
    await sb('monitoring_clients', 'PATCH',
      { stripe_customer_id: customerId, updated_at: new Date().toISOString() },
      `?id=eq.${client.id}`);
  }

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { client_id: String(client.id), tier } },
    metadata: { client_id: String(client.id), tier },
    success_url: success_url || `https://thermashift.net/saas?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancel_url || `https://thermashift.net/saas?checkout=cancelled`,
    allow_promotion_codes: true,
  });

  return { url: session.url, session_id: session.id };
}

// ─── Customer Portal for upgrade/cancel/payment ────────────

export async function createPortalSession(sb, { client_id, return_url }) {
  const clients = await sb('monitoring_clients', 'GET', null, `?id=eq.${client_id}&limit=1`);
  const client = clients?.[0];
  if (!client?.stripe_customer_id) throw new Error('no_stripe_customer');

  const session = await stripe().billingPortal.sessions.create({
    customer: client.stripe_customer_id,
    return_url: return_url || 'https://thermashift.net/saas',
  });
  return { url: session.url };
}

// ─── Webhook handler ────────────────────────────────────────

const TIER_FROM_PRICE = (priceId) => {
  const e = env();
  if (priceId === e.prices.watch) return 'watch';
  if (priceId === e.prices.guard) return 'guard';
  if (priceId === e.prices.pro) return 'pro';
  return null;
};

export async function processStripeWebhook(sb, rawBody, signature) {
  const e = env();
  if (!e.secret) throw new Error('STRIPE_SECRET_KEY not configured');
  if (!e.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

  let event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, e.webhookSecret);
  } catch (err) {
    throw new Error(`signature_invalid: ${err.message}`);
  }

  // Idempotency: skip if we've seen this event_id
  const existing = await sb('stripe_events', 'GET', null,
    `?stripe_event_id=eq.${event.id}&limit=1`);
  if (existing?.[0]?.processed) return { idempotent: true, type: event.type };

  await sb('stripe_events', 'POST', {
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object,
    processed: false,
  });

  let result = {};
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const clientId = session.metadata?.client_id;
        if (clientId && session.subscription) {
          const sub = await stripe().subscriptions.retrieve(session.subscription);
          const tier = TIER_FROM_PRICE(sub.items.data[0]?.price.id) || session.metadata?.tier;
          await sb('monitoring_clients', 'PATCH', {
            tier,
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, `?id=eq.${clientId}`);
          result = { client_id: clientId, tier, status: sub.status };
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object;
        const clientId = sub.metadata?.client_id;
        if (clientId) {
          const tier = TIER_FROM_PRICE(sub.items.data[0]?.price.id);
          const patch = {
            subscription_status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (tier) patch.tier = tier;
          if (sub.status === 'active' || sub.status === 'trialing') patch.stripe_subscription_id = sub.id;
          await sb('monitoring_clients', 'PATCH', patch, `?id=eq.${clientId}`);
          result = { client_id: clientId, status: sub.status, tier };
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const clientId = sub.metadata?.client_id;
        if (clientId) {
          await sb('monitoring_clients', 'PATCH', {
            tier: 'watch',
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString(),
          }, `?id=eq.${clientId}`);
          result = { client_id: clientId, downgraded_to: 'watch' };
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.customer) {
          const rows = await sb('monitoring_clients', 'GET', null,
            `?stripe_customer_id=eq.${invoice.customer}&limit=1`);
          if (rows?.[0]) {
            await sb('monitoring_clients', 'PATCH',
              { subscription_status: 'past_due', updated_at: new Date().toISOString() },
              `?id=eq.${rows[0].id}`);
          }
        }
        break;
      }
      default:
        result = { ignored_type: event.type };
    }
  } catch (err) {
    await sb('stripe_events', 'PATCH', { error: err.message }, `?stripe_event_id=eq.${event.id}`);
    throw err;
  }

  await sb('stripe_events', 'PATCH', { processed: true }, `?stripe_event_id=eq.${event.id}`);
  return { type: event.type, ...result };
}

export function isStripeConfigured() {
  const e = env();
  return !!(e.secret && e.prices.watch && e.prices.guard && e.prices.pro);
}
