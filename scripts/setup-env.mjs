#!/usr/bin/env node
/**
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║             FormForge — Universal Environment & KV Wizard              ║
 * ║  Interactive & Automated setup for Cloudflare D1, KV, Secrets & .env  ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node scripts/setup-env.mjs              # Interactive wizard
 *   node scripts/setup-env.mjs --generate   # Non-interactive quick generate
 *   node scripts/setup-env.mjs --check      # Verify current env & bindings
 *   node scripts/setup-env.mjs --guide      # Display Cloudflare dashboard guide
 */

import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const WRANGLER_CONFIG = path.join(REPO_ROOT, "wrangler.jsonc");
const ENV_LOCAL_PATH = path.join(REPO_ROOT, ".env.local");
const GITIGNORE_PATH = path.join(REPO_ROOT, ".gitignore");

// ─── ANSI Colors & Styling ───
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  white: "\x1b[97m",
  bgCyan: "\x1b[46m",
  bgGreen: "\x1b[42m",
  bgBlue: "\x1b[44m",
};

function log(msg = "") { console.log(msg); }
function info(msg) { log(`${C.cyan}ℹ${C.reset}  ${msg}`); }
function success(msg) { log(`${C.green}✔${C.reset}  ${msg}`); }
function warn(msg) { log(`${C.yellow}⚠${C.reset}  ${C.yellow}${msg}${C.reset}`); }
function error(msg) { log(`${C.red}✖${C.reset}  ${C.red}${msg}${C.reset}`); }
function banner(title) {
  log(`\n${C.cyan}${C.bold}════════════════════════════════════════════════════════════════════${C.reset}`);
  log(`${C.cyan}${C.bold}  ⚡ FormForge: ${title}${C.reset}`);
  log(`${C.cyan}${C.bold}════════════════════════════════════════════════════════════════════${C.reset}\n`);
}

// ─── Helpers ───
function runCapture(cmd) {
  try {
    const res = execSync(cmd, { encoding: "utf-8", stdio: "pipe", cwd: REPO_ROOT });
    return { ok: true, output: res };
  } catch (err) {
    return { ok: false, output: (err.stdout || "") + (err.stderr || "") + err.message };
  }
}

