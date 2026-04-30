/**
 * ThermaShift AI Cooling Action Engine — Phase 7A (Pro tier)
 *
 * Lifecycle of a cooling action:
 *   1. AI proposes an action (tied to an incident or proactive)
 *      → row in cooling_actions, status='proposed', requires_permission resolved per rules
 *   2. If permission required: client approves or rejects in the dashboard
 *      If auto-approve rule matches: status auto-flips to 'approved'
 *   3. Approved action is executed: POST to client.action_webhook_url
 *      Response captured, before/after state recorded
 *   4. Every event written to cooling_action_audit (immutable trail)
 *
 * Action types (extensible):
 *   set_crac_fan_speed         — increase/decrease air handler fan
 *   set_chilled_water_setpoint — change chilled water temperature target
 *   set_pump_vfd_speed         — variable pump speed
 *   set_rdhx_flow              — rear-door heat exchanger flow
 *   request_chiller_stage_up   — bring additional chiller online
 *   enable_economizer          — switch to free-cooling mode
 *   request_human_intervention — escalate (catch-all)
 */

import crypto from 'crypto';

const ACTION_CATALOG = {
  set_crac_fan_speed: {
    label: 'Set CRAC fan speed',
    description: 'Adjust CRAC/CRAH fan speed (0-100% of max).',
    parameters: ['target_label', 'speed_percent'],
  },
  set_chilled_water_setpoint: {
    label: 'Set chilled water setpoint',
    description: 'Change chilled water supply temperature target.',
    parameters: ['target_label', 'setpoint_f'],
  },
  set_pump_vfd_speed: {
    label: 'Set pump VFD speed',
    description: 'Variable-frequency drive pump speed (0-100%).',
    parameters: ['target_label', 'speed_percent'],
  },
  set_rdhx_flow: {
    label: 'Set RDHX flow',
    description: 'Rear-door heat exchanger water flow rate.',
    parameters: ['target_label', 'flow_gpm'],
  },
  request_chiller_stage_up: {
    label: 'Request chiller stage-up',
    description: 'Bring an additional chiller online.',
    parameters: ['target_label'],
  },
  enable_economizer: {
    label: 'Enable economizer',
    description: 'Switch to free-cooling using outside air.',
    parameters: ['target_label'],
  },
  request_human_intervention: {
    label: 'Request human intervention',
    description: 'AI hands off to facility ops staff.',
    parameters: ['reason'],
  },
};

export function listActionTypes() { return ACTION_CATALOG; }

// ─── Audit log helper ───────────────────────────────────────

async function audit(sb, { client_id, cooling_action_id, event_type, actor, actor_ip, details, before_state, after_state }) {
  try {
    await sb('cooling_action_audit', 'POST', {
      client_id, cooling_action_id, event_type,
      actor: actor || 'system',
      actor_ip: actor_ip || null,
      details: details || null,
      before_state: before_state || null,
      after_state: after_state || null,
    });
  } catch (e) { console.error('audit log error:', e.message); }
}

// ─── Permission check ───────────────────────────────────────

/**
 * Returns { auto_approve: bool, matched_rule_id: number|null }.
 * Permission rules are per (client, action_type, optional site). The most
 * specific match wins (site-scoped beats client-wide).
 */
async function evaluatePermission(sb, clientId, action) {
  const rules = await sb('cooling_action_permissions', 'GET', null,
    `?client_id=eq.${clientId}&action_type=eq.${encodeURIComponent(action.action_type)}&active=eq.true`);
  if (!rules?.length) return { auto_approve: false, matched_rule_id: null };

  // Prefer site-specific over client-wide
  const siteSpecific = rules.find(r => r.site_id && r.site_id === action.site_id);
  const clientWide = rules.find(r => !r.site_id);
  const rule = siteSpecific || clientWide;
  if (!rule) return { auto_approve: false, matched_rule_id: null };

  // Check parameter constraints if any (e.g., max speed_percent <= 95)
  if (rule.parameter_constraints && action.parameters) {
    for (const [k, max] of Object.entries(rule.parameter_constraints)) {
      const val = action.parameters[k];
      if (val != null && Number(val) > Number(max)) {
        return { auto_approve: false, matched_rule_id: rule.id, rejected_by_constraint: true };
      }
    }
  }
  return { auto_approve: !!rule.auto_approve, matched_rule_id: rule.id };
}

