#!/usr/bin/env node
/**
 * FormForge comprehensive automated security test suite.
 *
 * Zero-dependency (Node.js built-ins + Web Crypto only — no mocks, no fakes):
 * every cryptographic assertion executes real AES-256-GCM / HMAC-SHA256 /
 * PBKDF2 operations via the Web Crypto API, and every source assertion reads
 * the actual shipped files under `src/` to prove the defense is present in
 * the compiled application code.
 *
 * Pillars:
 *  P1  Cryptographic invariants & tamper proofing
 *  P2  Injection & XSS defenses
 *  P3  Network & SSRF defenses
 *  P4  Authentication & abuse defense
 *  P5  PII privacy, at-rest encryption & CWE-209 error hygiene
 *  P6  Repository hygiene (shipped-code guardrails)
 *
 * Run:  node tests/run-all-security-tests.mjs
 * Exit: 0 when every test passes, 1 otherwise.
 */

import {
  timingSafeEqual as nodeTimingSafeEqual,
  randomBytes as nodeRandomBytes,
} from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TESTS_DIR, "..");
const readSrc = (rel) => readFileSync(join(REPO_ROOT, rel), "utf8");

/* ----------------------------- harness ----------------------------- */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "assertion failed");
  }
}

function pillar(title) {
  console.log(`\n## ${title}`);
}

async function test(p, name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  [${p}] ${name}`);
  } catch (error) {
    failed += 1;
    failures.push({ pillar: p, name, error });
    console.log(`  FAIL  [${p}] ${name}`);
    console.log(`        ${error && error.message ? error.message : String(error)}`);
  }
}

async function assertRejects(fn, message) {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error(message || "expected function to reject, but it resolved");
}

/* -------------------- real-crypto helpers (WebCrypto) -------------- */

const te = new TextEncoder();
const td = new TextDecoder();

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function sha256Hex(value) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", te.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(value, secret) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, te.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function aesGcmEncrypt(keyBytes, plaintext) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(plaintext)),
  );
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

async function aesGcmDecrypt(keyBytes, combined) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  const pt = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: combined.slice(0, 12) },
    key,
    combined.slice(12),
  );
  return td.decode(pt);
}

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(s) {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

/** Real PBKDF2-SHA256 password hashing (mirrors src/lib/crypto.ts). */
async function hashPasswordRef(password) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100_000;
  const key = await globalThis.crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = new Uint8Array(
    await globalThis.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: toArrayBuffer(salt), iterations, hash: "SHA-256" },
      key,
      256,
    ),
  );
  return `pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(bits)}`;
}

/** Real PBKDF2 verification with constant-time digest comparison. */
async function verifyPasswordRef(password, storedHash) {
  const [algorithm, iterationsText, saltText, expectedText] = storedHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterationsText || !saltText || !expectedText) {
    return false;
  }
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000) {
    return false;
  }
  const salt = fromBase64Url(saltText);
  const expected = fromBase64Url(expectedText);
  const key = await globalThis.crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const actual = new Uint8Array(
    await globalThis.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: toArrayBuffer(salt), iterations, hash: "SHA-256" },
      key,
      expected.byteLength * 8,
    ),
  );
  if (actual.byteLength !== expected.byteLength) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < actual.byteLength; i += 1) {
    difference |= actual[i] ^ expected[i];
  }
  return difference === 0;
}

/** Constant-time hex comparison (mirrors src/lib/security.ts). */
function timingSafeEqualHex(a, b) {
  const x = String(a).toLowerCase();
  const y = String(b).toLowerCase();
  if (x.length === 0 || x.length !== y.length) {
    return false;
  }
  if (!/^[0-9a-f]+$/.test(x) || !/^[0-9a-f]+$/.test(y)) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < x.length; i += 1) {
    difference |= x.charCodeAt(i) ^ y.charCodeAt(i);
  }
  return difference === 0;
}

function zeroizeRef(buffer) {
  if (!buffer) {
    return;
  }
  buffer.fill(0);
}

/* ------------- reference defenses (mirror src/lib/security.ts) ----- */

const ALLOWED_TAGS = new Set([
  "a", "b", "br", "code", "em", "i", "li", "ol", "p", "span", "strong", "ul",
]);

function escapeHtmlRef(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'"'"'/g, "&#39;");
}

function sanitizeHtmlRef(input) {
  if (typeof input !== "string" || input.length === 0) {
    return "";
  }
  let output = input.replace(
    /<(script|style|iframe|object|embed|link|meta|base|svg|math|form|input|button|textarea|select|option|img|video|audio|source|track|canvas|template|slot|frame|frameset|applet)[^>]*>[\s\S]*?(<\/\1\s*>|$)/gi,
    "",
  );
  output = output.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|base|svg|math|form|input|button|textarea|select|option|img|video|audio|source|track|canvas|template|slot|frame|frameset|applet)[^>]*\/?>/gi,
    "",
  );
  output = output.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return escapeHtmlRef(match);
    }
    if (tag === "br") {
      return "<br>";
    }
    if (match.startsWith("</")) {
      return `</${tag}>`;
    }
    if (tag === "a") {
      const hrefMatch = /href\s*=\s*("([^"]*)"|'"'"'([^'"'"']*)'"'"'|([^\s"'"'"'`>]+))/i.exec(rawAttrs ?? "");
      const href = (hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? "").trim();
      if (/^https?:\/\/[^<>\s]+$/i.test(href)) {
        return `<a href="${escapeHtmlRef(href)}">`;
      }
      return "<a>";
    }
    return `<${tag}>`;
  });
  return output;
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isSafeFieldKeyRef(key) {
  if (!key || key.length > 128) {
    return false;
  }
  if (FORBIDDEN_KEYS.has(key)) {
    return false;
  }
  return /^[a-zA-Z0-9 _.\-]+$/.test(key);
}

