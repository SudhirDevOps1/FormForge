<h1 align="center">FormForge v2.0 Universal</h1>

<div align="center">
  A forever-free, open-source, universal form backend & analytics engine for static sites.
  <br />
  <strong>Deploys on Vercel, Netlify, Cloudflare Pages/Workers, and Docker with 100% Zero-Card Free Tier support.</strong>
  <br />
  <strong>Developed by <a href="https://github.com/SudhirDevOps1">Sudhir Singh</a></strong>
  <br /><br />
  🔓 <em>No paid database required.</em> 📀 <em>Own your data.</em> ⚡️ <em>Zero-card forever free.</em>
  <br /><br />
  <img src="https://img.shields.io/badge/Version-2.0.0%20Universal-blue?style=for-the-badge" alt="Version 2.0.0" />
  <img src="https://img.shields.io/badge/Platforms-Vercel%20%7C%20Netlify%20%7C%20Cloudflare-success?style=for-the-badge&logo=vercel&color=059669" alt="Platforms: Vercel | Netlify | Cloudflare" />
  <img src="https://img.shields.io/badge/Databases-Neon%20%7C%20D1%20%7C%20Turso%20%7C%20SQLite-blueviolet?style=for-the-badge" alt="Databases: Neon | D1 | Turso | SQLite" />
  <img src="https://img.shields.io/badge/Security%20Tests-53%2F53%20Passed-brightgreen?style=for-the-badge" alt="Security Tests: 53/53 Passed" />
</div>

<br />

> 🚀 **v2.0 Universal Status:** Fully tested across Vercel (`*.vercel.app`), Netlify (`*.netlify.app`), Cloudflare Pages (`*.pages.dev`), Cloudflare Workers (`*.workers.dev`), and local dev. Features include Multi-Database auto-migration (Neon Serverless Postgres, Cloudflare D1, Turso libSQL, SQLite), In-Browser DuckDB Live SQL Query Studio, Zero-Dependency Floating Embed Widget (`/widget.js`), Real-Time Integration & Webhook Tester with HMAC-SHA256 signatures, Free Notification Relays (Google Apps Script Gmail+Sheets, Telegram Bot, ntfy.sh), 6-digit OTP verification, Turnstile CAPTCHA, and Backblaze B2 S3 storage.

<div align="center">
  <img src="public/logo.svg" width="128" height="128" alt="FormForge logo" />
</div>

<br />

<div align="center">
  Perfect for <em>contact forms</em>, <em>feedback popups</em>, <em>waitlists</em>, <em>surveys</em>, <em>newsletter signups</em>, and <em>lead generation</em>.
</div>

<br />

<div align="center">

### 📖 Documentation & Guides

| 📂 File / Guide | 📝 Description |
| :--- | :--- |
| [🌟 Zero-Card Free Tier Mastery Guide](./docs/FREE_TIER_MASTERY_GUIDE.md) | Run 100% cardless on Vercel, Netlify, Cloudflare, Neon, Turso, GAS, B2. |
| [🛠️ Production Troubleshooting](./TROUBLESHOOTING.md) | Setup instructions, deployment loops, and error resolutions. |
| [🔒 System Limitations](./limitation.md) | Architectural constraints, IP rate limiting, and free-tier limits. |
| [🔧 Troubleshooting Notes](./troubleshooting1.md) | Additional debugging documentation and configuration details. |
| [📋 Feature Status & Security Audit](./fixed.md) | Full feature checklist, security score, and next-version roadmap. |
| [🛠️ Custom App/Game Integration](./INTEGRATION_GUIDE.md) | Connect HTML/JS static games (Chor-Sipahi), React apps, and bypass CORS. |
| [🔐 Privacy Policy](./privacypolicy.html) | Data handling, encryption, and privacy commitments. |

</div>

<br />

---

## ⚡ Deploy to Cloudflare in Seconds

Deploy your own serverless form backend in seconds - as easy as signing up for a commercial service:

<div align="center">

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/SudhirDevOps1/FormForge)

</div>

### How Deploy to Cloudflare Works

Here's what happens when you click the button:

