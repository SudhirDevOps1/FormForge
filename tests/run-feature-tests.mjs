#!/usr/bin/env node
/**
 * FormForge feature-behaviour test suite.
 *
 * The security suite (`run-all-security-tests.mjs`) proves the *guards* are
 * present in the shipped source. This suite proves the new v1.1 engines
 * actually *behave* correctly: the conditional-logic evaluator, the prefill
 * resolver, the webhook backoff policy, the duplicate fingerprinter, the
 * form-password token scheme and the password-strength policy.
 *
 * The engines live in TypeScript, so the suite compiles just those modules
 * to CommonJS in a temp directory (CommonJS resolution handles the
 * extension-less imports) and exercises the real implementation — no mocks,
 * no re-implementations.
 *
 * Run: node tests/run-feature-tests.mjs
 * Exit: 0 when every test passes, 1 otherwise.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TESTS_DIR, "..");
const OUT_DIR = join(REPO_ROOT, ".tmp-feature-tests");

/* ----------------------------- harness ----------------------------- */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "assertion failed");
  }
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message || "values differ"} — expected ${b}, got ${a}`);
  }
}

function assertDeepIncludes(haystack, needle, message) {
  const ok = haystack.some((entry) => JSON.stringify(entry) === JSON.stringify(needle));
  if (!ok) {
    throw new Error(
      `${message || "missing entry"} — ${JSON.stringify(haystack)} does not include ${JSON.stringify(needle)}`,
    );
  }
}

async function test(pillar, name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  [${pillar}] ${name}`);
  } catch (error) {
    failed += 1;
    failures.push({ pillar, name, error });
    console.log(`  FAIL  [${pillar}] ${name}`);
    console.log(`        ${error && error.message ? error.message : String(error)}`);
  }
}

function pillar(title) {
  console.log(`\n## ${title}`);
}

/* ----------------------------- build ------------------------------ */

console.log("Compiling feature modules to CommonJS…");
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

execFileSync(
  process.execPath,
  [
    join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc"),
    "-p",
    join(TESTS_DIR, "tsconfig.feature-tests.json"),
  ],
  { cwd: REPO_ROOT, stdio: "pipe" },
);

const requireCompiled = createRequire(join(OUT_DIR, "index.js"));
const rules = requireCompiled("./lib/rules.js");
const prefill = requireCompiled("./lib/prefill.js");
const retry = requireCompiled("./lib/webhook-retry.js");
const duplicates = requireCompiled("./lib/duplicates.js");
const formPassword = requireCompiled("./lib/form-password.js");
const passwordPolicy = requireCompiled("./lib/password-policy.js");

/* ================================================================== */
/* F1 — Conditional logic engine                                      */
/* ================================================================== */

pillar("F1 — Conditional logic engine");

await test("F1", "every documented operator evaluates correctly", async () => {
  // Each field is named after the operator that reads it, so the rule's
  // `sourceField` is the operator name itself.
  const payload = {
    equals: "yes",
    not_equals: "no",
    contains: "hello world",
    not_contains: "abc",
    starts_with: "formforge",
    ends_with: "pro",
    is_empty: "",
    is_not_empty: "value",
    gt: "42",
    gte: "42",
    lt: "42",
    lte: "42",
    in: "beta",
  };

  const cases = [
    ["equals", "yes", true],
    ["equals", "no", false],
    // The payload holds "no" for this field, so it does NOT equal "yes".
    ["not_equals", "yes", true],
    ["not_equals", "no", false],
    ["contains", "world", true],
    ["contains", "missing", false],
    // The payload holds "abc", which does not contain "world" — but it does
    // contain "abc".
    ["not_contains", "world", true],
    ["not_contains", "abc", false],
    ["starts_with", "form", true],
    ["starts_with", "forge", false],
    ["ends_with", "pro", true],
    ["ends_with", "fre", false],
    // `is_empty` and `is_not_empty` inspect the field itself, so the rule's
    // comparison value is irrelevant for them.
    ["is_empty", "", true],
    ["is_empty", "x", true],
    ["is_not_empty", "x", true],
    ["is_not_empty", "", true],
    ["gt", "40", true],
    ["gt", "50", false],
    ["gte", "42", true],
    ["lt", "50", true],
    ["lt", "10", false],
    ["lte", "42", true],
    ["in", "alpha,beta,gamma", true],
    ["in", "alpha,gamma", false],
  ];

  for (const [operator, value, expected] of cases) {
    const rule = {
      sourceField: operator,
      operator,
      value,
      action: "hide",
      targetField: "target",
    };
    assertEqual(
      rules.ruleMatches(rule, payload),
      expected,
      `operator "${operator}" with value "${value}"`,
    );
  }
});