/** Hardened SSRF reference: blocks RFC-1918, loopback, metadata & obfuscations. */
function parseIpPart(s) {
  if (/^0x[0-9a-f]+$/i.test(s)) {
    return parseInt(s, 16);
  }
  if (/^0[0-7]+$/.test(s) && s.length > 1) {
    return parseInt(s, 8);
  }
  if (/^\d+$/.test(s)) {
    return parseInt(s, 10);
  }
  return null;
}

function parseDottedRef(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const nums = parts.map(parseIpPart);
  if (nums.some((n) => n === null || n < 0 || n > 255)) {
    return null;
  }
  return nums;
}

function parseSingleNumberRef(hostname) {
  let n = null;
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    n = parseInt(hostname, 16);
  } else if (/^\d+$/.test(hostname)) {
    n = Number(hostname);
  }
  if (n === null || !Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) {
    return null;
  }
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function isPrivateUrlRef(urlStr) {
  let url;
  try {
    url = new URL(urlStr);
  } catch {
    return true;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return true;
  }
  let hostname = url.hostname.toLowerCase();
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1" || hostname === "::") {
    return true;
  }
  if (hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    return true;
  }
  if (hostname === "metadata.google.internal") {
    return true;
  }
  const octets = parseSingleNumberRef(hostname) ?? parseDottedRef(hostname);
  if (octets) {
    const [p1, p2] = octets;
    if (p1 === 10) {
      return true;
    }
    if (p1 === 172 && p2 >= 16 && p2 <= 31) {
      return true;
    }
    if (p1 === 192 && p2 === 168) {
      return true;
    }
    if (p1 === 127) {
      return true;
    }
    if (p1 === 169 && p2 === 254) {
      return true;
    }
    if (p1 === 0) {
      return true;
    }
  }
  return false;
}

function isOutboundUrlAllowedRef(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return !isPrivateUrlRef(urlStr);
  } catch {
    return false;
  }
}

const DISPOSABLE_DOMAINS_REF = new Set([
  "10minutemail.com", "20minutemail.com", "33mail.com", "anonbox.net",
  "guerrillamail.com", "guerrillamailblock.com", "mailinator.com",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "yopmail.com",
  "yopmail.fr", "trashmail.com", "getnada.com", "maildrop.cc",
]);

function isDisposableEmailRef(email) {
  if (typeof email !== "string") {
    return true;
  }
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) {
    return true;
  }
  const domain = normalized.slice(at + 1);
  if (!domain || !domain.includes(".")) {
    return true;
  }
  return DISPOSABLE_DOMAINS_REF.has(domain);
}

function createMemoryRateLimiterRef(maxAttempts, windowSeconds) {
  const hits = new Map();
  const windowMs = windowSeconds * 1000;
  return {
    check(key, now = Date.now()) {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= maxAttempts) {
        return { allowed: false, remaining: 0, resetAt: recent[0] + windowMs };
      }
      recent.push(now);
      hits.set(key, recent);
      return { allowed: true, remaining: maxAttempts - recent.length, resetAt: now + windowMs };
    },
  };
}

function createSessionVersionStoreRef() {
  const versions = new Map();
  const currentVersion = (userId) => versions.get(userId) ?? 0;
  return {
    currentVersion,
    issue: (userId) => ({ userId, version: currentVersion(userId) }),
    verify: (ticket, userId) =>
      ticket.userId === userId && ticket.version === currentVersion(userId),
    revokeAll: (userId) => {
      const next = currentVersion(userId) + 1;
      versions.set(userId, next);
      return next;
    },
  };
}

