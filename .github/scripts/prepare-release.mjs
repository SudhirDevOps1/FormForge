/**
 * Prepare the release commit: bump `package.json` and write the
 * Keep-a-Changelog section for `docs/CHANGELOG.md`.
 *
 * The changelog section is generated from the conventional-commit subjects
 * between the previous `v*` tag and HEAD, so a release note always describes
 * what actually changed instead of depending on someone remembering to edit
 * the file by hand.
 *
 * Usage: node .github/scripts/prepare-release.mjs 1.2.0
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const rawVersion = String(process.argv[2] || "").trim();
const version = rawVersion.replace(/^v/, "");

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`prepare-release: "${rawVersion}" is not a semver version`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

/* ----------------------------- changelog ----------------------------- */

const GROUPS = [
  { heading: "Breaking Changes", match: (type, breaking) => breaking },
  { heading: "Added", match: (type) => type === "feat" },
  { heading: "Fixed", match: (type) => type === "fix" },
  { heading: "Performance", match: (type) => type === "perf" },
  { heading: "Documentation", match: (type) => type === "docs" },
  { heading: "Changed", match: (type) => ["refactor", "style", "revert"].includes(type) },
  { heading: "Tests", match: (type) => type === "test" },
  { heading: "Internal", match: (type) => ["build", "ci", "chore", "deps"].includes(type) },
];

function git(args) {
  return execSync(`git ${args}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function previousTag() {
  try {
    const tags = git("tag --list 'v*.*.*'").split("\n").filter(Boolean);
    const parsed = tags
      .map((tag) => {
        const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
        return match ? { tag: tag.trim(), parts: match.slice(1).map(Number) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        for (let index = 0; index < 3; index += 1) {
          if (a.parts[index] !== b.parts[index]) return b.parts[index] - a.parts[index];
        }
        return 0;
      });
    return parsed.length > 0 ? parsed[0].tag : null;
  } catch {
    return null;
  }
}

function commitSubjects() {
  const tag = previousTag();
  // Without a previous tag every commit in history would qualify; cap the
  // window so the very first automated release note stays readable.
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const limit = tag ? "" : "-n 40";
  try {
    return git(`log ${range} ${limit} --no-merges --pretty=format:%s`).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function buildSection() {
  const grouped = new Map(GROUPS.map((group) => [group.heading, []]));

  for (const subject of commitSubjects()) {
    if (/^chore\(release\)/.test(subject)) continue;
    const match = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(subject);
    const type = match ? match[1].toLowerCase() : "other";
    const breaking = Boolean(match && match[3]);
    const text = match ? match[4].trim() : subject.trim();
    const line = `- ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    const group =
      GROUPS.find((candidate) => candidate.match(type, breaking)) ??
      GROUPS.find((candidate) => candidate.heading === "Changed");
    grouped.get(group.heading).push(line);
  }

  const lines = [`## [${version}] - ${today}`, ""];
  for (const group of GROUPS) {
    const entries = grouped.get(group.heading);
    if (!entries || entries.length === 0) continue;
    lines.push(`### ${group.heading}`);
    lines.push(...entries);
    lines.push("");
  }
  if (lines.length === 2) {
    lines.push("### Changed");
    lines.push("- Release cut from `main` with no user-facing commits since the previous tag.");
    lines.push("");
  }
  return lines.join("\n");
}

/* ---------------------------- write files ---------------------------- */

/** Keep the file's existing line endings so a version bump stays a one-line diff. */
function eolOf(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function writePreservingEol(path, text, eol) {
  writeFileSync(path, text.replace(/\r?\n/g, eol));
}

const pkgPath = "package.json";
const pkgText = readFileSync(pkgPath, "utf8");
const pkgEol = eolOf(pkgText);
const previousVersion = JSON.parse(pkgText).version;

// Patch only the top-level `version` field: re-serialising the whole file
// would rewrite formatting and line endings for no reason.
const bumpedPkg = pkgText.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`);
if (JSON.parse(bumpedPkg).version !== version) {
  console.error("prepare-release: could not patch the package.json version field");
  process.exit(1);
}
writePreservingEol(pkgPath, bumpedPkg, pkgEol);

// Keep the lockfile's recorded version in step so `npm install` on a clean
// clone does not rewrite it into an unrelated diff.
try {
  const lockPath = "package-lock.json";
  const lockText = readFileSync(lockPath, "utf8");
  const lockEol = eolOf(lockText);
  const lock = JSON.parse(lockText);
  lock.version = version;
  if (lock.packages && lock.packages[""]) lock.packages[""].version = version;
  writePreservingEol(lockPath, `${JSON.stringify(lock, null, 2)}\n`, lockEol);
  console.log(`prepare-release: lockfile version ${previousVersion} -> ${version}`);
} catch {
  console.warn("prepare-release: package-lock.json not updated (missing or unreadable)");
}

const changelogPath = "docs/CHANGELOG.md";
let changelog = readFileSync(changelogPath, "utf8");

if (changelog.includes(`## [${version}]`)) {
  console.error(`prepare-release: docs/CHANGELOG.md already has a ${version} section`);
  process.exit(1);
}

const section = buildSection();
const firstSectionIndex = changelog.search(/^##\s+\[/m);

if (firstSectionIndex === -1) {
  changelog = `${changelog.trimEnd()}\n\n${section}\n`;
} else {
  const header = changelog.slice(0, firstSectionIndex);
  const rest = changelog.slice(firstSectionIndex);
  const withoutUnreleased = header.replace(/^##\s+\[Unreleased\][^\n]*\n+/m, "");
  changelog = `${withoutUnreleased.trimEnd()}\n\n## [Unreleased]\n\n${section}\n${rest}`;
}

writePreservingEol(changelogPath, changelog.replace(/\n{3,}/g, "\n\n"), eolOf(changelog));

console.log(`prepare-release: wrote version ${version} to package.json and docs/CHANGELOG.md`);
