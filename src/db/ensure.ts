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
];

type SchemaGuard = { ready: Promise<void> | null };

const globalForSchema = globalThis as typeof globalThis & { __formforgeSchema?: SchemaGuard };

export async function ensureSchema(db: AppDb): Promise<void> {
  const guard = (globalForSchema.__formforgeSchema ??= { ready: null });

  if (!guard.ready) {
    guard.ready = (async () => {
      for (const statement of SCHEMA_STATEMENTS) {
        await db.run(sql.raw(statement));
      }
      
      // Dynamically add columns if database already exists
      const alterStatements = [
        `ALTER TABLE forms ADD COLUMN turnstile_enabled integer NOT NULL DEFAULT 0;`,
        `ALTER TABLE forms ADD COLUMN turnstile_secret_key text;`,
        `ALTER TABLE forms ADD COLUMN autoresponder_subject text;`,
        `ALTER TABLE forms ADD COLUMN autoresponder_body text;`,
        `ALTER TABLE forms ADD COLUMN spam_blocklist text;`,
        `ALTER TABLE api_keys ADD COLUMN expires_at text;`,
        `ALTER TABLE forms ADD COLUMN email_verification_enabled integer NOT NULL DEFAULT 0;`,
        `ALTER TABLE forms ADD COLUMN retention_days integer DEFAULT 0;`
      ];
      for (const stmt of alterStatements) {
        try {
          await db.run(sql.raw(stmt));
        } catch (e) {
          // Column might already exist, which is fine
        }
      }
    })().catch((error) => {
      guard.ready = null;
      throw error;
    });
  }

  return guard.ready;
}