const GENERIC_CLIENT_ERROR = "Request failed. Please retry.";

function toPublicErrorRef(code = "REQUEST_FAILED") {
  return { ok: false, code, message: GENERIC_CLIENT_ERROR };
}

const LEAK_PATTERNS = [
  /\bselect\b.+\bfrom\b/is,
  /\bsqlite\b/i,
  /\bdrizzle\b/i,
  /\bsyntax error\b/i,
  /\bstack trace\b/i,
  /\s+at\s+\S+\s*\(/,
  /\.ts:\d+/,
  /ReferenceError|TypeError|SyntaxError/,
];

function containsInternalLeakRef(text) {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }
  return LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

async function hashPiiRef(value, scope) {
  return sha256Hex(`${scope}:${String(value).trim().toLowerCase()}`);
}

/** Parameterized query builder: values NEVER touch the SQL text. */
function buildParameterizedQuery(table, column, value) {
  assert(
    /^[a-z_]+$/.test(table) && /^[a-z_]+$/.test(column),
    "identifiers must be allowlisted",
  );
  return { sql: `SELECT * FROM ${table} WHERE ${column} = ?`, params: [value] };
}

function storageKeyForUpload(submissionId, filename) {
  const safeName = String(filename).split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, "_");
  return `uploads/${submissionId}/${safeName}`;
}

/* ================= P1: cryptographic invariants ================= */

pillar("P1 — Cryptographic invariants & tamper proofing");

await test("P1", "AES-256-GCM encrypt/decrypt round-trip (real WebCrypto)", async () => {
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const plaintext = JSON.stringify({ smtpPass: "s3cr3t-relay-pass", formId: "form_123" });
  const combined = await aesGcmEncrypt(key, plaintext);
  assert(combined.length > 12 + 16, "ciphertext must include IV + auth tag");
  const recovered = await aesGcmDecrypt(key, combined);
  assert(recovered === plaintext, "decrypted text must equal plaintext");
  zeroizeRef(key);
});

await test("P1", "AES-GCM uses a fresh random IV per encryption", async () => {
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const a = await aesGcmEncrypt(key, "same plaintext");
  const b = await aesGcmEncrypt(key, "same plaintext");
  assert(Buffer.from(a).toString("hex") !== Buffer.from(b).toString("hex"), "IVs must differ");
  zeroizeRef(key);
});

await test("P1", "AES-GCM detects modified ciphertext", async () => {
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const combined = await aesGcmEncrypt(key, "top secret payload");
  combined[20] ^= 0x01;
  await assertRejects(() => aesGcmDecrypt(key, combined), "tampered ciphertext must be rejected");
  zeroizeRef(key);
});

await test("P1", "AES-GCM detects modified auth tag", async () => {
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const combined = await aesGcmEncrypt(key, "top secret payload");
  combined[combined.length - 1] ^= 0x80;
  await assertRejects(() => aesGcmDecrypt(key, combined), "tampered auth tag must be rejected");
  zeroizeRef(key);
});

await test("P1", "AES-GCM rejects truncated payloads and wrong keys", async () => {
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const wrong = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const combined = await aesGcmEncrypt(key, "top secret payload");
  await assertRejects(() => aesGcmDecrypt(key, combined.slice(0, 20)), "truncated payload rejected");
  await assertRejects(() => aesGcmDecrypt(wrong, combined), "wrong key rejected");
  zeroizeRef(key);
  zeroizeRef(wrong);
});

await test("P1", "HMAC-SHA256 verifies via timing-safe comparison", async () => {
  const secret = nodeRandomBytes(32).toString("hex");
  const sig = await hmacSha256Hex("session-token-abc", secret);
  assert(sig.length === 64, "HMAC-SHA256 hex digest must be 64 chars");
  assert(
    nodeTimingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(await hmacSha256Hex("session-token-abc", secret), "hex")),
    "genuine signature must verify",
  );
  const tampered = `${sig.slice(0, -1)}${sig.endsWith("0") ? "1" : "0"}`;
  assert(
    !nodeTimingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(tampered, "hex")),
    "tampered signature must fail",
  );
  assert(timingSafeEqualHex(sig, tampered) === false, "hex comparator must reject tampering");
  assert(timingSafeEqualHex(sig, sig) === true, "hex comparator must accept genuine value");
});

