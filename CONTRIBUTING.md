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
5. **Test** locally: `npm run dev`
6. **Build check**: `npx tsc --noEmit` (must pass with zero errors).
7. **Commit**: `git commit -m "feat: your feature description"`
8. **Push**: `git push origin feature/your-feature`
9. **Open** a Pull Request on GitHub.

## 🧪 Development Setup

```bash
# Clone and install
git clone https://github.com/SudhirDevOps1/FormForge.git
cd FormForge
npm install

# Run locally
npm run dev

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

## 📋 Code Style

- Use **TypeScript** for all source files.
- Follow existing naming conventions and project structure.
- Use **Drizzle ORM** for all database operations — no raw SQL.
- Encrypt sensitive data at rest using **AES-GCM** via Web Crypto API.
- Use **parameterized queries** only — no string interpolation in SQL.

## 🐛 Reporting Bugs

1. Check existing [issues](https://github.com/SudhirDevOps1/FormForge/issues) first.
2. Include steps to reproduce, expected behavior, and actual behavior.
3. Include browser/OS information if relevant.

## 💡 Feature Requests

Open a new [issue](https://github.com/SudhirDevOps1/FormForge/issues/new) with the `enhancement` label and describe the use case.

---

> **FormForge** — Privacy-first serverless form backend  
> Developed with ❤️ by [Sudhir Singh](https://github.com/SudhirDevOps1)
