# Contributing to FormForge

Thank you for your interest in contributing to FormForge! 🚀

## 👨‍💻 Developed By

**Sudhir Singh** — [github.com/SudhirDevOps1](https://github.com/SudhirDevOps1)

## 📜 License

FormForge is released under the **MIT License**.

**© 2024-2026 Sudhir Singh. All rights reserved.**

If you host, fork, or redistribute FormForge:
- Please credit **Sudhir Singh** as the original developer.
- Include a link to the original repository: [github.com/SudhirDevOps1/FormForge](https://github.com/SudhirDevOps1/FormForge).

## 🛠️ How to Contribute

1. **Fork** the repository.
2. **Clone** your fork: `git clone https://github.com/YOUR-USERNAME/FormForge.git`
3. **Create** a feature branch: `git checkout -b feature/your-feature`
4. **Make** your changes.
5. **Verify locally**:
   - `npm run typecheck` (must pass with zero errors)
   - `npm run lint` (must pass with zero warnings)
   - `npm run test:security` and `npm run test:features` (all suites green)
6. **Commit** using [Conventional Commits](#-commit-messages-conventional-commits) — the release notes and version bumps are generated from these messages.
7. **Push**: `git push origin feature/your-feature`
8. **Open** a Pull Request on GitHub. Every required check must be green; the
   merged branch is deleted automatically.

## 🧪 Development Setup

```bash
# Clone and install dependencies
git clone https://github.com/SudhirDevOps1/FormForge.git
cd FormForge
npm install

# Run locally in development mode
npm run dev

# Run strict TypeScript check
npm run typecheck

# Run zero-warning linter
npm run lint

# Run automated security + feature regression suites
npm run test:security
npm run test:features

# Build for production
npm run build
```

## 📋 Code Style

- Use **TypeScript** for all source files.
- Follow existing naming conventions and project structure.
- Use **Drizzle ORM** for all database operations — no raw SQL.
- Encrypt sensitive data at rest using **AES-GCM** via Web Crypto API.
- Use **parameterized queries** only — no string interpolation in SQL.

## 📝 Commit Messages (Conventional Commits)

FormForge uses [Conventional Commits](https://www.conventionalcommits.org/) for
two reasons: `commitlint` rejects malformed messages in a `commit-msg` hook, and
`release-please` derives the next version **and** the changelog from them. A
sloppy message becomes a wrong release note, so the format is enforced, not
suggested.

### Format

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

| Type | Use for | Release effect |
| :--- | :--- | :--- |
| `feat` | a new user-visible capability | **minor** bump |
| `fix` | a bug fix | **patch** bump |
| `perf` | performance/cost improvement without behaviour change | patch bump |
| `refactor` | restructuring with no behaviour change | patch bump |
| `docs` | documentation only | patch bump |
| `test` | tests only | patch bump |
| `build` | build system, dependencies, lockfiles | patch bump |
| `ci` | workflows and automation | patch bump |
| `chore` | maintenance that fits nowhere else | patch bump |
| `revert` | reverting an earlier commit | patch bump |

### Rules

- **Subject**: imperative, lower-case, no trailing period, ≤ 72 characters.
  The whole header must stay within 100 characters (`commitlint` enforces it).
- **Scope** is optional and lower-case — use the area you touched:
  `auth`, `submit`, `dashboard`, `db`, `cache`, `release`, `ci`, `docs`.
- **Body** explains *why*, not *what*; wrap at 100 characters.
- **Breaking changes** must be explicit — either `feat!:` / `fix!:` or a
  `BREAKING CHANGE:` footer. That is the only thing that triggers a **major**
  bump, so never hide one.
- One logical change per commit. Formatting-only churn belongs in its own
  `style:` commit so the diff stays reviewable.

### Examples

```
feat(cache): add a KV read-through layer in front of D1
fix(auth): invalidate the cached session on logout
perf(submit): batch webhook delivery telemetry writes
docs(readme): document the KV namespace setup
ci(release): let release-please own tags and releases

feat(api)!: require HMAC signatures on v2 webhook deliveries

BREAKING CHANGE: unsigned deliveries now receive HTTP 401.
```

Version numbers are **never edited by hand**. `release-please` bumps
`package.json`, `package-lock.json`, `docs/CHANGELOG.md`, `README.md` and
`version.md` together in a Release PR, and the application reads the version
from `package.json` at build time (`src/lib/version.ts`). Merging that PR is the
only way a release is published — see [`docs/RELEASES.md`](./docs/RELEASES.md).

---

## 🐛 Reporting Bugs

1. Check existing [issues](https://github.com/SudhirDevOps1/FormForge/issues) first.
2. Include steps to reproduce, expected behavior, and actual behavior.
3. Include browser/OS information if relevant.

## 💡 Feature Requests

Open a new [issue](https://github.com/SudhirDevOps1/FormForge/issues/new) with the `enhancement` label and describe the use case.

---

> **FormForge** — Privacy-first serverless form backend  
> Developed with ❤️ by [Sudhir Singh](https://github.com/SudhirDevOps1)
