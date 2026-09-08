# Changelog

All notable changes to FormForge are documented in this file.

## [1.0.0] - 2026-09-08

### Added
- **Universal Multi-Database Engine** — Native support for Cloudflare D1, Neon Serverless Postgres (`@neondatabase/serverless` & `drizzle-orm/neon-http`), Turso libSQL, and local SQLite with automated zero-downtime startup schema migrations (`autoMigrate`).
- **Native ALTCHA Proof-of-Work Anti-Spam** — 100% free, privacy-first, self-hosted anti-spam verification powered by native WebCrypto HMAC-SHA256 challenges (`/api/altcha/challenge`) and client-side PoW solver. Completely zero cookies and GDPR/CCPA compliant.
- **Native In-App Confirmation Modals** — Eliminated browser-native `window.confirm()` popup alerts in favor of responsive dark glassmorphic confirmation dialogs with keyboard accessibility (`Escape`/`Enter`).
- **In-Dashboard Interactive API Documentation Hub** — Interactive live sandbox tester with real-time latency benchmark (ms), response payload viewer, parameter reference, and integration recipes.
- **Database Storage & Payload Pruning** — Automatically strip transient anti-spam fields (`altcha`, `honeypotField`, PoW challenge tokens) prior to Cloudflare D1 insertion, saving 40–60% database row size.
- **In-Browser DuckDB Live SQL Query Studio** — Zero-cost client-side analytical SQL query studio with 1-click execution over local datasets, DuckDB CLI query generator, and MotherDuck integration.
- **Zero-Dependency Floating Embed Widget (`/widget.js`)** — Ultra-lightweight (<3KB) floating feedback/contact popup widget for WordPress, Webflow, Shopify, Framer, Wix, Astro, and static HTML sites.
- **Real-Time Integration & Webhook Tester (`/api/forms/[formId]/test-webhook`)** — Interactive live delivery test and latency benchmark for Webhooks (with HMAC-SHA256 signatures), Google Apps Script (GAS), Telegram Bot, and ntfy.sh.
- **Zero-Card Free Tier Notifications** — Google Apps Script (GAS) Gmail relay (500–1,500 free emails/day + Google Sheets auto-logging), Telegram Bot instant mobile alerts, and ntfy.sh push topics.
- **Submission Lifecycle Management** — Full-featured `/api/submissions/[submissionId]` endpoint supporting real-time search (`?q=...`), status filtering (`all`, `inbox`, `spam`), bulk deletion, single deletion, and 1-click "Clear All Spam".
- **Dynamic Non-AJAX HTML Form Redirection** — Native support for `_next`, `_redirect`, and `next` hidden form fields with SSRF-safe redirect validation and glassmorphic browser thank-you pages.
- **Military-Grade Cryptographic Security** — AES-256-GCM encryption for SMTP passwords and secrets at rest, PBKDF2 (100,000 iterations) for password hashing, and HMAC-signed API keys and session tokens.
- **Multi-Format Submissions Export** — Direct 1-click exports in CSV, structured JSON, raw TXT reports, and PDF print formats.
- **Modern Kinetic F SVG Brand Assets** — Redesigned `logo.svg` and `favicon.svg` with modern obsidian squircle, cyber shield watermark, and high-contrast kinetic F monogram.
- **OpenAPI v3 Documentation** — Full interactive API specification published at `/api/openapi.json`.

---

> **FormForge** — Developed by [Sudhir Singh](https://github.com/SudhirDevOps1)
> © 2024-2026 Sudhir Singh. All rights reserved.

---

> **FormForge** — Developed by [Sudhir Singh](https://github.com/SudhirDevOps1)  
> © 2024-2026 Sudhir Singh. All rights reserved.
