#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║              FormForge — One-Click Setup                  ║
 * ║  Automatically creates D1 DB, sets secrets, and deploys   ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

const readline = require("readline");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ─── Colors ───
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
  bgRed: "\x1b[41m",
};

function log(msg) { console.log(msg); }
function info(msg) { log(`${C.cyan}ℹ${C.reset}  ${msg}`); }
function success(msg) { log(`${C.green}✔${C.reset}  ${msg}`); }
function warn(msg) { log(`${C.yellow}⚠${C.reset}  ${C.yellow}${msg}${C.reset}`); }
function error(msg) { log(`${C.red}✖${C.reset}  ${C.red}${msg}${C.reset}`); }
function step(num, msg) { log(`\n${C.bgCyan}${C.bold} STEP ${num} ${C.reset} ${C.bold}${msg}${C.reset}`); }

function banner() {
  log("");
  log(`${C.cyan}${C.bold}  ╔═══════════════════════════════════════════╗${C.reset}`);
  log(`${C.cyan}${C.bold}  ║        🔥 FormForge Auto Setup 🔥        ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ║   D1 Database + Secrets + Deploy — Easy!  ║${C.reset}`);
  log(`${C.cyan}${C.bold}  ╚═══════════════════════════════════════════╝${C.reset}`);
  log("");
}

