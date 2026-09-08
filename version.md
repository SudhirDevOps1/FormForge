# 📌 FormForge Release Changelog (version.md)

This file tracks the versions, release dates, features added, removed, and bug fixes for the **FormForge** production application.

---

## 🚀 Current Version: `v1.0.0` (September 8, 2026)

### 🟢 Universal Release Highlights
* **Native In-App Confirmation Modal:** Completely eliminated browser-native `window.confirm()` popup alerts in favor of responsive dark glassmorphic dialogs with keyboard accessibility (`Escape`/`Enter`).
* **In-Dashboard Interactive API Documentation Hub:** Added an interactive live sandbox tester to test endpoints directly from the browser with latency counters (ms) and JSON response viewers.
* **Database Storage & Payload Pruning:** Prunes transient tokens (`altcha`, `honeypotField`, PoW challenges) before inserting submissions into SQLite D1, saving 40–60% database row storage.
* **Redesigned Modern Kinetic F SVG Logo:** Upgraded `logo.svg` and `favicon.svg` with modern obsidian squircle, cyber shield watermark, and high-contrast kinetic F monogram.
* **Native ALTCHA Proof-of-Work Integration (100% Free & Self-Hosted):** Replaced third-party Cloudflare Turnstile with native in-browser ALTCHA Proof-of-Work anti-spam verification.
* **Native WebCrypto PoW Challenge & Verification:** Built zero-dependency challenge generator (`/api/altcha/challenge`) and HMAC-SHA256 solution verifier (`src/lib/altcha.ts`) running natively on Cloudflare Workers and Node.js.
* **Privacy-First & Cookie-Free:** Zero external tracking cookies, zero external API keys or cloud dependencies, fully GDPR/CCPA compliant.
* **Interactive Dashboard ALTCHA Panel:** Form settings feature a dedicated ALTCHA toggle with one-click live challenge URL copy and auto-generated snippet integration.
* **Multi-Database Universal Engine:** Seamless support for Cloudflare D1, Neon Serverless Postgres, Turso (libSQL), and local file SQLite with automatic zero-downtime startup migrations (`autoMigrate`).
* **In-Browser DuckDB Live SQL Query Studio:** Zero-cost client-side analytical SQL engine with 1-click execution over local datasets.
* **Zero-Dependency Floating Embed Widget (`/widget.js`):** Ultra-lightweight (<3KB) embed script for WordPress, Webflow, Shopify, Framer, Wix, Astro, and static HTML websites.
* **Real-Time Integration & Webhook Tester:** 1-click delivery test and latency benchmark for Webhooks (with HMAC-SHA256 signatures), Google Apps Script (GAS), Telegram Bot, and ntfy.sh.
* **Zero-Card Free Tier Notifications:** Google Apps Script (GAS) Gmail relay (500–1,500 free emails/day + Google Sheets auto-logging), Telegram Bot instant mobile push alerts, and ntfy.sh topics.
* **Custom SMTP Server Integration:** Fully supports custom SMTP servers enabling support for 10+ major email engines (Gmail, Yahoo, Outlook, Resend SMTP, Mailjet, Brevo, SMTP2GO, SendGrid, Amazon SES, Mailgun, and Postmark).
* **Military-Grade AES-GCM Cryptographic Encryption:** Integrated Web Crypto API to automatically encrypt SMTP Passwords and secrets at rest in SQLite D1.
* **Submission Lifecycle Management:** Endpoints supporting real-time search (`?q=...`), status filtering (`all`, `inbox`, `spam`), bulk deletion, single deletion, and 1-click "Clear All Spam".
* **Interactive Timeline Analytics & Submissions Export:** Real-time analytics charts and multi-format exports in CSV, structured JSON, raw TXT reports, and PDF print formats.
* **OpenAPI v3 Documentation:** Full interactive API specification published at `/api/openapi.json`.