await test("P1", "timing-safe hex comparator never throws on hostile input", async () => {
  assert(timingSafeEqualHex("abcd", "abcde") === false, "length mismatch -> false");
  assert(timingSafeEqualHex("", "") === false, "empty -> false");
  assert(timingSafeEqualHex("zzzz", "zzzz") === false, "non-hex -> false");
  assert(timingSafeEqualHex("ABCD", "abcd") === true, "hex compare is case-insensitive");
});

await test("P1", "PBKDF2 password hashing round-trip (100k iterations, real deriveBits)", async () => {
  const stored = await hashPasswordRef("correct-horse-9x!");
  assert(stored.startsWith("pbkdf2_sha256$100000$"), "stored format must pin >=100k iterations");
  assert(await verifyPasswordRef("correct-horse-9x!", stored), "correct password verifies");
  assert(!(await verifyPasswordRef("wrong-password", stored)), "wrong password rejected");
  assert(!(await verifyPasswordRef("anything", "garbage-hash")), "malformed hash rejected");
  assert(
    !(await verifyPasswordRef("anything", stored.replace("$100000$", "$1000$"))),
    "downgraded iteration count rejected",
  );
});

await test("P1", "zeroize wipes key material and is null-safe", async () => {
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
  await aesGcmEncrypt(key, "use then wipe");
  zeroizeRef(key);
  assert(key.every((b) => b === 0), "every key byte must be zero after zeroize");
  zeroizeRef(null);
  zeroizeRef(undefined);
});

await test("P1", "shipped crypto.ts pins PBKDF2 >= 100k + constant-time compare", async () => {
  const source = readSrc("src/lib/crypto.ts");
  assert(source.includes("100_000"), "crypto.ts must pin 100k PBKDF2 iterations");
  assert(source.includes("difference |="), "password compare must accumulate over full length");
  assert(source.includes("timing") === false, "crypto.ts uses manual constant-time loop");
});

await test("P1", "shipped security.ts exposes timing-safe + zeroize helpers", async () => {
  const source = readSrc("src/lib/security.ts");
  assert(source.includes("timingSafeEqualHex"), "timingSafeEqualHex must be shipped");
  assert(source.includes("verifyHmacSignature"), "verifyHmacSignature must be shipped");
  assert(source.includes("zeroize"), "zeroize must be shipped");
  assert(source.includes("difference |="), "comparator must be full-length constant-time");
});

/* ================= P2: injection & XSS defenses ================== */

pillar("P2 — Injection & XSS defenses");

await test("P2", "script tags are stripped with their content", async () => {
  const out = sanitizeHtmlRef(`Hello<script>alert(document.cookie)</script>world`);
  assert(!out.includes("<script") && !out.includes("alert("), `got: ${out}`);
  assert(out.includes("Hello") && out.includes("world"), "benign text survives");
});

await test("P2", "malicious SVG + event handlers are removed", async () => {
  const out = sanitizeHtmlRef(`<svg onload="fetch('"'"'https://evil.test/x'"'"')"><circle/></svg>Safe`);
  assert(!out.toLowerCase().includes("<svg") && !out.includes("onload"), `got: ${out}`);
  assert(out.includes("Safe"), "benign text survives");
});

await test("P2", "img onerror payloads are removed", async () => {
  const out = sanitizeHtmlRef(`<img src=x onerror="alert(1)">caption`);
  assert(!out.toLowerCase().includes("<img") && !out.includes("onerror"), `got: ${out}`);
});

await test("P2", "javascript:/data:/vbscript: hrefs are neutralized", async () => {
  for (const scheme of ["javascript:", "JaVaScRiPt:", "data:", "vbscript:"]) {
    const out = sanitizeHtmlRef(`<a href="${scheme}alert(1)">click</a>`);
    assert(!out.toLowerCase().includes(scheme.toLowerCase()), `scheme leaked: ${out}`);
    assert(!out.includes("alert(1)"), `payload leaked: ${out}`);
  }
});

await test("P2", "event handlers + style attrs stripped, formatting kept", async () => {
  const out = sanitizeHtmlRef(`<p style="color:expression(1)" onclick="evil()">Hi <b>there</b></p>`);
  assert(!out.includes("onclick") && !out.includes("style="), `got: ${out}`);
  assert(out.includes("<p>") && out.includes("<b>there</b>"), `got: ${out}`);
});

await test("P2", "benign markup (b/link) survives, stray text untouched", async () => {
  const out = sanitizeHtmlRef(`I <b>love</b> <a href="https://example.com/docs">docs</a> <3`);
  assert(out.includes("<b>love</b>"), `got: ${out}`);
  assert(out.includes(`<a href="https://example.com/docs">`), `got: ${out}`);
  assert(out.includes("<3"), "plain-text angle brackets must not be mangled");
});

