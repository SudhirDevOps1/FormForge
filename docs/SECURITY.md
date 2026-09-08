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
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

Only the latest minor release receives full security support. Deployments
should track the newest `v*` tag (see `docs/RELEASES.md`).

## Cryptographic specifications

| Usage | Construction | Parameters |
| ----- | ------------ | ---------- |
| Password storage | PBKDF2-SHA256 (`src/lib/crypto.ts`) | 100,000 iterations, 16-byte random salt, 256-bit output, constant-time verify |
| Session tokens | HMAC-SHA256 (`src/lib/auth.ts`) | 40-byte random token, HMAC stored in D1, HttpOnly `SameSite=Lax` cookie (`Secure` off localhost), 30-day expiry |
| API keys | HMAC-SHA256 (`src/lib/api-key-auth.ts`) | `ff_<prefix>.<secret>`, hash-only storage, expiry + revocation enforced |
| Secrets at rest | AES-256-GCM (`src/lib/encryption.ts`) | SMTP passwords, Telegram bot tokens; random 12-byte IV per value |
| PII anonymization | SHA-256 (`src/lib/security.ts`, submit route) | Per-form scopes (`form:<id>:ip`), emails lowercased/trimmed before hashing |
| Constant-time compare | Full-length XOR accumulation (`timingSafeEqualHex`) | Used for HMAC/signature checks; never throws on hostile input |
| Key hygiene | `zeroize()` | Overwrites raw key buffers with zeros after use |

`AUTH_SECRET` must be a long random value (`openssl rand -hex 32`, 64 chars).
The server refuses to create sessions when it is missing or shorter than
24 characters (`isAuthConfigured`).

## Edge security posture

- Strict headers (`next.config.ts`): `nosniff`, `DENY` framing,
  `strict-origin-when-cross-origin`, restrictive `Permissions-Policy`, HSTS.
- SSRF guard (`src/lib/url-validation.ts`): webhooks/redirects blocked for
  RFC-1918, loopback (`127/8`, `::1`), `0.0.0.0/8`, link-local/metadata
  (`169.254/16`), `.localhost`/`.internal`, non-`http(s)` schemes, and
  hex/octal-obfuscated IPv4.
- Throttles: login **5 / 15 min**, registration **30 / min**, public form
  submission **60 / min** (429 + `Retry-After`).
- Spam defense: honeypot trap, ALTCHA Proof-of-Work (100% free, zero cookies, self-hosted),
  DNS-MX validation, retention auto-purge.
- Public API errors are generic (`An error occurred …`, CWE-209); SMTP
  diagnostics return detail only to the authenticated form owner.
- Automated evidence: `npm run test:security` (53 assertions across the
  crypto / XSS / SSRF / auth-abuse / PII / repo-hygiene pillars), CodeQL SAST, `npm audit`
  at `--audit-level=high`, and Gitleaks secret scanning in CI.

## Reporting email

Security contact: via GitHub Private Vulnerability Reporting, or email to the
maintainer address on <https://github.com/SudhirDevOps1> with subject prefix
`[FormForge SECURITY]`. PGP available on request.
