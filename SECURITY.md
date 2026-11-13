# Security Policy

FormForge handles form submissions, uploaded documents and account credentials,
so security reports are taken seriously and handled privately.

## Responsible disclosure

**Do not open a public GitHub issue, discussion or pull request for a suspected
vulnerability.**

Report it privately through one of these channels:

1. **GitHub Private Vulnerability Reporting** — repository → `Security` tab →
   `Report a vulnerability` (preferred: it keeps the report, the fix and the
   advisory in one private thread).
2. **Email the maintainer** — Sudhir Singh; the address is published on the
   [maintainer profile](https://github.com/SudhirDevOps1).

Please include:

- the affected version or tag (the running version is reported by
  `GET /api/health`),
- a description of the impact and the affected endpoint, page or setting,
- reproduction steps or a minimal proof of concept,
- any deployment shape that matters (Cloudflare Worker, Node host, local dev),
- a suggested mitigation if you have one.

**Never include real respondent data, session cookies, API keys or personal
information** in a report. Redact payloads; a synthetic reproduction is always
enough.

## What to expect

| Stage | Target |
| :--- | :--- |
| Acknowledgement of the report | within **72 hours** |
| Triage + severity assessment | within **7 days** |
| Fix or documented mitigation | critical/high: as soon as practical; lower: next minor release |
| Public advisory + credit | coordinated with you, after the fix ships |

You will be credited in `docs/CHANGELOG.md` and the GitHub Security Advisory
unless you ask to stay anonymous. Please give us a reasonable window to ship a
patch before publishing details.

## Supported versions

| Version | Supported |
| :--- | :--- |
| latest `MINOR.x` release | :white_check_mark: |
| previous `MINOR.x` release | :white_check_mark: (security fixes only) |
| older releases | :x: |

Only the newest release receives full support. Deployments should track the
latest `v*` tag — releases are produced by `release-please` and published by the
`Release` workflow (see [`docs/RELEASES.md`](./docs/RELEASES.md)). Each release
ships an SPDX SBOM and a Sigstore signature so you can verify what you deploy.

## Scope

In scope:

- authentication, session handling, 2FA/TOTP and password reset flows,
- authorization between accounts, forms, submissions and API keys,
- the public submission endpoint (`/api/submit/:endpointId`), including CORS,
  rate limiting, honeypot, ALTCHA and file-upload handling,
- injection, SSRF, path traversal, unsafe deserialization and template issues,
- secret handling and encryption at rest,
- the release pipeline, workflow permissions and supply chain.

Out of scope:

- findings that require a compromised device, browser extension or admin
  account,
- volumetric denial of service and free-tier quota exhaustion on a public
  deployment,
- missing hardening headers with no demonstrated impact,
- reports produced solely by an automated scanner without a working exploit,
- social engineering of maintainers or users.

## Safe harbour

Good-faith research that respects this policy, stays within your own accounts and
data, avoids privacy violations, service degradation and data destruction, and
gives us reasonable time to fix the issue before disclosure will not be pursued.
If in doubt about whether an action is allowed, ask first via a private report.

## More detail

- [`docs/SECURITY.md`](./docs/SECURITY.md) — security model and controls.
- [`docs/THREAT-MODEL.md`](./docs/THREAT-MODEL.md) — assets, actors, threats.
- [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) — incident response and recovery.