export function generateCryptoKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function parseEnvFile(content) {
  const result = {};
  if (!content || typeof content !== "string") return result;

  const lines = content.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx !== -1) {
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

export function formatEnvFile(envVars) {
  return `# ==============================================================================
# FormForge Local Environment File (.env.local)
# Generated automatically by scripts/setup-env.mjs
# DO NOT COMMIT THIS FILE TO PUBLIC REPOSITORIES!
# ==============================================================================

# ── Primary Security Secret (Required for session authentication) ──
AUTH_SECRET=${envVars.AUTH_SECRET || ""}

# ── Operator Account Recovery Token (Optional emergency password reset key) ──
RECOVERY_TOKEN=${envVars.RECOVERY_TOKEN || ""}

# ── Application Configuration ──
APP_NAME=${envVars.APP_NAME || "FormForge"}
ALLOW_REGISTRATION=${envVars.ALLOW_REGISTRATION || "true"}

# ── Optional: Database Overrides for Non-Cloudflare Deployments ──
# TURSO_DATABASE_URL=${envVars.TURSO_DATABASE_URL || ""}
# TURSO_AUTH_TOKEN=${envVars.TURSO_AUTH_TOKEN || ""}
# NEON_DATABASE_URL=${envVars.NEON_DATABASE_URL || ""}

# ── Optional: Transactional Email Providers (Pick one if emails needed) ──
# RESEND_API_KEY=${envVars.RESEND_API_KEY || ""}
# RESEND_FROM=${envVars.RESEND_FROM || "onboarding@resend.dev"}
# BREVO_API_KEY=${envVars.BREVO_API_KEY || ""}
# SENDGRID_API_KEY=${envVars.SENDGRID_API_KEY || ""}

# ── Optional: Telegram Push Alerts (100% Free from @BotFather) ──
# TELEGRAM_BOT_TOKEN=${envVars.TELEGRAM_BOT_TOKEN || ""}
# TELEGRAM_CHAT_ID=${envVars.TELEGRAM_CHAT_ID || ""}

# ── Optional: Google Apps Script Webhook (1-Click Google Sheets Sync) ──
# GAS_URL=${envVars.GAS_URL || ""}
# GAS_SECRET=${envVars.GAS_SECRET || ""}
`;
}

function ensureGitignoreEntry(entry) {
  let content = null;
  try {
    content = fs.readFileSync(GITIGNORE_PATH, "utf-8");
  } catch {
    content = "";
  }

  if (!content.includes(entry)) {
    try {
      fs.appendFileSync(GITIGNORE_PATH, `\n# Added by setup wizard\n${entry}\n`, "utf-8");
      success(`Added ${entry} to .gitignore ✔`);
    } catch {
      // ignore
    }
  }
}

// ─── Cloudflare Dashboard Step-by-Step Display ───
export function printCloudflareGuide(authSecret, recoveryToken) {
  banner("Cloudflare Dashboard Deployment & Environment Guide");

  log(`${C.bold}Cloudflare par deploy karte waqt ye 3 jagah setup hoti hain:${C.reset}\n`);

  log(`${C.bgBlue}${C.bold} 1. BINDINGS (Database & KV Cache) ${C.reset}`);
  log(`📍 Cloudflare Dashboard ➔ Workers & Pages ➔ [Your Worker: e.g. apnaform] ➔ ${C.bold}Settings ➔ Bindings${C.reset}`);
  log("   Click '+ Add binding' for each of the following:");
  log("");
  log(`   ${C.green}A) D1 Database Binding:${C.reset}`);
  log(`      • Type:          ${C.cyan}D1 Database${C.reset}`);
  log(`      • Variable name: ${C.bold}${C.white}DB${C.reset}  ${C.dim}(MUST BE CAPITAL "DB")${C.reset}`);
  log(`      • D1 Database:   Select your database (e.g. ${C.cyan}formforge-db${C.reset})`);
  log("");
  log(`   ${C.green}B) KV Namespace Binding:${C.reset}`);
  log(`      • Type:          ${C.cyan}KV Namespace${C.reset}`);
  log(`      • Variable name: ${C.bold}${C.white}CACHE${C.reset}  ${C.dim}(MUST BE CAPITAL "CACHE")${C.reset}`);
  log(`      • KV Namespace:  Select your KV namespace (e.g. ${C.cyan}CACHE${C.reset})`);
  log("");

  log(`${C.bgBlue}${C.bold} 2. ENCRYPTED SECRETS (Sensitve Keys) ${C.reset}`);
  log(`📍 Cloudflare Dashboard ➔ Workers & Pages ➔ [Your Worker] ➔ ${C.bold}Settings ➔ Variables and Secrets${C.reset}`);
  log("   Click '+ Add' ➔ select 'Secret' (Encrypted):");
  log("");
  log(`   ${C.magenta}AUTH_SECRET${C.reset} (Required for JWT session auth):`);
  log(`      • Variable name: ${C.bold}AUTH_SECRET${C.reset}`);
  log(`      • Value:         ${C.cyan}${authSecret}${C.reset}`);
  log("");
  if (recoveryToken) {
    log(`   ${C.magenta}RECOVERY_TOKEN${C.reset} (Optional for operator emergency recovery):`);
    log(`      • Variable name: ${C.bold}RECOVERY_TOKEN${C.reset}`);
    log(`      • Value:         ${C.cyan}${recoveryToken}${C.reset}`);
    log("");
  }

  log(`${C.bgBlue}${C.bold} 3. ENVIRONMENT VARIABLES (Plain Text Settings) ${C.reset}`);
  log(`📍 Same page: ${C.bold}Settings ➔ Variables and Secrets${C.reset} ➔ Click '+ Add' ➔ select 'Environment variable'`);
  log("");
  log(`   • ${C.bold}APP_NAME${C.reset}           ➔  Value: ${C.cyan}FormForge${C.reset}`);
  log(`   • ${C.bold}ALLOW_REGISTRATION${C.reset} ➔  Value: ${C.cyan}true${C.reset}`);
  log("");

  log(`${C.bgBlue}${C.bold} 4. OPTIONAL INTEGRATIONS (Add as Secrets or Variables) ${C.reset}`);
  log(`   • ${C.bold}RESEND_API_KEY${C.reset}     ➔  For transactional notification emails (resend.com)`);
  log(`   • ${C.bold}RESEND_FROM${C.reset}        ➔  Sender email (e.g. ${C.cyan}noreply@yourdomain.com${C.reset})`);
  log(`   • ${C.bold}TELEGRAM_BOT_TOKEN${C.reset} ➔  From @BotFather for free mobile push alerts`);
  log(`   • ${C.bold}TELEGRAM_CHAT_ID${C.reset}   ➔  Numeric chat ID from @userinfobot`);
  log(`   • ${C.bold}GAS_URL${C.reset}            ➔  Google Apps Script Webhook URL for Google Sheets sync`);
  log(`   • ${C.bold}GAS_SECRET${C.reset}         ➔  Secret key matching your Google Apps Script`);
  log("");
  log(`${C.cyan}${C.bold}════════════════════════════════════════════════════════════════════${C.reset}\n`);
}

// ─── Audit / Check Mode ───
export function checkEnvironment() {
  banner("FormForge Environment & Bindings Audit");

  let localEnv = {};
  try {
    const raw = fs.readFileSync(ENV_LOCAL_PATH, "utf-8");
    localEnv = parseEnvFile(raw);
    success(`Found local .env.local file (${Object.keys(localEnv).length} keys)`);
  } catch {
    warn("No .env.local file found. Run 'node scripts/setup-env.mjs' to generate one.");
  }

  // Check AUTH_SECRET
  if (localEnv.AUTH_SECRET && localEnv.AUTH_SECRET.length >= 32) {
    success(`AUTH_SECRET is properly set (${localEnv.AUTH_SECRET.length} chars)`);
  } else {
    warn("AUTH_SECRET is missing or under 32 chars in .env.local");
  }

  // Check wrangler.jsonc
  try {
    const rawConfig = fs.readFileSync(WRANGLER_CONFIG, "utf-8");
    const nameMatch = rawConfig.match(/"name"\s*:\s*"([^"]+)"/);
    const dbIdMatch = rawConfig.match(/"database_id"\s*:\s*"([^"]*)"/);
    const hasKv = rawConfig.includes('"kv_namespaces": [');

    log("\nConfiguration status in wrangler.jsonc:");
    if (nameMatch) {
      success(`Worker Name: ${C.cyan}${nameMatch[1]}${C.reset}`);
    }
    if (dbIdMatch && dbIdMatch[1]) {
      success(`D1 Database ID: ${C.cyan}${dbIdMatch[1]}${C.reset}`);
    } else {
      warn("D1 Database ID in wrangler.jsonc is empty (Cloudflare dashboard binding required if deploying via Git)");
    }

    if (hasKv) {
      const kvIdMatch = rawConfig.match(/"binding"\s*:\s*"CACHE"[\s\S]*?"id"\s*:\s*"([^"]+)"/);
      if (kvIdMatch && kvIdMatch[1] && !kvIdMatch[1].includes("<paste")) {
        success(`KV Cache Binding: Active with ID ${C.cyan}${kvIdMatch[1]}${C.reset}`);
      } else {
        warn("KV Cache binding is present but ID is a placeholder");
      }
    } else {
      info("KV Cache binding is commented out (App runs in memory cache fallback or uses dashboard binding)");
    }
  } catch (err) {
    error(`Cannot read wrangler.jsonc: ${err.message}`);
  }

  log("\nAudit complete! ✔\n");
}

