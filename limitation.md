# 📋 FormForge Production Limitations & Specifications

This document outlines the architectural limits, security rules (like IP blocking/rate limits), and configuration requirements for **FormForge** deployed in `formforge-prod`.

---

## 1. Security & Access Control

### 🔒 Single-Owner Registration Limit
* **Constraint:** Only **one admin/owner user** can register.
* **Mechanism:** Once the first user completes the registration at `/dashboard`, the sign-up endpoint automatically locks down. Any subsequent registration attempts will fail with a `REGISTRATION_DISABLED` error.

### 🛡️ IP-Based Rate Limiting (IP Blocking)
* **Mechanism:** FormForge tracks the client's IP address (using Cloudflare headers `cf-connecting-ip` or `x-forwarded-for`) to limit abuse.
* **Current Rules:**
  * **Registration (`/api/auth/register`):** Allowed up to **30 attempts per 60 seconds** (preventing lockouts during slow database migrations/initial setup).
  * **Login (`/api/auth/login`):** Prevents brute-force attacks by limiting consecutive attempts per IP.
  * **Form Submissions (`/api/submit`):** Spam protection restricts how many times a single IP can submit forms within a specific timeframe.

---

## 2. Infrastructure & Multi-Database Engine (Universal Zero-Card Free Tier)

FormForge v1.0.0 Universal dynamically detects and connects to any of the following databases on boot with zero configuration:

