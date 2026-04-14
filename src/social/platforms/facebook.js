// ThermaShift — Facebook Page Poster (Graph API v19.0)
// Required packages: none (uses native fetch)

import { platforms } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('facebook');
const cfg = platforms.facebook;

/**
 * Post content to the Facebook page.
 * @param {string} message — The post text.
 * @returns {object} — Result with post ID.
 */
export async function post(message) {
  if (!cfg.enabled) {
    throw new Error('Facebook is not configured. Set FACEBOOK_PAGE_ACCESS_TOKEN in .env');
  }

  const url = `${cfg.baseUrl}/${cfg.pageId}/feed`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      access_token: cfg.pageAccessToken,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();

    // Handle expired token specifically
    if (res.status === 190 || (errBody.includes('OAuthException') && errBody.includes('expired'))) {
      throw new Error(
        'Facebook page access token has expired. Generate a new long-lived token. ' +
        `Details: ${errBody}`
      );
    }

    throw new Error(`Facebook post failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  log.info(`Facebook post published. ID: ${data.id}`);

  return {
    platform: 'facebook',
    success: true,
    id: data.id,
  };
}

/**
 * Validate that the Facebook configuration is usable.
 */
export function validate() {
  const missing = [];
  if (!cfg.pageAccessToken) missing.push('FACEBOOK_PAGE_ACCESS_TOKEN');
  if (!cfg.pageId) missing.push('FACEBOOK_PAGE_ID');
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  return { valid: true, missing: [] };
}

export default { post, validate };
