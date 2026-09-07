# FormForge Production Runbook

## Deployment presets

Required Worker configuration (`wrangler.jsonc` + secrets):

```bash
# 1. Secrets (never commit these)
npx wrangler secret put AUTH_SECRET        # openssl rand -hex 32 (64 chars, min 24)
npx wrangler secret put RESEND_API_KEY     # optional, pick one email provider
npx wrangler secret put SMTP_PASS          # optional global SMTP relay

# 2. D1 + deploy
npx wrangler d1 create formforge-db        # paste database_id into wrangler.jsonc
npm run deploy
```

Production checklist: strong `AUTH_SECRET`, explicit per-form `allowedOrigins`
(not `*`), `ALLOW_REGISTRATION=false` after owner setup, retention limits set,
webhooks allowlisted to public HTTPS endpoints.

## Health-check monitoring

```bash
# Liveness (no auth) — expect {"ok":true,...}
curl -fsS https://YOUR-WORKER.workers.dev/api/health

# Anonymous aggregate stats — expect 200 with counters
curl -fsS https://YOUR-WORKER.workers.dev/api/public-stats

# Authenticated dashboard probe (owner session cookie)
curl -fsS -b cookies.txt https://YOUR-WORKER.workers.dev/api/auth/me

# Alert if: non-2xx, p99 latency > 2s, or 429 rate above baseline.
```

## Database backup / restore drill (D1)

```bash
# Monthly (or pre-release) backup drill:
npx wrangler d1 export formforge-db --output backup-$(date +%F).sql
ls -la backup-*.sql   # verify non-empty, store off-site (encrypted)

# Quarterly restore drill on a scratch database:
npx wrangler d1 create formforge-restore-drill
npx wrangler d1 execute formforge-restore-drill --file backup-<date>.sql
npx wrangler d1 execute formforge-restore-drill --command "SELECT count(*) FROM submissions;"
npx wrangler d1 delete formforge-restore-drill
```

Also export submissions per form from the dashboard (`/api/forms/<id>/export`)
before retention purges if compliance requires offline copies.

## Emergency procedures

| Incident | Action |
| -------- | ------ |
| `AUTH_SECRET` leaked | Generate new secret, `wrangler secret put AUTH_SECRET`, redeploy, delete all rows in `sessions`, revoke API keys (`revoked_at`), force owner password reset |
| Spam flood | Enable ALTCHA PoW (100% free) or Turnstile on the form, tighten blocklist, lower submit throttle, set retention purge |
| Malicious webhook exfiltrating | Clear `webhook_url` on affected forms, rotate any exposed tokens, review `notifications` table errors |
| Bad deploy | Roll back: `git tag` the last good release, `git checkout vX.Y.Z`, `npm run deploy`; D1 schema self-heals forward (no down-migration needed) |
| Committed secret | Revoke/rotate immediately, purge from git history, verify Gitleaks passes |

## Rollback procedure

```bash
git fetch --tags
git checkout v1.2.0            # last known-good tag
npm ci && npm run typecheck && npm run test:security
npm run deploy
curl -fsS https://YOUR-WORKER.workers.dev/api/health
```

## Post-deploy verification

```bash
npm run typecheck && npm run test:security
curl -fsS https://YOUR-WORKER.workers.dev/api/health
curl -fsS https://YOUR-WORKER.workers.dev/api/openapi.json | head -c 300
```
