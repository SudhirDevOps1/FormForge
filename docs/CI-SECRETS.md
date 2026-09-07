# CI/CD Secrets & Environment Variables

This document lists every secret and variable required by the GitHub Actions
workflows in `.github/workflows/`. Configure these under:
**GitHub repo → Settings → Secrets and variables → Actions**

---

## Required Secrets (encrypted)

| Secret Name | Required By | Description |
| ----------- | ----------- | ----------- |
| `CODECOV_TOKEN` | `ci.yml` (future) | Codecov.io upload token for coverage reports. Get from codecov.io. |
| `SEMGREP_APP_TOKEN` | `security.yml` | Semgrep Cloud token. Get from semgrep.dev. Optional — workflow runs in OSS mode without it. |
| `GITLEAKS_LICENSE` | `security.yml` | Gitleaks Pro license. Optional — free tier works without it. |

## Optional Deployment Secrets (for manual deploys via Actions)

| Secret Name | Required By | Description |
| ----------- | ----------- | ----------- |
| `CLOUDFLARE_API_TOKEN` | (future `deploy.yml`) | Cloudflare API token with `Workers:Edit` + `D1:Edit` permissions. Scope to this account only. |
| `CLOUDFLARE_ACCOUNT_ID` | (future `deploy.yml`) | Cloudflare Account ID (from dashboard URL). |

## Runtime Secrets (Cloudflare Workers — NOT GitHub secrets)

These are set via `wrangler secret put <NAME>` or the Cloudflare Dashboard.
They are **NOT** needed in GitHub Actions for CI/build.

| Secret Name | Description |
| ----------- | ----------- |
| `AUTH_SECRET` | HMAC/session signing key. Generate: `openssl rand -hex 32` (64 chars minimum). |
| `RESEND_API_KEY` | Optional. Resend.com transactional email API key. |
| `BREVO_API_KEY` | Optional. Brevo (Sendinblue) API key. |
| `SENDGRID_API_KEY` | Optional. SendGrid API key. |
| `MAILGUN_API_KEY` | Optional. Mailgun API key. |
| `SMTP_PASS` | Optional. SMTP password (stored AES-256-GCM encrypted at rest). |
| `S3_ACCESS_KEY_ID` | Optional. S3-compatible storage access key. |
| `S3_SECRET_ACCESS_KEY` | Optional. S3-compatible storage secret key. |

## Cloudflare Vars (non-secret, set in wrangler.jsonc or dashboard)

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `APP_NAME` | `FormForge` | Application display name |
| `ALLOW_REGISTRATION` | `true` | Set to `false` for owner-only mode |
| `RESEND_FROM` | — | Verified sender address for Resend |
| `BREVO_FROM` | — | Sender address for Brevo |
| `SENDGRID_FROM` | — | Sender address for SendGrid |
| `MAILGUN_DOMAIN` | — | Mailgun domain |
| `MAILGUN_FROM` | — | Sender address for Mailgun |
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | — | SMTP port (typically 587 or 465) |
| `SMTP_USER` | — | SMTP authentication username |
| `SMTP_FROM` | — | Sender address for SMTP |
| `SMTP_ENABLED` | — | Set to `true` to enable SMTP |
| `S3_ENDPOINT` | — | S3-compatible endpoint URL |
| `S3_BUCKET_NAME` | — | S3 bucket name |
| `S3_REGION` | — | S3 region identifier |

---

## Security Notes

- Never commit any of these secrets to the repository.
- Rotate `AUTH_SECRET` immediately if you suspect it has been exposed.
- Cloudflare API tokens should be scoped to the minimum required permissions.
- Use [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning) to detect accidental leaks.