// ─── Interactive Wizard ───
async function runInteractiveWizard() {
  banner("Universal Environment & Cloudflare KV Wizard");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, def = "") =>
    new Promise((resolve) => {
      const suffix = def ? ` ${C.dim}(default: ${def})${C.reset}` : "";
      rl.question(`${C.white}${C.bold}?${C.reset}  ${q}${suffix}: `, (ans) => {
        resolve(ans.trim() || def);
      });
    });

  const confirm = (q, defYes = true) =>
    new Promise((resolve) => {
      const hint = defYes ? "Y/n" : "y/N";
      rl.question(`${C.yellow}?${C.reset}  ${q} ${C.dim}(${hint})${C.reset}: `, (ans) => {
        const val = ans.trim().toLowerCase();
        if (!val) resolve(defYes);
        else resolve(val === "y" || val === "yes");
      });
    });

  // 1. Generate or read AUTH_SECRET
  let currentAuthSecret = "";
  try {
    const existing = parseEnvFile(fs.readFileSync(ENV_LOCAL_PATH, "utf-8"));
    if (existing.AUTH_SECRET) currentAuthSecret = existing.AUTH_SECRET;
  } catch {
    // ignore
  }

  if (!currentAuthSecret) {
    currentAuthSecret = generateCryptoKey(32);
    info(`Auto-generated secure 64-char AUTH_SECRET: ${C.dim}${currentAuthSecret.slice(0, 16)}...${C.reset}`);
  } else {
    info(`Existing AUTH_SECRET detected: ${C.dim}${currentAuthSecret.slice(0, 16)}...${C.reset}`);
    const regenerate = await confirm("Do you want to regenerate a new AUTH_SECRET?", false);
    if (regenerate) {
      currentAuthSecret = generateCryptoKey(32);
      success("Generated new AUTH_SECRET ✔");
    }
  }

  const recoveryToken = generateCryptoKey(24);

  // 2. Cloudflare CLI auto-detection
  info("Checking Cloudflare Wrangler status...");
  const whoamiRes = runCapture("npx wrangler whoami");
  let isLoggedIn = whoamiRes.ok && !whoamiRes.output.includes("not authenticated") && !whoamiRes.output.includes("expired");

  if (isLoggedIn) {
    success("Cloudflare CLI authentication verified ✔");
    const autoProvision = await confirm("Do you want to auto-setup Cloudflare KV cache now via CLI?", true);
    if (autoProvision) {
      try {
        const { setupKvNamespace } = await import("./setup-kv.mjs");
        await setupKvNamespace();
      } catch (err) {
        warn(`KV provision note: ${err.message}`);
      }
    }
  } else {
    warn("Cloudflare CLI is not authenticated locally.");
    log(`  ${C.dim}(This is normal if you deploy via GitHub integration or Cloudflare Dashboard).${C.reset}`);
  }

  // 3. FormForge app name and configuration
  const appName = await ask("App / Worker Name", "apnaform");
  const allowRegistration = (await confirm("Allow open user registration?", true)) ? "true" : "false";

  // 4. Write .env.local
  const envData = {
    AUTH_SECRET: currentAuthSecret,
    RECOVERY_TOKEN: recoveryToken,
    APP_NAME: appName,
    ALLOW_REGISTRATION: allowRegistration,
  };

  const formatted = formatEnvFile(envData);
  fs.writeFileSync(ENV_LOCAL_PATH, formatted, "utf-8");
  success("Wrote .env.local successfully ✔");

  // Save backup secret file
  const backupPath = path.join(REPO_ROOT, ".auth-secret-backup.txt");
  fs.writeFileSync(backupPath, `AUTH_SECRET=${currentAuthSecret}\nRECOVERY_TOKEN=${recoveryToken}\n`, "utf-8");
  ensureGitignoreEntry(".env.local");
  ensureGitignoreEntry(".auth-secret-backup.txt");

  rl.close();

  // 5. Print comprehensive dashboard guide
  printCloudflareGuide(currentAuthSecret, recoveryToken);
}