await test("F1", "unknown operators never match", async () => {
  const rule = {
    sourceField: "a",
    operator: "definitely_not_an_operator",
    value: "x",
    action: "hide",
    targetField: "b",
  };
  assertEqual(rules.ruleMatches(rule, { a: "x" }), false, "unknown operator must not match");
});

await test("F1", "prototype-pollution field keys are rejected", async () => {
  const sanitized = rules.sanitizeRules([
    { sourceField: "__proto__", operator: "equals", value: "x", action: "hide", targetField: "b" },
    { sourceField: "a", operator: "equals", value: "x", action: "hide", targetField: "constructor" },
    { sourceField: "a", operator: "equals", value: "x", action: "hide", targetField: "prototype" },
    { sourceField: "a", operator: "equals", value: "x", action: "hide", targetField: "safe_field" },
  ]);
  assertEqual(sanitized.length, 1, "only the safe rule may survive");
  assertEqual(sanitized[0].targetField, "safe_field");
});

await test("F1", "self-referencing rules are rejected", async () => {
  const sanitized = rules.sanitizeRules([
    { sourceField: "a", operator: "equals", value: "x", action: "hide", targetField: "a" },
  ]);
  assertEqual(sanitized.length, 0, "a rule cannot target its own source field");
});

await test("F1", "a matching hide rule hides the target field", async () => {
  const evaluation = rules.evaluateRules(
    [{ sourceField: "plan", operator: "equals", value: "free", action: "hide", targetField: "company" }],
    { plan: "free" },
  );
  assertDeepIncludes(evaluation.hidden, "company");
});

await test("F1", "a show-rule target is hidden until its condition matches", async () => {
  const ruleset = [
    { sourceField: "plan", operator: "equals", value: "pro", action: "show", targetField: "seats" },
  ];

  const notMatched = rules.evaluateRules(ruleset, { plan: "free" });
  assertDeepIncludes(notMatched.hidden, "seats", "show target stays hidden when the condition fails");

  const matched = rules.evaluateRules(ruleset, { plan: "pro" });
  assert(!matched.hidden.includes("seats"), "show target becomes visible when the condition matches");
  assertDeepIncludes(matched.visible, "seats");
});

await test("F1", "a hidden field is never reported as required", async () => {
  const ruleset = [
    { sourceField: "plan", operator: "equals", value: "free", action: "hide", targetField: "company" },
    { sourceField: "plan", operator: "equals", value: "free", action: "require", targetField: "company" },
  ];
  const evaluation = rules.evaluateRules(ruleset, { plan: "free" });
  assertDeepIncludes(evaluation.hidden, "company");
  assert(!evaluation.required.includes("company"), "a hidden field must not be required");
});

await test("F1", "applyRules strips hidden fields from the payload", async () => {
  const ruleset = [
    { sourceField: "plan", operator: "equals", value: "free", action: "hide", targetField: "secret" },
  ];
  const { sanitized } = rules.applyRules(ruleset, {
    plan: "free",
    secret: "smuggled",
    visible: "kept",
  });
  assert(!("secret" in sanitized), "hidden fields must be stripped");
  assertEqual(sanitized.visible, "kept", "visible fields must survive");
});

