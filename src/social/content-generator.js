// ThermaShift -- Content Generation and Rotation Module
// No external dependencies (uses native fs)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './logger.js';

const log = createLogger('content-generator');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_FILE = path.join(__dirname, 'content', 'posts.json');
const TRACKING_FILE = path.join(__dirname, 'content', 'tracking.json');

// Topic categories aligned with ThermaShift's 4 service lines
const CATEGORIES = [
  'liquid_cooling',
  'waste_heat_recovery',
  'esg_compliance',
  'pue_optimization',
  'ai_infrastructure',
];

/**
 * Load all posts from the content library.
 * @returns {Array} Array of post objects.
 */
export function loadPosts() {
  try {
    const raw = fs.readFileSync(POSTS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    log.error('Failed to load posts.json:', err.message);
    return [];
  }
}

/**
 * Save the posts array back to disk.
 * @param {Array} posts
 */
function savePosts(posts) {
  try {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
  } catch (err) {
    log.error('Failed to save posts.json:', err.message);
  }
}

/**
 * Check if a post has been used by a specific platform.
 * Supports both old format (used: true/false) and new format (usedBy: []).
 */
function isUsedByPlatform(post, platform) {
  if (Array.isArray(post.usedBy)) {
    return post.usedBy.includes(platform);
  }
  // Legacy fallback: old "used" boolean means used by all platforms
  return post.used === true;
}

/**
 * Mark a post as used by a specific platform.
 */
function markUsedByPlatform(posts, postId, platform) {
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx === -1) return;

  // Migrate from old format if needed
  if (!Array.isArray(posts[idx].usedBy)) {
    posts[idx].usedBy = [];
    delete posts[idx].used;
  }

  if (!posts[idx].usedBy.includes(platform)) {
    posts[idx].usedBy.push(platform);
  }
  savePosts(posts);
}

/**
 * Load posting history / tracking data.
 * @returns {object} Tracking data with platform histories.
 */
export function loadTracking() {
  try {
    if (fs.existsSync(TRACKING_FILE)) {
      return JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
    }
  } catch (err) {
    log.warn('Failed to load tracking.json, starting fresh:', err.message);
  }
  return {
    lastPosted: {},        // { platform: { postId, timestamp } }
    history: [],           // [{ postId, platform, timestamp }]
    categoryRotation: {},  // { platform: lastCategoryIndex }
  };
}

/**
 * Save tracking data to disk.
 * @param {object} tracking
 */
function saveTracking(tracking) {
  try {
    const dir = path.dirname(TRACKING_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TRACKING_FILE, JSON.stringify(tracking, null, 2), 'utf8');
  } catch (err) {
    log.error('Failed to save tracking.json:', err.message);
  }
}

/**
 * Get the next post for a given platform, using per-platform tracking
 * and category rotation to ensure diverse topic coverage.
 *
 * Each platform tracks usage independently — a post used on LinkedIn
 * can still be posted to Bluesky and Facebook.
 *
 * @param {string} platform - Platform name (linkedin, twitter, reddit, facebook, bluesky).
 * @returns {object|null} The selected post object, or null if no posts available.
 */
