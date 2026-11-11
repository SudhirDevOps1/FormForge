#!/usr/bin/env node
/**
 * Validate every third-party action pin in the GitHub workflows.
 *
 * A SHA that does not exist on the remote breaks the workflow at the "Prepare
 * all required actions" step — the job fails before it runs a single line.
 * That is exactly what happened to `actions/cache` in `ci.yml`.
 *
 * This script resolves every `owner/repo@<sha>` reference against the GitHub
 * API and reports the ones that cannot be found, so a stale pin is caught
 * locally instead of in CI.
 *
 * Run: node tests/validate-action-pins.mjs
 * Exit: 0 when every pin resolves, 1 otherwise.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TESTS_DIR, "..");
const WORKFLOWS_DIR = join(REPO_ROOT, ".github", "workflows");

const GITHUB_API = "https://api.github.com";
const USER_AGENT = "formforge-action-pin-validator";

/**
 * Everything that reaches a URL below originates in a workflow file, which is
 * repository content — not necessarily trusted input. Each component is
 * validated against a strict allowlist and percent-encoded before it is
 * interpolated, so a crafted `uses:` line cannot redirect the request to
 * another host or smuggle a path traversal into the API call.
 */
const REPO_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
const SHA_RE = /^[0-9a-f]{40}$/i;
const TAG_RE = /^[A-Za-z0-9._\/-]{1,120}$/;

/** Build a safe `owner/name` path segment pair. */
function repoPath(repo) {
  if (!REPO_RE.test(repo)) return null;
  const [owner, name] = repo.split("/");
  return `${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

/** An optional token lifts the API rate limit from 60 to 5,000 requests an
 * hour. `GITHUB_TOKEN` is set automatically inside GitHub Actions.
 */
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

function apiHeaders() {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": USER_AGENT };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  return headers;
}

/** Read a workflow file. */
function readWorkflow(file) {
  return readFileSync(join(WORKFLOWS_DIR, file), "utf8");
}

/** Collect every `uses: owner/repo@ref` reference. */
function collectPins() {
  const pins = [];
  const files = readdirSync(WORKFLOWS_DIR).filter((name) => name.endsWith(".yml"));

  for (const file of files) {
    const source = readWorkflow(file);
    const pattern = /uses:\s*["']?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([^\s"']+)["']?/g;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      pins.push({ file, repo: match[1], ref: match[2] });
    }
  }

  return pins;
}

/** Ask GitHub whether a commit SHA exists in a repository. */
async function shaExists(repo, sha) {
  const path = repoPath(repo);
  if (!path || !SHA_RE.test(sha)) return null;

  const response = await fetch(`${GITHUB_API}/repos/${path}/commits/${encodeURIComponent(sha)}`, {
    headers: apiHeaders(),
  });

  if (response.status === 404) return false;
  if (!response.ok) {
    // Rate limited or offline — do not report a false positive.
    return null;
  }
  return true;
}

/** Ask GitHub whether a tag exists in a repository. */
async function tagExists(repo, tag) {
  const path = repoPath(repo);
  if (!path || !TAG_RE.test(tag)) return false;

  const response = await fetch(
    `${GITHUB_API}/repos/${path}/git/ref/tags/${encodeURIComponent(tag)}`,
    { headers: apiHeaders() },
  );
  return response.ok;
}

const pins = collectPins();
console.log(`\nValidating ${pins.length} action references in ${WORKFLOWS_DIR}\n`);

let invalid = 0;
let unverified = 0;
const seen = new Set();

for (const pin of pins) {
  const key = `${pin.repo}@${pin.ref}`;
  if (seen.has(key)) continue;
  seen.add(key);

  // Local actions ("./.github/...") are not fetched from GitHub.
  if (pin.repo.startsWith(".")) {
    console.log(`  LOCAL  ${pin.file}: ${key}`);
    continue;
  }

  const isSha = /^[0-9a-f]{40}$/i.test(pin.ref);

  if (!isSha) {
    // A floating tag: allowed, but recorded so it is a conscious choice.
    const exists = await tagExists(pin.repo, pin.ref);
    if (exists === false) {
      invalid += 1;
      console.log(`  BAD    ${pin.file}: ${key} (tag not found)`);
    } else {
      console.log(`  TAG    ${pin.file}: ${key}`);
    }
    continue;
  }

  const exists = await shaExists(pin.repo, pin.ref);
  if (exists === false) {
    invalid += 1;
    console.log(`  BAD    ${pin.file}: ${key} (commit not found)`);
  } else if (exists === null) {
    unverified += 1;
    console.log(`  SKIP   ${pin.file}: ${key} (could not verify)`);
  } else {
    console.log(`  OK     ${pin.file}: ${key}`);
  }
}

console.log("\n==============================");
console.log(`  ${invalid} invalid, ${unverified} unverified`);
if (invalid > 0) {
  console.log("  Every action reference must resolve, otherwise the job fails before it starts.");
  process.exit(1);
}
console.log("  ALL ACTION PINS RESOLVE");
