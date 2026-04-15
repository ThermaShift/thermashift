// ThermaShift Social Media Auto-Poster — Configuration
// Required packages: dotenv
// Install: npm install dotenv

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

export const platforms = {
  linkedin: {
    enabled: !!process.env.LINKEDIN_ACCESS_TOKEN,
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN || '',
    refreshToken: process.env.LINKEDIN_REFRESH_TOKEN || '',
    clientId: process.env.LINKEDIN_CLIENT_ID || '',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
    organizationId: process.env.LINKEDIN_ORGANIZATION_ID || '',
    memberId: process.env.LINKEDIN_MEMBER_ID || '',
    // 'personal' posts from Steve's profile; 'organization' posts from company page
    postingMode: process.env.LINKEDIN_ORGANIZATION_ID ? 'organization' : 'personal',
    apiVersion: '202401',
    baseUrl: 'https://api.linkedin.com/v2',
    restBaseUrl: 'https://api.linkedin.com/rest',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    characterLimit: 3000,
  },

  twitter: {
    enabled: !!process.env.TWITTER_API_KEY,
    apiKey: process.env.TWITTER_API_KEY || '',
    apiSecret: process.env.TWITTER_API_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
    bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    baseUrl: 'https://api.twitter.com/2',
    characterLimit: 280,
  },

  reddit: {
    enabled: !!process.env.REDDIT_CLIENT_ID,
    clientId: process.env.REDDIT_CLIENT_ID || '',
    clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
    username: process.env.REDDIT_USERNAME || '',
    password: process.env.REDDIT_PASSWORD || '',
    userAgent: process.env.REDDIT_USER_AGENT || 'ThermaShift:v1.0.0 (by /u/ThermaShift)',
    baseUrl: 'https://oauth.reddit.com',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    targetSubreddits: ['datacenter', 'sysadmin', 'sustainability', 'HVAC'],
  },

  facebook: {
    enabled: !!process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
    pageId: process.env.FACEBOOK_PAGE_ID || '',
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    baseUrl: 'https://graph.facebook.com/v19.0',
    characterLimit: 63206,
  },

  bluesky: {
    enabled: !!process.env.BLUESKY_IDENTIFIER,
    identifier: process.env.BLUESKY_IDENTIFIER || '',
    password: process.env.BLUESKY_APP_PASSWORD || '',
    service: process.env.BLUESKY_SERVICE || 'https://bsky.social',
    characterLimit: 300,
  },
};

export const schedule = {
  linkedin: {
    days: [1, 2, 3, 4],     // Monday, Tuesday, Wednesday, Thursday (0=Sun)
    times: ['09:00'],        // 9 AM EST
    timezone: 'America/New_York',
    cron: '0 9 * * 1,2,3,4',
  },
  twitter: {
    days: [0, 1, 2, 3, 4, 5, 6], // Daily
    times: ['08:00', '12:00', '17:00'],
    timezone: 'America/New_York',
    cron: ['0 8 * * *', '0 12 * * *', '0 17 * * *'],
  },
  reddit: {
    days: [1, 3, 5],         // Mon, Wed, Fri
    times: ['10:00'],
    timezone: 'America/New_York',
    cron: '0 10 * * 1,3,5',
  },
  facebook: {
    days: [1, 3, 5],         // Mon, Wed, Fri
    times: ['09:00'],
    timezone: 'America/New_York',
    cron: '0 9 * * 1,3,5',
  },
  bluesky: {
    days: [0, 1, 2, 3, 4, 5, 6], // Daily
    times: ['09:00'],
    timezone: 'America/New_York',
    cron: '0 9 * * *',
  },
};

export const logging = {
  dir: new URL('./logs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
  level: process.env.LOG_LEVEL || 'info',
};

export const contentTracking = {
  filePath: new URL('./content/tracking.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
};

export default { platforms, schedule, logging, contentTracking };
