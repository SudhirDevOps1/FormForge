# 🛠️ FormForge Production Troubleshooting & Setup Guide

This guide helps you resolve any runtime, setup, or pipeline issues when deploying or using FormForge on Cloudflare.

---

## 1. Deploy Setup Prompts

When deploying to Cloudflare using the **Deploy to Cloudflare** button, you must define the following variables on the configuration screen:

| Input Field | Required | Description / Action |
| :--- | :--- | :--- |
| **APP_NAME** | Optional | Name of your deployment (Default: `FormForge`). |
| **AUTH_SECRET** | ✅ Yes | Generate a strong secret key (32+ chars) using [jwtsecrets.com](https://jwtsecrets.com) to secure dashboard sessions. |
| **RESEND_API_KEY** | Optional | Your Resend.com API key. Leave blank if you don't need email alerts. |

---

## 2. Common Errors & Fixes

### ❌ Error: `Network error. Is the Worker deployed and D1 bound?`

#### Cause:
The backend database has no tables created yet, or the database binding is missing.

#### Fix:
> 💡 **Auto-Migration Note (v2.0+):** FormForge v2.0+ includes self-healing startup migrations (`autoMigrate`). Tables and columns are initialized automatically upon first request. If automatic migration is prevented by Cloudflare permissions, use the manual query below as a fallback:

1. Open your **Cloudflare Dashboard** -> **D1 Database** -> Select `formforge-db`.
2. Go to the **Console** tab.
3. Paste the following SQL query and click **Execute**:

```sql
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_seen_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");

CREATE TABLE IF NOT EXISTS "forms" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"endpoint_id" text NOT NULL,
	"description" text,
	"redirect_url" text,
	"success_message" text DEFAULT 'Thanks! Your response has been received.' NOT NULL,
	"allowed_origins" text DEFAULT '*' NOT NULL,
	"honeypot_field" text DEFAULT 'website' NOT NULL,
	"require_proof_of_work" integer DEFAULT false NOT NULL,
	"notify_email" integer DEFAULT false NOT NULL,
	"email_to" text,
	"webhook_url" text,
	"store_ip_hash" integer DEFAULT true NOT NULL,
	"is_active" integer DEFAULT true NOT NULL,
	"submissions_count" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "forms_user_id_idx" ON "forms" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "forms_endpoint_id_idx" ON "forms" ("endpoint_id");
CREATE UNIQUE INDEX IF NOT EXISTS "forms_user_slug_idx" ON "forms" ("user_id","slug");

CREATE TABLE IF NOT EXISTS "submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"payload" text NOT NULL,
	"email" text,
	"ip_hash" text,
	"user_agent" text,
	"referer" text,
	"status" text DEFAULT 'accepted' NOT NULL,
	"spam_score" integer DEFAULT 0 NOT NULL,
	"spam_reasons" text DEFAULT '[]' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "submissions_form_id_idx" ON "submissions" ("form_id");
CREATE INDEX IF NOT EXISTS "submissions_created_at_idx" ON "submissions" ("created_at");

CREATE TABLE IF NOT EXISTS "form_fields" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"form_id" text NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"required" integer DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "form_fields_form_id_idx" ON "form_fields" ("form_id");
CREATE UNIQUE INDEX IF NOT EXISTS "form_fields_form_key_idx" ON "form_fields" ("form_id","field_key");

CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text DEFAULT 'forms:read,submissions:read' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_used_at" text,
	"revoked_at" text,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_hash_idx" ON "api_keys" ("key_hash");

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"form_id" text NOT NULL,
	"submission_id" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "notifications_form_id_idx" ON "notifications" ("form_id");
CREATE INDEX IF NOT EXISTS "notifications_submission_id_idx" ON "notifications" ("submission_id");

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"user_id" text,
	"form_id" text,
	"action" text NOT NULL,
	"metadata" text DEFAULT '{}' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE set null,
	FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON UPDATE no action ON DELETE set null
);
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_form_id_idx" ON "audit_logs" ("form_id");

CREATE TABLE IF NOT EXISTS "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

### ❌ Error: `Build failed: ERESOLVE could not resolve peer dependencies`

#### Cause:
Node packages installation conflicts.

#### Fix:
Verify that the `.npmrc` file is in the project root with the following line:
```text
legacy-peer-deps=true
```

---

### ❌ Error: `ERROR Could not find compiled Open Next config, did you run the build command?`

#### Cause:
This happens when you run a deploy command like `npx wrangler deploy` (or deploy via Cloudflare Pages) but Wrangler cannot find the compiled OpenNext files in the `.open-next` directory. It usually occurs when:
1. The build script in `package.json` was run as `next build` instead of generating the worker assets, OR
2. There is a configuration mismatch between your `package.json` build command and wrangler's build configuration.

#### Correct Fix & Setup:
To prevent compilation issues, configure your files exactly like this:
* **`package.json`**:
  ```json
  "scripts": {
    "build": "next build",
    "deploy": "opennextjs-cloudflare build && wrangler deploy"
  }
  ```
* **`wrangler.jsonc` & `wrangler.toml`**:
  ```json
  "build": {
    "command": "npm run build"
  }
  ```
With this setup, the flow is:
1. Cloudflare/Wrangler triggers the deployment.
2. Wrangler executes the build command `npm run build` which runs the standard `next build` (Next.js compilation).
3. OpenNext wraps the compiled Next.js build into Cloudflare Worker assets under `.open-next` directory.
4. Wrangler uploads and deploys the contents of `.open-next`.

---

### ❌ Error: Build Infinite Recursion / Deploy Loop (Baar-baar build loop hona)

#### Cause:
If you set the build command in `package.json` to `"opennextjs-cloudflare build"` **AND** set the build command in `wrangler.jsonc` / `wrangler.toml` to `"opennextjs-cloudflare build"`, it triggers a circular loop:
`Wrangler Build` ➔ runs `opennextjs-cloudflare build` ➔ runs `@opennextjs/cloudflare` ➔ reads wrangler configuration ➔ runs wrangler build command (`opennextjs-cloudflare build`) again.

#### Fix:
Ensure that `package.json`'s `"build"` script is set to `"next build"` and Wrangler's build command is set to `"npm run build"`. This separates the Next.js compile task from the Wrangler deployment process and breaks the loop.

---

## 3. Database Separation Guide (Dono apps ka data same na ho)

If you deploy two separate workers (e.g., `formforgetesting` and `formforgev1`) but they display the exact same submissions, users, and dashboard data, it means they are **sharing the same D1 Database ID**.

To make them completely independent:

1. **Create a new D1 database** in your Cloudflare account:
   ```bash
   npx wrangler d1 create <new-db-name>
   ```
2. Copy the newly generated **Database ID** (UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
3. Update your **`wrangler.jsonc`** or **`wrangler.toml`** file in the new folder:
   * Change the Worker `name` (e.g., `name = "formforgetesting"`).
   * Paste the new `database_id` under the `[[d1_databases]]` array.
   ```toml
   name = "formforgetesting"

   [[d1_databases]]
   binding = "DB"
   database_name = "formforge-db"
   database_id = "YOUR-NEW-DATABASE-ID-HERE"
   migrations_dir = "migrations"
   ```
4. Deploy the second app. It will now connect to its own empty database.

---

## 4. Fresh Clone Setup Checklist

When cloning this repository to a new machine or account, follow this checklist:

1. **Install Dependencies**:
   ```bash
   npm install   # or bun install
   ```
2. **First Time Deploy**:
   * Set your `name` in `wrangler.jsonc` (this determines your deployment URL: `https://<name>.<subdomain>.workers.dev`).
   * Leave `database_id` empty (`""`) if you want Cloudflare's one-click deploy to automatically create and bind a database for you, **OR** put your manual D1 Database ID if you want to connect to a specific existing database.
   * Run the deployment:
     ```bash
     npm run deploy
     ```
3. **Database Schema Sync**:
   * When deploying for the first time, FormForge auto-creates its schema on the first API request. Simply visit `https://your-worker.workers.dev/dashboard` to register your admin user and initialize the database.

---

## v1.2.0 New Features Troubleshooting

### Registration blocked / "Registration is disabled on this instance"
* **Cause:** `ALLOW_REGISTRATION` is set to `false` in Wrangler vars.
* **Fix:** Set `ALLOW_REGISTRATION=true` in Cloudflare dashboard → Workers → Settings → Environment Variables, or update `wrangler.jsonc` and redeploy.

### File uploads not working
* **Cause:** Neither R2 bucket nor S3 env vars are configured.
* **Fix (R2):** Uncomment the `r2_buckets` section in `wrangler.jsonc` and create the bucket: `npx wrangler r2 bucket create formforge-uploads`.
* **Fix (S3):** Set `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` in Cloudflare secrets.

### Emails not sending (Brevo/SendGrid/Mailgun)
* **Cause:** API key or sender address not configured.
* **Fix:** Set the relevant env vars (e.g. `BREVO_API_KEY` + `BREVO_FROM`) via `npx wrangler secret put BREVO_API_KEY`.

### OpenAPI spec endpoint returns 404
* **Cause:** Worker not deployed after adding the route.
* **Fix:** Redeploy with `npm run deploy`.

---

> **FormForge** — Developed by [Sudhir Singh](https://github.com/SudhirDevOps1)  
> © 2024-2026 Sudhir Singh. All rights reserved.
