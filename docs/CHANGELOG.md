# Changelog

All notable changes to FormForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Release automation reads this file: [`release.yml`](../.github/workflows/release.yml)
extracts the section matching each `v*` tag to build the GitHub Release notes.

## [2.2.1] - 2026-09-08

### Added
- **Native In-App Confirmation Modal** — Replaced all native browser `window.confirm` alert dialogs with sleek, keyboard-accessible (`Escape`/`Enter`) dark glassmorphic confirmation modals for bulk deletion, single deletion, form pausing, and API key revocation.
- **In-Dashboard Interactive API Documentation Hub** — Added dedicated sub-navigation in *Connect & Snippets* with a **Live Endpoint Sandbox Tester** (real-time latency counter in ms and response payload inspector), comprehensive *When & Where to Use* guides, and complete parameter reference.
- **D1 Storage Payload Pruning** — Automatically strip transient anti-spam fields (`altcha`, `honeypotField`, PoW challenge tokens) prior to Cloudflare D1 insertion, reducing submission storage size by 40–60%.
- **Modern Kinetic F SVG Brand Assets** — Redesigned `logo.svg` and `favicon.svg` with a modern obsidian squircle, cyber shield watermark, and high-contrast kinetic F monogram.

## [2.2.0] - 2026-09-08

### Added
- **Native ALTCHA Proof-of-Work Anti-Spam** — 100% free, privacy-first, self-hosted anti-spam verification powered by native WebCrypto HMAC-SHA256 challenges.
- **Dedicated Challenge Endpoint (`/api/altcha/challenge`)** — CORS-enabled endpoint delivering cryptographically signed PoW challenges without external services or keys.
- **Zero-Dependency Anti-Spam UX** — Complete removal of third-party Cloudflare Turnstile in favor of zero cookies, GDPR-compliant Proof-of-Work.

## [2.1.0] - 2026-09-07

### Added
- **Submission Lifecycle Management Endpoints** — New `/api/submissions/[submissionId]` endpoint supporting `GET`, `DELETE` (with automatic form counter synchronization), and `PATCH` for instant status toggling (`accepted` <-> `spam`).
- **Real-Time Submission Search & Status Filtering** — Live search query parameter (`?q=...`) filtering across emails and payload fields, plus status filtering tabs (`all`, `inbox`, `spam`, `pending`).
- **Bulk Submission Deletion & Spam Cleaner** — `DELETE /api/forms/[formId]/submissions` supporting selective bulk deletion and single-click "Clear All Spam".
- **Dynamic Non-AJAX HTML Form Redirection** — Native support for `_next`, `_redirect`, and `next` hidden form fields with SSRF-safe redirect validation.
- **Glassmorphic Browser Thank-You Page** — Clean, responsive zero-JS confirmation screen rendered automatically for browser form submissions with submission reference IDs and back buttons.
- **Micro-Animations & Premium UI/UX Polish** — Added CSS `@keyframes` for `pulseGlow`, `floatAnimation`, `shimmerEffect`, and `scaleInModal` across the dashboard and home page.
- **Direct Submissions Export Toolbar** — 1-click CSV, JSON, and PDF/Print export triggers embedded directly into the Submissions table header.

## [2.0.0] - 2026-09-07

### Added
- **Multi-Database Universal Engine** — Seamless support for Neon Serverless Postgres (`@neondatabase/serverless` & `drizzle-orm/neon-http`), Cloudflare D1, Turso (libSQL), and local file SQLite. Automatic zero-downtime startup schema execution (`autoMigrate`) supporting both SQLite and PostgreSQL dialects.
- **In-Browser DuckDB Live SQL Query Studio** — Zero-cost client-side analytical SQL engine with 1-click execution over local datasets, DuckDB CLI query generator, and MotherDuck integration.
- **Zero-Dependency Floating Embed Widget (`/widget.js`)** — Ultra-lightweight (<3KB) embed script for WordPress, Webflow, Shopify, Framer, Wix, Astro, and static HTML websites.
- **Real-Time Integration & Webhook Tester (`/api/forms/[formId]/test-webhook`)** — 1-click delivery test and latency benchmark for Webhooks (with HMAC-SHA256 signatures), Google Apps Script (GAS), Telegram Bot, and ntfy.sh.
- **Zero-Card Free Tier Notifications** — Google Apps Script (GAS) Gmail relay (500–1,500 free emails/day + Google Sheets auto-logging), Telegram Bot instant mobile push alerts, and ntfy.sh topics.
- **6-Digit Cryptographic OTP Email Verification** — Instant 6-digit one-time passcode verification for form submitters.
- **Backblaze B2 S3 Storage** — 10GB permanent free cloud storage for file attachments.
- **Universal Subdomain Deployment** — Host-only cookies and universal CORS enabling cardless deployments on `*.vercel.app`, `*.netlify.app`, `*.pages.dev`, and `*.workers.dev`.