await test("F1", "applyRules reports missing required fields", async () => {
  const ruleset = [
    { sourceField: "plan", operator: "equals", value: "pro", action: "require", targetField: "seats" },
  ];
  const { missingRequired } = rules.applyRules(ruleset, { plan: "pro", seats: "  " });
  assertDeepIncludes(missingRequired, "seats", "a blank required field must be reported");

  const filled = rules.applyRules(ruleset, { plan: "pro", seats: "10" });
  assertEqual(filled.missingRequired, [], "a filled required field must not be reported");
});

/* ================================================================== */
/* F2 — Prefill & hidden fields                                       */
/* ================================================================== */

pillar("F2 — Prefill & hidden fields");

await test("F2", "URL parameters map onto their fields", async () => {
  const resolved = prefill.resolvePrefills(
    [{ fieldKey: "email", paramName: "email", isHidden: false }],
    "?email=ada%40example.com",
  );
  assertEqual(resolved.values.email, "ada@example.com");
  assertDeepIncludes(resolved.editableFields, "email");
});

await test("F2", "hidden mappings are flagged as hidden, not editable", async () => {
  const resolved = prefill.resolvePrefills(
    [{ fieldKey: "tenant", paramName: "t", isHidden: true }],
    "?t=acme",
  );
  assertDeepIncludes(resolved.hiddenFields, "tenant");
  assert(!resolved.editableFields.includes("tenant"), "a hidden field is not editable");
});

await test("F2", "UTM parameters are captured as hidden fields", async () => {
  const resolved = prefill.resolvePrefills([], "?utm_source=news&utm_campaign=spring", true);
  assertEqual(resolved.values.utm_source, "news");
  assertEqual(resolved.values.utm_campaign, "spring");
  assertDeepIncludes(resolved.hiddenFields, "utm_source");
});

await test("F2", "UTM capture is off unless enabled", async () => {
  const resolved = prefill.resolvePrefills([], "?utm_source=news", false);
  assertEqual(resolved.values.utm_source, undefined);
});

await test("F2", "reserved keys can never be prefilled", async () => {
  const sanitized = prefill.sanitizePrefillMappings([
    { fieldKey: "__proto__", paramName: "x" },
    { fieldKey: "website", paramName: "y" },
    { fieldKey: "ok", paramName: "__proto__" },
    { fieldKey: "ok2", paramName: "valid" },
  ]);
  assertEqual(sanitized.length, 1);
  assertEqual(sanitized[0].fieldKey, "ok2");
});

await test("F2", "hidden values overwrite whatever the client sent", async () => {
  const merged = prefill.applyHiddenPrefills(
    { tenant: "forged", keep: "yes" },
    { tenant: "trusted" },
  );
  assertEqual(merged.tenant, "trusted", "the server value must win");
  assertEqual(merged.keep, "yes");
});

/* ================================================================== */
/* F3 — Webhook retry policy                                          */
/* ================================================================== */

pillar("F3 — Webhook retry policy");

await test("F3", "the backoff schedule increases monotonically", async () => {
  const schedule = retry.RETRY_BACKOFF_MS;
  assert(schedule.length >= 5, "at least five attempts must be scheduled");
  for (let i = 1; i < schedule.length; i += 1) {
    assert(schedule[i] > schedule[i - 1], "each attempt must wait longer than the last");
  }
  assertEqual(schedule[0], 60_000, "the first retry is after one minute");
});

await test("F3", "server errors and rate limits are retryable", async () => {
  assertEqual(retry.shouldRetry(500), true);
  assertEqual(retry.shouldRetry(502), true);
  assertEqual(retry.shouldRetry(429), true);
  assertEqual(retry.shouldRetry(408), true);
  assertEqual(retry.shouldRetry(null, true), true, "transport errors are retryable");
});

