import type { AppDb } from "@/db";
import { sql } from "drizzle-orm";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'owner',
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    expires_at text NOT NULL,
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);`,
  `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);`,
  `CREATE TABLE IF NOT EXISTS forms (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    endpoint_id text NOT NULL,
    description text,
    redirect_url text,
    success_message text NOT NULL DEFAULT 'Thanks! Your response has been received.',
    allowed_origins text NOT NULL DEFAULT '*',
    honeypot_field text NOT NULL DEFAULT 'website',
    require_proof_of_work integer NOT NULL DEFAULT 0,
    notify_email integer NOT NULL DEFAULT 0,
    email_to text,
    webhook_url text,
    store_ip_hash integer NOT NULL DEFAULT 1,
    is_active integer NOT NULL DEFAULT 1,
    submissions_count integer NOT NULL DEFAULT 0,
    email_verification_enabled integer NOT NULL DEFAULT 0,
    smtp_enabled integer NOT NULL DEFAULT 0,
    smtp_host text,
    smtp_port integer,
    smtp_user text,
    smtp_pass text,
    smtp_from text,
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS forms_user_id_idx ON forms (user_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS forms_endpoint_id_idx ON forms (endpoint_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS forms_user_slug_idx ON forms (user_id, slug);`,
  `CREATE TABLE IF NOT EXISTS form_fields (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    form_id text NOT NULL,
    field_key text NOT NULL,
    label text NOT NULL,
    type text NOT NULL DEFAULT 'text',
    required integer NOT NULL DEFAULT 0,
    position integer NOT NULL DEFAULT 0,
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS form_fields_form_id_idx ON form_fields (form_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS form_fields_form_key_idx ON form_fields (form_id, field_key);`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id text PRIMARY KEY NOT NULL,
    form_id text NOT NULL,
    payload text NOT NULL,
    email text,
    ip_hash text,
    user_agent text,
    referer text,
    status text NOT NULL DEFAULT 'accepted',
    spam_score integer NOT NULL DEFAULT 0,
    spam_reasons text NOT NULL DEFAULT '[]',
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS submissions_form_id_idx ON submissions (form_id);`,
  `CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at);`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    key_prefix text NOT NULL,
    key_hash text NOT NULL,
    scopes text NOT NULL DEFAULT 'forms:read,submissions:read',
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at text,
    revoked_at text
  );`,
  `CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash);`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    form_id text NOT NULL,
    submission_id text NOT NULL,
    channel text NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    error text,
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS notifications_form_id_idx ON notifications (form_id);`,
  `CREATE INDEX IF NOT EXISTS notifications_submission_id_idx ON notifications (submission_id);`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    user_id text,
    form_id text,
    action text NOT NULL,
    metadata text NOT NULL DEFAULT '{}',
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);`,
  `CREATE INDEX IF NOT EXISTS audit_logs_form_id_idx ON audit_logs (form_id);`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key text PRIMARY KEY NOT NULL,
    count integer NOT NULL DEFAULT 0,
    reset_at text NOT NULL,
    updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS otp_codes (
    id text PRIMARY KEY NOT NULL,
    form_id text NOT NULL,
    email text NOT NULL,
    code_hash text NOT NULL,
    expires_at text NOT NULL,
    verified_at text,
    attempts integer NOT NULL DEFAULT 0,
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS otp_codes_form_id_idx ON otp_codes (form_id);`,
  `CREATE INDEX IF NOT EXISTS otp_codes_email_idx ON otp_codes (email);`,
  `CREATE TABLE IF NOT EXISTS webhook_logs (
    id text PRIMARY KEY NOT NULL,
    form_id text NOT NULL,
    submission_id text NOT NULL,
    url text NOT NULL,
    event text NOT NULL DEFAULT 'form.submitted',
    status_code integer,
    latency_ms integer,
    status text NOT NULL,
    error text,
    created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE INDEX IF NOT EXISTS webhook_logs_form_id_idx ON webhook_logs (form_id);`,
  `CREATE INDEX IF NOT EXISTS webhook_logs_submission_id_idx ON webhook_logs (submission_id);`,
  `CREATE INDEX IF NOT EXISTS webhook_logs_created_at_idx ON webhook_logs (created_at);`,
];

type SchemaGuard = { ready: Promise<void> | null };

const globalForSchema = globalThis as typeof globalThis & { __formforgeSchema?: SchemaGuard };

export async function ensureSchema(db: AppDb): Promise<void> {
  const guard = (globalForSchema.__formforgeSchema ??= { ready: null });

  if (!guard.ready) {
    guard.ready = (async () => {
      // 1. Run complete cross-platform auto-migration (creates all tables and runs additive alters)
      const { autoMigrate } = await import("./auto-migrate");
      await autoMigrate(db as any);
    })().catch((error) => {
      guard.ready = null;
      throw error;
    });
  }

  return guard.ready;
}
