# FormForge — v1.1 "Aurora" Upgrade Plan

> **Deep-analysis-driven upgrade:** premium visual identity + a real motion system +
> competitor-grade product features + a hardened security/privacy core.
> Every item below is scoped to be **actually working and verified** (typecheck,
> lint, security-suite, production build) — not mocked.

> **Status:** ✅ all six phases complete — see §11 for the verification record.

---

## 1. Executive Summary

FormForge today is a **privacy-first, self-hostable form backend** for static sites,
deployable on Cloudflare Workers + D1 (also Neon / Turso / SQLite). It already ships
a very mature security core (53/53 security tests, HMAC webhooks, TOTP 2FA, ALTCHA
proof-of-work, magic-byte upload scanning, SSRF guards, AES-GCM at rest, audit logs).

The three gaps that stop it from feeling "premium" and from competing with
Typeform / Fillout / Formspree / FormTo are:

| Gap | Reality |
| --- | --- |
| **Visual + motion** | The landing page is a static hero. There is no motion system, no scroll choreography, no product preview, no design tokens. `globals.css` is 4.6 KB of utility classes. The dashboard is a **321 KB single file** with no design system. |
| **Product depth** | No conditional logic / branching, no URL prefill, no partial submissions, no submission workflow (triage → reply → resolve), no webhook auto-retry, no native Slack/Discord, no password-gated forms, no drop-off analytics, no tags/search. These are table-stakes in Typeform, Fillout, FormTo, Basin. |
| **Security/privacy depth** | **No `Content-Security-Policy`** header. **Raw IP is stored** when `storeIpHash` is disabled (a privacy bug, see §5.1). No session-management surface, no audit-log viewer, no password-strength gating. |

**Plan:** 6 phases, additive-first (no breaking changes to existing endpoints), each
phase independently verifiable.

---

## 2. Competitive Research → Feature Decisions

Researched against Formspree, Basin, Typeform, Fillout, FormTo, OSForms, HeyForm,
OpnForm, Tally, Web3Forms (2026 landscape).

| Competitor pattern | FormForge status | Decision |
| --- | --- | --- |
| **Typeform Logic Map** — conditional show/hide + branching | Missing | ✅ **Built** `form_rules` engine |
| **Fillout prefill / hidden fields / answer piping** — URL params + UTM | Missing | ✅ **Built** `form_prefills` (URL param → field, plus UTM auto-capture) |
| **Fillout partial submissions** — capture drop-offs | Missing | ✅ **Built** `partial_submissions` + resume token → unlocks drop-off analytics |
| **FormTo inbox** — archive / reply by email / internal notes / status | Missing | ✅ **Built** submission workflow: `new → in_progress → resolved → spam`, internal notes, reply-by-email |
| **FormTo / Basin auto-close** — stop after N responses | Partial (`submissionLimit`) | ✅ Extended: close on date + close on N + auto-reopen |
| **OSForms / FormTo webhook retries** — signed, retried | Manual 1-click only | ✅ **Built** exponential backoff auto-retry with attempt ledger |
| **FormTo Slack / Telegram** — native channels | Telegram + ntfy + generic webhook | ✅ **Built** native Slack + Discord channels (no third-party relay) |
| **Fillout password-protected forms** | Missing | ✅ **Built** form password gate (PBKDF2, no plaintext) |
| **Typeform drop-off analysis** | Missing | ✅ **Built** per-field drop-off funnel from partial submissions |
| **FormTo tags & search** | Missing | ✅ **Built** `tags` column + cross-form search |
| **Tally / FormTo CSV + JSON export** | CSV only | ✅ Added JSON export + per-field flattened CSV |
| **Typeform custom domain / theming on hosted page** | Missing | ⚠️ Partially — dynamic hosted form engine shipped; theming deferred (see §10) |
| **Typeform duplicate protection** | Missing | ✅ **Built** duplicate fingerprint detection |

### Explicitly rejected (privacy-first, cost-zero, or unmaintainable)

