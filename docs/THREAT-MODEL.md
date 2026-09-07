# FormForge Threat Model

Scope: the deployed Cloudflare Worker + D1 database + R2/S3 file storage +
outbound email/webhook integrations. Attackers are assumed to control public
inputs (form payloads, files, headers, origins) but not Cloudflare, D1, or
the operator'"'"'s secrets.

| Threat | Mitigation | Residual risk |
| ------ | ---------- | ------------- |
| Host / Worker compromise | Secrets in encrypted Worker vars, never in code; `AUTH_SECRET` length gate; DB binding (not URL) | **Medium** — a leaked `AUTH_SECRET` forces rotation + session/API-key invalidation; runbook covers it |
| Password brute-force / credential stuffing | PBKDF2-100k, login throttle 5/15 min per IP, generic `INVALID_CREDENTIALS`, owner-only registration mode | **Low** — distributed botnets share the same per-IP budget |
| Session theft / replay | 40-byte random tokens, HMAC-only storage, HttpOnly `SameSite=Lax` (+`Secure`), 30-day expiry, version-revocation pattern (`createSessionVersionStore`) | **Low** — XSS that could steal non-HttpOnly state is separately mitigated; operator must serve HTTPS |
| CSRF | `SameSite=Lax` session cookie, origin allowlist per form (`ORIGIN_BLOCKED`), state-changing routes require session/API key | **Low** — wildcard `*` origins weaken this; production checklist mandates explicit `allowedOrigins` |
| SSRF via webhook / redirect URL | `isPrivateUrl` blocks RFC-1918, `127/8`, `::1`, `0.0.0.0/8`, `169.254/16`, `.localhost`/`.internal`, non-http(s), hex/octal-obfuscated IPv4; tested in `tests/run-all-security-tests.mjs` P3 | **Low** — DNS rebinding between check and fetch is a known TOCTOU; mitigate with egress filtering where available |
| Stored / reflected XSS | Allowlist sanitizer (`sanitizeHtml`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`; email templates escape interpolated values | **Low** — dashboard renders payloads; keep the sanitizer allowlist minimal and review template changes |
| SQL / NoSQL injection | Drizzle parameterized queries only (no raw SQL; CI-adjacent test asserts it), field-key allowlist rejects `__proto__`/`constructor`/operator keys, 64 KB payload cap | **Low** |
| Spam / bot abuse | Honeypot, ALTCHA Proof-of-Work (100% free, privacy-first), blocklist (+100 score), MX validation, 60/min submit throttle, retention purge | **Low** — silent in-browser PoW challenge blocks automated submission bots |
| Data theft (D1 exfiltration) | AES-GCM secrets at rest, SHA-256 PII pseudonymization, per-form IP scopes, CSV/JSON export restricted to form owner | **Medium** — D1 contents remain sensitive; enable Cloudflare access logs + recurring off-site backups |
| Error-information leakage (CWE-209) | Generic public errors; `containsInternalLeak`/`toPublicError` helpers; test-smtp detail gated behind owner auth | **Low** — owner-visible SMTP diagnostics intentionally verbose for debugging |
| Dependency / supply-chain compromise | `npm audit --audit-level=high`, CodeQL SAST, weekly scheduled scans, Dependabot-ready manifest | **Low** —honor audit failures; do not add dependencies without review |
| Secret commit (accidental push) | Gitleaks + private-key pattern sweep on every push/PR | **Low** — rotate immediately per runbook if a scan ever fires |
| File-upload abuse | Storage keys hash-scoped, traversal neutralized, authenticated download proxy, optional R2/S3 only (no execution path in Worker) | **Low** — enforce bucket-side content-type + size caps in production |

## Trust boundaries

1. **Public internet → Worker**: untrusted; every byte validated.
2. **Worker → D1/R2/S3/email APIs**: trusted credentials, encrypted in transit.
3. **Dashboard owner session**: trusted after auth; still bound by per-form ownership checks.
4. **Outbound webhooks**: untrusted destination; SSRF guard + generic JSON only.

## Out of scope (accepted)

- Cloudflare platform compromise, D1 encryption-at-rest internals.
- End-user device malware, operator workstation security.
- DNS-rebinding TOCTOU (documented above), email-provider-side abuse.