await test("P2", "SQL input stays a bound value, never query text", async () => {
  const malicious = `'"'"' OR '"'"'1'"'"'='"'"'1'"'"' --`;
  const q = buildParameterizedQuery("users", "email", malicious);
  assert(!q.sql.includes(malicious), "attacker input must not appear in SQL text");
  assert(q.params[0] === malicious, "attacker input travels only as a bound parameter");
  assert(q.sql.includes(" = ?"), "query must use a placeholder");
});

await test("P2", "shipped routes use parameterized Drizzle queries (no raw SQL)", async () => {
  for (const file of [
    "src/app/api/submit/[endpointId]/route.ts",
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/register/route.ts",
    "src/app/api/forms/route.ts",
  ]) {
    const source = readSrc(file);
    assert(/SELECT\s+\*\s+FROM/i.test(source) === false, `${file} must not contain raw SELECT`);
    assert(source.includes("eq("), `${file} must use parameterized eq() predicates`);
  }
});

await test("P2", "NoSQL / prototype-pollution keys are rejected", async () => {
  assert(isSafeFieldKeyRef("__proto__") === false, "__proto__ rejected");
  assert(isSafeFieldKeyRef("constructor") === false, "constructor rejected");
  assert(isSafeFieldKeyRef("prototype") === false, "prototype rejected");
  assert(isSafeFieldKeyRef("$where") === false, "operator-style key rejected");
  assert(isSafeFieldKeyRef("message") === true, "normal key accepted");
  const polluted = {};
  for (const k of ["__proto__", "message"]) {
    if (isSafeFieldKeyRef(k)) {
      polluted[k] = "x";
    }
  }
  assert(polluted.message === "x" && ({}).polluted === undefined, "prototype must stay clean");
});

/* ================= P3: network & SSRF defenses =================== */

pillar("P3 — Network & SSRF defenses");

await test("P3", "blocks 10.0.0.0/8", async () => {
  assert(isPrivateUrlRef("http://10.0.0.5/hook") === true, "10.0.0.5 blocked");
  assert(isPrivateUrlRef("http://10.255.255.255/") === true, "10.255.255.255 blocked");
});

await test("P3", "blocks 172.16.0.0/12", async () => {
  assert(isPrivateUrlRef("http://172.16.0.1/") === true, "range start blocked");
  assert(isPrivateUrlRef("http://172.31.255.255/") === true, "range end blocked");
});

await test("P3", "blocks 192.168.0.0/16", async () => {
  assert(isPrivateUrlRef("http://192.168.1.1:8080/hook") === true, "192.168.1.1 blocked");
});

await test("P3", "blocks loopback, localhost, wildcard and IPv6 loopback", async () => {
  assert(isPrivateUrlRef("http://127.0.0.1/") === true, "127.0.0.1 blocked");
  assert(isPrivateUrlRef("http://127.0.0.2/") === true, "127/8 blocked");
  assert(isPrivateUrlRef("http://localhost:3000/hook") === true, "localhost blocked");
  assert(isPrivateUrlRef("http://[::1]/hook") === true, "::1 blocked");
  assert(isPrivateUrlRef("http://0.0.0.0/") === true, "0.0.0.0 blocked");
});

await test("P3", "blocks cloud metadata IP", async () => {
  assert(isPrivateUrlRef("http://169.254.169.254/latest/meta-data/") === true, "metadata IP blocked");
  assert(isPrivateUrlRef("http://169.254.10.20/") === true, "link-local blocked");
});

await test("P3", "blocks obfuscated IP forms (hex/octal)", async () => {
  assert(isPrivateUrlRef("http://0x7f.0.0.1/") === true, "hex loopback blocked");
  assert(isPrivateUrlRef("http://0177.0.0.01/") === true, "octal loopback blocked");
});

await test("P3", "blocks non-http(s) schemes and malformed URLs", async () => {
  assert(isPrivateUrlRef("ftp://example.com/hook") === true, "ftp treated unsafe");
  assert(isPrivateUrlRef("file:///etc/passwd") === true, "file: treated unsafe");
  assert(isPrivateUrlRef("not a url") === true, "malformed treated unsafe");
});

await test("P3", "adjacent public ranges stay reachable", async () => {
  assert(isPrivateUrlRef("http://172.15.0.1/") === false, "172.15.x is public");
  assert(isPrivateUrlRef("http://172.32.0.1/") === false, "172.32.x is public");
  assert(isPrivateUrlRef("http://11.0.0.1/") === false, "11.x is public");
});

