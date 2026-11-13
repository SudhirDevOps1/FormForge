#!/usr/bin/env node
/**
 * FormForge — Automated Cloudflare KV Namespace Provisioner & Binder
 *
 * Automatically provisions Cloudflare KV namespace `CACHE` (production & preview)
 * and updates `wrangler.jsonc` with the exact namespace IDs.
 *
 * Usage:
 *   node scripts/setup-kv.mjs [--silent]
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const WRANGLER_CONFIG = path.join(REPO_ROOT, "wrangler.jsonc");

const isSilent = process.argv.includes("--silent");

function log(msg) {
  if (!isSilent) console.log(msg);
}

function runCapture(cmd) {
  try {
    const res = execSync(cmd, { encoding: "utf-8", stdio: "pipe", cwd: REPO_ROOT });
    return { ok: true, output: res };
  } catch (err) {
    return { ok: false, output: (err.stdout || "") + (err.stderr || "") + err.message };
  }
}

export function extractKvId(output) {
  if (!output || typeof output !== "string") return null;

  // Pattern 1: id = "xxxx" or "id": "xxxx"
  const match1 = output.match(/id\s*[:=]\s*"?([a-f0-9]{32})"?/i);
  if (match1) return match1[1];

  // Pattern 2: 32 hex char string standalone
  const match2 = output.match(/\b([a-f0-9]{32})\b/i);
  if (match2) return match2[1];

  return null;
}

export function updateWranglerKvBinding(configContent, kvId, previewId) {
  const bindingBlock = `  "kv_namespaces": [\n    {\n      "binding": "CACHE",\n      "id": "${kvId}",\n      "preview_id": "${previewId || kvId}"\n    }\n  ],`;

  // Check if kv_namespaces already exists in config
  if (configContent.includes('"kv_namespaces": [')) {
    // Replace existing block
    return configContent.replace(
      /"kv_namespaces"\s*:\s*\[[\s\S]*?\],?/,
      bindingBlock,
    );
  }

  // Check if commented out kv_namespaces block exists
  const commentedRegex = /\/\/\s*"kv_namespaces"\s*:\s*\[[\s\S]*?\/\/ \],?/;
  if (commentedRegex.test(configContent)) {
    return configContent.replace(commentedRegex, bindingBlock);
  }

  // Insert before triggers or d1_databases
  if (configContent.includes('"triggers"')) {
    return configContent.replace('"triggers"', `${bindingBlock}\n  "triggers"`);
  }

  if (configContent.includes('"d1_databases"')) {
    return configContent.replace('"d1_databases"', `${bindingBlock}\n  "d1_databases"`);
  }

  // Fallback insert after vars
  return configContent.replace(
    /"vars"\s*:\s*\{[\s\S]*?\},/,
    (match) => `${match}\n${bindingBlock}`,
  );
}

export async function setupKvNamespace(options = {}) {
  log("⚡ FormForge: Checking Cloudflare KV Namespace for cache layer...");

  let prodId = options.prodId || null;
  let previewId = options.previewId || null;

  // Check CLI arguments --kv-id and --preview-id if not provided in options
  if (!prodId) {
    const kvIdx = process.argv.indexOf("--kv-id");
    if (kvIdx !== -1 && process.argv[kvIdx + 1]) {
      const candidate = process.argv[kvIdx + 1].trim();
      if (/^[a-f0-9]{32}$/i.test(candidate)) {
        prodId = candidate;
        log(`✔ Using KV namespace ID from CLI: ${prodId}`);
      }
    }
  }

  if (!previewId) {
    const prevIdx = process.argv.indexOf("--preview-id");
    if (prevIdx !== -1 && process.argv[prevIdx + 1]) {
      const candidate = process.argv[prevIdx + 1].trim();
      if (/^[a-f0-9]{32}$/i.test(candidate)) {
        previewId = candidate;
        log(`✔ Using KV preview namespace ID from CLI: ${previewId}`);
      }
    }
  }

  // 1. Check existing KV namespaces if prodId not provided
  if (!prodId) {
    const listRes = runCapture("npx wrangler kv namespace list");
    if (listRes.ok) {
      try {
        const namespaces = JSON.parse(listRes.output);
        if (Array.isArray(namespaces)) {
          for (const ns of namespaces) {
            const title = (ns.title || "").toLowerCase();
            if (title.endsWith("-cache") || title === "cache") {
              prodId = ns.id;
              log(`✔ Found existing KV namespace: ${ns.title} (${prodId})`);
              break;
            }
          }
          for (const ns of namespaces) {
            const title = (ns.title || "").toLowerCase();
            if (title.endsWith("-cache_preview") || title === "cache_preview") {
              previewId = ns.id;
              log(`✔ Found existing KV preview namespace: ${ns.title} (${previewId})`);
              break;
            }
          }
        }
      } catch {
        // not JSON or CLI output
      }
    }
  }

  // 2. Create production KV namespace if not found
  if (!prodId) {
    log("Creating Cloudflare KV namespace: CACHE...");
    const createRes = runCapture("npx wrangler kv namespace create CACHE");
    if (createRes.ok) {
      prodId = extractKvId(createRes.output);
      if (prodId) {
        log(`✔ Created KV namespace 'CACHE' with ID: ${prodId}`);
      }
    } else {
      // Might already exist
      prodId = extractKvId(createRes.output);
    }
  }

  // 3. Create preview KV namespace if not found
  if (!previewId) {
    log("Creating Cloudflare KV preview namespace: CACHE --preview...");
    const createPrevRes = runCapture("npx wrangler kv namespace create CACHE --preview");
    if (createPrevRes.ok) {
      previewId = extractKvId(createPrevRes.output);
      if (previewId) {
        log(`✔ Created KV preview namespace with ID: ${previewId}`);
      }
    } else {
      previewId = extractKvId(createPrevRes.output);
    }
  }

  if (!prodId) {
    log("⚠ Note: Cloudflare KV namespace could not be auto-created via CLI.");
    log("  (Cache will seamlessly use per-isolate memory L1 without I/O errors).");
    return { ok: false, error: "Could not obtain KV namespace ID" };
  }

  // 4. Update wrangler.jsonc
  try {
    const rawConfig = fs.readFileSync(WRANGLER_CONFIG, "utf-8");
    const updated = updateWranglerKvBinding(rawConfig, prodId, previewId || prodId);
    fs.writeFileSync(WRANGLER_CONFIG, updated, "utf-8");
    log(`✔ Successfully auto-bound KV cache in wrangler.jsonc (ID: ${prodId})`);
    return { ok: true, prodId, previewId: previewId || prodId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Auto-run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupKvNamespace().catch((err) => {
    console.error("Setup KV error:", err.message);
  });
}
