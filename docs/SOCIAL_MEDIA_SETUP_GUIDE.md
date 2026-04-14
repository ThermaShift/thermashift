# ThermaShift Social Media Auto-Posting System -- Setup Guide

## Platform Priority for B2B Data Center Consulting

### Tier 1 (Start Here)
1. **LinkedIn** -- Primary platform. Decision-makers in data center operations, facilities management, and enterprise IT are active here. Company pages build credibility. Highest conversion potential for consulting leads.
2. **Bluesky** -- Growing technical community. Easy API access (free, no approval process). Good for establishing presence early while the platform grows.

### Tier 2 (Add When Ready)
3. **Reddit** -- High engagement in relevant subreddits (r/datacenter, r/sysadmin). Posts must be genuinely useful, not promotional. Builds authority through discussion.
4. **X/Twitter** -- Industry news and quick insights. Useful for visibility but lower B2B conversion than LinkedIn.

### Tier 3 (Optional)
5. **Facebook** -- Lower priority for B2B technical consulting. Worth maintaining a presence but unlikely to drive direct leads.

---

## API Key Setup

### LinkedIn

1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Click "Create App"
3. Fill in:
   - App Name: ThermaShift
   - LinkedIn Page: (your company page)
   - App Logo: upload your logo
4. Under the "Auth" tab, note your **Client ID** and **Client Secret**
5. Under "Products," request access to:
   - **Share on LinkedIn** (for company page posting)
   - **Sign In with LinkedIn using OpenID Connect**
6. Set your redirect URL (e.g., `https://localhost:3000/callback`)
7. Generate an access token using the OAuth 2.0 flow:
   - Authorization URL: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT&scope=w_member_social%20w_organization_social`
   - Exchange the authorization code for tokens at: `https://www.linkedin.com/oauth/v2/accessToken`
8. Find your Organization ID:
   - Go to your LinkedIn company page
   - The URL contains the ID: `linkedin.com/company/12345678/`
9. Add to `.env`:
   ```
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   LINKEDIN_ACCESS_TOKEN=your_access_token
   LINKEDIN_REFRESH_TOKEN=your_refresh_token
   LINKEDIN_ORGANIZATION_ID=12345678
   ```

**Note:** LinkedIn access tokens expire after 60 days. The system handles automatic refresh if you provide a refresh token.

---

### X / Twitter

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Sign up for a developer account (Free tier available, but **Basic ($100/month) is required for posting via API**)
3. Create a Project and App
4. Under "Keys and Tokens," generate:
   - API Key and Secret (Consumer Keys)
   - Access Token and Secret (with Read and Write permissions)
   - Bearer Token
5. Under "User authentication settings":
   - Set App permissions to **Read and Write**
   - Set Type to **Web App**
   - Set Callback URL and Website URL
6. Add to `.env`:
   ```
   TWITTER_API_KEY=your_api_key
   TWITTER_API_SECRET=your_api_secret
   TWITTER_ACCESS_TOKEN=your_access_token
   TWITTER_ACCESS_SECRET=your_access_secret
   TWITTER_BEARER_TOKEN=your_bearer_token
   ```

**Cost:** Free tier allows read-only. Basic plan ($100/month) required for posting. Consider starting with other platforms if budget is a constraint.

---

### Reddit

1. Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps)
2. Click "create another app..."
3. Fill in:
   - Name: ThermaShift Content Bot
   - Type: **script** (for personal use)
   - Redirect URI: `http://localhost:8080` (not used for script type)
4. Note the **Client ID** (shown under the app name) and **Client Secret**
5. Add to `.env`:
   ```
   REDDIT_CLIENT_ID=your_client_id
   REDDIT_CLIENT_SECRET=your_client_secret
   REDDIT_USERNAME=your_reddit_username
   REDDIT_PASSWORD=your_reddit_password
   REDDIT_USER_AGENT=ThermaShift:v1.0.0 (by /u/your_username)
   ```

**Cost:** Free. Reddit API is free for script-type apps.

**Important:** Reddit has strict rules about self-promotion. The content in this system is written as discussion starters, not ads. Follow each subreddit's rules. A good ratio is 90% genuine engagement, 10% self-related posts.

