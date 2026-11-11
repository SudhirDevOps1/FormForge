#!/usr/bin/env node
/**
 * FormForge Worker smoke test.
 *
 * `next build` succeeding does **not** mean the Cloudflare Worker works.
 * Next.js 16 and the OpenNext adapter can disagree about runtime manifests —
 * the `preview-props.json` incident made every page answer 500 (Error 1101)
 * even though the build was green and every unit test passed.
 *
 * This test starts the real Worker bundle under `wrangler dev` (workerd) and
 * asserts that it actually serves pages. It is the last gate before a
 * deployment.
 *
 * Requires a completed `npm run build`.
 *
 * Run: node tests/worker-smoke.mjs
 * Exit: 0 when the Worker serves, 1 otherwise.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TESTS_DIR, "..");
const WORKER_ENTRY = join(REPO_ROOT, ".open-next", "worker.js");
const PORT = Number(process.env.FF_SMOKE_PORT || 8788);
const BASE_URL = `http://127.0.0.1:${PORT}`;

if (!existsSync(WORKER_ENTRY)) {
  console.error(
    "\n  No Worker bundle found at .open-next/worker.js.\n" +
      "  Run `npm run build` before the smoke test.\n",
  );
  process.exit(1);
}

console.log(`\nFormForge Worker smoke test → ${BASE_URL}\n`);

let child;
let output = "";

try {
  // Spawn wrangler's entry point through Node directly. Using `npx` would
  // need a shell on Windows, and `shell: true` with an argument array is
  // deprecated (and a command-injection risk).
  const wranglerBin = join(REPO_ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

  child = spawn(
    process.execPath,
    [
      wranglerBin,
      "dev",
      "--port",
      String(PORT),
      "--ip",
      "127.0.0.1",
      "--local",
    ],
    { cwd: REPO_ROOT, env: { ...process.env, WRANGLER_LOG: "error" } },
  );

  child.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });

  // Wait for the worker to accept requests.
  const deadline = Date.now() + 120_000;
  let ready = false;

  while (Date.now() < deadline && !ready) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      const response = await fetch(`${BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(8000),
      });
      ready = response.ok;
    } catch {
      /* not up yet */
    }
  }

  if (!ready) {
    console.error("  The Worker did not become ready in time.");
    console.error(output.split("\n").slice(-25).join("\n"));
    process.exit(1);
  }

  console.log("  Worker is up.\n");

  const checks = [
    { path: "/", expect: 200, label: "the marketing page renders" },
    { path: "/dashboard", expect: 200, label: "the dashboard renders" },
    { path: "/api/health", expect: 200, label: "the health endpoint answers" },
    { path: "/api/openapi.json", expect: 200, label: "the OpenAPI spec is served" },
  ];

  let failed = 0;

  for (const check of checks) {
    try {
      const response = await fetch(`${BASE_URL}${check.path}`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === check.expect) {
        console.log(`  PASS  ${check.label} (${check.path} → ${response.status})`);
      } else {
        failed += 1;
        console.log(`  FAIL  ${check.label} (${check.path} → ${response.status}, expected ${check.expect})`);
      }
    } catch (error) {
      failed += 1;
      console.log(`  FAIL  ${check.label} (${check.path} → ${error.message})`);
    }
  }

  // A runtime crash shows up as "Unexpected loadManifest(...) call!" or a
  // generic 500. Surface the worker's own log when something failed.
  if (failed > 0) {
    console.error("\n  Worker output:");
    console.error(output.split("\n").slice(-30).join("\n"));
  }

  console.log("\n==============================");
  console.log(`  ${checks.length - failed} passed, ${failed} failed (${checks.length} total)`);
  if (failed > 0) {
    console.log("  THE WORKER DOES NOT SERVE — do not deploy.");
    process.exit(1);
  }
  console.log("  THE WORKER SERVES CORRECTLY");
} catch (error) {
  console.error("  Smoke test failed:", error);
  process.exit(1);
} finally {
  if (child && !child.killed) {
    child.kill("SIGTERM");
    // Give wrangler a moment to release the port.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!child.killed) child.kill("SIGKILL");
  }
}