### 📊 Supported Database Capacity Matrix
* **Cloudflare D1:** 500MB storage, 5M reads/day, 100k writes/day (No credit card needed). With FormForge's automated transient payload pruning, a single submission takes only ~350–500 bytes, allowing over **1,000,000 submissions** within the 500MB free quota.
* **Neon Serverless Postgres:** 0.5GB storage, auto-scaling to zero, HTTP serverless connection (`NEON_DATABASE_URL` or `POSTGRES_URL`) (No credit card needed).
* **Turso (libSQL):** 5GB storage, 100 databases, libSQL HTTP/WebSocket connection (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`) (No credit card needed).
* **Local SQLite:** Unlimited local development file storage (`better-sqlite3`).
* **Self-Healing Auto-Migration:** Automatically detects SQLite vs PostgreSQL syntax and executes missing table/column DDL on application startup.

---

## 3. Integrations & Features

### 📧 Email Alerts & Free Push Relays
* **Google Apps Script (GAS) — Recommended for High Volume:** 500–1,500 100% free emails/day via personal Gmail + live Google Sheets logging (Zero card, zero cost). Executes via a single ~50ms HTTPS POST, completely immune to serverless TCP socket drops.
* **Telegram Bot:** Unlimited instant push notifications directly to mobile/desktop via Telegram Bot API (`telegramBotToken` + `telegramChatId`).
* **ntfy.sh:** Zero-account instant pub/sub mobile push notifications.
* **Direct API Integrations:** Resend, Brevo, SendGrid, Mailgun.
* **Custom SMTP Server:** 10+ providers with AES-256-GCM password encryption at rest.
  * *Serverless TCP Consideration:* Cloudflare Workers enforce socket concurrency and subrequest limits. High-concurrency traffic bursts over SMTP can occasionally face handshake delays (1.5–3.5s). For high-volume public endpoints, GAS or Webhook forwarders are strongly recommended.
* **⚡ Non-Blocking Background Sending:** Emails and Webhooks are sent asynchronously via Next.js / Cloudflare `waitUntil` background execution context so that submissions remain instant (~20ms) without blocking the client.

### 🤖 Proof of Work (Spam Protection)
* **Constraint:** When `altchaEnabled` is active on a form, the client browser solves a lightweight Proof-of-Work puzzle (taking ~100–300ms on modern devices) before submitting.
* **Impact:** Completely eliminates automated spam bots with zero cookies, zero third-party tracking, and 100% privacy compliance.

---

## 4. Benefit of `build-cf.js` (Wrapper Script)

The `build-cf.js` script was custom-created to act as an intelligent compile wrapper for Cloudflare Workers/Pages environment:

1. **Prevents Infinite Build Loops:**
   * Normally, setting `package.json` build command to OpenNext and wrangler's build command to `npm run build` triggers a circular loop where OpenNext calls the package manager build, which calls OpenNext again.
   * `build-cf.js` uses the environment variable `IN_OPEN_NEXT === 'true'` to detect the build phase. It runs standard `next build` if inside OpenNext, and `opennextjs-cloudflare build` if triggered by the outer deployment process, successfully breaking the cycle.

---

## 5. Added Features & Enhancements

The following custom features have been added to the production codebase:

### 🦆 In-Browser DuckDB Live SQL Query Studio
* **WebAssembly Execution:** Run analytical SQL queries on your submission data in real time directly inside the browser using DuckDB.
* **Export Presets:** One-click copy for DuckDB CLI commands, MotherDuck cloud queries, and custom SQL analytics.

### 🎈 Zero-Dependency Floating Embed Widget (`/widget.js`)
* **Ultra-Lightweight:** Less than `3KB` standalone script. Simply drop `<script src="https://your-domain.com/widget.js" data-form-id="..."></script>` into any website.
* **Glassmorphic Popup:** Provides an interactive floating bubble with responsive modal, honeypot bot trap, and AJAX submit handling.

### ⚡ Live Integration & Webhook Tester
* **Dashboard Testing:** Test Webhooks, Google Apps Script, Telegram Bot, and ntfy.sh directly from the Form Settings panel.
* **Latency & Status:** Displays real-time HTTP response status, latency in milliseconds, and headers.

### 🔍 Real-Time Submission Search & Status Filtering
* **Keyword Search:** Instant live filtering by submitter email, field name, or payload content.
* **Status Filtering:** One-click filter pills for `All`, `Inbox / Accepted`, `Spam`, and `Pending`.
* **Lifecycle Management:** Mark as Spam / Move to Inbox, single submission deletion, and bulk "Clear All Spam".

### 🔀 Dynamic HTML Form Redirects & Browser Thank-You Page
* **Zero-JS Support:** Full support for standard `<form action="..." method="POST">` submissions without JavaScript.
* **Dynamic Redirection:** Specify custom redirect destinations via hidden inputs `<input type="hidden" name="_next" value="https://mysite.com/thanks">`.
* **Glassmorphic Thank-You Page:** When submitted directly from a browser without a redirect URL, FormForge returns an elegant confirmation page with reference ID and back button.

### 📊 In-App Submissions Analytics
* **Dashboard Tab:** Accessible via the "Analytics" tab for each form.
* **Timeline Chart:** A scrollable HTML Bar Chart displaying the daily trend of accepted versus spam submissions over the last 30 days.
* **Aggregated Insights:** Detects and lists the **Top Referrer Sites** (which page the form was submitted from) and the **Top Submitter Emails** (most frequent users).

### 💬 Slack & Discord Auto-Webhook Formatting
* **Zero Configuration:** Simply input a standard Slack or Discord webhook URL into the "Webhook URL" field under Form Settings.
* **Auto-Formatting:** The notification handler automatically checks the URL pattern:
  * **Slack:** Formats submissions into beautiful Slack Blocks showing structured fields instead of raw JSON.
  * **Discord:** Formats submissions into rich Discord Embed fields with cyan borders and clear submitter metadata.

### 💻 Code Snippet Integration & Highlighting
* **Syntax Highlighting:** A custom lightweight CSS parser Highlights HTML, JavaScript, JSX, and Python syntax.
* **Available Snippets:** Includes copyable, live examples for:
  * **HTML Form** (with honeypot fields).
  * **JS Fetch API**.
  * **React Component** (with full state hooks).
  * **Python requests** script.

### ⏱️ Timezone & Creation Fixes
* **UTC Synchronization:** Fixes the timezone discrepancy where forms immediately displayed "Created 5 hours ago" due to the local client browser offset. Now displays local relative time correctly.

### 🛡️ Custom Spam Words Blocklist
* **Mechanism:** Add comma-separated keywords (e.g. `crypto`, `casino`, `viagra`) in the Form Settings.
* **Score Impact:** Any incoming submission containing any matching blocklisted words anywhere in the payload keys or values will have its spam score increased by `+100` and flagged as spam.

### 🛡️ ALTCHA Proof-of-Work Verification
* **Mechanism:** Enable ALTCHA in the form settings dashboard. ALTCHA uses silent in-browser cryptographic Proof-of-Work challenges to prevent bot spam without requiring external API keys or cookies.
* **Error Handling:** Failed solutions, tampered signatures, or expired challenges during ALTCHA validation will reject submissions with 400 Bad Request.

### 🔑 API Key Expiration & Security
* **Expiry Options:** API keys can be set to expire after `30`, `90`, `365` days, or `Never`.
* **Mechanism:** The authentication middleware checks the `expiresAt` timestamp against current server time and rejects requests made using expired keys with `401 Unauthorized`.

### 📅 Automatic Data Retention Purging
* **Retention Options:** Forms can be configured to retain submissions for `30`, `60`, `90` days, or `Keep Forever` (default).
* **Purge execution:** The purge operation runs in the background of incoming form submissions, automatically executing a SQLite deletion command `DELETE FROM submissions WHERE form_id = ? AND created_at < threshold` to delete outdated logs. This keeps your D1 usage within the free-tier storage limits (500MB) without requiring external cron setups.

### ✉️ Submitter Email Verification (Double Opt-in)
* **Flow:** Enable in form settings. Submissions are temporarily held in `pending` status. A transactional email verification link is sent automatically to the submitter. Clicking the link changes status to `accepted` and triggers Slack/Discord webhooks or email notifications.

### 🔍 Smart DNS MX Lookup Validation
* **Email Safety:** Automatically resolves and validates the domain name of submitters' emails using Cloudflare DNS over HTTPS. If the domain doesn't contain active Mail Exchange (MX) records, the submission is rejected instantly as spam/invalid.

### 📥 Multi-Format Data Exports
* **Export Options:** Download submissions directly from the dashboard top-bar Action Dropdown as CSV, JSON (fully parsed nested objects), readable TXT reports, or styled PDF Print Layouts.

### ✏️ Editable Form Slugs & Hard Deletion
* **Dashboard Control:** Form endpoints can be dynamically renamed with custom URL slugs. Forms can be hard-deleted directly to immediately wipe database records.

---

## v1.2.0 New Limitations

### 📁 File Upload Size Limits
* **Cloudflare Workers:** Maximum request body size is **100 MB** (Free plan). Files larger than this will be rejected.
* **R2/S3 Storage:** Limited by the provider's free tier (e.g. R2: 10 GB, Backblaze B2: 10 GB, Storj: 25 GB).

### 📧 Email Provider Fallback Chain
* **Priority Order:** Per-form SMTP → Resend API → Brevo API → SendGrid API → Mailgun API → Global SMTP env vars.
* **Limitation:** Only the first available provider in the chain is used. There is no retry across providers if one fails.

### 🔐 Owner-Only Mode
* **Constraint:** When `ALLOW_REGISTRATION=false`, the registration API is fully blocked. There is no invitation or invite-code system yet.
* **Future Roadmap:** TOTP-based 2FA and invite codes are planned for upcoming releases.

### 📄 OpenAPI Docs
* **Limitation:** The OpenAPI spec at `/api/openapi.json` is statically defined. It does not auto-discover custom form fields or dynamic endpoints.

---

> **FormForge** — Developed by [Sudhir Singh](https://github.com/SudhirDevOps1)  
> © 2024-2026 Sudhir Singh. All rights reserved.