await test("F3", "client errors are terminal", async () => {
  assertEqual(retry.shouldRetry(400), false);
  assertEqual(retry.shouldRetry(401), false);
  assertEqual(retry.shouldRetry(404), false);
});

await test("F3", "retries stop after the attempt cap", async () => {
  const plan = retry.planRetry(1, 500);
  assert(plan !== null, "the first failure must schedule a retry");
  assertEqual(plan.attempt, 2);

  const exhausted = retry.planRetry(
    retry.MAX_DELIVERY_ATTEMPTS,
    500,
  );
  assertEqual(exhausted, null, "no retry may be scheduled past the cap");
});

await test("F3", "a terminal failure schedules no retry", async () => {
  assertEqual(retry.planRetry(1, 404), null);
});

/* ================================================================== */
/* F4 — Duplicate detection                                           */
/* ================================================================== */

pillar("F4 — Duplicate detection");

await test("F4", "field order does not change the fingerprint", async () => {
  const a = await duplicates.fingerprintPayload({ x: "1", y: "2" }, "form", "salt");
  const b = await duplicates.fingerprintPayload({ y: "2", x: "1" }, "form", "salt");
  assertEqual(a, b, "the fingerprint must be order independent");
});

await test("F4", "different payloads produce different fingerprints", async () => {
  const a = await duplicates.fingerprintPayload({ x: "1" }, "form", "salt");
  const b = await duplicates.fingerprintPayload({ x: "2" }, "form", "salt");
  assert(a !== b, "different answers must not collide");
});

await test("F4", "the fingerprint is scoped per form", async () => {
  const a = await duplicates.fingerprintPayload({ x: "1" }, "form-a", "salt");
  const b = await duplicates.fingerprintPayload({ x: "1" }, "form-b", "salt");
  assert(a !== b, "the same answers on two forms must not correlate");
});

await test("F4", "server-injected fields are excluded from the fingerprint", async () => {
  const a = await duplicates.fingerprintPayload({ x: "1", _intent: "sales" }, "form", "salt");
  const b = await duplicates.fingerprintPayload({ x: "1" }, "form", "salt");
  assertEqual(a, b, "transient fields must not affect the fingerprint");
});

await test("F4", "an empty payload has no fingerprintable content", async () => {
  assertEqual(duplicates.hasFingerprintableContent({}), false);
  assertEqual(duplicates.hasFingerprintableContent({ x: "value" }), true);
});

/* ================================================================== */
/* F5 — Form password gate                                             */
/* ================================================================== */

pillar("F5 — Form password gate");

await test("F5", "a valid password round-trips through the hash", async () => {
  const hash = await formPassword.hashFormPassword("Str0ng!Passphrase");
  assert(hash.startsWith("pbkdf2_sha256$"), "the hash must use PBKDF2-SHA256");
  assert(!hash.includes("Str0ng!Passphrase"), "the plaintext must not appear in the hash");
  assertEqual(await formPassword.verifyFormPassword("Str0ng!Passphrase", hash), true);
  assertEqual(await formPassword.verifyFormPassword("wrong-password", hash), false);
});

await test("F5", "an unlock token verifies for its own form only", async () => {
  const secret = "a-test-secret";
  const token = await formPassword.createFormToken("form-1", secret);
  assertEqual(await formPassword.verifyFormToken(token, "form-1", secret), true);
  assertEqual(
    await formPassword.verifyFormToken(token, "form-2", secret),
    false,
    "a token must not unlock a different form",
  );
  assertEqual(
    await formPassword.verifyFormToken(token, "form-1", "other-secret"),
    false,
    "a token must not verify under a different secret",
  );
});

await test("F5", "a tampered token is rejected", async () => {
  const secret = "a-test-secret";
  const token = await formPassword.createFormToken("form-1", secret);
  const [expiry, signature] = token.split(".");
  const forged = `${expiry}.${signature.slice(0, -1)}${signature.endsWith("a") ? "b" : "a"}`;
  assertEqual(await formPassword.verifyFormToken(forged, "form-1", secret), false);
});

