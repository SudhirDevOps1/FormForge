#!/usr/bin/env node
/**
 * FormForge — Admin Account Verification & Emergency Password Reset Tool
 *
 * Checks registered users in Cloudflare D1 (or local SQLite), verifies account status,
 * and securely updates or resets owner passwords using PBKDF2-SHA256 (100k iterations).
 *
 * Usage:
 *   node scripts/admin-recover.mjs --check
 *   node scripts/admin-recover.mjs --reset <email> <newPassword>
 *   node scripts/admin-recover.mjs --create <email> <password> [name]
 *   node scripts/admin-recover.mjs (interactive)
 */

import { execFileSync } from "node:child_process";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const encoder = new TextEncoder();
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function hashPasswordPbkdf2(password) {
  const salt = randomBytes(16);
  const iterations = 100_000;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`;
}

function runWrangler(args) {
  try {
    const isWin = process.platform === "win32";
    const npxCmd = isWin ? "npx.cmd" : "npx";
    const res = execFileSync(npxCmd, ["wrangler", ...args], {
      encoding: "utf-8",
      stdio: "pipe",
      cwd: REPO_ROOT,
    });
    return { ok: true, output: res };
  } catch (err) {
    return { ok: false, output: (err.stdout || "") + (err.stderr || "") + err.message };
  }
}

export async function listUsers(remote = true) {
  const flag = remote ? "--remote" : "--local";
  return runWrangler([
    "d1",
    "execute",
    "DB",
    flag,
    "--command",
    "SELECT id, email, name, role, created_at FROM users",
  ]);
}

export async function resetPassword(email, newPassword, remote = true) {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error("Valid email format is required");
  }
  if (!newPassword || newPassword.length < 10) {
    throw new Error("Password must be at least 10 characters long");
  }

  const hash = await hashPasswordPbkdf2(newPassword);
  const flag = remote ? "--remote" : "--local";
  const safeEmail = email.toLowerCase().trim();

  const res = runWrangler([
    "d1",
    "execute",
    "DB",
    flag,
    "--command",
    `UPDATE users SET password_hash = '${hash}', updated_at = CURRENT_TIMESTAMP WHERE lower(email) = '${safeEmail}'`,
  ]);

  if (!res.ok) {
    return { ok: false, error: res.output };
  }
  return { ok: true, hash, output: res.output };
}

export async function createOwner(email, password, name = "Owner", remote = true) {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error("Valid email format is required");
  }
  if (!password || password.length < 10) {
    throw new Error("Password must be at least 10 characters long");
  }

  const hash = await hashPasswordPbkdf2(password);
  const flag = remote ? "--remote" : "--local";
  const safeEmail = email.toLowerCase().trim();
  const safeName = (name || "Owner").replace(/[^a-zA-Z0-9 _-]/g, "");
  const userId = `user_${toBase64Url(randomBytes(18))}`;

  const res = runWrangler([
    "d1",
    "execute",
    "DB",
    flag,
    "--command",
    `INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at) VALUES ('${userId}', '${safeEmail}', '${safeName}', '${hash}', 'owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ]);

  if (!res.ok) {
    return { ok: false, error: res.output };
  }
  return { ok: true, userId, output: res.output };
}

async function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));

  console.log("\n🛡️ FormForge: Admin Account Recovery & Verification Utility\n");
  console.log("1. Check existing users in Cloudflare D1");
  console.log("2. Reset password for an existing account");
  console.log("3. Create a new owner account in D1");
  console.log("4. Exit\n");

  const choice = await ask("Select an option (1-4): ");

  if (choice === "1") {
    console.log("\nQuerying Cloudflare D1 users...");
    const res = await listUsers(true);
    if (res.ok) {
      console.log("\nRegistered Users in D1:\n", res.output);
    } else {
      console.error("\nFailed to query D1. Output:\n", res.error);
    }
  } else if (choice === "2") {
    const email = await ask("\nEnter user email: ");
    const newPassword = await ask("Enter new password (min 10 chars): ");
    console.log("\nUpdating password in Cloudflare D1...");
    try {
      const res = await resetPassword(email, newPassword, true);
      if (res.ok) {
        console.log(`\n✔ Password for '${email}' successfully reset in Cloudflare D1!`);
        console.log("You can now log in at /dashboard with your new password.");
      } else {
        console.error("\nFailed to update password:", res.error);
      }
    } catch (e) {
      console.error("\nError:", e.message);
    }
  } else if (choice === "3") {
    const email = await ask("\nEnter owner email: ");
    const password = await ask("Enter password (min 10 chars): ");
    const name = await ask("Enter owner name (default: Owner): ");
    console.log("\nCreating owner in Cloudflare D1...");
    try {
      const res = await createOwner(email, password, name || "Owner", true);
      if (res.ok) {
        console.log(`\n✔ Owner account for '${email}' created successfully in Cloudflare D1!`);
      } else {
        console.error("\nFailed to create owner:", res.error);
      }
    } catch (e) {
      console.error("\nError:", e.message);
    }
  }

  rl.close();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    const res = await listUsers(true);
    if (res.ok) {
      console.log(res.output);
    } else {
      console.error(res.error);
      process.exit(1);
    }
    return;
  }

  if (args.includes("--reset")) {
    const idx = args.indexOf("--reset");
    const email = args[idx + 1];
    const newPassword = args[idx + 2];
    if (!email || !newPassword) {
      console.error("Usage: node scripts/admin-recover.mjs --reset <email> <newPassword>");
      process.exit(1);
    }
    const res = await resetPassword(email, newPassword, true);
    if (res.ok) {
      console.log(`✔ Password reset successfully for ${email}`);
    } else {
      console.error(res.error);
      process.exit(1);
    }
    return;
  }

  if (args.includes("--create")) {
    const idx = args.indexOf("--create");
    const email = args[idx + 1];
    const password = args[idx + 2];
    const name = args[idx + 3] || "Owner";
    if (!email || !password) {
      console.error("Usage: node scripts/admin-recover.mjs --create <email> <password> [name]");
      process.exit(1);
    }
    const res = await createOwner(email, password, name, true);
    if (res.ok) {
      console.log(`✔ Owner account created successfully for ${email}`);
    } else {
      console.error(res.error);
      process.exit(1);
    }
    return;
  }

  await interactive();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
}