// ─── Non-interactive generation ───
export function runAutoGenerate() {
  const authSecret = generateCryptoKey(32);
  const recoveryToken = generateCryptoKey(24);

  const envData = {
    AUTH_SECRET: authSecret,
    RECOVERY_TOKEN: recoveryToken,
    APP_NAME: "FormForge",
    ALLOW_REGISTRATION: "true",
  };

  const formatted = formatEnvFile(envData);
  fs.writeFileSync(ENV_LOCAL_PATH, formatted, "utf-8");
  success("Generated .env.local with secure 64-char AUTH_SECRET ✔");

  ensureGitignoreEntry(".env.local");
  ensureGitignoreEntry(".auth-secret-backup.txt");

  printCloudflareGuide(authSecret, recoveryToken);
}

// ─── Entry Point ───
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    checkEnvironment();
    return;
  }

  if (args.includes("--generate") || args.includes("--ci")) {
    runAutoGenerate();
    return;
  }

  if (args.includes("--guide")) {
    const authSecret = generateCryptoKey(32);
    const recoveryToken = generateCryptoKey(24);
    printCloudflareGuide(authSecret, recoveryToken);
    return;
  }

  await runInteractiveWizard();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    error(`Setup Env Error: ${err.message}`);
    process.exit(1);
  });
}
