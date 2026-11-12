# FormForge Security Policy

## Responsible disclosure

**Do not open a public GitHub issue for a suspected vulnerability.**
Instead, report it privately through one of these channels:

1. GitHub Private Vulnerability Reporting on this repository
   (`Security` tab → `Report a vulnerability`), or
2. Email the maintainer: **Sudhir Singh** — see the address published on the
   [maintainer profile](https://github.com/SudhirDevOps1).

Please include: affected version/tag, reproduction steps or proof of concept,
impact assessment, and any suggested mitigation. We aim to acknowledge reports
within **72 hours**, ship a fix or mitigation, credit the reporter in
`docs/CHANGELOG.md` (unless anonymity is requested), and publish a patched
release with a coordinated disclosure note.

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

Only the latest minor release receives full security support. Deployments
should track the newest `v*` tag (see `docs/RELEASES.md`).

## Cryptographic specifications

| Usage | Construction | Parameters |
| ----- | ------------ | ---------- |
| Password storage | PBKDF2-SHA256 (`src/lib/crypto.ts`) | 100,000 iterations, 16-byte random salt, 256-bit output, constant-time verify |
| Session tokens | HMAC-SHA256 (`src/lib/auth.ts`) | 40-byte random token, HMAC stored in D1, `__Host-` prefixed cookie on secure origins (`Secure; Path=/; HttpOnly; SameSite=Lax`, no `Domain`), 30-day expiry |
| API keys | HMAC-SHA256 (`src/lib/api-key-auth.ts`) | `ff_<prefix>.<secret>`, hash-only storage, expiry + revocation enforced |
| Secrets at rest | AES-256-GCM (`src/lib/encryption.ts`) | SMTP passwords, Telegram bot tokens; random 12-byte IV per value |
| PII anonymization | SHA-256 (`src/lib/security.ts`, submit route) | Per-form scopes (`form:<id>:ip`), emails lowercased/trimmed before hashing |
| Constant-time compare | Full-length XOR accumulation (`timingSafeEqualHex`) | Used for HMAC/signature checks; never throws on hostile input |
| Key hygiene | `zeroize()` | Overwrites raw key buffers with zeros after use |

`AUTH_SECRET` must be a long random value (`openssl rand -hex 32`, 64 chars).
The server refuses to create sessions when it is missing or shorter than
24 characters (`isAuthConfigured`).

## Edge security posture

- Strict headers from a single source of truth (`src/lib/security-headers.ts`,
  applied by `next.config.ts`): `nosniff`, `strict-origin-when-cross-origin`,
  restrictive `Permissions-Policy`, HSTS, `Cross-Origin-Opener-Policy`,
  `Cross-Origin-Resource-Policy`, and a strict **Content-Security-Policy**
  (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `frame-ancestors 'none'`).
  The hosted form page (`/f/*`) is the only path that permits framing, because
  embedding it is a documented feature.
- `script-src` includes `'unsafe-inline'`. Next.js injects inline
  bootstrap/hydration scripts and a per-request nonce is not available on
  every runtime FormForge targets. This is a deliberate, documented
  trade-off — it is safe here because there is no user-authored markup, every
  stored string is sanitized on the way in (`sanitizeHtml`) and escaped on
  the way out.
- SSRF guard (`src/lib/url-validation.ts`): webhooks/redirects blocked for
  RFC-1918, loopback (`127/8`, `::1`), `0.0.0.0/8`, link-local/metadata
  (`169.254/16`), `.localhost`/`.internal`, non-`http(s)` schemes, and
  hex/octal-obfuscated IPv4.
- Throttles: login **5 / 15 min**, registration **30 / min**, public form
  submission **60 / min** (429 + `Retry-After`, configurable per form),
  password reset **5 / 15 min per IP** and **3 / 15 min per address**,
  form unlock **10 / 5 min per IP**.
- Spam defense: honeypot trap, ALTCHA Proof-of-Work (100% free, zero cookies, self-hosted),
  DNS-MX validation, retention auto-purge.
- IP addresses are never stored in plaintext. When IP hashing is enabled the
  value is a SHA-256 hash salted with the current UTC day (correlatable
  within a day, not across days); when it is disabled **no value is stored at
  all**.
- Public API errors are generic (`An error occurred …`, CWE-209); SMTP
  diagnostics return detail only to the authenticated form owner.
- Supply chain: `npm audit --audit-level=high --omit=dev` gates production
  dependencies (dev-only advisories are reviewed separately), every GitHub
  Action is pinned to a full commit SHA, and
  `npm run test:licenses` refuses GPL/AGPL/LGPL in the production tree
  (`scripts/check-licenses.mjs` reads `package-lock.json`, so its verdict
  cannot drift from `npm ci`; the optional prebuilt `sharp`/libvips binaries
  are the only reviewed exceptions, and they are never bundled into the
  Worker).
- Automated evidence: `npm run test:security` (68 assertions across the
  crypto / XSS / SSRF / auth-abuse / PII / repo-hygiene / new-feature pillars),
  CodeQL SAST, `npm audit` at `--audit-level=high`, and Gitleaks secret
  scanning in CI.

## Reporting email

Security contact: via GitHub Private Vulnerability Reporting, or email to the
maintainer address on <https://github.com/SudhirDevOps1> with subject prefix
`[FormForge SECURITY]`. PGP available on request.
