# Changelog

All notable changes to FormForge are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Release automation reads this file: [`release.yml`](../.github/workflows/release.yml)
extracts the section matching each `v*` tag to build the GitHub Release notes.

## [1.1.0] - 2026-11-11

### Added
- **Optional encryption of submission payloads at rest** — a per-form toggle seals every new payload with AES-256-GCM. The envelope is self-describing (`ffenc:v1:…`), so a database that mixes encrypted and plaintext rows stays readable and turning the setting on never orphans an existing row. Search, exports, webhook deliveries and notifications all work on the readable body.
- **End-to-end integration suite** — `tests/run-e2e-tests.mjs` drives the real HTTP surface of a running server: registration, form creation, conditional logic (a hidden field is stripped from storage, a required field is enforced), URL prefill (a hidden value cannot be forged), UTM capture, partial submissions and resume, the submission workflow, internal notes, encrypted payloads at rest, search inside an encrypted form, the flattened CSV export, the password gate, duplicate detection, session listing and the audit trail. 24 assertions, wired into `npm run test:e2e` and a new CI job.
- **New feature-behaviour suite** — `tests/run-feature-tests.mjs` compiles the new engines to CommonJS and exercises the real implementations: all thirteen conditional-logic operators, show/hide/require semantics, hidden-field stripping, prototype-pollution rejection, prefill mapping and UTM capture, hidden-value injection, the webhook backoff schedule and terminal-failure rule, duplicate fingerprinting, the form-password token scheme (cross-form, tampering and expiry), the password-strength policy and the encryption envelope. 40 assertions.
- **Conditional Logic & Branching Engine** — per-form rules (`show` / `hide` / `require`) evaluated server-side on every submission. Hidden fields are stripped from the stored payload and are never counted as required, so a crafted request cannot bypass the form's logic. Thirteen operators (equals, contains, greater-than, `in`, empty checks, …). Managed from a new **Logic & Prefill** tab in the dashboard.
- **URL Prefill & Server-Side Hidden Fields** — map a query parameter onto a form field. Visible prefills pre-fill an input; hidden fields are injected server-side after the client payload is parsed, so the respondent can neither read nor forge them. Optional automatic UTM capture (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`).
- **Partial Submissions & Save-and-Resume** — respondents can save progress and continue later with a signed resume link. The resume token is stored only as a SHA-256 hash, so a leaked database row cannot be replayed.
- **Drop-off Funnel Analytics** — per-field completion rates derived from saved partial submissions, with a started/completed/completion-rate summary in the analytics panel.
- **Submission Workflow & Internal Notes** — triage every submission through `new → in_progress → resolved → spam`, attach private internal notes, and reply by email. Notes are excluded from exports, webhooks and notifications; a reply can only target the address captured with the submission.
- **Webhook Auto-Retry with Exponential Backoff** — failed deliveries are scheduled for another attempt on a human-scale backoff (1m → 5m → 30m → 2h → 12h), capped at five attempts. Every attempt is logged with its status code and latency. A scheduler-safe endpoint (`POST /api/webhooks/retry-due`) processes the due queue using a `CRON_SECRET`.
- **Native Slack & Discord Channels** — dedicated form fields for Slack and Discord incoming webhook URLs. The dispatcher renders native Block Kit / embed payloads; no OAuth app and no relay service involved.
- **Password-Protected Forms** — a shared access password gates the hosted page. Stored as a PBKDF2-SHA256 hash and compared in constant time; unlocking returns a short-lived HMAC token bound to the form id.
- **Duplicate Detection** — submissions are fingerprinted on a canonical, order-independent payload. A repeat is flagged and linked to the original instead of silently inflating the response count.
- **Tags & Cross-Form Search** — per-form tags plus `?search=` and `?tag=` filtering across every form the owner owns.
- **Scheduled Form Closure & Per-Form Rate Limits** — close a form on a given date, and set the per-IP submissions-per-minute ceiling for each form (default 60).
- **Session Management & Audit Trail UI** — list every active session with a device label and a daily-rotating IP hash, revoke one or all of them, and read the administrative audit trail that was previously write-only.
- **Command Palette (⌘K / Ctrl+K)** — a keyboard-driven surface for every dashboard action, with fuzzy matching, arrow-key navigation and focus trapping.
- **Premium "Aurora" Design System & Motion Engine** — a token-based design system (colour, type, spacing, radius, shadow, motion) shared by the marketing site and the dashboard, plus a scroll-reveal system, animated counters, magnetic buttons, an aurora backdrop, a trust marquee, and an interactive product preview.
- **Dynamic Hosted Form Engine** — the hosted page now renders owner-defined field lists (text, email, number, tel, url, date, textarea, select, radio, checkbox, file) with live conditional logic, prefills and save-and-resume, while keeping the classic and conversational layouts.
- **Flattened CSV Export** — one column per field instead of a single JSON blob, plus `workflow_status` and `duplicate_of` columns, so exports open directly in a spreadsheet.

### Fixed
- **A client-side failure could leave the whole page blank** — the scroll-reveal system hid every section behind a class that an inline script added before first paint. If the React runtime then failed to boot (a blocked script, a CSP violation, a network error), nothing ever revealed the content and the visitor saw an empty page. A hydration failsafe now removes the class again when the client runtime never reports in, and a `HydrationGuard` component cancels the timer as soon as the runtime is healthy.
- **Encrypted payloads broke notifications** — `deliverNotifications` and the email-verification route parsed the stored payload as JSON, so a form with encryption enabled answered every submission with a 500. Both now read the decrypted body, and the submit route logs the cause instead of swallowing it.
- **Local development could never reach a database** — the database layer imports `createClient` from `@libsql/client/web`, which cannot open `file:` URLs, so the documented `npm run dev` flow always answered `503 DATABASE_NOT_CONFIGURED`. The Node build of the client is now resolved lazily through `process.getBuiltinModule()`, which does not exist in a Worker — the production bundle is unaffected.
- **Raw client IP could be persisted** — when the "store IP hash" option was disabled, the submit route fell back to writing the *plaintext* IP address into `submissions.ip_hash`. The value is now omitted entirely when hashing is off, and the stored hash is salted with the current UTC day so it cannot be correlated across days.
- **Dependency drift in the Cloudflare toolchain** — `@opennextjs/cloudflare@1.20.6` requires `next >= 15.5.24` and `wrangler ^4.125.0`, but the repository pinned `next@15.5.18` / `wrangler@^4.108.0`, which made a clean `npm install` fail with `ERESOLVE`. Bumped to `next@15.5.29`, `eslint-config-next@15.5.29` and `wrangler@^4.125.0`.
- **Missing CI workflows** — the security suite mandates `.github/workflows/ci.yml`, `security-scan.yml` and `release.yml`, but the `.github` directory had been untracked, leaving the suite at 49/53. Restored from history, and the remaining floating action tags in `security-scan.yml` are now SHA-pinned.

### Security
- **Content-Security-Policy** — a strict CSP is now shipped from a single source of truth (`src/lib/security-headers.ts`) and applied by `next.config.ts`: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy` were added alongside it. The hosted form page (`/f/*`) is the only route that permits framing, because embedding it is a documented feature.
- **`__Host-` session cookie** — the session cookie is now issued as `__Host-ff_session` on secure origins, which the browser enforces as `Secure; Path=/` with no `Domain` attribute. A sibling subdomain can no longer set or overwrite it. The legacy name is still read so existing deployments survive the upgrade.
- **Password strength policy** — registration and password reset now enforce length, character-class diversity and a common-password blocklist. The client additionally offers a breach check against the Pwned Passwords **k-anonymity** API: only the first five characters of the SHA-1 digest leave the browser.
- **Per-address throttling** — `forgot-password` now has a second rate-limit bucket keyed on the target address, so a single attacker cannot rotate IPs to hammer one inbox.
- **Extended security suite** — the test suite grew from 53 to 64 assertions, adding a new `P7` pillar covering the raw-IP regression, the CSP, the `__Host-` cookie, rule-engine prototype-pollution defence, authorization on every new dashboard API, form-password hashing, the backoff schedule, reply-target confinement, resume-token hashing and hidden-prefill injection.
- **New feature-behaviour suite** — `tests/run-feature-tests.mjs` compiles the new engines to CommonJS and exercises the real implementations: all thirteen conditional-logic operators, show/hide/require semantics, hidden-field stripping, prototype-pollution rejection, prefill mapping and UTM capture, hidden-value injection, the webhook backoff schedule and terminal-failure rule, duplicate fingerprinting, the form-password token scheme (cross-form, tampering and expiry) and the password-strength policy. 35 assertions, wired into `npm test` and CI.

### Changed
- **Next.js 15 → 16.4.6** — the Next.js 15 line left the two-year support window on 2026-10-21, so the Cloudflare build refused to run against it. The upgrade also satisfies `@opennextjs/cloudflare@1.20.6`'s peer range (`next >= 16.3.3`). React was moved to `19.3.1` and `eslint-config-next` to `16.4.6`.
- **ESLint flat config** — `eslint-config-next@16` ships native flat config, so `eslint.config.mjs` consumes it directly instead of routing it through the `FlatCompat` shim, which crashed on the v16 plugin graph.
- **`.github/` is tracked again** — it had been added to `.gitignore`, which silently disabled CI and failed the repository's own security suite. The workflows are restored, SHA-pinned, and the ignore rule was removed.
- **Windows build support** — `build-cf.js` preloads `scripts/windows-symlink-fallback.cjs`, which falls back to junction points when OpenNext recreates the standalone `node_modules` layout. The Cloudflare bundle can now be produced on a normal Windows workstation without Developer Mode or Administrator rights.
- **Content-Security-Policy in development** — `'unsafe-eval'` is granted in development only, because React's dev build calls `eval()` to reconstruct component stacks. The production policy remains strict.

---

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
- **Native RFC 6238 TOTP Two-Factor Authentication (2FA)** — Zero-dependency WebCrypto implementation with QR-ready `otpauth://` URI generator and constant-time HMAC-SHA1 verification.
- **Backblaze B2 & S3 Object Storage Integration** — 10GB free permanent storage on Backblaze B2 or Cloudflare R2 with binary magic-bytes signature verification to block disguised executables.
- **Webhook Observability & HMAC Delivery Logs** — Dedicated `webhook_logs` table, latency tracking (ms), HMAC-SHA256 headers (`X-FormForge-Signature`), and authenticated 1-click redelivery.
- **Smart Intent & Urgency Triage** — Zero-cost synchronous heuristic classifier automatically tagging submissions into 🚨 Urgent, 💼 Sales, 🛠️ Support, 💡 Feedback, and 💬 General.
- **Conversational Multi-Step Form Mode** — Standalone `/f/[slug]` support for interactive step-by-step questions with progress bar and keyboard shortcuts.
- **Real-Time Live Feed Ingestion Stream** — 25-second background polling stream in the dashboard with glowing live alerts and instant table updates.
- **AI-Ready Integration Architecture (`INTEGRATION_GUIDE.md`)** — One-shot prompt and complete recipes for Cursor, ChatGPT, Claude, Copilot, v0 across Next.js, React, Vue, Svelte, Astro, and HTML.

---

> **FormForge** — Developed by [Sudhir Singh](https://github.com/SudhirDevOps1)
> © 2024-2026 Sudhir Singh. All rights reserved.