- ❌ **reCAPTCHA / Turnstile / hCaptcha** — third-party tracking, breaks GDPR posture. FormForge's native **ALTCHA** already covers it.
- ❌ **Google Sheets native sync** — requires OAuth + stored refresh tokens = large attack surface, and GAS relay already covers it.
- ❌ **Stripe payments** — PCI scope expansion is antithetical to "security/privacy first"; not required for a form backend.
- ❌ **Client-side analytics (Plausible/Umami)** — the whole product promise is "no third-party analytics."
- ❌ **Any runtime dependency addition** — zero-dependency posture is a core product differentiator (Cloudflare Workers bundle size + supply-chain risk).

---

## 3. Phase Map

```
P1  Design System + Motion Engine      → premium tokens, scroll choreography
P2  Premium Landing Page                → aurora hero, bento, tabs, FAQ, pricing
P3  Product Features (backend)          → 10 new working features
P4  Security & Privacy Hardening       → CSP, IP bug fix, sessions, audit UI
P5  Dashboard Premium UX                → decomposition, command palette, toasts
P6  Verification + Docs                 → typecheck, lint, 53+ security tests
```

---

## 4. Phase 1 — Design System & Motion Engine

**Goal:** one motion vocabulary + one token vocabulary for the whole app.

- `src/lib/motion.ts` — shared durations, easings, stagger steps, and the
  `prefers-reduced-motion` contract (single source of truth, no magic numbers).
- `src/app/globals.css` — rewrite:
  - **Color tokens** (CSS custom properties): surface ramp, accent ramp, semantic
    (success/warn/danger/info), each with light+dark values.
  - **Type scale** (fluid `clamp()`), spacing rhythm, radius ramp, shadow ramp.
  - **Motion primitives**: `rise`, `fade`, `scale`, `blur-in`, `shimmer`, `marquee`,
    `aurora-drift`, `spotlight`, `gradient-x`, `border-sweep`.
  - **Component classes**: `.btn-primary/.btn-ghost/.btn-outline`, `.card`, `.chip`,
    `.input`, `.badge`, `.skeleton`, `.kbd`, `.divider`, `.glass`.
  - **Focus-visible rings** (accessibility) + **scrollbar** + **selection**.
  - **Reduced-motion** block that kills *all* animation, not just the ones tagged.
- `src/components/Reveal.tsx` — `"use client"`; IntersectionObserver-based
  `data-reveal` reveal with `delay`/`direction` props, **auto-disables under
  `prefers-reduced-motion`**.
- `src/components/Counter.tsx` — rAF number counter with `Intl.NumberFormat`,
  reduced-motion aware (renders final value instantly).
- `src/components/Aurora.tsx` — animated mesh-gradient backdrop (pure CSS, zero JS).
- `src/components/Magnetic.tsx` — pointer-reactive magnetic button wrapper.

**Definition of done:** no magic numbers in components; all motion respects
`prefers-reduced-motion`; lint + typecheck clean.

---

## 5. Phase 3 — Product Features (the "more features that work" block)

