#!/usr/bin/env node

// ThermaShift -- Social Media Scheduler
// Required packages: node-cron (npm install node-cron)
//
// Usage:
//   node src/social/scheduler.js           # Run as long-running process
//   node src/social/scheduler.js --once    # Run all due jobs once and exit
//
// For cron-based execution (alternative to long-running process),
// add to system crontab:
//   * * * * * cd /path/to/thermashift && node src/social/scheduler.js --once

import cron from 'node-cron';
import { schedule, platforms } from './config.js';
import { createLogger } from './logger.js';
import { postToAll } from './poster.js';
import { replenishIfLow } from './content-generator.js';

const log = createLogger('scheduler');

/**
 * Check if a platform is enabled (has credentials configured).
 * @param {string} platformName
 * @returns {boolean}
 */
function isPlatformEnabled(platformName) {
  return platforms[platformName]?.enabled === true;
}

/**
 * Create a scheduled job for a platform.
 * @param {string} platformName - Platform to schedule.
 * @param {string} cronExpression - Cron expression for scheduling.
 * @param {object} options - Scheduling options.
 * @returns {object|null} The cron job, or null if platform is not enabled.
 */
function createJob(platformName, cronExpression, options = {}) {
  if (!isPlatformEnabled(platformName)) {
    log.warn(`Skipping ${platformName} -- not configured (missing API credentials).`);
    return null;
  }

  const timezone = schedule[platformName]?.timezone || 'America/New_York';

  const job = cron.schedule(
    cronExpression,
    async () => {
      log.info(`Scheduled job triggered for ${platformName}`);
      try {
        const results = await postToAll([platformName]);
        const result = results[0];
        if (result.success) {
          log.info(`Scheduled post to ${platformName} succeeded. Post: ${result.data?.postId}`);
        } else {
          log.error(`Scheduled post to ${platformName} failed: ${result.error}`);
        }
      } catch (err) {
        log.error(`Scheduler error for ${platformName}:`, err.message);
      }
    },
    {
      timezone,
      scheduled: true,
      ...options,
    }
  );

  log.info(`Scheduled ${platformName}: "${cronExpression}" (${timezone})`);
  return job;
}

/**
 * Start all scheduled jobs as a long-running process.
 */