export async function getNextPost(platform) {
  const posts = loadPosts();
  if (posts.length === 0) {
    log.error('No posts found in content library.');
    return null;
  }

  const tracking = loadTracking();
  const catIndex = tracking.categoryRotation[platform] ?? -1;
  const nextCatIndex = (catIndex + 1) % CATEGORIES.length;
  const targetCategory = CATEGORIES[nextCatIndex];

  // Try to find a post not yet used by this platform in the target category
  let selected = posts.find((p) => !isUsedByPlatform(p, platform) && p.category === targetCategory);

  // If none in target category, try any post not used by this platform
  if (!selected) {
    selected = posts.find((p) => !isUsedByPlatform(p, platform));
  }

  // If all posts used by this platform, try to generate fresh content
  if (!selected) {
    log.info(`All posts used by ${platform}. Generating fresh content with Claude API...`);
    try {
      const newPosts = await generateFreshPosts(5);
      if (newPosts.length > 0) {
        posts.push(...newPosts);
        savePosts(posts);
        log.info(`Generated ${newPosts.length} new posts via Claude API.`);
        selected = newPosts.find((p) => p.category === targetCategory) || newPosts[0];
      }
    } catch (err) {
      log.warn(`Claude API generation failed: ${err.message}. Resetting ${platform} usage.`);
    }

    // Fallback: reset this platform's usage and start over
    if (!selected) {
      posts.forEach((p) => {
        if (Array.isArray(p.usedBy)) {
          p.usedBy = p.usedBy.filter((pl) => pl !== platform);
        } else {
          p.used = false;
        }
      });
      savePosts(posts);
      selected = posts.find((p) => p.category === targetCategory) || posts[0];
    }
  }

  // Mark as used by this platform
  markUsedByPlatform(posts, selected.id, platform);

  // Update tracking
  tracking.categoryRotation[platform] = nextCatIndex;
  tracking.lastPosted[platform] = {
    postId: selected.id,
    timestamp: new Date().toISOString(),
  };
  tracking.history.push({
    postId: selected.id,
    platform,
    timestamp: new Date().toISOString(),
  });

  // Keep history at a manageable size (last 500 entries)
  if (tracking.history.length > 500) {
    tracking.history = tracking.history.slice(-500);
  }

  saveTracking(tracking);
  log.info(`Selected post "${selected.id}" (${selected.category}) for ${platform}`);
  return selected;
}

/**
 * Get the platform-specific text from a post object.
 * @param {object} post - Post object from the content library.
 * @param {string} platform - Platform name.
 * @returns {object} Object with the appropriate text fields for the platform.
 */
export function getContentForPlatform(post, platform) {
  switch (platform) {
    case 'linkedin':
      return { text: post.linkedin_text };
    case 'twitter':
      return { text: post.twitter_text };
    case 'reddit':
      return { title: post.reddit_title, body: post.reddit_body };
    case 'facebook':
      return { text: post.facebook_text };
    case 'bluesky':
      return { text: post.bluesky_text };
    default:
      log.warn(`Unknown platform: ${platform}`);
      return { text: post.linkedin_text };
  }
}

/**
 * Get a summary of content library status.
 * Now shows per-platform availability.
 * @returns {object} Summary with total and per-platform unused counts.
 */
export function getLibraryStatus() {
  const posts = loadPosts();
  const activePlatforms = ['linkedin', 'bluesky', 'facebook'];

  const status = {
    total: posts.length,
    byPlatform: {},
    byCategory: {},
  };

  for (const platform of activePlatforms) {
    const unused = posts.filter((p) => !isUsedByPlatform(p, platform)).length;
    status.byPlatform[platform] = { total: posts.length, unused };
  }

  for (const cat of CATEGORIES) {
    const catPosts = posts.filter((p) => p.category === cat);
    status.byCategory[cat] = { total: catPosts.length };
  }

  // Legacy compat
  status.used = posts.filter((p) => p.used === true || (Array.isArray(p.usedBy) && p.usedBy.length > 0)).length;
  status.unused = posts.length - status.used;

  return status;
}

/**
 * Reset all posts to unused state for a specific platform, or all platforms.
 * @param {string} [platform] - Platform to reset. If omitted, resets all.
 */
export function resetAllPosts(platform) {
  const posts = loadPosts();
  posts.forEach((p) => {
    if (platform) {
      if (Array.isArray(p.usedBy)) {
        p.usedBy = p.usedBy.filter((pl) => pl !== platform);
      }
    } else {
      p.usedBy = [];
      delete p.used;
    }
  });
  savePosts(posts);
  const scope = platform || 'all platforms';
  log.info(`Reset ${posts.length} posts for ${scope}.`);
}

/**
 * List all available post IDs and their status.
 * @returns {Array} Array of { id, topic, category, usedBy }.
 */
export function listPosts() {
  const posts = loadPosts();
  return posts.map((p) => ({
    id: p.id,
    topic: p.topic,
    category: p.category,
    usedBy: Array.isArray(p.usedBy) ? p.usedBy : (p.used ? ['all'] : []),
  }));
}

/**
 * Generate fresh posts using the Claude API.
 * Called automatically when the content library is exhausted for a platform.
 * @param {number} count - Number of posts to generate.
 * @returns {Array} Array of new post objects.
 */