// ─── Propose an action ──────────────────────────────────────

/**
 * AI calls this to propose a cooling action. Determines if permission
 * is required based on client rules. Returns the cooling_action row.
 */
export async function proposeAction(sb, {
  client_id, site_id, incident_id, action_type, target_label, parameters, reasoning, proposed_by = 'ai',
}) {
  if (!ACTION_CATALOG[action_type]) throw new Error(`unknown_action_type: ${action_type}`);

  const perm = await evaluatePermission(sb, client_id, { action_type, site_id, parameters });
  const requires_permission = !perm.auto_approve;

  const expires_at = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // unapproved actions expire in 30 min

  const [action] = await sb('cooling_actions', 'POST', {
    client_id, site_id: site_id || null, incident_id: incident_id || null,
    action_type, target_label: target_label || null,
    parameters: parameters || {},
    reasoning: reasoning || null,
    proposed_by,
    status: requires_permission ? 'proposed' : 'approved',
    requires_permission,
    approved_by: requires_permission ? null : 'auto-approval rule',
    approved_at: requires_permission ? null : new Date().toISOString(),
    expires_at,
  });

  await audit(sb, {
    client_id, cooling_action_id: action.id,
    event_type: 'proposed', actor: proposed_by,
    details: { action_type, parameters, reasoning, auto_approved: !requires_permission, matched_rule_id: perm.matched_rule_id },
  });

  // If auto-approved, execute immediately
  if (!requires_permission) await executeAction(sb, action.id, { actor: 'auto-approval' });

  return action;
}

// ─── Approve / reject ───────────────────────────────────────