// ─── Readline helper ───
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultVal) {
  return new Promise((resolve) => {
    const suffix = defaultVal ? ` ${C.dim}(${defaultVal})${C.reset}` : "";
    rl.question(`${C.white}${C.bold}?${C.reset}  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal || "");
    });
  });
}

function confirm(question) {
  return new Promise((resolve) => {
    rl.question(`${C.yellow}?${C.reset}  ${question} ${C.dim}(y/n)${C.reset}: `, (answer) => {
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });
}

// ─── Run shell command ───
function run(cmd, silent = false) {
  try {
    const result = execSync(cmd, {
      encoding: "utf-8",
      stdio: silent ? "pipe" : "inherit",
      cwd: __dirname,
    });
    return { ok: true, output: result || "" };
  } catch (err) {
    return { ok: false, output: err.stdout || err.stderr || err.message };
  }
}

function runCapture(cmd) {
  try {
    const result = execSync(cmd, { encoding: "utf-8", stdio: "pipe", cwd: __dirname });
    return { ok: true, output: result };
  } catch (err) {
    return { ok: false, output: err.stdout || err.stderr || err.message };
  }
}

// ─── Send input to interactive command ───
function runWithInput(cmd, inputText) {
  return new Promise((resolve) => {
    const isWin = process.platform === "win32";
    const child = spawn(isWin ? "cmd" : "sh", isWin ? ["/c", cmd] : ["-c", cmd], {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    // Send the input after a short delay to let the prompt appear
    setTimeout(() => {
      child.stdin.write(inputText + "\n");
      child.stdin.end();
    }, 1000);

    child.on("close", (code) => {
      resolve({ ok: code === 0, output: stdout + stderr });
    });
  });
}

// ─── Update wrangler.jsonc ───
function updateWranglerConfig(appName, dbName, dbId) {
  const configPath = path.join(__dirname, "wrangler.jsonc");
  let content = fs.readFileSync(configPath, "utf-8");

  // Update name
  content = content.replace(/"name"\s*:\s*"[^"]*"/, `"name": "${appName}"`);

  // Update database_name
  content = content.replace(/"database_name"\s*:\s*"[^"]*"/, `"database_name": "${dbName}"`);

  // Update database_id
  content = content.replace(/"database_id"\s*:\s*"[^"]*"/, `"database_id": "${dbId}"`);

  fs.writeFileSync(configPath, content, "utf-8");
}

// ─── Extract database ID from wrangler output ───
function extractDbId(output) {
  // wrangler d1 create output contains the database ID in different formats
  // Pattern 1: "database_id = \"xxxx\""
  let match = output.match(/database_id\s*=\s*"?([a-f0-9-]{36})"?/i);
  if (match) return match[1];

  // Pattern 2: Just a UUID on its own line or after some text
  match = output.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (match) return match[1];

  return null;
}

// ─── Main ───
async function main() {
  banner();

  // ─── Pre-check: Is wrangler available? ───
  info("Checking if wrangler is available...");
  const wranglerCheck = runCapture("npx wrangler --version");
  if (!wranglerCheck.ok) {
    error("wrangler not found! Make sure you have run 'npm install' first.");
    process.exit(1);
  }
  success(`Wrangler found: ${wranglerCheck.output.trim()}`);

  // ─── Pre-check: Is user logged in? ───
  info("Checking Cloudflare login status...");
  const whoami = runCapture("npx wrangler whoami");
  if (!whoami.ok || whoami.output.includes("not authenticated")) {
    warn("You are not logged in to Cloudflare!");
    info("Opening browser for login...");
    log("");
    run("npx wrangler login");
    log("");

    // Verify login
    const recheck = runCapture("npx wrangler whoami");
    if (!recheck.ok || recheck.output.includes("not authenticated")) {
      error("Login failed. Please run 'npx wrangler login' manually and try again.");
      process.exit(1);
    }
  }
  success("Logged in to Cloudflare ✔");

  // ═══════════════════════════════════════
  //  Ask user for 3 things
  // ═══════════════════════════════════════

  log(`\n${C.magenta}${C.bold}── Bas 3 cheezein batao, baaki sab automatic! ──${C.reset}\n`);

  const appName = await ask("App/Worker name kya rakhna hai?", "formforge");
  const dbName = await ask("Database name kya rakhna hai?", `${appName}-db`);

  log("");
  info("AUTH_SECRET ek security key hai jo sessions sign karne ke liye use hoti hai.");
  const autoGenerate = await confirm("Kya main AUTH_SECRET auto-generate kar doon?");

  let authSecret;
  if (autoGenerate) {
    authSecret = crypto.randomBytes(32).toString("hex");
    success(`Auth secret generated: ${C.dim}${authSecret.substring(0, 12)}...${C.reset}`);
  } else {
    authSecret = await ask("Apna AUTH_SECRET paste karo (min 32 chars)");
    if (authSecret.length < 32) {
      warn("AUTH_SECRET bahut chhota hai! Minimum 32 characters hona chahiye.");
      authSecret = crypto.randomBytes(32).toString("hex");
      info(`Auto-generated instead: ${C.dim}${authSecret.substring(0, 12)}...${C.reset}`);
    }
  }

  // ─── Summary ───
  log(`\n${C.cyan}${C.bold}═══════════════════ Summary ═══════════════════${C.reset}`);
  log(`  ${C.bold}App Name:${C.reset}      ${appName}`);
  log(`  ${C.bold}Database:${C.reset}      ${dbName}`);
  log(`  ${C.bold}Auth Secret:${C.reset}   ${authSecret.substring(0, 12)}...`);
  log(`${C.cyan}${C.bold}════════════════════════════════════════════════${C.reset}\n`);

  const proceed = await confirm("Sab sahi hai? Setup start karun?");
  if (!proceed) {
    warn("Setup cancelled. Phir se run karo jab ready ho!");
    rl.close();
    process.exit(0);
  }

  // ═══════════════════════════════════════
  //  STEP 1: Create D1 Database
  // ═══════════════════════════════════════

  step(1, "D1 Database create kar raha hoon...");
  const createDb = runCapture(`npx wrangler d1 create ${dbName}`);

  if (!createDb.ok) {
    // If database already exists, that's fine
    if (createDb.output.includes("already exists")) {
      warn(`Database '${dbName}' pehle se exist karta hai.`);
      // Try to get the ID from wrangler d1 list
      info("Existing database ka ID dhoondh raha hoon...");
      const listDb = runCapture("npx wrangler d1 list");
      if (listDb.ok) {
        // Find the database in the list
        const lines = listDb.output.split("\n");
        for (const line of lines) {
          if (line.includes(dbName)) {
            const dbId = extractDbId(line);
            if (dbId) {
              success(`Existing database ID found: ${dbId}`);
              updateWranglerConfig(appName, dbName, dbId);
              success("wrangler.jsonc updated ✔");
              break;
            }
          }
        }
      }
    } else {
      error("Database create karne mein error aaya:");
      log(createDb.output);
      rl.close();
      process.exit(1);
    }
  } else {
    const dbId = extractDbId(createDb.output);
    if (dbId) {
      success(`Database created! ID: ${C.cyan}${dbId}${C.reset}`);
      updateWranglerConfig(appName, dbName, dbId);
      success("wrangler.jsonc updated with database_id ✔");
    } else {
      error("Database ID parse nahi ho paya. Output:");
      log(createDb.output);
      warn("Please manually copy the database_id into wrangler.jsonc");
    }
  }

  // ═══════════════════════════════════════
  //  STEP 2: Set AUTH_SECRET
  // ═══════════════════════════════════════

  step(2, "AUTH_SECRET set kar raha hoon...");
  const secretResult = await runWithInput(`npx wrangler secret put AUTH_SECRET`, authSecret);

  if (secretResult.ok) {
    success("AUTH_SECRET set ho gaya ✔");
  } else {
    // Try alternative method
    warn("Interactive method fail hua, alternative try kar raha hoon...");
    const altResult = runCapture(
      process.platform === "win32"
        ? `echo ${authSecret} | npx wrangler secret put AUTH_SECRET`
        : `echo "${authSecret}" | npx wrangler secret put AUTH_SECRET`
    );
    if (altResult.ok) {
      success("AUTH_SECRET set ho gaya ✔");
    } else {
      warn("AUTH_SECRET auto-set nahi ho paya.");
      log("");
      info("Yeh command manually run karo:");
      log(`  ${C.cyan}npx wrangler secret put AUTH_SECRET${C.reset}`);
      log(`  Then paste: ${C.dim}${authSecret}${C.reset}`);
      log("");
    }
  }

  // ═══════════════════════════════════════
  //  STEP 3: Apply Migrations
  // ═══════════════════════════════════════

  step(3, "Database migrations apply kar raha hoon...");
  const migrateResult = run("npx wrangler d1 migrations apply DB --remote", false);
  if (migrateResult.ok) {
    success("Migrations applied ✔");
  } else {
    warn("Migrations skip hua — FormForge first request pe schema auto-create karega.");
  }

  // ═══════════════════════════════════════
  //  STEP 4: Build & Deploy
  // ═══════════════════════════════════════

  step(4, "Building and deploying to Cloudflare...");
  info("Yeh thoda time le sakta hai (1-3 minutes)...");
  log("");

  const buildResult = run("npx opennextjs-cloudflare build");
  if (!buildResult.ok) {
    error("Build fail ho gaya! Errors upar dekhiye.");
    rl.close();
    process.exit(1);
  }
  success("Build complete ✔");

  const deployResult = run("npx opennextjs-cloudflare deploy");
  if (!deployResult.ok) {
    error("Deploy fail ho gaya! Errors upar dekhiye.");
    rl.close();
    process.exit(1);
  }
  success("Deployed successfully ✔");

  // ═══════════════════════════════════════
  //  DONE!
  // ═══════════════════════════════════════

  log("");
  log(`${C.green}${C.bold}  ╔═══════════════════════════════════════════════╗${C.reset}`);
  log(`${C.green}${C.bold}  ║        🎉  Setup Complete! Sab ho gaya! 🎉    ║${C.reset}`);
  log(`${C.green}${C.bold}  ╚═══════════════════════════════════════════════╝${C.reset}`);
  log("");
  log(`  ${C.bold}App Name:${C.reset}       ${appName}`);
  log(`  ${C.bold}Database:${C.reset}       ${dbName}`);
  log(`  ${C.bold}Worker URL:${C.reset}     ${C.cyan}https://${appName}.workers.dev${C.reset}`);
  log(`  ${C.bold}Dashboard:${C.reset}      ${C.cyan}https://${appName}.workers.dev/dashboard${C.reset}`);
  log("");
  log(`  ${C.dim}Ab browser mein dashboard kholo aur account create karo!${C.reset}`);
  log("");

  // Save auth secret to a local file for reference
  const secretFile = path.join(__dirname, ".auth-secret-backup.txt");
  fs.writeFileSync(secretFile, `AUTH_SECRET=${authSecret}\n# Generated on ${new Date().toISOString()}\n# Keep this safe and DO NOT commit to git!\n`, "utf-8");
  info(`Auth secret backup saved to: ${C.dim}.auth-secret-backup.txt${C.reset}`);
  warn("Is file ko git mein commit MAT karna!");

  // Make sure .gitignore has it. Read straight through instead of testing for
  // existence first — a check-then-use pair is a race, and the read's own error
  // already tells us whether the file is there.
  const gitignorePath = path.join(__dirname, ".gitignore");
  let gitignore = null;
  try {
    gitignore = fs.readFileSync(gitignorePath, "utf-8");
  } catch {
    gitignore = null;
  }

  if (gitignore !== null) {
    if (!gitignore.includes(".auth-secret-backup")) {
      fs.appendFileSync(gitignorePath, "\n# Auth secret backup (DO NOT COMMIT)\n.auth-secret-backup.txt\n");
      success(".gitignore updated ✔");
    }
  } else {
    fs.writeFileSync(gitignorePath, "node_modules/\n.open-next/\n.auth-secret-backup.txt\n");
    success(".gitignore created ✔");
  }

  rl.close();
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
