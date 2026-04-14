// ThermaShift — Reddit Platform Poster (OAuth2)
// Required packages: none (uses native fetch)

import { platforms } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('reddit');
const cfg = platforms.reddit;

let accessToken = null;
let tokenExpiry = 0;

/**
 * Obtain a Reddit OAuth2 access token using script-type credentials.
 */
async function authenticate() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  log.info('Authenticating with Reddit...');

  const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const params = new URLSearchParams({
    grant_type: 'password',
    username: cfg.username,
    password: cfg.password,
  });

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': cfg.userAgent,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reddit auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 60s early
  log.info('Reddit authentication successful.');
  return accessToken;
}

/**
 * Get the next subreddit to post to, cycling through the list.
 * @param {number} [index] — Optional explicit index into the subreddit list.
 * @returns {string} — Subreddit name (without r/ prefix).
 */
function getNextSubreddit(index) {
  if (typeof index === 'number') {
    return cfg.targetSubreddits[index % cfg.targetSubreddits.length];
  }
  // Rotate based on day of year
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return cfg.targetSubreddits[dayOfYear % cfg.targetSubreddits.length];
}

/**
 * Post content to a Reddit subreddit as a self/text post.
 * @param {string} title — Post title.
 * @param {string} body — Post body text (markdown).
 * @param {object} [options] — Optional: subreddit, subredditIndex.
 * @returns {object} — Result data.
 */
export async function post(title, body, options = {}) {
  if (!cfg.enabled) {
    throw new Error('Reddit is not configured. Set REDDIT_CLIENT_ID in .env');
  }

  const token = await authenticate();
  const subreddit = options.subreddit || getNextSubreddit(options.subredditIndex);

  log.info(`Posting to r/${subreddit}: "${title}"`);

  const params = new URLSearchParams({
    sr: subreddit,
    kind: 'self',
    title,
    text: body,
    resubmit: 'true',
    send_replies: 'true',
  });

  const res = await fetch(`${cfg.baseUrl}/api/submit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': cfg.userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Reddit post failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();

  // Reddit returns errors in a nested structure
  if (data.json && data.json.errors && data.json.errors.length > 0) {
    const errors = data.json.errors.map((e) => e.join(': ')).join('; ');
    throw new Error(`Reddit post rejected: ${errors}`);
  }

  const postUrl = data.json?.data?.url || 'unknown';
  log.info(`Reddit post published to r/${subreddit}. URL: ${postUrl}`);

  return {
    platform: 'reddit',
    success: true,
    subreddit,
    url: postUrl,
    id: data.json?.data?.id,
  };
}

/**
 * Validate that the Reddit configuration is usable.
 */
export function validate() {
  const missing = [];
  if (!cfg.clientId) missing.push('REDDIT_CLIENT_ID');
  if (!cfg.clientSecret) missing.push('REDDIT_CLIENT_SECRET');
  if (!cfg.username) missing.push('REDDIT_USERNAME');
  if (!cfg.password) missing.push('REDDIT_PASSWORD');
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  return { valid: true, missing: [] };
}

export { getNextSubreddit };
export default { post, validate, getNextSubreddit };
