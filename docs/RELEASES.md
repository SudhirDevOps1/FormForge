# FormForge Releases & Branching Model

## Branching model (trunk-based)

- `main` is the single long-lived branch and is always deployable.
- Feature work lands via short-lived branches + pull requests into `main`.
- Every PR runs `CI` (typecheck, zero-warning lint, security suite) and the
  `Security scan` (CodeQL, `npm audit`, secret scan). PRs with failing checks
  are not merged.
- Weekly scheduled scans run on `main` even without code changes.

## Versioning

Semantic versioning (`MAJOR.MINOR.PATCH`), Keep-a-Changelog discipline:

1. Add entries under `docs/CHANGELOG.md` → `## [Unreleased]` as you merge.
2. On release day, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`
   (and mirror user-facing highlights into root `CHANGELOG.md`).
3. Commit on `main`, then tag and push:

```bash
git tag -a v1.0.0 -m "FormForge v1.0.0"
git push origin main v1.0.0
```

## Tag release workflow (`release.yml`)

Pushing a `v*` tag automatically:

1. Checks out full history and sets up Node.js 20.
2. Runs `.github/scripts/extract-changelog.mjs <tag>`, which prints the
   matching `## [X.Y.Z]` section from `docs/CHANGELOG.md` into
   `release-notes.md` (falls back to a placeholder if the section is missing).
3. Publishes a **verified GitHub Release** via `softprops/action-gh-release`
   with those notes (+ auto-generated notes) and attaches
   `docs/CHANGELOG.md` and `CHANGELOG.md` as release assets.

```bash
# Roll back production to a previous release:
git checkout v1.0.0
npm ci && npm run typecheck && npm run test:security
npm run deploy
```

## Pre-release checklist

- [ ] `docs/CHANGELOG.md` section dated and accurate.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:security` green locally.
- [ ] CI + security scan green on `main`.
- [ ] D1 backup exported (`docs/RUNBOOK.md` drill).
- [ ] Tag pushed; Release notes + assets verified on GitHub.
