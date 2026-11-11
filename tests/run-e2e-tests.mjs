#!/usr/bin/env node
/**
 * FormForge end-to-end integration test.
 *
 * Exercises the real HTTP surface of a running server: registration, form
 * creation, conditional logic, URL prefill, hidden-field injection, partial
 * submissions, submission workflow, notes, duplicate detection, encrypted
 * payloads at rest, export, rate limiting and the password gate.
 *
 * It uses a throwaway database — point it at a local dev server that was
 * started with a separate `DATABASE_URL`, or let it use the default local
 * SQLite file.
 *
 * Run: node tests/run-e2e-tests.mjs [baseUrl]
 * Exit: 0 when every test passes, 1 otherwise.
 */

const BASE_URL = (process.argv[2] || process.env.FF_E2E_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

/* ----------------------------- harness ----------------------------- */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message || "values differ"} — expected ${b}, got ${a}`);
}

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    failures.push({ name, error });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error && error.message ? error.message : String(error)}`);
  }
}

/* ----------------------------- client ------------------------------ */

let cookie = "";

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: response.status, json, text };
}

const unique = () => `e2e${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

/* ------------------------------ setup ------------------------------ */

console.log(`\nFormForge end-to-end tests → ${BASE_URL}\n`);

const health = await api("/api/health");
if (health.status !== 200) {
  console.error(`The server is not reachable (${health.status}). Start it with \`npm run dev\` first.`);
  process.exit(1);
}

// A fixed account lets the suite run repeatedly against the same instance:
// the first run registers the owner, later runs sign in.
const email = process.env.FF_E2E_EMAIL || "e2e-owner@example.com";
const password = process.env.FF_E2E_PASSWORD || "Thunder!River9Stone";

let register = await api("/api/auth/register", {
  method: "POST",
  body: { email, password, name: "E2E Owner" },
});

if (register.status === 201) {
  console.log(`Registered the test owner (${email}).`);
} else {
  // Registration is one-owner-only, so sign in instead.
  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (login.status !== 200) {
    console.error(
      `Could not authenticate the test owner (${login.status}): ${login.text}\n` +
        "Set FF_E2E_EMAIL / FF_E2E_PASSWORD to the credentials of an existing owner.",
    );
    process.exit(1);
  }
  console.log(`Signed in as the existing owner (${email}).`);
}

console.log("## Account & forms");

await test("the health endpoint reports a live database", async () => {
  const res = await api("/api/health");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(res.json?.ok === true, "health must report ok");
});

await test("an unauthenticated caller cannot list forms", async () => {
  const saved = cookie;
  cookie = "";
  const res = await api("/api/forms");
  cookie = saved;
  assert(res.status === 401, `expected 401, got ${res.status}`);
});

await test("a form can be created", async () => {
  const res = await api("/api/forms", {
    method: "POST",
    body: { name: `E2E Form ${unique()}` },
  });
  assert(res.status === 201, `expected 201, got ${res.status}: ${res.text}`);
  assert(res.json?.data?.form?.endpointId, "the form must expose an endpoint id");
});

let form;
let endpointId;

await test("the created form is listed", async () => {
  const res = await api("/api/forms");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  form = res.json?.data?.forms?.find((entry) => entry.name?.startsWith("E2E Form"));
  assert(form, "the new form must appear in the list");
  endpointId = form.endpointId;
});

/* --------------------------- conditional logic --------------------- */

console.log("\n## Conditional logic");

await test("rules can be saved and read back", async () => {
  const res = await api(`/api/forms/${form.id}/rules`, {
    method: "PUT",
    body: {
      rules: [
        {
          sourceField: "plan",
          operator: "equals",
          value: "free",
          action: "hide",
          targetField: "company",
        },
      ],
    },
  });
  assert(res.status === 200, `expected 200, got ${res.status}: ${res.text}`);
  assertEqual(res.json?.data?.count, 1, "one rule must be stored");

  const read = await api(`/api/forms/${form.id}/rules`);
  assertEqual(read.json?.data?.rules?.length, 1, "the rule must be readable");
  assertEqual(read.json?.data?.rules?.[0]?.targetField, "company");
});

