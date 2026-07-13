# Changelog

All notable changes to FormForge are documented in this file.

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