## [1.2.0] - 2026-07-14

### Added
- **4 Direct Email API Integrations** — Resend, Brevo (Sendinblue), SendGrid,
  and Mailgun with zero SMTP configuration.
- **10+ SMTP Relay Support** — Gmail, Yahoo, Outlook, MailerLite, Mailchimp,
  Mailjet, Mailtrap, SMTP2GO, Loops, Notifuse, Postmark.
- **S3-Compatible File Uploads** — Backblaze B2, Wasabi, Storj, AWS S3, MinIO,
  IDrive e2, Tencent COS, Garage, RustFS.
- **Cloudflare R2 Integration** — Optional R2 bucket binding for file uploads.
- **Secure File Download API** — Authenticated proxy endpoint at
  `/api/submissions/{id}/files/{name}`.
- **Owner-Only Registration Mode** — `ALLOW_REGISTRATION=false` blocks all new signups.
- **OpenAPI v3 Documentation** — Full API spec at `/api/openapi.json`.
- **Feedback Form Template** — Glassmorphism dark UI with star ratings
  (4th dashboard template).
- **Public Stats API** — Anonymous aggregate counts at `/api/public-stats`.
- **Enhanced SEO** — Canonical URL, Twitter cards, richer JSON-LD schema with
  `featureList` and `softwareVersion`.

### Changed
- `CloudflareEnv` type expanded with 25+ fields (all email, storage, and
  registration variables).
- `getRuntimeEnv()` now resolves all new variables from Cloudflare context
  with `process.env` fallback.
- `wrangler.jsonc` updated with `ALLOW_REGISTRATION` var and optional
  `r2_buckets` binding.
- `package.json` cloudflare section updated with all env vars and secrets.
- `notifications.ts` expanded with Brevo, SendGrid, Mailgun API delivery
  across all three flows (owner alerts, autoresponder, email verification).
- `README.md` fully updated with v1.2.0 features, new badges, environment
  variable tables, and copyright footer.
- `fixed.md` completely rewritten with full feature matrix and security
  score (95/100).

### Security
- SQL injection protection via Drizzle ORM parameterized queries (no raw SQL).
- AES-GCM encryption for SMTP passwords and Turnstile secrets at rest.
- PBKDF2 (100,000 iterations) for password hashing.
- HMAC-signed API keys and session tokens.
- SSRF prevention (private IP ranges blocked for webhooks).

## [1.1.0] - 2026-07-08

### Added
- Cloudflare Turnstile CAPTCHA integration.
- Proof of Work (PoW) spam protection.
- Custom spam word blocklists.
- DNS MX record validation via DNS-over-HTTPS.
- IP-based rate limiting (D1 sliding window).
- Submitter email verification (double opt-in).
- Data retention auto-purge.
- 10+ webhook channels (Slack, Discord, MS Teams, Mattermost, etc.).
- Custom SMTP server per form with AES-GCM encrypted passwords.
- Interactive analytics dashboard with timeline charts.
- Multi-format export (CSV, JSON, TXT, PDF).

## [1.0.0] - 2026-07-06

### Added
- Initial release.
- Next.js 15.1.3 + Cloudflare Workers + D1 architecture.
- User registration, login, and session management.
- Form creation with honeypot spam trap.
- Resend API email notifications.
- Dashboard with form management and submission viewing.
- Self-healing D1 schema (auto-create/alter tables).
- Deploy to Cloudflare button.

---

> **FormForge** — Developed by [Sudhir Singh](https://github.com/SudhirDevOps1)
> © 2024-2026 Sudhir Singh. All rights reserved.