1. Cloudflare creates a copy of this repository in your GitHub account.
2. You provide configuration options:
   - **Project name** (e.g., "formforge")
   - **Database name** (e.g., "formforge-db")
   - **AUTH_SECRET** (Generate a strong secret key using [jwtsecrets.com](https://jwtsecrets.com) or `openssl rand -hex 32` to sign authentication sessions).
3. Cloudflare builds and deploys FormForge directly into **your own Cloudflare account** (fully within Cloudflare's free tier).
4. You get a unique URL (e.g., `https://formforge.YOUR-SUBDOMAIN.workers.dev/dashboard`) to access your dashboard.

> **💡 Note:** `RESEND_API_KEY` and `RESEND_FROM` are optional secrets. Leave them blank if you don't need email notifications.

---

## Why FormForge?

FormForge is inspired by simplicity, but upgraded for a modern Cloudflare-native stack:

- **No DATABASE_URL build failure** — no PostgreSQL pool is initialized at build time.
- **Cloudflare D1 by default** — free-tier friendly SQLite database built into Workers.
- **OpenNext Next.js app** — deploys to Cloudflare Workers with `@opennextjs/cloudflare`.
- **Privacy first** — data stays in the deployer’s Cloudflare account; IP addresses are hashed per form.
- **No artificial SaaS limits** — your limits are your Cloudflare plan and D1 quotas.
- **Export anytime** — CSV export endpoint prevents vendor lock-in.

---

## 🌟 Key Features

- **🌐 Multi-Platform Deployment** — Deploy on Vercel (`*.vercel.app`), Netlify (`*.netlify.app`), Cloudflare Pages (`*.pages.dev`), Cloudflare Workers (`*.workers.dev`), or self-hosted Docker.
- **🗄️ Universal Multi-Database Engine** — Native support for Cloudflare D1, Neon Serverless Postgres, Turso (libSQL), and local file SQLite with automatic zero-downtime startup migration (`autoMigrate`).
- **🦆 In-Browser DuckDB Live SQL Query Studio** — Interactive SQL analytical engine running inside the browser with zero server compute and zero database costs. Includes 1-click execution, DuckDB CLI commands, and MotherDuck queries.
- **💬 Zero-Dependency Floating Embed Widget (`/widget.js`)** — Ultra-lightweight (<3KB) vanilla JS popup feedback & contact modal. Embed on any Webflow, WordPress, Shopify, Framer, Wix, or static site with a single `<script>` tag.
- **⚡ Live Integration & Webhook Tester** — Test outgoing webhooks (with HMAC-SHA256 signatures), Google Apps Script relays, Telegram Bot alerts, and ntfy.sh mobile push in real time directly from the dashboard.
- **📨 100% Free Notification Relays** — Google Apps Script (500–1,500 free emails/day via Gmail + auto Google Sheets row logging), Telegram Bot push notifications, and ntfy.sh instant mobile alerts without third-party subscriptions.
- **🔐 6-Digit Cryptographic OTP Verification** — Zero-cost submitter email verification via secure 6-digit one-time passcodes.
- **📁 Universal S3 / Backblaze B2 File Uploads** — 10GB free permanent storage with Backblaze B2 or Cloudflare R2 compatibility.
- **🛡️ Enterprise Spam & Abuse Defenses** — Cloudflare Turnstile CAPTCHA, Honeypot bot traps, custom keyword blocklists, DNS MX validation, and timing-safe authentication.
- **Multi-Format Data Exports** — Export submissions in CSV, JSON, and clean human-readable TXT reports.
- **Multi-Framework Code Generator** — Instant copy-paste snippets for Plain HTML, Floating Widget, React, Vanilla JS Fetch, Python Requests, and cURL.
- **Real Dashboard** at `/dashboard` — Manage forms, inspect submissions, view analytics, and generate API keys.

---

## 🛡️ Advanced Security & Premium Features

FormForge includes advanced security mechanisms out-of-the-box that are typically behind paid enterprise tiers in commercial form backends:

### 1. 🤖 Cloudflare Turnstile Verification
Integrate Cloudflare's non-intrusive Turnstile CAPTCHA to verify that submitters are human. Turnstile uses silent JavaScript challenges to stop bots without disrupting user experience.
* **Setup:** Obtain `Site Key` and `Secret Key` from the Cloudflare Turnstile dashboard. Save the secret key in the form settings dashboard, and add the public Turnstile widget snippet to your HTML frontend.

### 2. 📧 Custom Submitter Autoresponder
Automatically deliver structured, personalized emails to users immediately after they submit a form.
* **Dynamic Variables:** Draft your message template using `{curly_braces}` matching form fields (e.g. `Hi {name}, thank you for writing to us about {message}!`). The backend dynamically compiles and replaces these values on submission.

### 3. 🚫 Custom Spam Words Blocklist
Filter incoming payloads against a blacklist of forbidden keywords (e.g., `crypto`, `casino`, `free money`).
* **Enforcement:** Enter comma-separated keywords in the form's spam settings. Any submission containing these words in any field is flagged with `+100` spam score and blocked.

### 4. 🔑 API Key Expiration & Security
Generate secure API keys to read forms and submissions programmatically.
* **Safety:** Set expiration parameters (`30`, `90`, `365` days, or `Never`). The Cloudflare Worker validation layer rejects requests made using expired keys with `401 Unauthorized`.

### 5. 💬 10+ Auto-Formatting Webhooks
Delivers form notifications straight to your communications channels in rich visual styles:
* **Auto-format:** Paste your webhook URL. The backend automatically styles the payloads:
  * **Slack:** Rich formatting using Slack Blocks.
  * **Discord:** Beautiful color-bordered Discord Embed cards.
  * **Stoat.chat / Revolt:** Clean Markdown message content blocks.
  * **Microsoft Teams:** Office 365 Connector card format.
  * **Mattermost:** Structured Markdown headers and bullet lists.
  * **Generics (IFTTT, Zapier, Make, etc.):** Standard structured JSON payload is delivered.
* **Resilience:** Skip failures automatically so email notifications and DB writes are never blocked by a failing webhook.

### 6. 📧 Custom SMTP Server Integration (10+ Email Providers)
Configure custom SMTP credentials per form directly from the settings panel.
* **Gmail Auto-Config:** Entering a Gmail address auto-configures the host/port (`smtp.gmail.com:587`) and provides hints for setting up a 16-character Gmail App Password.
* **Supported Providers:** Gmail, Resend SMTP, Yahoo, Outlook, Mailjet, Brevo, SMTP2GO, SendGrid, Amazon SES, Mailgun, and Postmark.
* **🔒 AES-GCM Encrypted Passwords:** Passwords are fully encrypted in the D1 database and never sent to the client browser.
* **🧪 Test Settings Endpoint:** Includes a "Send test email" button to verify connection settings before saving.

### 6. 📅 Automatic Data Retention Purging
Automatically keep your Cloudflare D1 database storage usage clean and compliant by purging submissions older than a specific retention period.
* **Auto-Purge:** Set the retention limit per form (`30`, `60`, `90` days, or `Keep Forever`) in the General Settings. The backend automatically scans and deletes expired records for that form upon receiving new incoming submissions. Zero cron configuration is required.

### 7. ✉️ Submitter Email Verification (Double Opt-in)
Verify submitter email addresses before accepting submissions and dispatching webhook notifications.
* **Verification Flow:** Enable via form settings. When a submission is received, its status is set to `pending` and a unique verification link is sent to the submitter's email. Clicking the link updates the status to `accepted` and triggers webhook alerts.

---

## Tech Stack

- **Next.js 15.1.3 App Router** + **React 19**
- **Cloudflare Workers** via **OpenNext** (`@opennextjs/cloudflare`)
- **Cloudflare D1** using **Drizzle ORM** (`drizzle-orm/d1`)
- **Tailwind CSS**
- **Wrangler** for deploy and D1 migrations

---

## 🛠️ Manual Setup (Alternative)

If you prefer to set up manually instead of using the one-click button:

```bash
# 1. Clone & install
git clone https://github.com/SudhirDevOps1/FormForge.git
cd my-form
npm install

# 2. Login to Cloudflare
npx wrangler login

# 3. Auto setup (interactive — asks app name, db name, auth secret)
npm run setup

# OR do it manually:

# 3a. Create D1 database
npx wrangler d1 create formforge-db
# Copy the database_id and paste it in wrangler.jsonc

# 3b. Set AUTH_SECRET
npx wrangler secret put AUTH_SECRET
# Paste your generated secret

# 3c. Deploy
npm run deploy
```

---

## Environment Variables

### Required
| Variable | Description |
| --- | --- |
| `AUTH_SECRET` | Long random secret for HMAC session/API-key hashing. Generate with `openssl rand -hex 32`. |
| `DB` | Cloudflare D1 binding name. Configure as a D1 binding, not as a string secret. |

### Email Providers (Direct API — Pick One)
| Variable | Provider | Free Tier |
| --- | --- | --- |
| `RESEND_API_KEY` + `RESEND_FROM` | Resend | 100 emails/day |
| `BREVO_API_KEY` + `BREVO_FROM` | Brevo (Sendinblue) | 300 emails/day |
| `SENDGRID_API_KEY` + `SENDGRID_FROM` | SendGrid | 100 emails/day |
| `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` + `MAILGUN_FROM` | Mailgun | 5,000/month |

### SMTP Relay (Universal — For MailerLite, Mailchimp, Mailjet, Mailtrap, Loops, Notifuse, etc.)
| Variable | Description |
| --- | --- |
| `SMTP_ENABLED` | Set to `true` to enable global SMTP. |
| `SMTP_HOST` | SMTP host (e.g. `smtp.gmail.com`). |
| `SMTP_PORT` | SMTP port (e.g. `587`). |
| `SMTP_USER` | SMTP username. |
| `SMTP_PASS` | SMTP password (use wrangler secret). |
| `SMTP_FROM` | Sender email address. |

### File Storage (S3-Compatible — Backblaze B2, Wasabi, Storj, AWS S3, MinIO, etc.)
| Variable | Description |
| --- | --- |
| `S3_ENDPOINT` | S3-compatible endpoint URL (e.g. `https://s3.us-west-002.backblazeb2.com`). |
| `S3_ACCESS_KEY_ID` | S3 access key (use wrangler secret). |
| `S3_SECRET_ACCESS_KEY` | S3 secret key (use wrangler secret). |
| `S3_BUCKET_NAME` | Bucket name for file uploads. |
| `S3_REGION` | Region (default: `us-east-1`). |

### Security & Registration
| Variable | Description |
| --- | --- |
| `ALLOW_REGISTRATION` | Set to `false` to disable new user registration (owner-only mode). |

> **Note:** Cloudflare R2 can also be used by binding an R2 bucket as `FILES_BUCKET` in `wrangler.jsonc`.
> Do **not** set `DATABASE_URL`. FormForge uses Cloudflare D1 by default.

---

## API Examples

### Register owner

```bash
curl -X POST https://YOUR-WORKER.workers.dev/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","name":"Owner","password":"change-this-password"}'
```

### Create a form

```bash
curl -X POST https://YOUR-WORKER.workers.dev/api/forms \
  -H 'Content-Type: application/json' \
  -b cookies.txt -c cookies.txt \
  -d '{"name":"Contact","allowedOrigins":"https://example.com"}'
```

### Use in HTML

```html
<form method="POST" action="https://YOUR-WORKER.workers.dev/api/submit/endpoint_xxx">
  <input name="email" type="email" required />
  <textarea name="message" required></textarea>
  <input name="website" tabindex="-1" autocomplete="off" hidden />
  <button>Send</button>
</form>
```

### Use with fetch

```js
await fetch("https://YOUR-WORKER.workers.dev/api/submit/endpoint_xxx", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "hello@example.com", message: "Hi" }),
});
```

---

## 📊 Free Tier Quota & Safe Operations Guide ($0/mo)

FormForge is architected to run completely **free of cost** on the Cloudflare Free Plan. Below is the detailed breakdown of daily capacity, data limits, and recommendations to ensure your application remains stable and safe indefinitely:

### ⚙️ Cloudflare Free Tier Specifications

| Service | Free Tier Limit | Daily Safe Budget | What it Represents |
| --- | --- | --- | --- |
| **Cloudflare Workers** | 100,000 requests / day | ~90,000 submissions + API hits | Daily form submissions, webhook hits, and dashboard API queries. |
| **D1 DB Storage** | 500 MB / account | Keep Forever or Purge | Storage space for user logins, forms metadata, and submissions database. |
| **D1 DB Reads** | 5,000,000 reads / day | ~4,500,000 queries | Reads occurring when viewing submission analytics and dashboards. |
| **D1 DB Writes** | 100,000 writes / day | ~90,000 inserts | Database insertions occurring when a user submits a form. |

### 📈 Monthly Data Capacity Calculation

* **Submission Size:** A typical submission payload takes roughly **500 bytes to 1 KB** of storage space.
* **Storage Capacity:** A 500 MB database can safely store **500,000 submissions** simultaneously!
* **Auto-Purge Strategy:** By setting a **Data Retention Limit** (e.g. 30, 60, or 90 days) in your settings:
  - FormForge automatically deletes expired submissions in the background during new incoming submissions.
  - This keeps your database footprint tiny (< 50MB) and ensures you never hit the 500MB storage ceiling.

### 📧 Free Email Sending Daily Budget

Depending on your configured email integration, your daily outbound email capacity is:
* **Global Resend API (Free):** Up to **100 emails/day** (3,000/month).
* **Gmail SMTP (Free via App Password):** Up to **500 emails/day** (recommended for portfolio forms).
* **Brevo SMTP (Free):** Up to **300 emails/day** (9,000/month).
* **Mailjet SMTP (Free):** Up to **200 emails/day** (6,000/month).
* **SMTP2GO SMTP (Free):** Up to **200 emails/day** (1,000/month).

### 💬 Webhook Delivery
* Webhooks (Slack, Discord, Stoat.chat, MS Teams, Mattermost) are **100% free and unlimited**. They are only restricted by your daily 100k Worker requests limit.

---

## Production Checklist

- ✅ The `database_id` in `wrangler.jsonc` is blank on purpose — Cloudflare creates the D1 database for you on first deploy.
- ✅ Set a strong `AUTH_SECRET` in Cloudflare secrets.
- ✅ FormForge self-heals its schema on first request, so no manual migration step is required (SQL migrations are included as a backup).
- ⚠️ Set `allowedOrigins` for each form instead of `*` when possible.
- ⚠️ Keep email/webhook integrations disabled unless needed.
- 📋 Open `/dashboard` after deploy to create an owner account, forms, and view submissions.
- 📋 Export submissions periodically if your compliance policy requires offline backups.

---

## Troubleshooting

### `Network error. Is the Worker deployed and D1 bound?`
This means the frontend cannot reach the API.
1. **Worker not deployed** — Click the deploy button above or run `npm run deploy`.
2. **D1 database not created** — The deploy button creates it automatically. For manual setup, run `npx wrangler d1 create formforge-db` and add the `database_id` to `wrangler.jsonc`.
3. **AUTH_SECRET not set** — Run `npx wrangler secret put AUTH_SECRET` and paste your secret.

### `Error: DATABASE_URL is required`
This means old PostgreSQL code is still being imported. FormForge removes `pg`, uses `drizzle-orm/d1`, and exposes `getDb()` so database access happens only inside request handlers.

### D1 binding not found
Confirm the binding name is exactly `DB` in `wrangler.jsonc` and in the Cloudflare dashboard.

---

## License

MIT — © 2024-2026 [Sudhir Singh](https://github.com/SudhirDevOps1). All rights reserved.

---

<div align="center">
  <strong>FormForge</strong> — Privacy-first serverless form backend<br />
  Developed with ❤️ by <a href="https://github.com/SudhirDevOps1">Sudhir Singh</a><br /><br />
  <a href="https://github.com/SudhirDevOps1/FormForge">⭐ Star on GitHub</a> · <a href="https://sudhirdevops1.github.io/FormForge/">📖 Documentation</a> · <a href="https://github.com/SudhirDevOps1/FormForge/issues">🐛 Report Bug</a>
</div>

> **© 2024-2026 Sudhir Singh. All rights reserved.**  
> You are free to self-host, modify, and redistribute FormForge under the MIT license.  
> If you host or redistribute this application, please credit **Sudhir Singh** and link to the original repository: [github.com/SudhirDevOps1/FormForge](https://github.com/SudhirDevOps1/FormForge).
