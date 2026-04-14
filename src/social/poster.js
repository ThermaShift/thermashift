#!/usr/bin/env node

// ThermaShift -- Main Social Media Poster / Orchestrator
// Required packages: dotenv (npm install dotenv)
//
// Usage:
//   node src/social/poster.js --platform=all
//   node src/social/poster.js --platform=linkedin,twitter
//   node src/social/poster.js --platform=linkedin --dry-run
//   node src/social/poster.js --status
//   node src/social/poster.js --reset
//   node src/social/poster.js --list

import { platforms } from './config.js';
import { createLogger } from './logger.js';
import {
  getNextPost,
  getContentForPlatform,
  getLibraryStatus,
  resetAllPosts,
  listPosts,
  replenishIfLow,
} from './content-generator.js';

// Platform modules -- dynamic imports to avoid loading unnecessary dependencies
const PLATFORM_MODULES = {
  linkedin: () => import('./platforms/linkedin.js'),
  twitter: () => import('./platforms/twitter.js'),
  reddit: () => import('./platforms/reddit.js'),
  facebook: () => import('./platforms/facebook.js'),
  bluesky: () => import('./platforms/bluesky.js'),
};

const ALL_PLATFORMS = Object.keys(PLATFORM_MODULES);
const log = createLogger('poster');

/**
 * Post content to a single platform.
 * @param {string} platformName - Platform identifier.
 * @param {object} [options] - Options: dryRun, postOverride.
 * @returns {object} Result object with success/failure info.
 */
async function postToPlatform(platformName, options = {}) {
  const { dryRun = false, postOverride = null } = options;
  const result = { platform: platformName, success: false, error: null, data: null };

  try {
    // Check if platform is configured
    const platformConfig = platforms[platformName];
    if (!platformConfig || !platformConfig.enabled) {
      result.error = `${platformName} is not enabled (missing API credentials in .env)`;
      log.warn(result.error);
      return result;
    }

    // Load the platform module
    const platformModule = await PLATFORM_MODULES[platformName]();

    // Validate configuration
    const validation = platformModule.validate();
    if (!validation.valid) {
      result.error = `${platformName} configuration invalid. Missing: ${validation.missing.join(', ')}`;
      log.error(result.error);
      return result;
    }

    // Get content
    const post = postOverride || await getNextPost(platformName);
    if (!post) {
      result.error = `No content available for ${platformName}`;
      log.error(result.error);
      return result;
    }

    const content = getContentForPlatform(post, platformName);

    // Dry run mode -- log but do not post
    if (dryRun) {
      log.info(`[DRY RUN] ${platformName} -- Post ID: ${post.id}`);
      if (platformName === 'reddit') {
        log.info(`[DRY RUN] Title: ${content.title}`);
        log.info(`[DRY RUN] Body: ${content.body.substring(0, 100)}...`);
      } else {
        log.info(`[DRY RUN] Text: ${content.text.substring(0, 100)}...`);
      }
      result.success = true;
      result.data = { postId: post.id, dryRun: true };
      return result;
    }

    // Post to the platform
    log.info(`Posting to ${platformName}... (Post ID: ${post.id})`);

    let apiResult;
    if (platformName === 'reddit') {
      apiResult = await platformModule.post(content.title, content.body);
    } else {
      apiResult = await platformModule.post(content.text);
    }

    result.success = true;
    result.data = { postId: post.id, ...apiResult };
    log.info(`Successfully posted to ${platformName}. Post ID: ${post.id}`);
  } catch (err) {
    result.error = err.message;
    log.error(`Failed to post to ${platformName}:`, err.message);
  }

  return result;
}

/**
 * Post content to multiple platforms.
 * Each platform is independent -- one failure does not stop others.
 * @param {string[]} platformNames - Array of platform names to post to.
 * @param {object} [options] - Options: dryRun.
 * @returns {object[]} Array of result objects.
 */