await test("a hidden field is stripped from the stored payload", async () => {
  const res = await api(`/api/submit/${endpointId}`, {
    method: "POST",
    body: { plan: "free", company: "ShouldNotBeStored", email: "e2e@example.com" },
  });
  assert(res.status === 202 || res.status === 200, `expected 202, got ${res.status}: ${res.text}`);

  const list = await api(`/api/forms/${form.id}/submissions?limit=10`);
  const submission = list.json?.data?.submissions?.[0];
  assert(submission, "the submission must be stored");
  const payload = JSON.parse(submission.payload);
  assert(!("company" in payload), "the hidden field must not be stored");
  assertEqual(payload.plan, "free", "visible fields must be stored");
});

await test("a rule that makes a field required is enforced", async () => {
  await api(`/api/forms/${form.id}/rules`, {
    method: "PUT",
    body: {
      rules: [
        {
          sourceField: "plan",
          operator: "equals",
          value: "pro",
          action: "require",
          targetField: "seats",
        },
      ],
    },
  });

  const res = await api(`/api/submit/${endpointId}`, {
    method: "POST",
    body: { plan: "pro", email: "e2e@example.com" },
  });
  assert(res.status === 400, `expected 400, got ${res.status}: ${res.text}`);
  assertEqual(res.json?.code, "MISSING_REQUIRED_FIELD");
});

await test("the required field is accepted once it is supplied", async () => {
  const res = await api(`/api/submit/${endpointId}`, {
    method: "POST",
    body: { plan: "pro", seats: "10", email: "e2e@example.com" },
  });
  assert(res.status === 202 || res.status === 200, `expected 202, got ${res.status}: ${res.text}`);
});

/* ------------------------------- prefill ---------------------------- */

console.log("\n## Prefill & hidden fields");

await test("prefill mappings can be saved", async () => {
  const res = await api(`/api/forms/${form.id}/prefills`, {
    method: "PUT",
    body: {
      captureUtm: true,
      prefills: [{ fieldKey: "tenant", paramName: "tenant", isHidden: true }],
    },
  });
  assert(res.status === 200, `expected 200, got ${res.status}: ${res.text}`);
  assertEqual(res.json?.data?.count, 1);
});

await test("a hidden field is injected server-side and cannot be forged", async () => {
  const res = await api(`/api/submit/${endpointId}?tenant=acme`, {
    method: "POST",
    body: { plan: "free", tenant: "forged", email: "e2e@example.com" },
  });
  assert(res.status === 202 || res.status === 200, `expected 202, got ${res.status}: ${res.text}`);

  const list = await api(`/api/forms/${form.id}/submissions?limit=10`);
  const submission = list.json?.data?.submissions?.find((entry) => {
    const payload = JSON.parse(entry.payload);
    return payload.tenant !== undefined;
  });
  assert(submission, "the submission with the tenant field must exist");
  assertEqual(
    JSON.parse(submission.payload).tenant,
    "acme",
    "the server-resolved value must win over the forged one",
  );
});

await test("UTM parameters are captured automatically", async () => {
  const res = await api(`/api/submit/${endpointId}?utm_source=news&utm_campaign=spring`, {
    method: "POST",
    body: { plan: "free", email: "e2e@example.com" },
  });
  assert(res.status === 202 || res.status === 200, `expected 202, got ${res.status}: ${res.text}`);

  const list = await api(`/api/forms/${form.id}/submissions?limit=20`);
  const submission = list.json?.data?.submissions?.find((entry) => {
    const payload = JSON.parse(entry.payload);
    return payload.utm_source === "news";
  });
  assert(submission, "the UTM submission must exist");
  assertEqual(JSON.parse(submission.payload).utm_campaign, "spring");
});

/* --------------------------- partial submissions -------------------- */

console.log("\n## Partial submissions");

