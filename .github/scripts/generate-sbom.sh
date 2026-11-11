#!/usr/bin/env bash
# FormForge local SBOM generator — requires syft (https://github.com/anchore/syft).
# Usage: bash .github/scripts/generate-sbom.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

OUTPUT_FILE="formforge-sbom-$(date +%Y%m%d).spdx.json"

echo "=== FormForge SBOM Generator ==="
echo ""

if ! command -v syft &>/dev/null; then
  echo "Syft not found. Install with:"
  echo "  curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin"
  exit 1
fi

echo "Generating SBOM in SPDX JSON format..."
syft . --output spdx-json="$OUTPUT_FILE"
echo ""
echo "SBOM written to: $OUTPUT_FILE"
echo ""
echo "=== SBOM generation complete ==="
