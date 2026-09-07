#!/usr/bin/env bash
# FormForge pre-commit local check — mirrors what CI runs.
# Usage: bash .github/scripts/pre-commit-check.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== FormForge Pre-Commit Check ==="
echo ""

# 1. TypeScript
echo "[1/3] Running TypeScript typecheck..."
npm run typecheck
echo "  ✅ TypeScript OK"
echo ""

# 2. ESLint
echo "[2/3] Running ESLint (zero-warning mode)..."
npm run lint
echo "  ✅ ESLint OK"
echo ""

# 3. Security tests
echo "[3/3] Running security test suite..."
npm run test:security
echo "  ✅ Security tests OK"
echo ""

echo "=== All pre-commit checks passed! ==="
