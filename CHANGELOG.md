# Changelog

All notable changes to FormForge are documented in this file.

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
- **Multi-Database Universal Engine** — Neon Serverless Postgres (`@neondatabase/serverless` & `drizzle-orm/neon-http`), Cloudflare D1, Turso libSQL, and local SQLite with unified auto-migration (`autoMigrate`).
- **In-Browser DuckDB Live SQL Query Studio** — 100% zero-cost client-side analytical query studio with 1-click execution, DuckDB CLI commands, and MotherDuck integration.
- **Zero-Dependency Floating Embed Widget (`/widget.js`)** — Under 3KB vanilla JS floating feedback/contact popup for WordPress, Webflow, Shopify, Framer, and static sites.
- **Real-Time Integration & Webhook Tester (`/api/forms/[formId]/test-webhook`)** — Interactive live test tool for Webhooks (with HMAC-SHA256 signatures), Google Apps Script (GAS), Telegram Bot, and ntfy.sh.
- **Zero-Card Free Tier Notification Relays** — Google Apps Script (GAS) Gmail relay (500–1,500 free emails/day + Google Sheets auto-logging), Telegram Bot instant mobile alerts, and ntfy.sh push.
- **6-Digit Cryptographic OTP Verification** — Zero-cost submitter email verification via secure 6-digit one-time passcodes.
- **Backblaze B2 S3 Storage** — 10GB permanent free cloud storage for file attachments.
- **Universal Subdomain Support** — Host-only cookies and universal CORS for `*.vercel.app`, `*.netlify.app`, `*.pages.dev`, and `*.workers.dev`.

## [1.2.0] - 2026-07-14

### Added
- **4 Direct Email API Integrations** — Resend, Brevo (Sendinblue), SendGrid, and Mailgun with zero SMTP configuration.
- **10+ SMTP Relay Support** — Gmail, Yahoo, Outlook, MailerLite, Mailchimp, Mailjet, Mailtrap, SMTP2GO, Loops, Notifuse, Postmark.
- **S3-Compatible File Uploads** — Backblaze B2, Wasabi, Storj, AWS S3, MinIO, IDrive e2, Tencent COS, Garage, RustFS.
- **Cloudflare R2 Integration** — Optional R2 bucket binding for file uploads.
- **Secure File Download API** — Authenticated proxy endpoint at `/api/submissions/{id}/files/{name}`.
- **Owner-Only Registration Mode** — `ALLOW_REGISTRATION=false` blocks all new signups.
- **OpenAPI v3 Documentation** — Full API spec at `/api/openapi.json`.
- **Feedback Form Template** — Glassmorphism dark UI with star ratings (4th dashboard template).
- **Public Stats API** — Anonymous aggregate counts at `/api/public-stats`.
- **Enhanced SEO** — Canonical URL, Twitter cards, richer JSON-LD schema with `featureList` and `softwareVersion`.

### Changed
- `CloudflareEnv` type expanded with 25+ fields (all email, storage, and registration variables).
- `getRuntimeEnv()` now resolves all new variables from Cloudflare context with `process.env` fallback.
- `wrangler.jsonc` updated with `ALLOW_REGISTRATION` var and optional `r2_buckets` binding.
- `package.json` cloudflare section updated with all env vars and secrets.
- `notifications.ts` expanded with Brevo, SendGrid, Mailgun API delivery across all three flows (owner alerts, autoresponder, email verification).
- `README.md` fully updated with v1.2.0 features, new badges, environment variable tables, and copyright footer.
- `fixed.md` completely rewritten with full feature matrix and security score (95/100).

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
