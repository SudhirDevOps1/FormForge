/**
 * Compute the next semantic version for the next release.
 *
 * Baseline is the highest `v*.*.*` tag in the repository; when no tag exists
 * yet (or the tag list is unreadable) the `version` field in `package.json`
 * is used instead, so the first automated release starts from the version the
 * code already claims.
 *
 * Usage: node .github/scripts/next-version.mjs [patch|minor|major]
 * Output: GitHub Actions output file lines (`version=`, `tag=`, `previous=`)
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const bump = String(process.argv[2] || "patch").trim().toLowerCase();
if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`next-version: unsupported bump "${bump}" (use patch, minor or major)`);
  process.exit(1);
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim());
  if (!match) return null;
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function compareVersions(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function highestTag() {
  let output = "";
  try {
    output = execSync("git tag --list 'v*.*.*'", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
  let best = null;
  for (const line of output.split("\n")) {
    const parsed = parseVersion(line.trim().replace(/^v/, ""));
    if (parsed && (!best || compareVersions(parsed, best) > 0)) best = parsed;
  }
  return best;
}

const baseline =
  highestTag() ??
  parseVersion(JSON.parse(readFileSync("package.json", "utf8")).version);

if (!baseline) {
  console.error("next-version: neither a vX.Y.Z tag nor a semver package.json version was found");
  process.exit(1);
}

const [major, minor, patch] = baseline;
const next =
  bump === "major"
    ? [major + 1, 0, 0]
    : bump === "minor"
      ? [major, minor + 1, 0]
      : [major, minor, patch + 1];

const version = next.join(".");
console.log(`version=${version}`);
console.log(`tag=v${version}`);
console.log(`previous=${baseline.join(".")}`);
