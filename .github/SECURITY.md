# Security Policy — FormForge

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately through one of these channels:

1. **GitHub Private Vulnerability Reporting** — `Security` tab → `Report a vulnerability`
2. **Email** — maintainer address published on [SudhirDevOps1's profile](https://github.com/SudhirDevOps1)
   with subject prefix `[FormForge SECURITY]`. PGP available on request.

Please include:
- Affected version/tag
- Reproduction steps or proof of concept
- Impact assessment
- Suggested mitigation (if any)

**Response SLA:**
| Milestone | Target |
| --------- | ------ |
| Acknowledge | ≤ 72 hours |
| Triage & severity assessment | ≤ 7 days |
| Patch or mitigation shipped | ≤ 30 days (critical), ≤ 90 days (high) |
| Coordinated public disclosure | After patch is released |

Reporters credited in `docs/CHANGELOG.md` unless anonymity is requested.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.2.x   | ✅ Full support |
| 1.1.x   | ✅ Security fixes only |
| < 1.1.0 | ❌ End-of-life |

Only the latest minor release receives full security support.
Track the newest `v*` tag (see `docs/RELEASES.md`).

## Security Architecture

FormForge is a privacy-first form backend with the following controls:

| Control | Implementation |
| ------- | ------------- |
| Password hashing | PBKDF2-SHA256, 100k iterations, 16-byte salt |
| Session tokens | HMAC-SHA256, 40-byte random, hash-only storage |
| API keys | `ff_<prefix>.<secret>`, HMAC-SHA256, hash-only |
| Secrets at rest | AES-256-GCM, random 12-byte IV per value |
| PII anonymization | SHA-256 per-form-scoped hashes |
| SSRF prevention | RFC-1918 + loopback + metadata IP blocklist |
| Rate limiting | Login 5/15min, registration 30/min, submit 60/min |
| Injection prevention | Drizzle ORM (no raw SQL), CSP headers |
| Transport security | HSTS, `nosniff`, `DENY` framing, restrictive CSP |

For full details see `docs/SECURITY.md` and `docs/THREAT-MODEL.md`.