export async function postToAll(platformNames, options = {}) {
  const results = [];

  log.info(`Starting post run for platforms: ${platformNames.join(', ')}`);
  log.info(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Post to each platform sequentially to respect rate limits
  // and ensure content selection rotation works correctly
  for (const platformName of platformNames) {
    const result = await postToPlatform(platformName, options);
    results.push(result);

    // Small delay between platforms to be respectful of APIs
    if (!options.dryRun && platformNames.length > 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Summary
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  log.info(`Post run complete. Success: ${succeeded}, Failed: ${failed}`);

  if (failed > 0) {
    const failures = results
      .filter((r) => !r.success)
      .map((r) => `  ${r.platform}: ${r.error}`)
      .join('\n');
    log.warn(`Failed platforms:\n${failures}`);
  }

  return results;
}

/**
 * Parse command-line arguments.
 * @returns {object} Parsed options.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    platforms: [],
    dryRun: false,
    status: false,
    reset: false,
    list: false,
    replenish: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--status') {
      options.status = true;
    } else if (arg === '--reset') {
      options.reset = true;
    } else if (arg === '--list') {
      options.list = true;
    } else if (arg === '--replenish') {
      options.replenish = true;
    } else if (arg.startsWith('--platform=')) {
      const value = arg.split('=')[1];
      if (value === 'all') {
        options.platforms = ALL_PLATFORMS;
      } else {
        options.platforms = value.split(',').map((p) => p.trim().toLowerCase());
      }
    }
  }

  return options;
}

/**
 * Print usage information.
 */
function printHelp() {
  console.log(`
ThermaShift Social Media Auto-Poster
=====================================

Usage:
  node src/social/poster.js [options]

Options:
  --platform=<names>  Platforms to post to (comma-separated or "all")
                      Available: ${ALL_PLATFORMS.join(', ')}
  --dry-run           Preview what would be posted without actually posting
  --status            Show content library status
  --list              List all posts and their used/unused status
  --reset             Reset all posts to unused state
  --help, -h          Show this help message

Examples:
  node src/social/poster.js --platform=all
  node src/social/poster.js --platform=linkedin,twitter
  node src/social/poster.js --platform=all --dry-run
  node src/social/poster.js --status
  node src/social/poster.js --reset
`);
}

// CLI entry point
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.status) {
    const status = getLibraryStatus();
    console.log('\nContent Library Status');
    console.log('=====================');
    console.log(`Total posts: ${status.total}`);
    console.log('\nAvailable by platform:');
    for (const [plat, info] of Object.entries(status.byPlatform)) {
      console.log(`  ${plat}: ${info.unused}/${info.total} available`);
    }
    console.log('\nBy category:');
    for (const [cat, info] of Object.entries(status.byCategory)) {
      console.log(`  ${cat}: ${info.total} posts`);
    }
    process.exit(0);
  }

  if (options.list) {
    const posts = listPosts();
    console.log('\nContent Library Posts');
    console.log('====================');
    for (const p of posts) {
      const used = p.usedBy.length > 0 ? `[${p.usedBy.join(',')}]` : '[READY]';
      console.log(`${used.padEnd(30)} ${p.id} -- ${p.topic} (${p.category})`);
    }
    process.exit(0);
  }

  if (options.reset) {
    resetAllPosts();
    console.log('All posts have been reset to unused state.');
    process.exit(0);
  }

  if (options.replenish) {
    const count = await replenishIfLow(10);
    if (count > 0) {
      console.log(`Generated ${count} new posts via Claude API.`);
    } else {
      console.log('Library is well-stocked. No new posts needed.');
    }
    process.exit(0);
  }

  if (options.platforms.length === 0) {
    console.error('Error: No platform specified. Use --platform=all or --platform=linkedin,twitter');
    console.error('Run with --help for usage information.');
    process.exit(1);
  }

  // Validate platform names
  const invalid = options.platforms.filter((p) => !ALL_PLATFORMS.includes(p));
  if (invalid.length > 0) {
    console.error(`Error: Unknown platform(s): ${invalid.join(', ')}`);
    console.error(`Available platforms: ${ALL_PLATFORMS.join(', ')}`);
    process.exit(1);
  }

  const results = await postToAll(options.platforms, { dryRun: options.dryRun });

  // Exit with error code if any platform failed
  const anyFailed = results.some((r) => !r.success);
  process.exit(anyFailed ? 1 : 0);
}

// Run if executed directly
const isMain = process.argv[1] && (
  process.argv[1].endsWith('poster.js') ||
  process.argv[1].endsWith('poster')
);

if (isMain) {
  main().catch((err) => {
    log.error('Fatal error:', err.message);
    process.exit(1);
  });
}

export { postToPlatform };
export default { postToAll, postToPlatform };