---

### Facebook

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app (type: Business)
3. Add the **Pages** product
4. Under Settings > Basic, note your **App ID** and **App Secret**
5. Generate a Page Access Token:
   - Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   - Select your app
   - Add permission: `pages_manage_posts`
   - Generate User Token, then exchange for a Page Token
6. Convert to a long-lived token (60 days):
   ```
   GET https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN
   ```
7. Find your Page ID:
   - Go to your Facebook page > About > Page ID
8. Add to `.env`:
   ```
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   FACEBOOK_PAGE_ID=your_page_id
   FACEBOOK_PAGE_ACCESS_TOKEN=your_long_lived_page_token
   ```

**Cost:** Free. Facebook API is free for page management.

**Note:** Page tokens expire. You will need to regenerate them periodically (every 60 days for long-lived tokens).

---

### Bluesky

1. Go to [Bluesky App Passwords](https://bsky.app/settings/app-passwords)
2. Click "Add App Password"
3. Name it "ThermaShift Auto-Poster"
4. Copy the generated password
5. Add to `.env`:
   ```
   BLUESKY_IDENTIFIER=your-handle.bsky.social
   BLUESKY_APP_PASSWORD=your_app_password
   BLUESKY_SERVICE=https://bsky.social
   ```

**Cost:** Free. No developer application or approval process required. This is the easiest platform to set up.

---

## Installation

```bash
cd C:\Users\Home1\Documents\Thermashift

# Install required dependencies
npm install dotenv node-cron
```

No other packages are required. All platform modules use Node.js native `fetch` (available in Node.js 18+).

---

## Running the Auto-Poster

### Manual Posting (One-Time)

```bash
# Post to all configured platforms
node src/social/poster.js --platform=all

# Post to specific platforms
node src/social/poster.js --platform=linkedin,twitter

# Preview what would be posted (no actual API calls)
node src/social/poster.js --platform=all --dry-run

# Check content library status
node src/social/poster.js --status

# List all posts and their used/unused status
node src/social/poster.js --list

# Reset all posts to unused (start rotation over)
node src/social/poster.js --reset
```

### Automated Scheduling

**Option 1: Long-running process**
```bash
# Start the scheduler (runs continuously)
node src/social/scheduler.js

# The scheduler will post according to the configured schedule:
#   LinkedIn:   Tue, Thu at 9:00 AM EST
#   Twitter:    Daily at 8:00 AM, 12:00 PM, 5:00 PM EST
#   Reddit:     Mon, Wed, Fri at 10:00 AM EST
#   Facebook:   Mon, Wed, Fri at 9:00 AM EST
#   Bluesky:    Daily at 9:00 AM EST
```

**Option 2: System cron/Task Scheduler**

For Windows Task Scheduler, create a task that runs every hour:
```
Program: node
Arguments: C:\Users\Home1\Documents\Thermashift\src\social\scheduler.js --once
Start in: C:\Users\Home1\Documents\Thermashift
```

For Linux/macOS crontab:
```
0 * * * * cd /path/to/thermashift && node src/social/scheduler.js --once
```

The `--once` flag checks which platforms are due and posts only for those, then exits.

---

## Adding New Content

### Method 1: Edit posts.json directly

Open `src/social/content/posts.json` and add a new entry:

```json
{
  "id": "unique-id-here",
  "topic": "Post Topic Name",
  "category": "liquid_cooling",
  "linkedin_text": "Full LinkedIn post (150-250 words)...\n\n#DataCenter #ThermaShift",
  "twitter_text": "Short tweet under 280 chars. #DataCenter",
  "reddit_title": "Discussion question format?",
  "reddit_body": "Context and open-ended questions for discussion...",
  "facebook_text": "Medium-length conversational post...",
  "bluesky_text": "Under 300 chars. Punchy and direct. #DataCenter",
  "used": false
}
```

### Content Guidelines

**Categories** (aligned with ThermaShift's 4 service lines):
- `liquid_cooling` -- Direct-to-chip, immersion, RDHx, CDUs
- `waste_heat_recovery` -- Heat sales, district heating, agricultural uses
- `esg_compliance` -- Reporting, SBTi, carbon credits, regulations
- `pue_optimization` -- Airflow, economizers, VSDs, right-sizing
- `ai_infrastructure` -- GPU cooling, edge AI, capacity planning

**Platform formatting rules:**
- LinkedIn: 150-250 words, professional tone, include hashtags at the end
- Twitter: Under 280 characters, punchy, 2-3 hashtags
- Reddit: Title as a question, body provides context and asks for community input, no self-promotion
- Facebook: Medium length, conversational, 1-2 hashtags
- Bluesky: Under 300 characters, direct and informative, 2-3 hashtags

### Content Rotation

The system automatically rotates through categories to ensure diverse topic coverage. Each platform maintains its own rotation index. When all posts are used, the system resets and starts over.

Tracking data is stored in `src/social/content/tracking.json`.

---

## Cost Breakdown

| Platform | API Cost | Notes |
|----------|----------|-------|
| LinkedIn | Free | Free tier supports company page posting |
| Twitter | $100/month | Basic plan required for write access via API |
| Reddit | Free | Script-type apps have no cost |
| Facebook | Free | Page management API is free |
| Bluesky | Free | AT Protocol is fully open, no cost |

**Recommended starting budget: $0/month** -- Start with LinkedIn, Bluesky, and Reddit (all free), then add Twitter when budget allows.

---

## Content Strategy Tips

### For B2B Data Center Consulting

1. **Lead with value, not sales.** Every post should teach something. The content in this system is designed as industry insights, not advertisements.

2. **Use real numbers.** Data center operators respond to specific metrics (PUE values, cost savings, kW per rack). Vague claims get ignored.

3. **Engage with replies.** The auto-poster handles publishing, but you should personally respond to comments and questions. This is where leads are generated.

4. **LinkedIn is your primary channel.** Data center facility managers, enterprise IT directors, and sustainability officers are most active here. Prioritize LinkedIn content quality.

5. **Reddit requires authenticity.** The subreddits in this system (r/datacenter, r/sysadmin, r/sustainability, r/HVAC) are communities of practitioners. Posts must be genuine discussion contributions, not marketing. The Reddit content is formatted as questions and discussion starters for this reason.

6. **Consistency matters more than volume.** Posting 2-3 times per week consistently for 6 months beats posting daily for 2 weeks and then going silent.

7. **Track what works.** Monitor which posts get engagement and create more content in those topic areas. The tracking.json file records posting history for analysis.

### Posting Frequency Recommendations

| Platform | Frequency | Reasoning |
|----------|-----------|-----------|
| LinkedIn | 2x/week (Tue, Thu) | Quality over quantity; Tuesday and Thursday have highest B2B engagement |
| Twitter | 3x/day | High velocity platform; more frequent posting is expected |
| Reddit | 3x/week (Mon, Wed, Fri) | Moderate frequency; different subreddit each time |
| Facebook | 3x/week (Mon, Wed, Fri) | Lower priority; maintain presence without over-investing |
| Bluesky | 1x/day | Growing platform; daily presence builds following |

---

## Logs and Monitoring

Logs are written to `src/social/logs/` with daily rotation:
- File format: `social-YYYY-MM-DD.log`
- Console output mirrors file logs
- Log level controlled by `LOG_LEVEL` env variable (debug, info, warn, error)

---

## Troubleshooting

**"Platform is not configured"**
- Check that the required environment variables are set in `.env`
- Run `node src/social/poster.js --platform=linkedin --dry-run` to test without posting

**"Token expired"**
- LinkedIn: The system auto-refreshes tokens if a refresh token is provided
- Facebook: Regenerate the Page Access Token manually (every 60 days)
- Bluesky: App passwords do not expire; the system creates new sessions automatically

**"Reddit post rejected"**
- Check subreddit posting rules (some require minimum account age or karma)
- Ensure your account is not shadowbanned
- Some subreddits limit posting frequency

**"All posts have been used"**
- The system auto-resets and starts the rotation over
- Add new content to `posts.json` to keep posts fresh
- Run `node src/social/poster.js --reset` to manually reset
