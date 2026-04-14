// ThermaShift — X/Twitter Platform Poster (API v2, OAuth 2.0)
// Required packages: none (uses native fetch + built-in crypto)

import crypto from 'node:crypto';
import { platforms } from '../config.js';
import { createLogger } from '../logger.js';

const log = createLogger('twitter');
const cfg = platforms.twitter;

/**
 * Generate OAuth 1.0a signature for Twitter API v2.
 * Twitter v2 still requires OAuth 1.0a User Context for posting tweets.
 */
function generateOAuthHeader(method, url, params = {}) {
  const oauthParams = {
    oauth_consumer_key: cfg.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: cfg.accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...params };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString),
  ].join('&');

  const signingKey = `${encodeURIComponent(cfg.apiSecret)}&${encodeURIComponent(cfg.accessSecret)}`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${header}`;
}

/**
 * Post a single tweet.
 * @param {string} text — Tweet text (max 280 chars).
 * @param {string|null} replyToId — If threading, the ID to reply to.
 * @returns {object} — Tweet data from API.
 */
async function postTweet(text, replyToId = null) {
  const url = `${cfg.baseUrl}/tweets`;
  const body = { text };

  if (replyToId) {
    body.reply = { in_reply_to_tweet_id: replyToId };
  }

  const authHeader = generateOAuthHeader('POST', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Twitter post failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.data;
}

/**
 * Split text into tweet-sized chunks for threading.
 * Splits on sentence boundaries when possible.
 */
function splitIntoThread(text, limit = 275) {
  if (text.length <= limit) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).trim().length > limit) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // Number the tweets if there are multiple
  if (chunks.length > 1) {
    return chunks.map((c, i) => `${i + 1}/${chunks.length} ${c}`);
  }
  return chunks;
}

/**
 * Post content to Twitter. Handles threading for long content.
 * @param {string} text — The content to post.
 * @returns {object} — Result with tweet IDs.
 */
export async function post(text) {
  if (!cfg.enabled) {
    throw new Error('Twitter is not configured. Set TWITTER_API_KEY in .env');
  }

  const chunks = splitIntoThread(text);
  const tweetIds = [];
  let lastId = null;

  for (const chunk of chunks) {
    const tweet = await postTweet(chunk, lastId);
    tweetIds.push(tweet.id);
    lastId = tweet.id;
    log.info(`Twitter tweet posted. ID: ${tweet.id}`);

    // Small delay between thread tweets to avoid rate limits
    if (chunks.length > 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return {
    platform: 'twitter',
    success: true,
    ids: tweetIds,
    threaded: chunks.length > 1,
  };
}

/**
 * Validate that the Twitter configuration is usable.
 */
export function validate() {
  const missing = [];
  if (!cfg.apiKey) missing.push('TWITTER_API_KEY');
  if (!cfg.apiSecret) missing.push('TWITTER_API_SECRET');
  if (!cfg.accessToken) missing.push('TWITTER_ACCESS_TOKEN');
  if (!cfg.accessSecret) missing.push('TWITTER_ACCESS_SECRET');
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  return { valid: true, missing: [] };
}

export default { post, validate };
