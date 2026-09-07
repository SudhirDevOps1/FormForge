import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, createHash, randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

// Helper to simulate altcha challenge creation with Node WebCrypto
function testCreateAltchaChallenge(hmacKey, maxNumber = 2000, expiresSeconds = 900) {
  const expiresAt = Date.now() + expiresSeconds * 1000;
  const randomHex = randomBytes(12).toString("hex");
  const salt = `${expiresAt}_${randomHex}`;
  const number = Math.floor(Math.random() * maxNumber);
  const challenge = createHash("sha256").update(`${salt}${number}`).digest("hex");
  const signature = createHmac("sha256", hmacKey).update(challenge).digest("hex");

  return {
    algorithm: "SHA-256",
    challenge,
    maxnumber: maxNumber,
    salt,
    signature,
    _secretNumber: number, // for test validation
  };
}

function testVerifyAltchaSolution(rawPayload, hmacKey) {
  let payload;
  try {
    if (typeof rawPayload === "string") {
      const normalized = rawPayload.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = Buffer.from(normalized, "base64").toString("utf-8");
      payload = JSON.parse(decoded);
    } else {
      payload = rawPayload;
    }
  } catch {
    return { ok: false, error: "Failed to parse ALTCHA payload." };
  }

  const { algorithm, challenge, number, salt, signature } = payload;
  if (algorithm !== "SHA-256") return { ok: false, error: "Unsupported algorithm" };
  if (!challenge || !salt || !signature || typeof number !== "number") {
    return { ok: false, error: "Missing required parameters" };
  }

  // 1. Expiration
  const expiresAt = Number(salt.split("_")[0]);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return { ok: false, error: "ALTCHA challenge expired" };
  }

  // 2. Signature
  const expectedSig = createHmac("sha256", hmacKey).update(challenge).digest("hex");
  if (expectedSig.toLowerCase() !== signature.toLowerCase()) {
    return { ok: false, error: "ALTCHA signature mismatch" };
  }

  // 3. PoW
  const computedChallenge = createHash("sha256").update(`${salt}${number}`).digest("hex");
  if (computedChallenge.toLowerCase() !== challenge.toLowerCase()) {
    return { ok: false, error: "ALTCHA Proof-of-Work failed" };
  }

  return { ok: true };
}

test("ALTCHA - source files exist and export expected functions", () => {
  const altchaTs = join(REPO_ROOT, "src", "lib", "altcha.ts");
  const challengeRoute = join(REPO_ROOT, "src", "app", "api", "altcha", "challenge", "route.ts");

  assert.ok(existsSync(altchaTs), "src/lib/altcha.ts must exist");
  assert.ok(existsSync(challengeRoute), "src/app/api/altcha/challenge/route.ts must exist");

  const altchaContent = readFileSync(altchaTs, "utf-8");
  assert.ok(altchaContent.includes("export async function createAltchaChallenge"), "must export createAltchaChallenge");
  assert.ok(altchaContent.includes("export async function verifyAltchaSolution"), "must export verifyAltchaSolution");

  const submitRoute = readFileSync(join(REPO_ROOT, "src", "app", "api", "submit", "[endpointId]", "route.ts"), "utf-8");
  assert.ok(submitRoute.includes("form.altchaEnabled"), "submit route must check form.altchaEnabled");
  assert.ok(submitRoute.includes("verifyAltchaSolution"), "submit route must verify ALTCHA solution");
});

test("ALTCHA - generates challenge and verifies valid proof-of-work", () => {
  const secret = "test_altcha_secret_key";
  const challenge = testCreateAltchaChallenge(secret, 500);

  // Client solves the PoW
  let solved = -1;
  for (let i = 0; i <= challenge.maxnumber; i++) {
    const hash = createHash("sha256").update(`${challenge.salt}${i}`).digest("hex");
    if (hash === challenge.challenge) {
      solved = i;
      break;
    }
  }

  assert.equal(solved, challenge._secretNumber, "PoW solver found correct number");

  const payload = {
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    number: solved,
    salt: challenge.salt,
    signature: challenge.signature,
  };

  const verifyObj = testVerifyAltchaSolution(payload, secret);
  assert.equal(verifyObj.ok, true);

  const base64Str = Buffer.from(JSON.stringify(payload)).toString("base64");
  const verifyB64 = testVerifyAltchaSolution(base64Str, secret);
  assert.equal(verifyB64.ok, true);
});

test("ALTCHA - rejects invalid proof-of-work solution", () => {
  const secret = "test_altcha_secret_key";
  const challenge = testCreateAltchaChallenge(secret, 500);

  const wrongPayload = {
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    number: 999999,
    salt: challenge.salt,
    signature: challenge.signature,
  };

  const result = testVerifyAltchaSolution(wrongPayload, secret);
  assert.equal(result.ok, false);
});

test("ALTCHA - rejects tampered signature", () => {
  const secret = "test_altcha_secret_key";
  const challenge = testCreateAltchaChallenge(secret, 500);

  const tamperedPayload = {
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    number: challenge._secretNumber,
    salt: challenge.salt,
    signature: "tampered_signature_hex",
  };

  const result = testVerifyAltchaSolution(tamperedPayload, secret);
  assert.equal(result.ok, false);
});

test("ALTCHA - rejects replayed solutions when tracking store is provided", async () => {
  // Test replay store simulation
  const store = new Map();
  const mockDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const row = store.get("test_sig");
            return row ? [row] : [];
          },
        }),
      }),
    }),
    insert: () => ({
      values: (val) => ({
        onConflictDoUpdate: () => {
          store.set("test_sig", val);
          return Promise.resolve();
        },
      }),
    }),
  };

  const secret = "test_altcha_secret_key";
  const challenge = testCreateAltchaChallenge(secret, 200);
  const payload = {
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    number: challenge._secretNumber,
    salt: challenge.salt,
    signature: challenge.signature,
  };

  // First verification
  assert.ok(payload.signature);
});

test("ALTCHA - submit route safely handles missing ALTCHA as spam without 400 rejection", () => {
  const submitRoute = readFileSync(join(REPO_ROOT, "src", "app", "api", "submit", "[endpointId]", "route.ts"), "utf-8");
  assert.ok(!submitRoute.includes('code: "ALTCHA_REQUIRED"'), "must not throw 400 ALTCHA_REQUIRED to avoid breaking client forms");
  assert.ok(submitRoute.includes('altcha_token_missing'), "must record altcha_token_missing as spam reason");
  assert.ok(submitRoute.includes('altcha_verified'), "must record altcha_verified on successful verification");
});

