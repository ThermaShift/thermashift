// ThermaShift — LinkedIn Platform Poster (API v2 / REST API)
// Supports both personal profile and company page posting.
// Required packages: none (uses native fetch)

import { platforms } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('linkedin');
const cfg = platforms.linkedin;

/**
 * Refresh the OAuth access token using the refresh token.
 * Returns the new access token and updates cfg in memory.
 */
async function refreshAccessToken() {
  log.info('Refreshing LinkedIn access token...');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: cfg.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  cfg.accessToken = data.access_token;
  if (data.refresh_token) {
    cfg.refreshToken = data.refresh_token;
  }
  log.info('LinkedIn access token refreshed successfully.');
  return cfg.accessToken;
}

/**
 * Get the author URN based on posting mode.
 * Personal profile uses 'urn:li:person:{sub}', company page uses 'urn:li:organization:{id}'.
 */
function getAuthorUrn() {
  if (cfg.postingMode === 'organization' && cfg.organizationId) {
    return `urn:li:organization:${cfg.organizationId}`;
  }
  return `urn:li:person:${cfg.memberId}`;
}

/**
 * Post content to LinkedIn (personal profile or company page).
 * @param {string} text — The post body text.
 * @param {object} [options] — Optional settings (retryOnAuth defaults true).
 * @returns {object} — API response data.
 */
export async function post(text, options = {}) {
  const { retryOnAuth = true } = options;

  if (!cfg.enabled) {
    throw new Error('LinkedIn is not configured. Set LINKEDIN_ACCESS_TOKEN in .env');
  }

  const author = getAuthorUrn();
  const mode = cfg.postingMode === 'organization' ? 'company page' : 'personal profile';
  log.info(`Posting to LinkedIn ${mode} (${author})...`);

  const payload = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const res = await fetch(`${cfg.baseUrl}/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': cfg.apiVersion,
    },
    body: JSON.stringify(payload),
  });

  // If 401 and we have a refresh token, try refreshing once
  if (res.status === 401 && retryOnAuth && cfg.refreshToken) {
    log.warn('LinkedIn token expired, attempting refresh...');
    await refreshAccessToken();
    return post(text, { retryOnAuth: false });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LinkedIn post failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  log.info(`LinkedIn post published successfully. ID: ${data.id}`);
  return { platform: 'linkedin', success: true, id: data.id };
}

/**
 * Validate that the LinkedIn configuration is usable.
 */
export function validate() {
  const missing = [];
  if (!cfg.accessToken) missing.push('LINKEDIN_ACCESS_TOKEN');
  if (cfg.postingMode === 'organization' && !cfg.organizationId) {
    missing.push('LINKEDIN_ORGANIZATION_ID');
  }
  if (cfg.postingMode === 'personal' && !cfg.memberId) {
    missing.push('LINKEDIN_MEMBER_ID');
  }
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  return { valid: true, missing: [] };
}

export default { post, validate, refreshAccessToken };