function startScheduler() {
  log.info('=== ThermaShift Social Media Scheduler Starting ===');
  log.info(`Timestamp: ${new Date().toISOString()}`);

  const jobs = [];

  // LinkedIn: Tue/Thu 9AM EST
  const linkedinJob = createJob('linkedin', schedule.linkedin.cron);
  if (linkedinJob) jobs.push({ name: 'linkedin', job: linkedinJob });

  // Twitter: Daily 8AM, 12PM, 5PM EST (three separate schedules)
  const twitterCrons = Array.isArray(schedule.twitter.cron)
    ? schedule.twitter.cron
    : [schedule.twitter.cron];
  for (const cronExpr of twitterCrons) {
    const twitterJob = createJob('twitter', cronExpr);
    if (twitterJob) jobs.push({ name: `twitter (${cronExpr})`, job: twitterJob });
  }

  // Reddit: Mon/Wed/Fri 10AM EST
  const redditJob = createJob('reddit', schedule.reddit.cron);
  if (redditJob) jobs.push({ name: 'reddit', job: redditJob });

  // Facebook: Mon/Wed/Fri 9AM EST
  const facebookJob = createJob('facebook', schedule.facebook.cron);
  if (facebookJob) jobs.push({ name: 'facebook', job: facebookJob });

  // Bluesky: Daily 9AM EST
  const blueskyJob = createJob('bluesky', schedule.bluesky.cron);
  if (blueskyJob) jobs.push({ name: 'bluesky', job: blueskyJob });

  if (jobs.length === 0) {
    log.error('No platforms are configured. Set API credentials in .env file.');
    log.error('See .env.example for required environment variables.');
    process.exit(1);
  }

  log.info(`${jobs.length} scheduled job(s) active.`);
  log.info('Scheduler is running. Press Ctrl+C to stop.');

  // Print schedule summary
  console.log('\n  Active Schedule');
  console.log('  ===============');
  if (isPlatformEnabled('linkedin')) {
    console.log('  LinkedIn:   Mon, Tue, Wed, Thu at 9:00 AM EST');
  }
  if (isPlatformEnabled('twitter')) {
    console.log('  Twitter:    Daily at 8:00 AM, 12:00 PM, 5:00 PM EST');
  }
  if (isPlatformEnabled('reddit')) {
    console.log('  Reddit:     Mon, Wed, Fri at 10:00 AM EST');
  }
  if (isPlatformEnabled('facebook')) {
    console.log('  Facebook:   Mon, Wed, Fri at 9:00 AM EST');
  }
  if (isPlatformEnabled('bluesky')) {
    console.log('  Bluesky:    Daily at 9:00 AM EST');
  }
  console.log('');

  // Weekly content replenishment — Sundays at 8AM EST
  const replenishJob = cron.schedule('0 8 * * 0', async () => {
    log.info('Running weekly content replenishment check...');
    try {
      const count = await replenishIfLow(10);
      if (count > 0) {
        log.info(`Replenished ${count} new posts via Claude API.`);
      }
    } catch (err) {
      log.error('Content replenishment failed:', err.message);
    }
  }, { timezone: 'America/New_York', scheduled: true });
  jobs.push({ name: 'content-replenish', job: replenishJob });
  log.info('Scheduled content replenishment: Sundays at 8:00 AM EST');

  // Graceful shutdown
  const shutdown = () => {
    log.info('Scheduler shutting down...');
    for (const { name, job } of jobs) {
      job.stop();
      log.info(`Stopped job: ${name}`);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process alive
  setInterval(() => {
    log.debug('Scheduler heartbeat -- still running.');
  }, 3600000); // Log heartbeat every hour
}

/**
 * Run all currently due jobs once and exit.
 * Useful for crontab-based execution instead of a long-running process.
 */
async function runOnce() {
  log.info('Running one-time scheduled check...');

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const hour = now.getHours();
  const currentTime = `${String(hour).padStart(2, '0')}:00`;

  const platformsToPost = [];

  for (const [platformName, sched] of Object.entries(schedule)) {
    if (!isPlatformEnabled(platformName)) continue;

    const isDayMatch = sched.days.includes(dayOfWeek);
    const isTimeMatch = sched.times.includes(currentTime);

    if (isDayMatch && isTimeMatch) {
      platformsToPost.push(platformName);
    }
  }

  if (platformsToPost.length === 0) {
    log.info('No platforms are due for posting at this time.');
    return;
  }

  log.info(`Platforms due: ${platformsToPost.join(', ')}`);
  const results = await postToAll(platformsToPost);

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  log.info(`One-time run complete. Success: ${succeeded}, Failed: ${failed}`);
}

// CLI entry point
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
ThermaShift Social Media Scheduler
====================================

Usage:
  node src/social/scheduler.js           Start as a long-running process
  node src/social/scheduler.js --once    Run due jobs once and exit
  node src/social/scheduler.js --help    Show this help message

Schedule:
  LinkedIn:   Monday-Thursday at 9:00 AM EST
  Twitter:    Daily at 8:00 AM, 12:00 PM, 5:00 PM EST
  Reddit:     Monday, Wednesday, Friday at 10:00 AM EST
  Facebook:   Monday, Wednesday, Friday at 9:00 AM EST
  Bluesky:    Daily at 9:00 AM EST

Environment:
  Requires API credentials in .env file. See .env.example.
`);
  process.exit(0);
}

if (args.includes('--once')) {
  runOnce()
    .then(() => process.exit(0))
    .catch((err) => {
      log.error('Fatal error in one-time run:', err.message);
      process.exit(1);
    });
} else {
  startScheduler();
}

export { startScheduler, runOnce };
export default { startScheduler, runOnce };
