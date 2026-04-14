// ThermaShift — Bluesky Poster (AT Protocol / atproto)
// Required packages: none (uses native fetch)

import { platforms } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('bluesky');
const cfg = platforms.bluesky;

let session = null;

/**
 * Create or refresh a Bluesky session.
 */
async function createSession() {
  if (session && session.accessJwt) {
    // Try to use existing session; if it fails we will re-auth
    return session;
  }

  log.info('Creating Bluesky session...');

  const res = await fetch(`${cfg.service}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: cfg.identifier,
      password: cfg.password,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bluesky auth failed (${res.status}): ${body}`);
  }

  session = await res.json();
  log.info(`Bluesky session created for ${session.handle}`);
  return session;
}

/**
 * Parse hashtags from text and create AT Protocol facets.
 * Facets enable rich-text features like clickable hashtags.
 * @param {string} text — Post text.
 * @returns {Array} — Array of facet objects.
 */
function parseHashtagFacets(text) {
  const facets = [];
  const encoder = new TextEncoder();

  // Match hashtags: # followed by word characters
  const hashtagRegex = /#(\w+)/g;
  let match;

  while ((match = hashtagRegex.exec(text)) !== null) {
    const hashtag = match[0];
    const tag = match[1];

    // AT Protocol uses byte offsets, not character offsets
    const beforeBytes = encoder.encode(text.slice(0, match.index)).byteLength;
    const hashtagBytes = encoder.encode(hashtag).byteLength;

    facets.push({
      index: {
        byteStart: beforeBytes,
        byteEnd: beforeBytes + hashtagBytes,
      },
      features: [
        {
          $type: 'app.bsky.richtext.facet#tag',
          tag,
        },
      ],
    });
  }

  return facets;
}

/**
 * Parse URLs from text and create link facets.
 * @param {string} text — Post text.
 * @returns {Array} — Array of facet objects.
 */
function parseLinkFacets(text) {
  const facets = [];
  const encoder = new TextEncoder();
  const urlRegex = /https?:\/\/[^\s)]+/g;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const beforeBytes = encoder.encode(text.slice(0, match.index)).byteLength;
    const urlBytes = encoder.encode(url).byteLength;

    facets.push({
      index: {
        byteStart: beforeBytes,
        byteEnd: beforeBytes + urlBytes,
      },
      features: [
        {
          $type: 'app.bsky.richtext.facet#link',
          uri: url,
        },
      ],
    });
  }

  return facets;
}

/**
 * Post content to Bluesky.
 * @param {string} text — Post text (max 300 chars).
 * @param {object} [options] — Optional: retryOnAuth (default true).
 * @returns {object} — Result data.
 */
export async function post(text, options = {}) {
  const { retryOnAuth = true } = options;

  if (!cfg.enabled) {
    throw new Error('Bluesky is not configured. Set BLUESKY_IDENTIFIER in .env');
  }

  const sess = await createSession();
  const facets = [...parseHashtagFacets(text), ...parseLinkFacets(text)];

  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
  };

  if (facets.length > 0) {
    record.facets = facets;
  }

  const res = await fetch(`${cfg.service}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sess.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: sess.did,
      collection: 'app.bsky.feed.post',
      record,
    }),
  });

  // If auth expired, reset session and retry once
  if ((res.status === 401 || res.status === 400) && retryOnAuth) {
    log.warn('Bluesky session expired, re-authenticating...');
    session = null;
    return post(text, { retryOnAuth: false });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bluesky post failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  log.info(`Bluesky post published. URI: ${data.uri}`);

  return {
    platform: 'bluesky',
    success: true,
    uri: data.uri,
    cid: data.cid,
  };
}

/**
 * Validate that the Bluesky configuration is usable.
 */
export function validate() {
  const missing = [];
  if (!cfg.identifier) missing.push('BLUESKY_IDENTIFIER');
  if (!cfg.password) missing.push('BLUESKY_APP_PASSWORD');
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  return { valid: true, missing: [] };
}

export default { post, validate };