async function generateFreshPosts(count = 5) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — cannot auto-generate content');
  }

  const posts = loadPosts();
  const maxNum = posts.reduce((max, p) => {
    const match = p.id.match(/-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);

  const prompt = `You are the content strategist for ThermaShift, a data center cooling optimization and waste heat recovery consulting firm.

Services: (1) Liquid cooling design & optimization, (2) Waste heat recovery & monetization, (3) AI-driven thermal intelligence monitoring, (4) ESG compliance & sustainability consulting.

Audience: Data center facility managers, VP of Operations at colocation providers, sustainability officers, CTOs at hyperscale operators.

Generate exactly 5 social media posts as a JSON array. Each post must have:
- "id": use format "{category_abbrev}-{number}" starting from ${maxNum + 1}. Category abbreviations: lc, whr, esg, pue, ai
- "topic": short topic name
- "category": one of: liquid_cooling, waste_heat_recovery, esg_compliance, pue_optimization, ai_infrastructure (rotate evenly)
- "linkedin_text": 150-250 words, professional, insightful, real stats. End with a CTA: "Book a free cooling efficiency review at https://thermashift.net/contact" (vary the CTA wording). Include 3-5 hashtags at the end.
- "twitter_text": under 280 chars total (including CTA "thermashift.net/contact" and hashtags). Punchy and direct.
- "reddit_title": discussion question format
- "reddit_body": genuine discussion starter, NO self-promotion, NO links, NO mention of ThermaShift
- "facebook_text": medium length, conversational, include CTA to thermashift.net/contact
- "bluesky_text": under 300 chars total (including CTA "thermashift.net/contact"). Direct and insightful.
- "usedBy": []

Rules:
- NO emojis anywhere
- Use real industry data and statistics
- Open LinkedIn posts with a hook (surprising stat, bold claim, or contrarian take)
- Every post must be genuinely insightful, not marketing fluff
- Rotate topics across all 5 categories

Return ONLY valid JSON array, no markdown fencing, no explanation.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data.content[0].text.trim();

  // Parse JSON, handling potential markdown fencing
  const jsonStr = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  const newPosts = JSON.parse(jsonStr);

  if (!Array.isArray(newPosts) || newPosts.length === 0) {
    throw new Error('Claude API returned invalid post format');
  }

  log.info(`Claude API generated ${newPosts.length} fresh posts.`);
  return newPosts;
}

/**
 * Proactively generate posts if library is running low for any active platform.
 * @param {number} threshold - Generate when any platform's unused posts drop below this.
 * @returns {number} Number of new posts generated (0 if not needed).
 */
export async function replenishIfLow(threshold = 10) {
  const status = getLibraryStatus();
  const lowestPlatform = Object.entries(status.byPlatform)
    .sort((a, b) => a[1].unused - b[1].unused)[0];

  if (!lowestPlatform || lowestPlatform[1].unused >= threshold) {
    log.info(`All platforms have ${lowestPlatform ? lowestPlatform[1].unused + '+' : 'enough'} unused posts. No replenishment needed.`);
    return 0;
  }

  log.info(`${lowestPlatform[0]} is low (${lowestPlatform[1].unused} unused). Generating fresh posts...`);
  let totalGenerated = 0;
  for (let batch = 0; batch < 2; batch++) {
    try {
      const newPosts = await generateFreshPosts(5);
      const posts = loadPosts();
      posts.push(...newPosts);
      savePosts(posts);
      totalGenerated += newPosts.length;
      log.info(`Batch ${batch + 1}: added ${newPosts.length} posts. Total: ${posts.length}`);
    } catch (err) {
      log.error(`Batch ${batch + 1} failed: ${err.message}`);
    }
  }
  if (totalGenerated > 0) {
    log.info(`Replenished library with ${totalGenerated} new posts.`);
  }
  return totalGenerated;
}

export default {
  loadPosts,
  loadTracking,
  getNextPost,
  getContentForPlatform,
  getLibraryStatus,
  resetAllPosts,
  listPosts,
  replenishIfLow,
  CATEGORIES,
};