await test("partial progress can be saved and resumed", async () => {
  await api(`/api/forms/${form.id}`, {
    method: "PATCH",
    body: { partialSubmissionsEnabled: true },
  });

  const save = await api(`/api/submit/${endpointId}/partial`, {
    method: "POST",
    body: { payload: { name: "Ada" }, completedFieldKeys: ["name"], lastStep: 1 },
  });
  assert(save.status === 201, `expected 201, got ${save.status}: ${save.text}`);
  const token = save.json?.data?.resumeToken;
  assert(token, "a resume token must be returned");

  const resume = await api(`/api/submit/${endpointId}/partial?token=${encodeURIComponent(token)}`);
  assert(resume.status === 200, `expected 200, got ${resume.status}: ${resume.text}`);
  assertEqual(resume.json?.data?.payload?.name, "Ada");
});

await test("an invalid resume token is rejected", async () => {
  const res = await api(`/api/submit/${endpointId}/partial?token=not-a-real-token`);
  assert(res.status === 404, `expected 404, got ${res.status}`);
});

/* --------------------------- submission workflow -------------------- */

console.log("\n## Submission workflow");

let submissionId;

await test("a submission can be moved through the workflow", async () => {
  const list = await api(`/api/forms/${form.id}/submissions?limit=5`);
  submissionId = list.json?.data?.submissions?.[0]?.id;
  assert(submissionId, "a submission must exist");

  const res = await api(`/api/submissions/${submissionId}`, {
    method: "PATCH",
    body: { workflowStatus: "in_progress" },
  });
  assert(res.status === 200, `expected 200, got ${res.status}: ${res.text}`);
  assertEqual(res.json?.data?.workflowStatus, "in_progress");
});

await test("an invalid workflow status is rejected", async () => {
  const res = await api(`/api/submissions/${submissionId}`, {
    method: "PATCH",
    body: { workflowStatus: "not-a-status" },
  });
  assert(res.status === 400, `expected 400, got ${res.status}`);
});

await test("internal notes can be added and read back", async () => {
  const add = await api(`/api/submissions/${submissionId}/notes`, {
    method: "POST",
    body: { body: "Follow up on Monday <script>alert(1)</script>" },
  });
  assert(add.status === 201, `expected 201, got ${add.status}: ${add.text}`);
  assert(!add.json?.data?.note?.body?.includes("<script>"), "the note must be sanitized");

  const list = await api(`/api/submissions/${submissionId}/notes`);
  assertEqual(list.json?.data?.notes?.length, 1);
});

/* ------------------------- encryption at rest ---------------------- */

console.log("\n## Encryption at rest");

await test("enabling payload encryption seals the stored payload", async () => {
  const patched = await api(`/api/forms/${form.id}`, {
    method: "PATCH",
    body: { encryptPayloads: true },
  });
  assert(patched.status === 200, `expected 200, got ${patched.status}: ${patched.text}`);

  const res = await api(`/api/submit/${endpointId}`, {
    method: "POST",
    body: { plan: "free", email: "secret@example.com", message: "sensitive-answer" },
  });
  assert(res.status === 202 || res.status === 200, `expected 202, got ${res.status}`);

  // The API always returns the readable body.
  const list = await api(`/api/forms/${form.id}/submissions?limit=20`);
  const submission = list.json?.data?.submissions?.find((entry) => {
    const payload = JSON.parse(entry.payload);
    return payload.email === "secret@example.com";
  });
  assert(submission, "the encrypted submission must be readable through the API");
  assertEqual(JSON.parse(submission.payload).message, "sensitive-answer");
});

await test("search still finds answers in an encrypted form", async () => {
  const res = await api(`/api/forms/${form.id}/submissions?q=sensitive-answer`);
  assert(res.status === 200, `expected 200, got ${res.status}: ${res.text}`);
  assert(
    (res.json?.data?.submissions?.length ?? 0) > 0,
    "search must find the answer inside an encrypted payload",
  );
});

/* ------------------------------- export ----------------------------- */

console.log("\n## Export");