export async function approveAction(sb, actionId, { actor, actor_ip }) {
  const rows = await sb('cooling_actions', 'GET', null, `?id=eq.${actionId}&limit=1`);
  const action = rows?.[0];
  if (!action) throw new Error('action_not_found');
  if (action.status !== 'proposed') throw new Error(`cannot_approve_status_${action.status}`);
  if (action.expires_at && new Date(action.expires_at) < new Date()) throw new Error('action_expired');

  await sb('cooling_actions', 'PATCH',
    { status: 'approved', approved_by: actor, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    `?id=eq.${actionId}`);
  await audit(sb, {
    client_id: action.client_id, cooling_action_id: action.id,
    event_type: 'approved', actor, actor_ip,
  });

  return executeAction(sb, actionId, { actor, actor_ip });
}

export async function rejectAction(sb, actionId, { actor, actor_ip, reason }) {
  const rows = await sb('cooling_actions', 'GET', null, `?id=eq.${actionId}&limit=1`);
  const action = rows?.[0];
  if (!action) throw new Error('action_not_found');

  await sb('cooling_actions', 'PATCH',
    { status: 'rejected', rejected_by: actor, rejected_at: new Date().toISOString(),
      rejection_reason: reason || null, updated_at: new Date().toISOString() },
    `?id=eq.${actionId}`);
  await audit(sb, {
    client_id: action.client_id, cooling_action_id: action.id,
    event_type: 'rejected', actor, actor_ip, details: { reason },
  });
  return { rejected: true };
}

// ─── Execute (POST to client webhook) ───────────────────────

export async function executeAction(sb, actionId, { actor, actor_ip }) {
  const rows = await sb('cooling_actions', 'GET', null, `?id=eq.${actionId}&limit=1`);
  const action = rows?.[0];
  if (!action) throw new Error('action_not_found');

  const clients = await sb('monitoring_clients', 'GET', null, `?id=eq.${action.client_id}&limit=1`);
  const client = clients?.[0];
  if (!client) throw new Error('client_not_found');

  if (!client.actions_enabled || !client.action_webhook_url) {
    // No webhook configured — mark as approved-but-not-executed (recorded for compliance)
    await sb('cooling_actions', 'PATCH',
      { status: 'completed', error: 'no_webhook_configured', updated_at: new Date().toISOString() },
      `?id=eq.${actionId}`);
    await audit(sb, {
      client_id: action.client_id, cooling_action_id: action.id,
      event_type: 'execution_skipped', actor: actor || 'system',
      details: { reason: 'no webhook configured — action recorded but not dispatched' },
    });
    return { status: 'completed', dispatched: false, reason: 'no_webhook' };
  }

  const payload = {
    event: 'cooling_action_request',
    action_id: action.id,
    action_type: action.action_type,
    target_label: action.target_label,
    parameters: action.parameters,
    reasoning: action.reasoning,
    site_id: action.site_id,
    incident_id: action.incident_id,
    proposed_at: action.created_at,
    approved_at: action.approved_at,
    approved_by: action.approved_by,
  };

  // Sign the payload so the client can verify it came from us
  const headers = { 'Content-Type': 'application/json', 'X-ThermaShift-Action-Id': String(action.id) };
  if (client.action_webhook_secret) {
    const hmac = crypto.createHmac('sha256', client.action_webhook_secret);
    hmac.update(JSON.stringify(payload));
    headers['X-ThermaShift-Signature'] = `sha256=${hmac.digest('hex')}`;
  }

  let res, responseText, statusCode;
  try {
    res = await fetch(client.action_webhook_url, {
      method: 'POST', headers, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    statusCode = res.status;
    responseText = (await res.text()).slice(0, 2000);
  } catch (e) {
    await sb('cooling_actions', 'PATCH',
      { status: 'failed', error: e.message, updated_at: new Date().toISOString() },
      `?id=eq.${actionId}`);
    await audit(sb, {
      client_id: action.client_id, cooling_action_id: action.id,
      event_type: 'execution_failed', actor: actor || 'system',
      details: { error: e.message },
    });
    return { status: 'failed', error: e.message };
  }

  const success = res.ok;
  let parsedResponse = null;
  try { parsedResponse = JSON.parse(responseText); } catch { /* not JSON */ }

  await sb('cooling_actions', 'PATCH', {
    status: success ? 'completed' : 'failed',
    executed_at: new Date().toISOString(),
    webhook_status_code: statusCode,
    webhook_response: responseText,
    error: success ? null : `webhook returned ${statusCode}`,
    after_state: parsedResponse?.after_state || null,
    before_state: parsedResponse?.before_state || null,
    updated_at: new Date().toISOString(),
  }, `?id=eq.${actionId}`);

  await audit(sb, {
    client_id: action.client_id, cooling_action_id: action.id,
    event_type: success ? 'executed' : 'execution_failed',
    actor: actor || 'system', actor_ip,
    details: { webhook_status: statusCode, webhook_response_preview: responseText.slice(0, 500) },
    before_state: parsedResponse?.before_state || null,
    after_state: parsedResponse?.after_state || null,
  });

  return { status: success ? 'completed' : 'failed', http_status: statusCode };
}

// ─── Tier middleware helper ─────────────────────────────────

export const TIER_LEVELS = { watch: 1, guard: 2, pro: 3, enterprise: 4 };

export function requireTier(minTier) {
  return (req, res, next) => {
    const tier = req.client?.tier || 'watch';
    if ((TIER_LEVELS[tier] || 0) < TIER_LEVELS[minTier]) {
      return res.status(402).json({
        error: 'tier_upgrade_required',
        current_tier: tier,
        required_tier: minTier,
        message: `This feature requires ${minTier} tier or above. Upgrade at thermashift.net/pricing.`,
      });
    }
    next();
  };
}

// ─── Auto-cleanup expired proposals (cron) ──────────────────

export async function expireStaleActions(sb) {
  const now = new Date().toISOString();
  const stale = await sb('cooling_actions', 'GET', null,
    `?status=eq.proposed&expires_at=lt.${now}&limit=100`);
  if (!stale?.length) return { expired: 0 };
  for (const a of stale) {
    await sb('cooling_actions', 'PATCH',
      { status: 'expired', updated_at: new Date().toISOString() }, `?id=eq.${a.id}`);
    await audit(sb, {
      client_id: a.client_id, cooling_action_id: a.id,
      event_type: 'expired', actor: 'system',
      details: { reason: 'no approval received before expiry' },
    });
  }
  return { expired: stale.length };
}