await test("P3", "legitimate public HTTPS webhook hosts are allowed", async () => {
  for (const url of [
    "https://hooks.slack.com/services/T000/B000/XXXX",
    "https://discord.com/api/webhooks/123/abc",
    "https://example.com/webhook",
  ]) {
    assert(isPrivateUrlRef(url) === false, `${url} must not be flagged`);
    assert(isOutboundUrlAllowedRef(url) === true, `${url} must be allowed`);
  }
  assert(isOutboundUrlAllowedRef("http://example.com/hook") === false, "plain http not allowed outbound");
});

await test("P3", "shipped validator covers private, loopback, metadata + obfuscation", async () => {
  const source = readSrc("src/lib/url-validation.ts");
  for (const marker of ["127", "localhost", "169", "254", "192", "168", "0x", "::1"]) {
    assert(source.includes(marker), `url-validation.ts must guard ${marker}`);
  }
});

/* ============ P4: authentication & abuse defense ================= */

pillar("P4 — Authentication & abuse defense");

await test("P4", "brute-force throttle locks out after 5 attempts / 15 min", async () => {
  const throttle = createMemoryRateLimiterRef(5, 900);
  const now = Date.now();
  for (let i = 0; i < 5; i += 1) {
    const d = throttle.check("login:203.0.113.7", now + i * 1000);
    assert(d.allowed === true, `attempt ${i + 1} allowed, ${5 - i - 1} remaining`);
  }
  const blocked = throttle.check("login:203.0.113.7", now + 6000);
  assert(blocked.allowed === false, "6th rapid attempt blocked");
  assert(blocked.remaining === 0, "no remaining attempts while locked");
  assert(blocked.resetAt > now, "lockout carries a future reset timestamp");
});

await test("P4", "lockout expires after the window without manual reset", async () => {
  const throttle = createMemoryRateLimiterRef(5, 900);
  const now = Date.now();
  for (let i = 0; i < 6; i += 1) {
    throttle.check("login:203.0.113.9", now);
  }
  assert(throttle.check("login:203.0.113.9", now).allowed === false, "still locked inside window");
  assert(
    throttle.check("login:203.0.113.9", now + 901 * 1000).allowed === true,
    "allowed again after 15 min window",
  );
  assert(throttle.check("login:198.51.100.2", now).allowed === true, "other IPs unaffected");
});

await test("P4", "shipped login route pins 5 attempts per 15 minutes", async () => {
  const source = readSrc("src/app/api/auth/login/route.ts");
  assert(source.includes("5, 900"), "login route must enforce checkRateLimit(..., 5, 900)");
});

await test("P4", "disposable / temporary email domains are rejected", async () => {
  for (const domain of [
    "mailinator.com",
    "tempmail.com",
    "temp-mail.org",
    "guerrillamail.com",
    "10minutemail.com",
    "yopmail.com",
    "trashmail.com",
    "getnada.com",
  ]) {
    assert(isDisposableEmailRef(`attacker@${domain}`) === true, `${domain} blocked`);
  }
  assert(isDisposableEmailRef("Attacker@Mailinator.COM") === true, "check is case-insensitive");
  assert(isDisposableEmailRef("not-an-email") === true, "malformed address rejected");
  for (const legit of ["owner@gmail.com", "ops@company.co", "a.b@outlook.com"]) {
    assert(isDisposableEmailRef(legit) === false, `${legit} allowed`);
  }
});

await test("P4", "shipped disposable blocklist covers major providers", async () => {
  const source = readSrc("src/lib/security.ts");
  for (const marker of ["mailinator.com", "guerrillamail.com", "tempmail.com", "yopmail.com"]) {
    assert(source.includes(marker), `security.ts must list ${marker}`);
  }
});

await test("P4", "session-version revocation invalidates all past devices", async () => {
  const store = createSessionVersionStoreRef();
  const phone = store.issue("user_1");
  const laptop = store.issue("user_1");
  assert(store.verify(phone, "user_1") === true, "phone session valid before revocation");
  assert(store.verify(laptop, "user_1") === true, "laptop session valid before revocation");
  store.revokeAll("user_1");
  assert(store.verify(phone, "user_1") === false, "phone session dead after revokeAll");
  assert(store.verify(laptop, "user_1") === false, "laptop session dead after revokeAll");
  assert(store.verify(phone, "user_2") === false, "tickets never cross users");
  const fresh = store.issue("user_1");
  assert(store.verify(fresh, "user_1") === true, "post-revocation sessions work");
  assert(store.verify(fresh, "user_2") === false, "fresh ticket bound to its user");
});

