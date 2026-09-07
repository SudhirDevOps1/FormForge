#!/usr/bin/env bash
# FormForge local security scanner — Semgrep + Gitleaks + pattern sweep.
# Usage: bash .github/scripts/security-scan-local.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "=== FormForge Local Security Scan ==="
echo ""

# 1. Semgrep
if command -v semgrep &>/dev/null; then
  echo "[1/3] Running Semgrep SAST..."
  semgrep --config p/security-audit --config p/owasp-top-ten \
          --config p/jwt --config p/xss --config p/nodejs \
          --exclude node_modules --exclude .next --exclude .open-next \
          src/
  echo "  ✅ Semgrep OK"
else
  echo "[1/3] Semgrep not found — install with: pip install semgrep"
fi
echo ""

# 2. Gitleaks
if command -v gitleaks &>/dev/null; then
  echo "[2/3] Running Gitleaks secret scan..."
  gitleaks detect --source . --no-git --redact
  echo "  ✅ Gitleaks OK"
else
  echo "[2/3] Gitleaks not found — install from: https://github.com/gitleaks/gitleaks"
fi
echo ""

# 3. Pattern sweep
echo "[3/3] Running defense-in-depth pattern sweep..."
FOUND=0
if grep -rEn \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.next \
  --exclude-dir=.open-next \
  --exclude="*.map" \
  --exclude="package-lock.json" \
  'BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY|AKIA[0-9A-Z]{16}|xox[bpas]-[0-9A-Za-z-]+|sk-live-|rk_live-' \
  . ; then
  echo "  ❌ Potential committed secret detected"
  FOUND=1
else
  echo "  ✅ No committed secrets detected"
fi
echo ""

[ "$FOUND" -eq 0 ] || exit 1
echo "=== Local security scan complete ==="
