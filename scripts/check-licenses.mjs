#!/usr/bin/env node
/**
 * Copyleft gate for the production dependency tree.
 *
 * Why not `license-checker`: that package reaches the tree through
 * `read-package-json`, which calls `glob()` as a plain function (the glob@7
 * API). The project pins glob to a patched major for its own advisory fixes,
 * so the checker either crashes with "TypeError: glob is not a function" or —
 * when installed in isolation — exits 0 without writing anything at all. A gate
 * that cannot fail is worse than no gate, so this script does the walk itself.
 *
 * Why the lockfile: `package-lock.json` (v3) is exactly what `npm ci` installs,
 * records a licence for every resolved package, and marks dev-only entries.
 * Reading it means the check cannot disagree with the build, needs no network
 * access and stays fast.
 *
 * Run: node scripts/check-licenses.mjs [--lock <path>] [--report <path>]
 * Exit: 0 when every production dependency is permissively licensed, 1 otherwise.
 * Side effect: writes `license-report.json` (the CI artifact) in the cwd.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal argv reader: `--flag value`, no dependencies. */
function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const LOCK_PATH = arg("lock", join(REPO_ROOT, "package-lock.json"));
const REPORT_PATH = arg("report", join(process.cwd(), "license-report.json"));

/** GPL / AGPL / LGPL in any SPDX position ("MIT OR", "Apache-2.0 AND", lone). */
const COPYLEFT = /\b(?:A?GPL|LGPL)(?:-[0-9.]+)?(?:-only|-or-later)?\b/i;

/**
 * Reviewed exceptions. Each entry must name the package and say why the licence
 * is acceptable in this deployment — an unexplained allowlist entry defeats the
 * purpose of the gate.
 */
const ALLOWED = [
  {
    match: /^node_modules\/@img\/sharp-/,
    reason:
      "optional prebuilt image-processing binary (libvips): linked at build time only and never shipped in the Worker bundle",
  },
];

function main() {
  let lock;
  try {
    lock = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
  } catch (error) {
    console.error(`Cannot read ${LOCK_PATH}: ${error.message}`);
    process.exit(1);
  }

  const checked = [];
  const exceptions = [];
  const offenders = [];

  for (const [path, pkg] of Object.entries(lock.packages ?? {})) {
    if (!path.startsWith("node_modules/")) {
      continue; // the root package itself
    }
    if (pkg.dev || pkg.devOptional) {
      continue; // never installed by `npm ci --omit=dev`
    }
    if (pkg.link) {
      continue; // workspace symlink, reported through its target
    }

    const name = path.slice("node_modules/".length);
    const license = typeof pkg.license === "string" ? pkg.license : "";
    const entry = { package: name, version: pkg.version ?? null, license: license || null };

    if (!license) {
      offenders.push({ ...entry, why: "no licence declared" });
      continue;
    }
    if (!COPYLEFT.test(license)) {
      checked.push(entry);
      continue;
    }

    const exception = ALLOWED.find((rule) => rule.match.test(path));
    if (exception) {
      exceptions.push({ ...entry, why: exception.reason });
    } else {
      offenders.push({ ...entry, why: "copyleft licence" });
    }
  }

  const report = {
    checkedAt: new Date().toISOString(),
    scope: "production dependencies from package-lock.json",
    counts: {
      permissive: checked.length,
      exceptions: exceptions.length,
      offenders: offenders.length,
    },
    exceptions,
    offenders,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("Copyleft licence check — production dependencies only\n");
  console.log(`  permissive   ${checked.length}`);
  console.log(`  exceptions   ${exceptions.length}`);
  console.log(`  offenders    ${offenders.length}`);

  for (const entry of exceptions) {
    console.log(`\n  allowed  ${entry.package}@${entry.version}  ${entry.license}`);
    console.log(`           ${entry.why}`);
  }

  if (offenders.length > 0) {
    console.log("\nCOPYLEFT LICENCES FOUND\n");
    for (const entry of offenders) {
      console.log(`  ${entry.package}@${entry.version}  ${entry.license ?? "(none)"}  — ${entry.why}`);
    }
    console.log(
      "\nReplace the dependency, or add a documented entry to ALLOWED in scripts/check-licenses.mjs.",
    );
    process.exit(1);
  }

  console.log("\n  No copyleft licences in production dependencies.");
}

main();