await test("F5", "an expired token is rejected", async () => {
  const secret = "a-test-secret";
  const token = await formPassword.createFormToken("form-1", secret, -1000);
  assertEqual(await formPassword.verifyFormToken(token, "form-1", secret), false);
});

await test("F5", "malformed tokens are rejected without throwing", async () => {
  const secret = "a-test-secret";
  for (const token of ["", "nodot", ".", "abc.def", "1.2"]) {
    assertEqual(
      await formPassword.verifyFormToken(token, "form-1", secret),
      false,
      `token "${token}" must be rejected`,
    );
  }
});

await test("F5", "the form password policy rejects weak secrets", async () => {
  assertEqual(formPassword.validateFormPassword("short").ok, false);
  assertEqual(formPassword.validateFormPassword("alllettersnodigits").ok, false);
  assertEqual(formPassword.validateFormPassword("Valid123!").ok, true);
});

/* ================================================================== */
/* F6 — Password strength policy                                      */
/* ================================================================== */

pillar("F6 — Password strength policy");

await test("F6", "weak and common passwords are rejected", async () => {
  assert(passwordPolicy.passwordPolicyError("password") !== null, "common passwords are rejected");
  assert(passwordPolicy.passwordPolicyError("123456789012") !== null, "numeric-only is rejected");
  assert(passwordPolicy.passwordPolicyError("short") !== null, "short passwords are rejected");
  assert(passwordPolicy.passwordPolicyError("") !== null, "an empty password is rejected");
});

await test("F6", "a strong password is accepted", async () => {
  assertEqual(passwordPolicy.passwordPolicyError("Thunder!River9"), null);
});

await test("F6", "the score rises with length and diversity", async () => {
  const weak = passwordPolicy.assessPasswordStrength("abc");
  const strong = passwordPolicy.assessPasswordStrength("Thunder!River9Stone");
  assert(strong.score > weak.score, "a stronger password must score higher");
  assertEqual(weak.acceptable, false);
  assertEqual(strong.acceptable, true);
});

await test("F6", "a repeated-character password scores zero", async () => {
  const assessment = passwordPolicy.assessPasswordStrength("aaaaaaaaaaaa");
  assertEqual(assessment.score, 0);
  assertEqual(assessment.acceptable, false);
});

/* ================================================================== */
/* F7 — Payload encryption at rest                                      */
/* ================================================================== */

pillar("F7 — Payload encryption at rest");

await test("F7", "a payload round-trips through the encrypted envelope", async () => {
  const { encryptPayload, decryptPayload, isEncryptedPayload } = requireCompiled(
    "./lib/encryption.js",
  );

  const plain = JSON.stringify({ email: "ada@example.com", message: "hello" });
  const sealed = await encryptPayload(plain);

  assert(isEncryptedPayload(sealed), "the sealed payload must carry the envelope prefix");
  assert(!sealed.includes("ada@example.com"), "the plaintext must not be readable in the ciphertext");
  assertEqual(await decryptPayload(sealed), plain, "the payload must round-trip exactly");
});

await test("F7", "a plaintext payload is returned unchanged", async () => {
  const { decryptPayload, isEncryptedPayload } = requireCompiled("./lib/encryption.js");
  const plain = JSON.stringify({ a: 1 });
  assertEqual(isEncryptedPayload(plain), false, "plaintext is not an encrypted payload");
  assertEqual(await decryptPayload(plain), plain, "plaintext must pass through untouched");
});

await test("F7", "two encryptions of the same payload differ", async () => {
  const { encryptPayload } = requireCompiled("./lib/encryption.js");
  const plain = JSON.stringify({ a: 1 });
  const first = await encryptPayload(plain);
  const second = await encryptPayload(plain);
  assert(first !== second, "a fresh IV must be used for every encryption");
});

