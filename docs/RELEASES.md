# FormForge Releases & Branching Model

## Branching model (trunk-based)

- `main` is the single long-lived branch and is always deployable.
- Feature work lands via short-lived branches + pull requests into `main`.
- Every PR runs `CI` (typecheck, zero-warning lint, security suite) and the
  `Security scan` (CodeQL, `npm audit`, secret scan). PRs with failing checks
  are not merged.
- Weekly scheduled scans run on `main` even without code changes.
- Branches are deleted on merge; a merged PR never leaves a stale branch or a
  second open PR behind.

## Versioning

Semantic versioning (`MAJOR.MINOR.PATCH`), Keep-a-Changelog discipline.
`docs/CHANGELOG.md` is the single source of truth for release notes: the
release pipeline extracts the section that matches the tag.

## Approval-gated release (recommended)

Nothing is published without an explicit approval. The gate is the merge of
the release PR, and the `release` environment (Settings → Environments) can
additionally require a reviewer before assets are attached.

1. **Actions → Release → Run workflow**, choose `patch`, `minor` or `major`
   (optionally tick `dry_run` to only print the computed version).
2. `plan` computes the next version from the highest `v*.*.*` tag (falling
   back to `package.json` when no tag exists yet).
3. `open-release-pr` bumps `package.json` + `package-lock.json`, writes a
   `## [X.Y.Z] - YYYY-MM-DD` section into `docs/CHANGELOG.md` generated from
   the conventional commits since the previous tag, pushes
   `release/vX.Y.Z` and opens `chore(release): vX.Y.Z`.
4. **Approval:** merge that PR. Auto-merge is enabled when the repository
   allows it, so a green PR merges itself; otherwise merge it by hand.
5. `release-tag.yml` sees the `chore(release)` merge, verifies the version has
   no tag yet, creates the annotated `vX.Y.Z` tag, and dispatches
   `release.yml` with that exact version.
6. `release.yml` runs `validate-tag` (tag must equal `package.json`), the full
   `ci-gate` (typecheck, lint, security suite, Cloudflare build), then
   `create-release`: SBOM (SPDX), Sigstore keyless signature, and the GitHub
   Release with notes from `docs/CHANGELOG.md` plus auto-generated notes.

Only `chore(release):` merges can mint a tag, so a dependency PR that touches
`package.json` cannot accidentally ship a release.

## Manual release (escape hatch)

```bash
# 1. Land the version bump + changelog section on main through a normal PR.
# 2. Then tag the merge commit:
git tag -a v1.2.0 -m "FormForge v1.2.0"
git push origin v1.2.0
```

The tag push runs the same `release.yml` pipeline (`validate-tag` → `ci-gate`
→ `create-release`), so the manual path cannot skip the gate.

## Release assets

Every release attaches `docs/CHANGELOG.md`, `CHANGELOG.md`,
`formforge-sbom.spdx.json` and its `formforge-sbom.spdx.json.bundle` Sigstore
signature. Verify the SBOM offline with:

```bash
cosign verify-blob ./formforge-sbom.spdx.json \
  --bundle ./formforge-sbom.spdx.json.bundle
```

## Rollback

```bash
git checkout v1.0.0
npm ci && npm run typecheck && npm run test:security
npm run deploy
```

## Pre-release checklist

- [ ] `docs/CHANGELOG.md` section dated and accurate (the automated section is
      a draft — review it inside the release PR before merging).
- [ ] `npm run typecheck`, `npm run lint`, `npm run test:security` green locally.
- [ ] CI + security scan green on `main`.
- [ ] D1 backup exported (`docs/RUNBOOK.md` drill).
- [ ] Release published; notes + SBOM + signature verified on GitHub.
- [ ] Release branch deleted, no open PRs or stale branches left behind.
