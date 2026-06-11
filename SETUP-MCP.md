# Claude Code MCP Setup for ThermaShift

This is a one-time setup that lives in `~/.claude/settings.json` on your
Windows machine — not in the repo. After this is wired, every Claude Code
session you run can do things directly that currently require workflow
round-trips: render the marketing site in a real browser, query Supabase
without curl, run e2e tests interactively.

**Goal:** add two MCP servers — Playwright + Supabase. Skip the others
(Context7, GitHub, Sentry) until there's a concrete pain point they solve.

---

## Why these two specifically

| MCP | What it unlocks for ThermaShift | Audit gap closed |
|---|---|---|
| **Playwright** | Render the site in a real browser, click buttons, verify routes/CSS/anchors. Future Claude sessions can author + run the e2e tests in `tests/e2e/`. | "If you can't test the UI, say so explicitly rather than claiming success." |
| **Supabase** | Query the DB by table without building curls. Inspect schemas before writing migrations. Faster, safer than the manual curl-with-anon-key pattern we've been using. | Manual REST queries scattered through every cleanup/diagnostic workflow. |

What we're **not** adding:
- **Context7** (framework docs) — defer until you hit an outdated-API hallucination
- **GitHub** — the `gh` CLI already covers everything we use it for
- **Sentry** — premature; add after the first paying customer per the
  `feedback_revenue_milestone_triggers` rule

---

## Prerequisites

You need Node 20+ on your machine (you have it — that's what Claude Code
runs on). Beyond that:

- Claude Code CLI installed and working (you already use it)
- Your Supabase project URL + **anon key only** (NOT the service-role
  key — see safety note at the bottom)

---

## Step 1 — Add Playwright MCP

Open a terminal on Windows.

```powershell
# From any directory:
claude mcp add playwright -- npx @playwright/mcp@latest
```

That registers the Playwright MCP server with Claude Code. Verify it
loaded:

```powershell
# Inside a Claude Code session, type:
/mcp
```

You should see `playwright` in the list with status `connected`.

Quick test from a Claude Code session in the ThermaShift repo:

> "Use Playwright to open https://thermashift.net and tell me whether the
> footer links scroll to the service anchors."

If Claude reports back specific render details, the MCP is working.

---

## Step 2 — Add Supabase MCP

```powershell
claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest
```

After it's added, you need to give it credentials. Open
`~/.claude/settings.json` (on Windows that's
`C:\Users\Home1\.claude\settings.json`). Find the `supabase` entry under
`mcpServers` and add an `env` block:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_URL": "https://auqklthrpvsqyelfjood.supabase.co",
        "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4"
      }
    }
  }
}
```

The anon key above is the one already committed to the repo (used in
every workflow that queries Supabase). Restart Claude Code, then verify
with `/mcp` again.

Quick test:

> "Use the Supabase MCP to count rows in `discovered_contacts` grouped
> by `status`."

That's the same query I've been running via curl through the whole
audit sprint. Through the MCP it's one tool call instead of three.

---

## Step 3 — Run the new e2e tests at least once locally

The project now has e2e test scaffolding (committed today). Confirm it
runs on your machine before relying on the CI:

```powershell
cd C:\Users\Home1\Documents\Thermashift
npm install                       # picks up the new @playwright/test dep
npm run test:e2e:install          # downloads Chromium browser (one-time)
npm run test:e2e                  # runs the suite — should pass green
```

If you want to author tests interactively:

```powershell
npm run test:e2e:ui
```

That opens Playwright's UI runner — click each test, watch it execute
in a real browser, record new tests by interacting with the page.

---

## Safety note — DO NOT use the Supabase service-role key

The MCP gives Claude a programmatic way to query and (if configured
with a write-capable key) mutate your database. **Use only the anon key
in `SUPABASE_ANON_KEY`.**

Why this matters: prompt injection is a real threat in MCP-enabled
sessions. If Claude reads any external content (a fetched URL, a tool
result, an email body, a webhook payload), a malicious string in that
content could trick Claude into running arbitrary SQL through the MCP.

With the anon key:
- Worst case: Claude reads/writes the same tables every public endpoint
  can already read/write through Supabase REST. No privilege
  escalation.
- The RLS policies on tables like `discovered_contacts` and
  `monitoring_*` already gate writes appropriately for this key.

With the service-role key:
- Worst case: Claude could be tricked into bypassing all RLS, dropping
  tables, deleting all customer data, exporting the full CRM. This is
  the same key the chat-proxy server uses for full backend access.
- A single prompt-injection through a tool result could be
  catastrophic.

If you ever genuinely need service-role access from a Claude Code
session (rare — usually you'd just SSH to the VPS and use the existing
service-role-enabled `chat-proxy.js` paths), do it one-off and rotate
the key after.

---

## Verifying the whole stack

After both MCPs are wired, in a fresh Claude Code session in the
ThermaShift repo, try:

> "Pull up the Saas dashboard at https://thermashift.net/saas?key=tsk_demo_9f42e3c62de1be877830fa37dab0f3f2
> using Playwright. Confirm the page renders without an error boundary.
> Then use the Supabase MCP to confirm the demo client's sensor count
> matches what the dashboard shows."

If Claude does both with a single tool round-trip each and reports a
specific number, the full loop is working.

---

## Troubleshooting

**`claude mcp add` fails on Windows**

The command launches `npx`. If you don't have Node in PATH for the
shell Claude Code uses, the MCP registers but fails to start. Confirm
`npx --version` works from a fresh PowerShell window.

**Playwright MCP installs but tests crash with "browser not found"**

Run `npm run test:e2e:install` once to download Chromium. That binary
is per-project; the MCP separately downloads its own copy when first
used.

**Supabase MCP shows "no auth"**

The `env` block needs to be inside the `supabase` entry of
`mcpServers`, not at the top level of `settings.json`. Also: restart
Claude Code completely (close and reopen) after editing the file —
hot-reload doesn't pick up MCP env changes.

**`/mcp` shows "connected" but tool calls 404**

The MCP server packages can change names. As of 2026-06-11 the
canonical packages were `@playwright/mcp` and
`@supabase/mcp-server-supabase`. If a future name change breaks
things, search npm for `playwright mcp` / `supabase mcp` and grab the
copy-paste command from the new package's README.

---

## What we get from this

In future sessions, the kinds of things that took minutes during the
2026-05-29 audit sprint become single-tool-call operations:

- "Render Home.jsx in a real browser and tell me whether the footer
  fix actually scrolls correctly." → Playwright MCP, one call.
- "How many contacts are in `pushed_to_brandjet` status right now?"
  → Supabase MCP, one call. (Was: write a curl with URL-encoded
  filter, run, parse JSON, count.)
- "Did my last commit accidentally break the ChatWidget?"
  → Playwright MCP renders the homepage, looks at the widget
  computed styles, reports. (Was: untestable without a manual browser
  check, which we never did.)

For the next phase of work (post-launch customer onboarding, dashboard
polish, AI advisor → proposeAction wiring) these tools meaningfully
change what's possible in a single Claude session.