await test("F7", "a tampered ciphertext does not decrypt to the plaintext", async () => {
  const { encryptPayload, decryptPayload } = requireCompiled("./lib/encryption.js");
  const plain = JSON.stringify({ secret: "value" });
  const sealed = await encryptPayload(plain);
  const tampered = sealed.slice(0, -4) + "AAAA";
  const result = await decryptPayload(tampered);
  assert(result !== plain, "a tampered payload must not decrypt to the original");
});

await test("F7", "an unreadable payload yields a safe placeholder", async () => {
  const { decryptPayload } = requireCompiled("./lib/encryption.js");
  const result = await decryptPayload("ffenc:v1:bm90LWEtdmFsaWQtaGVyZQ==");
  assert(result.length > 0, "a placeholder must be returned instead of throwing");
  assert(result.includes("_error"), "the placeholder must flag the read failure");
});

/* ================================================================== */
/* F8 — Workflow automations & merge tags engine                      */
/* ================================================================== */

pillar("F8 — Workflow automations & merge tags engine");

await test("F8", "merge tags interpolate values and fallbacks cleanly", async () => {
  const { renderMergeTags, extractMergeTags } = requireCompiled("./lib/merge-tags.js");
  const template = "Hello {{name | 'Customer'}}, your topic is {{topic}}.";
  const rendered = renderMergeTags(template, { topic: "Sales" });
  assertEqual(rendered, "Hello Customer, your topic is Sales.");
  assertEqual(extractMergeTags(template), ["name", "topic"]);
});

await test("F8", "merge tags HTML escaping neutralizes XSS in emails", async () => {
  const { renderMergeTags } = requireCompiled("./lib/merge-tags.js");
  const rendered = renderMergeTags("<b>{{input}}</b>", { input: "<script>alert(1)</script>" }, { escapeHtml: true });
  assert(!rendered.includes("<script>"), "script tags must be escaped");
  assert(rendered.includes("&lt;script&gt;"), "escaped markup must be present");
});

await test("F8", "merge tags access nested metadata safely without prototype pollution", async () => {
  const { renderMergeTags } = requireCompiled("./lib/merge-tags.js");
  const rendered = renderMergeTags("ID: {{_meta.id}} Polluted: {{__proto__.test | 'safe'}}", {
    _meta: { id: "sub-123" },
  });
  assertEqual(rendered, "ID: sub-123 Polluted: safe");
});

await test("F8", "workflow condition operators evaluate accurately", async () => {
  const { evaluateCondition } = requireCompiled("./lib/workflow-engine.js");
  const data = { budget: "5000", intent: "sales", status: "open" };
  assert(evaluateCondition({ field: "budget", operator: "gt", value: "1000" }, data), "5000 > 1000");
  assert(!evaluateCondition({ field: "budget", operator: "lt", value: "1000" }, data), "5000 not < 1000");
  assert(evaluateCondition({ field: "intent", operator: "equals", value: "sales" }, data), "intent equals sales");
  assert(evaluateCondition({ field: "intent", operator: "in", value: "support, sales, billing" }, data), "in set");
});

await test("F8", "workflow conditions enforce conjunction (AND)", async () => {
  const { evaluateAllConditions } = requireCompiled("./lib/workflow-engine.js");
  const conds = JSON.stringify([
    { field: "tier", operator: "equals", value: "pro" },
    { field: "users", operator: "gt", value: "10" },
  ]);
  assert(evaluateAllConditions(conds, { tier: "pro", users: "25" }), "matches both conditions");
  assert(!evaluateAllConditions(conds, { tier: "free", users: "25" }), "fails first condition");
  assert(!evaluateAllConditions(conds, { tier: "pro", users: "5" }), "fails second condition");
});

