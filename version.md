# 📌 FormForge Release Changelog (version.md)

This file tracks the versions, release dates, features added, removed, and bug fixes for the **FormForge** production application.

---

## 🚀 Current Version: `v2.2.1` (September 8, 2026)

### 🟢 Added (Naya Add Kiya)
* **Native In-App Confirmation Modal:** Completely eliminated browser-native `window.confirm()` popup alerts in favor of responsive dark glassmorphic dialogs with keyboard accessibility (`Escape`/`Enter`).
* **In-Dashboard Interactive API Documentation Hub:** Added an interactive live sandbox tester to test endpoints directly from the browser with latency counters (ms) and JSON response viewers.
* **Database Storage & Payload Pruning:** Prunes transient tokens (`altcha`, `honeypotField`, PoW challenges) before inserting submissions into SQLite D1, saving 40–60% database row storage.
* **Redesigned Modern Kinetic F SVG Logo:** Upgraded `logo.svg` and `favicon.svg` with modern obsidian squircle, cyber shield watermark, and high-contrast kinetic F monogram.

---

## 🚀 Version: `v2.2.0` (September 8, 2026)

### 🟢 Added (Naya Add Kiya)
* **Native ALTCHA Proof-of-Work Integration (100% Free & Self-Hosted):** Completely replaced third-party Cloudflare Turnstile with native in-browser ALTCHA Proof-of-Work anti-spam verification.
* **Native WebCrypto PoW Challenge & Verification:** Built zero-dependency challenge generator (`/api/altcha/challenge`) and HMAC-SHA256 solution verifier (`src/lib/altcha.ts`) running natively on Cloudflare Workers and Node.js.
* **Privacy-First & Cookie-Free:** Zero external tracking cookies, zero external API keys or cloud dependencies, fully GDPR/CCPA compliant.
* **Interactive Dashboard ALTCHA Panel:** Form settings now feature a dedicated ALTCHA toggle with one-click live challenge URL copy and auto-generated snippet integration.

---

## 🚀 Version: `v1.1.0` (July 9, 2026)

### 🟢 Added (Naya Add Kiya)
* **Custom SMTP Server Integration:** Fully supports custom SMTP servers enabling support for **10+ major email engines** (Gmail, Yahoo, Outlook, Resend SMTP, Mailjet, Brevo, SMTP2GO, SendGrid, Amazon SES, Mailgun, and Postmark).
* **Military-Grade AES-GCM Cryptographic Encryption:** Integrated Web Crypto API to automatically encrypt SMTP Passwords and Turnstile Secret Keys inside the SQLite D1 database using the `AUTH_SECRET` key.
* **Turnstile Secret Masking:** API endpoints sanitized so that `smtpPass` and `turnstileSecretKey` return a masked placeholder (`__SMTP_PASSWORD_SET__` / `__TURNSTILE_SECRET_SET__`) to the browser, ensuring zero client-side credential leaks.
* **Live Settings SMTP Testing:** Added a **"Send test email"** button to the settings panel to verify SMTP connection parameters immediately before saving.
* **Next.js 15 Async Background Processing:** Deliveries of email alerts and webhook requests run inside the non-blocking `waitUntil` edge worker execution queue to keep submission times under 15ms.
* **10+ Rich Webhook Formatting:** Auto-detects and structures gorgeous markdown cards, embeds, and blocks for Slack, Discord, Stoat.chat/Revolt, MS Teams, and Mattermost.
* **Custom SMTP Global Backup:** Supports global fallback environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_ENABLED`) for users seeking zero database footprints.
* **Dynamic Gmail App Password Instructions:** Auto-detects `@gmail.com` inputs to autofill Gmail servers and warn users to use Google App Passwords.
* **Strict Privacy Policy:** Linked a newly created [Privacy & Security Policy Page](/privacypolicybanao.html) in the footer and headers of all main landing templates.

### 🟡 Fixed (Errors/Bugs Fix Kiya)
* **OpenNext Compiler Fixes:** Refactored runtime type definitions inside `/api/submit/[endpointId]` to solve Edge compiler issues.
* **Git Conflicts Resolved:** Recovered lost Drizzle models and local features following diverged remote branch rebase conflicts.
* **SMTP Port Parser:** Handled string-to-number validation bugs when patch payloads receive SMTP ports.

---

## 🚀 Version: `v1.0.1` (July 8, 2026)

### 🟢 Added (Naya Add Kiya)
* **Smart DNS MX Lookup Validation:** Automatically verify submitter email domain MX records using Cloudflare DNS over HTTPS to instantly reject spambots.
* **Interactive Timeline Analytics:** Rendered a 30-day interactive analytics timeline chart of accepted/spam entries in the dashboard.
* **Multi-Format Submissions Export:** Enabled exports in CSV, structured JSON, raw TXT reports, and PDF print formats.
* **Spam Key Blocklist:** Comma-separated spam word detection filter raising submission spam score by `+100`.
* **Automatic SQLite Data Purging:** Forms can specify `30`, `60`, or `90` days retention limits; obsolete logs are auto-deleted in SQLite background queries.
* **Submissions Relative Time:** Adjusted Relative creation timestamps synced to client browser timezones instead of standard Worker UTC offsets.

---

## 🚀 Version: `v1.0.0` (July 6, 2026)

### 🟢 Added (Naya Add Kiya)
* **FormForge Initial Launch:** Drizzle-D1 self-healing schema initialization.
* **User Authentication:** PBKDF2 salt password hashing and HMAC-SHA256 session/API-key validation.
* **Spam Controls:** Honeypot form trap inputs, Turnstile verify, and basic rate-limiting middleware.
* **Dashboard View:** Submissions listing table, API keys generator, and copy-paste code snippets for React, HTML, JS, and Python.