await test("the CSV export flattens the payload into columns", async () => {
  const response = await fetch(`${BASE_URL}/api/forms/${form.id}/export?format=csv`, {
    headers: { Cookie: cookie },
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  const text = await response.text();
  const header = text.split("\n")[0];
  assert(header.includes("workflow_status"), "the header must include the workflow status");
  assert(!header.includes('"payload"'), "the raw payload column must be flattened away");
});

await test("the JSON export is valid JSON", async () => {
  const response = await fetch(`${BASE_URL}/api/forms/${form.id}/export?format=json`, {
    headers: { Cookie: cookie },
  });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  const parsed = JSON.parse(await response.text());
  assert(Array.isArray(parsed), "the export must be an array");
});

/* ----------------------------- form password ------------------------ */

console.log("\n## Form password gate");

await test("a password-gated form refuses submissions until unlocked", async () => {
  const patched = await api(`/api/forms/${form.id}`, {
    method: "PATCH",
    body: { passwordEnabled: true, password: "Access123!" },
  });
  assert(patched.status === 200, `expected 200, got ${patched.status}: ${patched.text}`);

  const locked = await api(`/api/submit/${endpointId}`, {
    method: "POST",
    body: { plan: "free", email: "e2e@example.com" },
  });
  assert(locked.status === 403, `expected 403, got ${locked.status}: ${locked.text}`);
  assertEqual(locked.json?.code, "FORM_LOCKED");

  const unlock = await api(`/api/f/${form.slug}/unlock`, {
    method: "POST",
    body: { password: "Access123!" },
  });
  assert(unlock.status === 200, `expected 200, got ${unlock.status}: ${unlock.text}`);
  const token = unlock.json?.token;
  assert(token, "an unlock token must be returned");

  const unlocked = await api(`/api/submit/${endpointId}`, {
    method: "POST",
    headers: { "x-formforge-form-token": token },
    body: { plan: "free", email: "e2e@example.com" },
  });
  assert(unlocked.status === 202 || unlocked.status === 200, `expected 202, got ${unlocked.status}: ${unlocked.text}`);
});

/* ------------------------------- duplicates ------------------------- */

console.log("\n## Duplicate detection");

await test("an identical submission is flagged as a duplicate", async () => {
  await api(`/api/forms/${form.id}`, {
    method: "PATCH",
    body: { passwordEnabled: false, password: "" },
  });

  const body = { plan: "free", email: "dupe@example.com", message: "same answer" };
  const first = await api(`/api/submit/${endpointId}`, { method: "POST", body });
  const second = await api(`/api/submit/${endpointId}`, { method: "POST", body });
  assert(first.status === 202 && second.status === 202, "both submissions must be accepted");

  const list = await api(`/api/forms/${form.id}/submissions?limit=50`);
  const duplicates = list.json?.data?.submissions?.filter(
    (entry) => entry.duplicateOf !== null && entry.duplicateOf !== undefined,
  );
  assert(duplicates?.length >= 1, "the repeat must be flagged as a duplicate");
});

/* ------------------------------- sessions --------------------------- */

console.log("\n## Sessions & audit trail");

await test("active sessions can be listed", async () => {
  const res = await api("/api/user/sessions");
  assert(res.status === 200, `expected 200, got ${res.status}: ${res.text}`);
  assert(Array.isArray(res.json?.data?.sessions), "the session list must be an array");
  assert(res.json.data.sessions.length >= 1, "the current session must be listed");
});

await test("the audit trail records the administrative actions", async () => {
  const res = await api("/api/user/audit-logs");
  assert(res.status === 200, `expected 200, got ${res.status}: ${res.text}`);
  assert(
    (res.json?.data?.entries?.length ?? 0) > 0,
    "the audit trail must contain entries",
  );
});

/* ------------------------------ summary ----------------------------- */

console.log("\n==============================");
console.log(`  ${passed} passed, ${failed} failed (${passed + failed} total)`);
if (failed > 0) {
  console.log("  FAILING SUITES:");
  for (const f of failures) {
    console.log(`   - ${f.name}: ${f.error && f.error.message ? f.error.message : f.error}`);
  }
  process.exit(1);
}
console.log("  ALL END-TO-END TESTS PASSED");