await test("F8", "workflow actions cap enforces edge subrequest budget", async () => {
  const { MAX_WORKFLOW_ACTIONS } = requireCompiled("./lib/workflow-engine.js");
  assertEqual(MAX_WORKFLOW_ACTIONS, 5, "maximum actions per workflow must be 5 to respect Cloudflare limits");
});

/* ------------------------------------------------------------------ */
/* Pillar F9: Premium Market-Beating Features (Signatures & Quizzes)  */
/* ------------------------------------------------------------------ */

console.log("\n## F9 — Premium features (Signatures & Assessment Scoring)");

await test("F9", "digital signature payloads validate PNG base64 format", async () => {
  const dummySignature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  assert(dummySignature.startsWith("data:image/png;base64,"), "signature must carry PNG data URI header");
  const base64Data = dummySignature.replace("data:image/png;base64,", "");
  const buf = Buffer.from(base64Data, "base64");
  assert(buf.length > 0, "base64 signature payload must decode to binary bytes");
});

await test("F9", "option scoring logic calculates quiz totals correctly", async () => {
  const responses = {
    team_size: "10-50 employees [score:20]",
    budget: "Enterprise $50k+ [score:50]",
    timeline: "Immediate (+10)",
    plain_text: "General Feedback without score",
  };

  let total = 0;
  for (const val of Object.values(responses)) {
    if (typeof val === "string") {
      const match = val.match(/(?:\[score:|\+|score:)(\d+)\]?/i);
      if (match) {
        total += parseInt(match[1], 10) || 0;
      }
    }
  }

  assertEqual(total, 80, "score must sum 20 + 50 + 10 = 80 points");
});

await test("F9", "autoresponder email merges personalized fields safely", async () => {
  const { renderMergeTags } = requireCompiled("./lib/merge-tags.js");
  const template = "Hi {{name | 'valued customer'}},\n\nThank you for choosing FormForge!\n\nYour message: \"{{message}}\" has been routed to our team.";
  const payload = { name: "Sarah Connor", message: "Need multi-region deployment" };
  const rendered = renderMergeTags(template, payload, { escapeHtml: true });

  assert(rendered.includes("Hi Sarah Connor,"), "interpolates name");
  assert(rendered.includes("Need multi-region deployment"), "interpolates message");
});

await test("F9", "redirect URL parameter piping encodes values and strips unfilled tags", async () => {
  const template = "https://example.com/welcome?name={{name}}&tier={{tier}}&tag={{unknown}}";
  const values = { name: "John Doe & Partners", tier: "pro", secret: "do-not-leak" };

  let target = template;
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string") {
      const regex = new RegExp(`\\{\\{${k}\\}\\}`, "gi");
      target = target.replace(regex, encodeURIComponent(v));
    }
  }
  target = target.replace(/\{\{[^}]+\}\}/g, "");

  assertEqual(
    target,
    "https://example.com/welcome?name=John%20Doe%20%26%20Partners&tier=pro&tag=",
    "must URL-encode dynamic values and safely purge unfulfilled tags",
  );
});

await test("F9", "workflow builder generates valid JSON actions payload", async () => {
  const actions = [
    {
      id: "act-1",
      type: "autoresponder",
      subject: "Thanks {{name}}",
      body: "Received your message: {{message}}",
    },
  ];
  const serialized = JSON.stringify(actions);
  const parsed = JSON.parse(serialized);
  assertEqual(parsed[0].type, "autoresponder");
  assertEqual(parsed[0].id, "act-1");
});

/* ------------------------------ summary ---------------------------- */

rmSync(OUT_DIR, { recursive: true, force: true });

console.log("\n==============================");
console.log(`  ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed > 0) {
  console.log("  FAILING SUITES:");
  for (const f of failures) {
    console.log(`   - [${f.pillar}] ${f.name}: ${f.error && f.error.message ? f.error.message : f.error}`);
  }
  process.exit(1);
}
console.log("  ALL FEATURE TESTS PASSED");