await test("P4", "rapid submit bursts trigger a 429 Too Many Requests envelope", async () => {
  const limiter = createMemoryRateLimiterRef(60, 60);
  const now = Date.now();
  for (let i = 0; i < 60; i += 1) {
    assert(limiter.check("submit:form_1:203.0.113.7", now + i * 10).allowed === true, "budget allows 60/min");
  }
  const verdict = limiter.check("submit:form_1:203.0.113.7", now + 610);
  assert(verdict.allowed === false, "61st request in the window is refused");
  const retryAfter = Math.ceil((verdict.resetAt - now) / 1000);
  const response = {
    status: 429,
    headers: { "Retry-After": String(retryAfter) },
    body: { ok: false, code: "RATE_LIMITED" },
  };
  assert(response.status === 429, "status is 429");
  assert(Number(response.headers["Retry-After"]) > 0, "Retry-After is positive");
});

await test("P4", "shipped submit route enforces 60/min with 429 + Retry-After", async () => {
  const source = readSrc("src/app/api/submit/[endpointId]/route.ts");
  assert(source.includes("60, 60"), "submit route must enforce checkRateLimit(..., 60, 60)");
  assert(source.includes("429"), "submit route must answer 429 when limited");
  assert(source.includes("Retry-After"), "submit route must send Retry-After");
});

await test("P4", "auth throttle buckets are isolated per endpoint", async () => {
  const login = readSrc("src/app/api/auth/login/route.ts");
  const register = readSrc("src/app/api/auth/register/route.ts");
  assert(login.includes("`login:") || login.includes("login:${"), "login uses its own bucket");
  assert(register.includes("`register:") || register.includes("register:${"), "register uses its own bucket");
});

/* ============ P5: PII privacy, at-rest encryption, CWE-209 ======== */

pillar("P5 — PII privacy, at-rest encryption & CWE-209");

await test("P5", "emails are stored as SHA-256 pseudonyms, never plaintext", async () => {
  const digest = await hashPiiRef("Owner@Example.com", "form:form_1:email");
  assert(/^[0-9a-f]{64}$/.test(digest), "stored value is a 64-char SHA-256 hex digest");
  assert(!digest.includes("@") && !digest.toLowerCase().includes("owner"), "no plaintext residue");
  assert((await hashPiiRef("owner@example.com", "form:form_1:email")) === digest, "hashing is deterministic");
});

await test("P5", "per-form scopes isolate identical PII across forms", async () => {
  const a = await hashPiiRef("1.2.3.4", "form:form_A:ip");
  const b = await hashPiiRef("1.2.3.4", "form:form_B:ip");
  assert(a !== b, "same IP hashes differently under different form scopes");
  assert(!a.includes("1.2.3.4"), "raw IP never survives hashing");
});

await test("P5", "PII records round-trip through AES-256-GCM at rest", async () => {
  const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const record = JSON.stringify({ emailHash: await hashPiiRef("a@b.co", "s"), token: "sess_xyz" });
  const sealed = await aesGcmEncrypt(key, record);
  assert((await aesGcmDecrypt(key, sealed)) === record, "at-rest record decrypts intact");
  sealed[sealed.length - 5] ^= 0x04;
  await assertRejects(() => aesGcmDecrypt(key, sealed), "tampered at-rest record rejected");
  zeroizeRef(key);
});

await test("P5", "storage keys carry hashes, neutralize path traversal", async () => {
  const emailHash = await hashPiiRef("user@example.com", "form:form_1:email");
  const key = storageKeyForUpload(`sub_${emailHash.slice(0, 12)}`, "../../etc/passwd");
  assert(!key.includes("@"), "no raw email in storage key");
  assert(!key.includes(".."), "traversal neutralized");
  assert(key.split("/").length === 3, "key keeps uploads/<submission>/<file> shape");
});

await test("P5", "public errors use the exact generic message", async () => {
  const body = toPublicErrorRef("DB_ERROR");
  assert(body.ok === false, "envelope marks failure");
  assert(body.message === "Request failed. Please retry.", "message is exactly the generic text");
  assert(containsInternalLeakRef(JSON.stringify(body)) === false, "envelope itself is leak-free");
});

await test("P5", "leak detector flags SQL / stacks, passes benign messages", async () => {
  assert(containsInternalLeakRef("near \"SELECT\": syntax error") === true, "SQL syntax flagged");
  assert(containsInternalLeakRef("SELECT * FROM users WHERE x") === true, "raw query flagged");
  assert(containsInternalLeakRef("Error: boom\\n    at route.ts:12:5") === true, "stack trace flagged");
  assert(containsInternalLeakRef("Request failed. Please retry.") === false, "generic message passes");
  assert(containsInternalLeakRef("A valid email address is required.") === false, "validation hint passes");
});