All new tables are added to **three** places so the product stays
self-migrating (FormForge's headline promise):
`src/db/schema.ts` (Drizzle types) → `src/db/auto-migrate.ts` (live DDL) →
`migrations/0001_aurora.sql` (drizzle-kit artifact).

### 5.1 Security bug found during analysis (fix first)

`src/app/api/submit/[endpointId]/route.ts:626`

```ts
ipHash: form.storeIpHash && ip ? await sha256(`${form.id}:${ip}`) : (ip ?? undefined),
```

When `storeIpHash` is **disabled**, the **raw IP address is persisted**. The toggle
reads "store IP hash", so users reasonably believe disabling it stores nothing.
**Fix:** store `undefined` (no value) when hashing is off, and rotate the hash
salt per-day so hashes are not stable across days (defeats long-term
correlation) while staying correlatable within a day.

### 5.2 Feature list

| # | Feature | New tables / columns | API |
| --- | --- | --- | --- |
| F1 | **Conditional logic & branching** — rules `{ field, operator, value, action: show/hide/require, target }` evaluated server-side on submit + client-side on the hosted form | `form_rules` | `GET/POST/PATCH/DELETE /api/forms/[formId]/rules` |
| F2 | **URL prefill & hidden fields** — `?email=…` fills a field; hidden fields are server-injected and cannot be spoofed; UTM auto-capture | `form_prefills` | `GET/POST /api/forms/[formId]/prefills` |
| F3 | **Partial submissions & resume** — respondent progress saved, resume via signed token; drives drop-off analytics | `partial_submissions` | `POST /api/submit/[endpointId]/partial`, `GET /api/submit/[endpointId]/partial?token=` |
| F4 | **Submission workflow** — `new / in_progress / resolved / spam` + internal notes + reply-by-email (signed token, replies land in the inbox) | `submission_notes`, `submissions.workflow_status` | `PATCH /api/submissions/[submissionId]`, `POST /api/submissions/[submissionId]/notes`, `GET /api/submissions/[submissionId]/reply-token` |
| F5 | **Webhook auto-retry** — exponential backoff (1m→5m→30m→2h→12h), attempt ledger, HMAC re-signs each attempt | `webhook_logs.attempts/next_retry_at/max_attempts` | `POST /api/forms/[formId]/webhooks/retry-due` (cron-safe) |
| F6 | **Native Slack + Discord** — channel messages with field rendering; Slack signed-secret verification | `forms.slack_webhook_url`, `forms.discord_webhook_url` | piggybacks `deliverNotifications` |
| F7 | **Password-protected forms** — PBKDF2-SHA256 (same primitive as user passwords), no plaintext, constant-time compare | `forms.password_hash` | `POST /api/f/[slug]/unlock` |
| F8 | **Duplicate detection** — normalized payload fingerprint, flags `duplicate` status with a pointer to the original | `submissions.duplicate_of` | inside submit route |
| F9 | **Tags & search** — per-form tags; cross-form search by name/slug/tag/endpoint | `form_tags` | `GET /api/forms?search=&tag=` |
| F10 | **Per-form rate limit + drop-off analytics** — configurable rpm; funnel from partial submissions | `forms.rate_limit_per_minute` | analytics route extension |

### 5.3 Backwards-compatibility contract

- Every new column is `NULL`/defaulted → existing rows and existing databases keep working.
- Every new table is created by `autoMigrate` on first request → **no manual migration step** for existing self-hosters.
- New behaviour is **opt-in per form**. A form with no rules/prefills/partials enabled behaves exactly as before.
- All new endpoints return the standard `{ ok, data }` / `{ ok, code, message }` envelope already used by the codebase.

---

## 6. Phase 4 — Security & Privacy Hardening

| # | Item | Detail |
| --- | --- | --- |
| S1 | **Content-Security-Policy** | Add a strict CSP (`default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `img-src 'self' data:`, `style-src 'self' 'unsafe-inline'`, `script-src 'self' 'unsafe-inline'` — `unsafe-inline` only where Next.js hydration requires it) + `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Resource-Policy: same-origin`. |
| S2 | **Raw-IP storage bug** | §5.1 — fix + per-day rotating hash salt. |
| S3 | **`__Host-` session cookie** | Cookie name `__Host-ff_session` with `Path=/; Secure; HttpOnly; SameSite=Lax` (no `Domain`), so a subdomain can never set/override it. Backwards-compatible read of the legacy name. |
| S4 | **Session management surface** | New API + dashboard panel: list active sessions (device, IP hash, created, last seen), revoke one, revoke all (bumps a session-version). |
| S5 | **Audit log viewer** | New API + panel over the existing `audit_logs` table (currently write-only — data is collected but invisible). |
| S6 | **Password strength policy** | zxcvbn-free heuristic strength meter (client) + server-side minimum-complexity enforcement on register/reset + breached-password check via **k-anonymity** (first 5 SHA-1 chars only — the email never leaves the browser). |
| S7 | **Rate-limit the remaining auth endpoints** | `forgot-password`, `magic-link`, `otp/request` currently lack dedicated throttles → add D1-backed limits (5/15min per identifier). |
| S8 | **Security headers hardening** | `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (extended), `Strict-Transport-Security` (already present) → centralised in one `securityHeaders()` helper so route handlers and `next.config.ts` cannot drift. |

---

## 7. Phase 2 — Premium Landing Page

Rebuild `src/app/page.tsx` into a production-grade marketing page:

1. **Sticky glass navbar** — scroll-aware blur/scale, animated mobile drawer, active-section underline.
2. **Aurora hero** — animated mesh gradient + grid mask + noise, gradient headline with
   per-word reveal, dual CTA with magnetic hover, live stats strip (existing `LiveStatsCard`).
3. **Trust marquee** — infinite-scroll platform/integration rail (pause on hover, `prefers-reduced-motion` aware).
4. **Bento feature grid** — spotlight-on-hover cards, asymmetric spans, per-card icon animation.
5. **Interactive product preview** — tabbed (Embed / Conversational / Webhooks) with
   animated content swap; real code snippets from the shipped integration guide.
6. **"How it works"** — 3 steps with an animated SVG connector that draws on scroll.
7. **Security section** — animated trust-badge grid explaining the actual crypto in use
   (PBKDF2, AES-256-GCM, HMAC-SHA256, ALTCHA).
8. **Pricing** — Free ($0 forever) vs Self-hosted Pro — honest, no fake tiers.
9. **FAQ** — accessible accordion with smooth height animation.
10. **Final CTA + footer** — real nav, licence, attribution (the repo requires attribution be preserved).

Plus: `sitemap.ts`, `robots.ts`, `manifest.ts` (PWA), OpenGraph image upgrade.

---

## 8. Phase 5 — Dashboard Premium UX

- **Decompose the 321 KB `dashboard/page.tsx`** into `src/components/dashboard/*`
  (Header, FormsList, FormDetail, SubmissionsTable, Analytics, WebhookLogs, Settings,
  ApiKeys, AuditTrail, SessionManager, CommandPalette, Toaster). Same behaviour, far
  less risk of merge conflicts, and each piece independently reviewable.
- **Command palette** (⌘K / Ctrl+K) — jump to form, action, and setting.
- **Toast system** — consistent success/error feedback instead of ad-hoc `alert()`.
- **Skeleton + empty states** — no more blank panels.
- **Drop-off funnel chart** — new analytics visual fed by F3.

---

## 9. Verification Gate (Phase 6)

Every phase must pass all of the following before it is considered done:

```bash
npm run typecheck     # tsc --noEmit, zero errors
npm run lint          # eslint --max-warnings=0, zero warnings
npm test              # node tests/run-all-security-tests.mjs — 53/53 + new tests
npm run build         # production build succeeds
```

New security tests are appended for the new attack surface:
SSRF on the new outbound channels, authz on the new dashboard APIs, prototype-pollution
on rule/prefill keys, and the raw-IP regression test for §5.1.

---

## 10. Out of Scope (deliberate)

- Payments, e-signature, scheduling, PDF generation — belong to a *builder*, not a backend.
- Multi-tenant SaaS billing — FormForge is self-hosted BYO-cloud.
- Native mobile apps — the hosted form + embed already cover it.
- **Hosted-page theming** (custom fonts / accent colours / logo per form) — the
  dynamic hosted-form engine shipped, but per-form theming was deferred: it is a
  presentational feature with a real maintenance cost, and the design system is
  not yet validated against customer branding needs. Tracked for v1.2.
- **Splitting the 321 KB dashboard file** — the new features were extracted into
  `src/components/dashboard/*` as they were built, but a full decomposition of
  the remaining monolith is a refactor in its own right and was not mixed into
  this release.

---

## 11. Verification Record (Phase 6)

| Gate | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | ✅ 0 errors |
| Lint | `npm run lint` | ✅ 0 errors, 0 warnings (`--max-warnings=0`) |
| Security | `npm run test:security` | ✅ **66 / 66** |
| Behaviour | `npm run test:features` | ✅ **40 / 40** — the new engines exercised for real |
| Integration | `npm run test:e2e` | ✅ **24 / 24** — the real HTTP surface, end to end |
| Worker runtime | `npm run test:worker` | ✅ **4 / 4** — the built bundle booted under `wrangler dev` |
| Build | `npm run build` | ✅ OpenNext → Cloudflare Workers bundle produced (`worker.js`) |
| Runtime audit | `npm audit --omit=dev` | ✅ 0 vulnerabilities |

### Production outage postmortem — `Error 1101` (2026-11-11)

**Symptom.** The deployed Worker answered *"Worker threw a JavaScript exception"* (Cloudflare `1101`) on every request — the site was down, while the build job and all 130 local assertions were green.

**Root cause.** Next.js 16's server constructor calls `getPreviewProps()`, which resolves `/.next/server/preview-props.json` through `loadManifest`. `@opennextjs/cloudflare@1.20.6` inlined every other runtime manifest at build time but not `preview-props.json`, so the adapter's patched loader threw `Unexpected loadManifest(/.next/server/preview-props.json) call!` while constructing `NextNodeServer` — before routing any request. Upstream fixed it in `1.20.12` (`#1356`); the repo pinned `1.20.6`.

**Fix.** `@opennextjs/cloudflare` 1.20.6 → 1.20.16, plus `cacheComponents: false` / `partialPrefetching: false` in `next.config.ts` (unsupported by the adapter). Verified by booting the real bundle: `/`, `/dashboard`, `/f/:slug`, `/api/health`, `/api/openapi.json` → 200, no error in the Worker log.

**Guard.** `tests/worker-smoke.mjs` now boots `.open-next/worker.js` and asserts those routes serve, inside the Cloudflare Build job. A green `next build` is a compile check, not a runtime check; this closes the gap that let the outage ship.

### Incidental fixes surfaced by the verification gate

| Finding | Resolution |
| --- | --- |
| `npm install` failed with `ERESOLVE` | `@opennextjs/cloudflare@1.20.6` requires `next >= 15.5.24` and `wrangler ^4.125.0`; the repo pinned `next@15.5.18` / `wrangler@^4.108.0`. Bumped to `next@16.4.6`, `eslint-config-next@16.4.6`, `react@19.3.1`, `wrangler@^4.125.0`. |
| The Cloudflare build failed: *"Next.js version 15.5.29 is not supported by the Next.js team"* | Next.js **15** was released 2024-10-21, so it left the 2-year support window on 2026-10-21. Upgrading to the supported **16.x** line was the only correct fix — the alternative (`--dangerouslyUseUnsupportedNextVersion`) would ship an unpatched major, which is unacceptable for a security-first project. |
| `eslint.config.mjs` crashed: *"Converting circular structure to JSON"* | `eslint-config-next@16` ships native flat config; the `FlatCompat` shim used for the legacy eslintrc-style config breaks on the v16 plugin graph. The config now consumes the flat export directly. |
| The security suite failed 4 assertions | `.github/workflows/{ci,security-scan,release}.yml` had been untracked in commit `15ade9c` **and** listed in `.gitignore`, which silently disabled CI. Restored from history, SHA-pinned, and the ignore rule was removed. |
| `npm run dev` always answered `503 DATABASE_NOT_CONFIGURED` | The database layer imported `createClient` from `@libsql/client/web`, which cannot open `file:` URLs. The Node build is now resolved lazily through `process.getBuiltinModule()`, which does not exist in a Worker — the production bundle is unaffected. |
| The page could render blank | The scroll-reveal system hid every section behind a class added before first paint; a client-side failure meant nothing ever revealed it. A hydration failsafe now removes the class again when the runtime never reports in. |
| Encrypted forms answered every submission with a 500 | `deliverNotifications` and the verification route parsed the stored payload as JSON. Both now read the decrypted body, and the submit route logs the cause instead of swallowing it. |

---

*Plan generated from a full source-tree analysis + 2026 competitive research.
Execution order: P1 → P2 → P3 → P4 → P5 → P6.*
