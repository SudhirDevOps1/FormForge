import { sql } from "drizzle-orm";

let migrationExecuted = false;

async function executeQuery(db: any, query: any): Promise<void> {
  if (typeof db.run === "function") {
    await db.run(query);
  } else if (typeof db.execute === "function") {
    await db.execute(query);
  }
}

export async function autoMigrate(db: any): Promise<void> {
  if (migrationExecuted) return;

  try {
    const isPg = typeof db.execute === "function" && typeof db.run !== "function";
    const autoIncrementType = isPg ? "SERIAL" : "INTEGER PRIMARY KEY AUTOINCREMENT";

    // 1. Users table
    await executeQuery(db, sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'owner' NOT NULL,
        totp_secret TEXT,
        totp_enabled INTEGER DEFAULT 0 NOT NULL,
        global_smtp_enabled INTEGER DEFAULT 0 NOT NULL,
        global_smtp_host TEXT,
        global_smtp_port INTEGER DEFAULT 587,
        global_smtp_user TEXT,
        global_smtp_pass TEXT,
        global_smtp_from TEXT,
        global_gas_url TEXT,
        global_webhook_url TEXT,
        notify_on_login INTEGER DEFAULT 1 NOT NULL,
        notify_on_submission INTEGER DEFAULT 1 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    await executeQuery(db, sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);`);

    // 2. Forms table
    await executeQuery(db, sql`
      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        endpoint_id TEXT NOT NULL,
        description TEXT,
        redirect_url TEXT,
        success_message TEXT DEFAULT 'Thanks! Your response has been received.' NOT NULL,
        allowed_origins TEXT DEFAULT '*' NOT NULL,
        honeypot_field TEXT DEFAULT 'website' NOT NULL,
        require_proof_of_work INTEGER DEFAULT 0 NOT NULL,
        notify_email INTEGER DEFAULT 0 NOT NULL,
        email_to TEXT,
        webhook_url TEXT,
        store_ip_hash INTEGER DEFAULT 1 NOT NULL,
        is_active INTEGER DEFAULT 1 NOT NULL,
        submissions_count INTEGER DEFAULT 0 NOT NULL,
        altcha_enabled INTEGER DEFAULT 0 NOT NULL,
        autoresponder_subject TEXT,
        autoresponder_body TEXT,
        spam_blocklist TEXT,
        retention_days INTEGER DEFAULT 0,
        email_verification_enabled INTEGER DEFAULT 0 NOT NULL,
        smtp_enabled INTEGER DEFAULT 0 NOT NULL,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        smtp_from TEXT,
        gas_url TEXT,
        telegram_bot_token TEXT,
        telegram_chat_id TEXT,
        ntfy_topic TEXT,
        otp_enabled INTEGER DEFAULT 0 NOT NULL,
        submission_limit INTEGER DEFAULT 0,
        email_subject_template TEXT,
        autoresponder_reply_to TEXT,
        max_attachment_size_mb INTEGER DEFAULT 10,
        allowed_file_extensions TEXT DEFAULT '',
        display_mode TEXT DEFAULT 'classic' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );
    `);

    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS forms_user_id_idx ON forms (user_id);`);
    await executeQuery(db, sql`CREATE UNIQUE INDEX IF NOT EXISTS forms_endpoint_id_idx ON forms (endpoint_id);`);
    await executeQuery(db, sql`CREATE UNIQUE INDEX IF NOT EXISTS forms_user_slug_idx ON forms (user_id, slug);`);

    // 3. Form Fields table
    if (isPg) {
      await executeQuery(db, sql`
        CREATE TABLE IF NOT EXISTS form_fields (
          id SERIAL PRIMARY KEY NOT NULL,
          form_id TEXT NOT NULL,
          field_key TEXT NOT NULL,
          label TEXT NOT NULL,
          type TEXT DEFAULT 'text' NOT NULL,
          required INTEGER DEFAULT 0 NOT NULL,
          position INTEGER DEFAULT 0 NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE NO ACTION ON DELETE CASCADE
        );
      `);
    } else {
      await executeQuery(db, sql`
        CREATE TABLE IF NOT EXISTS form_fields (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          form_id TEXT NOT NULL,
          field_key TEXT NOT NULL,
          label TEXT NOT NULL,
          type TEXT DEFAULT 'text' NOT NULL,
          required INTEGER DEFAULT 0 NOT NULL,
          position INTEGER DEFAULT 0 NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE NO ACTION ON DELETE CASCADE
        );
      `);
    }

    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS form_fields_form_id_idx ON form_fields (form_id);`);
    await executeQuery(db, sql`CREATE UNIQUE INDEX IF NOT EXISTS form_fields_form_key_idx ON form_fields (form_id, field_key);`);

    // 4. Submissions table
    await executeQuery(db, sql`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY NOT NULL,
        form_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        email TEXT,
        ip_hash TEXT,
        user_agent TEXT,
        referer TEXT,
        status TEXT DEFAULT 'accepted' NOT NULL,
        spam_score INTEGER DEFAULT 0 NOT NULL,
        spam_reasons TEXT DEFAULT '[]' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );
    `);

    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS submissions_form_id_idx ON submissions (form_id);`);
    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS submissions_created_at_idx ON submissions (created_at);`);

    // 5. Sessions table
    await executeQuery(db, sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );
    `);

    await executeQuery(db, sql`CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions (token_hash);`);
    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);`);

    // 6. API Keys table
    await executeQuery(db, sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        scopes TEXT DEFAULT 'forms:read,submissions:read' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_used_at TEXT,
        revoked_at TEXT,
        expires_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );
    `);

    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id);`);
    await executeQuery(db, sql`CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash);`);

    // 7. Notifications table
    if (isPg) {
      await executeQuery(db, sql`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY NOT NULL,
          form_id TEXT NOT NULL,
          submission_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          status TEXT DEFAULT 'queued' NOT NULL,
          error TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE NO ACTION ON DELETE CASCADE,
          FOREIGN KEY (submission_id) REFERENCES submissions(id) ON UPDATE NO ACTION ON DELETE CASCADE
        );
      `);
    } else {
      await executeQuery(db, sql`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          form_id TEXT NOT NULL,
          submission_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          status TEXT DEFAULT 'queued' NOT NULL,
          error TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE NO ACTION ON DELETE CASCADE,
          FOREIGN KEY (submission_id) REFERENCES submissions(id) ON UPDATE NO ACTION ON DELETE CASCADE
        );
      `);
    }

    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS notifications_form_id_idx ON notifications (form_id);`);
    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS notifications_submission_id_idx ON notifications (submission_id);`);

    // 8. Audit logs table
    if (isPg) {
      await executeQuery(db, sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY NOT NULL,
          user_id TEXT,
          form_id TEXT,
          action TEXT NOT NULL,
          metadata TEXT DEFAULT '{}' NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE SET NULL,
          FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE NO ACTION ON DELETE SET NULL
        );
      `);
    } else {
      await executeQuery(db, sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          user_id TEXT,
          form_id TEXT,
          action TEXT NOT NULL,
          metadata TEXT DEFAULT '{}' NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE SET NULL,
          FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE NO ACTION ON DELETE SET NULL
        );
      `);
    }

    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);`);
    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS audit_logs_form_id_idx ON audit_logs (form_id);`);

    // 9. Rate limits table
    await executeQuery(db, sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY NOT NULL,
        count INTEGER DEFAULT 0 NOT NULL,
        reset_at TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);

    // 10. OTP codes table
    await executeQuery(db, sql`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY NOT NULL,
        form_id TEXT NOT NULL,
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        verified_at TEXT,
        attempts INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );
    `);

    // 11. Webhook logs table
    await executeQuery(db, sql`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id TEXT PRIMARY KEY NOT NULL,
        form_id TEXT NOT NULL,
        submission_id TEXT NOT NULL,
        url TEXT NOT NULL,
        event TEXT DEFAULT 'form.submitted' NOT NULL,
        status_code INTEGER,
        latency_ms INTEGER,
        status TEXT NOT NULL,
        error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (form_id) REFERENCES forms(id) ON UPDATE NO ACTION ON DELETE CASCADE
      );
    `);

    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS webhook_logs_form_id_idx ON webhook_logs (form_id);`);
    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS webhook_logs_submission_id_idx ON webhook_logs (submission_id);`);
    await executeQuery(db, sql`CREATE INDEX IF NOT EXISTS webhook_logs_created_at_idx ON webhook_logs (created_at);`);

    // Safe column additions for existing databases (SQLite & Postgres compatible)
    const columnsToAdd = [
      "ALTER TABLE forms ADD COLUMN gas_url TEXT;",
      "ALTER TABLE forms ADD COLUMN telegram_bot_token TEXT;",
      "ALTER TABLE forms ADD COLUMN telegram_chat_id TEXT;",
      "ALTER TABLE forms ADD COLUMN ntfy_topic TEXT;",
      "ALTER TABLE forms ADD COLUMN otp_enabled INTEGER DEFAULT 0 NOT NULL;",
      "ALTER TABLE forms ADD COLUMN altcha_enabled INTEGER DEFAULT 0 NOT NULL;",
      "ALTER TABLE forms ADD COLUMN autoresponder_subject TEXT;",
      "ALTER TABLE forms ADD COLUMN autoresponder_body TEXT;",
      "ALTER TABLE forms ADD COLUMN spam_blocklist TEXT;",
      "ALTER TABLE forms ADD COLUMN retention_days INTEGER DEFAULT 0;",
      "ALTER TABLE forms ADD COLUMN email_verification_enabled INTEGER DEFAULT 0 NOT NULL;",
      "ALTER TABLE forms ADD COLUMN smtp_enabled INTEGER DEFAULT 0 NOT NULL;",
      "ALTER TABLE forms ADD COLUMN smtp_host TEXT;",
      "ALTER TABLE forms ADD COLUMN smtp_port INTEGER;",
      "ALTER TABLE forms ADD COLUMN smtp_user TEXT;",
      "ALTER TABLE forms ADD COLUMN smtp_pass TEXT;",
      "ALTER TABLE forms ADD COLUMN smtp_from TEXT;",
      "ALTER TABLE users ADD COLUMN totp_secret TEXT;",
      "ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0 NOT NULL;",
      "ALTER TABLE forms ADD COLUMN submission_limit INTEGER DEFAULT 0;",
      "ALTER TABLE forms ADD COLUMN email_subject_template TEXT;",
      "ALTER TABLE forms ADD COLUMN autoresponder_reply_to TEXT;",
      "ALTER TABLE forms ADD COLUMN max_attachment_size_mb INTEGER DEFAULT 10;",
      "ALTER TABLE forms ADD COLUMN allowed_file_extensions TEXT DEFAULT '';",
      "ALTER TABLE forms ADD COLUMN display_mode TEXT DEFAULT 'classic' NOT NULL;",
      "ALTER TABLE users ADD COLUMN global_smtp_enabled INTEGER DEFAULT 0 NOT NULL;",
      "ALTER TABLE users ADD COLUMN global_smtp_host TEXT;",
      "ALTER TABLE users ADD COLUMN global_smtp_port INTEGER DEFAULT 587;",
      "ALTER TABLE users ADD COLUMN global_smtp_user TEXT;",
      "ALTER TABLE users ADD COLUMN global_smtp_pass TEXT;",
      "ALTER TABLE users ADD COLUMN global_smtp_from TEXT;",
      "ALTER TABLE users ADD COLUMN global_gas_url TEXT;",
      "ALTER TABLE users ADD COLUMN global_gas_secret TEXT;",
      "ALTER TABLE users ADD COLUMN global_webhook_url TEXT;",
      "ALTER TABLE users ADD COLUMN global_webhook_secret TEXT;",
      "ALTER TABLE users ADD COLUMN notify_on_login INTEGER DEFAULT 1 NOT NULL;",
      "ALTER TABLE users ADD COLUMN notify_on_submission INTEGER DEFAULT 1 NOT NULL;",
    ];

    for (const ddl of columnsToAdd) {
      try {
        await executeQuery(db, sql.raw(ddl));
      } catch {
        // Column already exists, safe to ignore
      }
    }

    migrationExecuted = true;
  } catch (err) {
    console.warn("Auto-migrate note (safe to ignore if tables exist):", err);
  }
}