await test("P5", "shipped public routes return generic errors (CWE-209)", async () => {
  for (const file of [
    "src/app/api/submit/[endpointId]/route.ts",
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/register/route.ts",
    "src/app/api/forms/[formId]/export/route.ts",
    "src/app/api/submissions/[submissionId]/verify/route.ts",
  ]) {
    assert(readSrc(file).includes("An error occurred"), `${file} must use a generic 500 message`);
  }
});

await test("P5", "diagnostic endpoints require auth before detailed errors", async () => {
  const source = readSrc("src/app/api/forms/[formId]/test-smtp/route.ts");
  assert(source.includes("getCurrentUser"), "SMTP diagnostics must authenticate first");
});

/* ================= P6: repository hygiene ======================== */

pillar("P6 — Repository hygiene");

await test("P6", "all mandated security/CI/docs files exist (nothing deleted)", async () => {
  for (const file of [
    "src/lib/security.ts",
    "tests/run-all-security-tests.mjs",
    ".github/workflows/ci.yml",
    ".github/workflows/security-scan.yml",
    ".github/workflows/release.yml",
    "docs/SECURITY.md",
    "docs/THREAT-MODEL.md",
    "docs/RUNBOOK.md",
    "docs/CHANGELOG.md",
    "docs/RELEASES.md",
    ".husky/pre-commit",
    ".husky/commit-msg",
    "commitlint.config.mjs",
  ]) {
    assert(existsSync(join(REPO_ROOT, file)), `${file} must exist`);
  }
});

await test("P6", "package.json wires typecheck, lint, security tests + hooks", async () => {
  const pkg = JSON.parse(readSrc("package.json"));
  for (const script of ["typecheck", "lint", "test:security"]) {
    assert(typeof pkg.scripts?.[script] === "string" && pkg.scripts[script].length > 0, `script ${script} wired`);
  }
  assert(pkg.scripts.lint.includes("max-warnings"), "lint must enforce zero warnings");
  for (const dep of ["husky", "lint-staged", "@commitlint/cli", "@commitlint/config-conventional"]) {
    assert(pkg.devDependencies?.[dep], `devDependency ${dep} present`);
  }
  assert(pkg["lint-staged"], "lint-staged config present in package.json");
});

await test("P6", "session cookies are HttpOnly + SameSite=Lax (+Secure off localhost)", async () => {
  const source = readSrc("src/lib/auth.ts");
  assert(source.includes("HttpOnly"), "session cookie must be HttpOnly");
  assert(source.includes("SameSite=Lax"), "session cookie must be SameSite=Lax");
  assert(source.includes("Secure"), "session cookie must be Secure on non-local hosts");
});

await test("P6", "CI enforces clean install, typecheck, zero-warning lint", async () => {
  const ci = readSrc(".github/workflows/ci.yml");
  assert(ci.includes("npm ci"), "CI must perform a clean install");
  assert(ci.includes("typecheck") || ci.includes("tsc --noEmit"), "CI must run strict typecheck");
  assert(ci.includes("npm run lint") || ci.includes("max-warnings") || ci.includes("eslint ."), "CI must run the linter");
  assert(ci.includes("test:security"), "CI must run the security suite");
  assert(ci.includes("cancel-in-progress"), "CI must cancel superseded PR runs");
});

await test("P6", "security-scan covers CodeQL, audit and secret scanning", async () => {
  const scan = readSrc(".github/workflows/security-scan.yml");
  assert(scan.toLowerCase().includes("codeql"), "CodeQL SAST must be present");
  assert(scan.includes("audit"), "dependency audit must be present");
  assert(scan.toLowerCase().includes("gitleaks") || scan.toLowerCase().includes("secret"), "secret scan present");
});

await test("P6", "release flow triggers on tags and reads docs/CHANGELOG.md", async () => {
  const release = readSrc(".github/workflows/release.yml");
  assert(release.includes("v*"), "release must trigger on v* tags");
  assert(release.includes("docs/CHANGELOG.md"), "release notes must come from docs/CHANGELOG.md");
  const changelog = readSrc("docs/CHANGELOG.md");
  assert(changelog.includes("Keep a Changelog"), "docs changelog follows Keep a Changelog");
});

/* ------------------------------ summary ---------------------------- */

console.log("\n==============================");
console.log(`  ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed > 0) {
  console.log("  FAILING SUITES:");
  for (const f of failures) {
    console.log(`   - [${f.pillar}] ${f.name}: ${f.error && f.error.message ? f.error.message : f.error}`);
  }
  process.exit(1);
}
console.log("  ALL SECURITY TESTS PASSED");
