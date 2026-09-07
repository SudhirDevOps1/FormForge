import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle as drizzleD1, type DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle as drizzleLibSql, type LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client/web";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { autoMigrate } from "./auto-migrate";

export type AppDb = DrizzleD1Database<typeof schema>;

export type CloudflareEnv = {
  DB?: D1Database;
  AUTH_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  ALLOW_REGISTRATION?: string;
  // Brevo
  BREVO_API_KEY?: string;
  BREVO_FROM?: string;
  // SendGrid
  SENDGRID_API_KEY?: string;
  SENDGRID_FROM?: string;
  // Mailgun
  MAILGUN_API_KEY?: string;
  MAILGUN_DOMAIN?: string;
  MAILGUN_FROM?: string;
  // SMTP Global
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
  SMTP_ENABLED?: string;
  // Google Apps Script (GAS)
  GAS_URL?: string;
  GAS_WEBHOOK_URL?: string;
  // Telegram Bot
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  // Ntfy.sh
  NTFY_TOPIC?: string;
  // Turso / libSQL
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  LIBSQL_URL?: string;
  LIBSQL_AUTH_TOKEN?: string;
  DATABASE_URL?: string;
  // Neon Serverless Postgres
  NEON_DATABASE_URL?: string;
  POSTGRES_URL?: string;
  // S3 / Backblaze B2 Storage
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET_NAME?: string;
  S3_REGION?: string;
  B2_ENDPOINT?: string;
  B2_APPLICATION_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_NAME?: string;
  // R2 Bucket binding (optional)
  FILES_BUCKET?: any;
  [key: string]: unknown;
};

function readCloudflareEnv(): CloudflareEnv | null {
  try {
    return getCloudflareContext().env as CloudflareEnv;
  } catch {
    return null;
  }
}

export function getRuntimeEnv(): CloudflareEnv {
  const cfEnv = readCloudflareEnv();

  return {
    DB: cfEnv?.DB,
    AUTH_SECRET: cfEnv?.AUTH_SECRET ?? process.env.AUTH_SECRET,
    RESEND_API_KEY: cfEnv?.RESEND_API_KEY ?? process.env.RESEND_API_KEY,
    RESEND_FROM: cfEnv?.RESEND_FROM ?? process.env.RESEND_FROM,
    ALLOW_REGISTRATION: cfEnv?.ALLOW_REGISTRATION ?? process.env.ALLOW_REGISTRATION,
    // Email Providers
    BREVO_API_KEY: cfEnv?.BREVO_API_KEY ?? process.env.BREVO_API_KEY,
    BREVO_FROM: cfEnv?.BREVO_FROM ?? process.env.BREVO_FROM,
    SENDGRID_API_KEY: cfEnv?.SENDGRID_API_KEY ?? process.env.SENDGRID_API_KEY,
    SENDGRID_FROM: cfEnv?.SENDGRID_FROM ?? process.env.SENDGRID_FROM,
    MAILGUN_API_KEY: cfEnv?.MAILGUN_API_KEY ?? process.env.MAILGUN_API_KEY,
    MAILGUN_DOMAIN: cfEnv?.MAILGUN_DOMAIN ?? process.env.MAILGUN_DOMAIN,
    MAILGUN_FROM: cfEnv?.MAILGUN_FROM ?? process.env.MAILGUN_FROM,
    // SMTP
    SMTP_HOST: cfEnv?.SMTP_HOST ?? process.env.SMTP_HOST,
    SMTP_PORT: cfEnv?.SMTP_PORT ?? process.env.SMTP_PORT,
    SMTP_USER: cfEnv?.SMTP_USER ?? process.env.SMTP_USER,
    SMTP_PASS: cfEnv?.SMTP_PASS ?? process.env.SMTP_PASS,
    SMTP_FROM: cfEnv?.SMTP_FROM ?? process.env.SMTP_FROM,
    SMTP_ENABLED: cfEnv?.SMTP_ENABLED ?? process.env.SMTP_ENABLED,
    // Google Apps Script (GAS)
    GAS_URL: cfEnv?.GAS_URL ?? process.env.GAS_URL ?? cfEnv?.GAS_WEBHOOK_URL ?? process.env.GAS_WEBHOOK_URL,
    GAS_WEBHOOK_URL: cfEnv?.GAS_WEBHOOK_URL ?? process.env.GAS_WEBHOOK_URL,
    // Telegram Bot
    TELEGRAM_BOT_TOKEN: cfEnv?.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: cfEnv?.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID,
    // Ntfy.sh
    NTFY_TOPIC: cfEnv?.NTFY_TOPIC ?? process.env.NTFY_TOPIC,
    // Turso / libSQL
    TURSO_DATABASE_URL: cfEnv?.TURSO_DATABASE_URL ?? process.env.TURSO_DATABASE_URL ?? cfEnv?.LIBSQL_URL ?? process.env.LIBSQL_URL,
    TURSO_AUTH_TOKEN: cfEnv?.TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN ?? cfEnv?.LIBSQL_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN,
    DATABASE_URL: cfEnv?.DATABASE_URL ?? process.env.DATABASE_URL,
    // Neon Serverless Postgres
    NEON_DATABASE_URL: cfEnv?.NEON_DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? cfEnv?.POSTGRES_URL ?? process.env.POSTGRES_URL,
    // S3 / Backblaze B2 Storage
    S3_ENDPOINT: cfEnv?.S3_ENDPOINT ?? process.env.S3_ENDPOINT ?? cfEnv?.B2_ENDPOINT ?? process.env.B2_ENDPOINT,
    S3_ACCESS_KEY_ID: cfEnv?.S3_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID ?? cfEnv?.B2_APPLICATION_KEY_ID ?? process.env.B2_APPLICATION_KEY_ID,
    S3_SECRET_ACCESS_KEY: cfEnv?.S3_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY ?? cfEnv?.B2_APPLICATION_KEY ?? process.env.B2_APPLICATION_KEY,
    S3_BUCKET_NAME: cfEnv?.S3_BUCKET_NAME ?? process.env.S3_BUCKET_NAME ?? cfEnv?.B2_BUCKET_NAME ?? process.env.B2_BUCKET_NAME,
    S3_REGION: cfEnv?.S3_REGION ?? process.env.S3_REGION ?? "us-east-1",
    // R2
    FILES_BUCKET: cfEnv?.FILES_BUCKET,
  };
}

let cachedDb: AppDb | null = null;
let cachedSource: string | null = null;

export function getDb(): AppDb | null {
  const env = getRuntimeEnv();

  // 1. Check for Cloudflare D1 database binding
  if (env.DB) {
    if (cachedDb && cachedSource === "d1") {
      return cachedDb;
    }
    const db = drizzleD1(env.DB, { schema });
    cachedDb = db;
    cachedSource = "d1";
    // Trigger auto-migration asynchronously
    void autoMigrate(db as any);
    return cachedDb;
  }

  // 2. Check for Turso / libSQL credentials (works on Vercel, Netlify, Cloudflare, Node)
  const tursoUrl = env.TURSO_DATABASE_URL || (env.DATABASE_URL?.startsWith("libsql://") || env.DATABASE_URL?.startsWith("https://") ? env.DATABASE_URL : undefined);
  const tursoToken = env.TURSO_AUTH_TOKEN;

  if (tursoUrl) {
    if (cachedDb && cachedSource === tursoUrl) {
      return cachedDb;
    }
    try {
      const client = createClient({
        url: tursoUrl,
        authToken: tursoToken,
      });
      const db = drizzleLibSql(client, { schema });
      cachedDb = db as unknown as AppDb;
      cachedSource = tursoUrl;
      // Trigger auto-migration asynchronously
      void autoMigrate(db as any);
      return cachedDb;
    } catch (error) {
      console.error("Failed to initialize Turso/libSQL client:", error);
    }
  }

  // 3. Check for Neon Serverless Postgres (works on Vercel, Netlify, Cloudflare, Node)
  const neonUrl = env.NEON_DATABASE_URL || (env.DATABASE_URL?.startsWith("postgres://") || env.DATABASE_URL?.startsWith("postgresql://") ? env.DATABASE_URL : undefined);
  if (neonUrl) {
    if (cachedDb && cachedSource === neonUrl) {
      return cachedDb;
    }
    try {
      const sqlClient = neon(neonUrl);
      const db = drizzleNeon(sqlClient, { schema });
      cachedDb = db as unknown as AppDb;
      cachedSource = neonUrl;
      // Trigger auto-migration asynchronously
      void autoMigrate(db as any);
      return cachedDb;
    } catch (error) {
      console.error("Failed to initialize Neon Postgres client:", error);
    }
  }

  // 4. Fallback for local development or file/memory SQLite
  if (env.DATABASE_URL?.startsWith("file:") || process.env.NODE_ENV !== "production") {
    const fallbackUrl = env.DATABASE_URL?.startsWith("file:") ? env.DATABASE_URL : "file:formforge.db";
    if (cachedDb && cachedSource === fallbackUrl) {
      return cachedDb;
    }
    try {
      const client = createClient({ url: fallbackUrl });
      const db = drizzleLibSql(client, { schema });
      cachedDb = db as unknown as AppDb;
      cachedSource = fallbackUrl;
      void autoMigrate(db as any);
      return cachedDb;
    } catch (err) {
      console.warn("Local SQLite client initialization note:", err);
    }
  }

  return cachedDb;
}

export function databaseUnavailableResponse() {
  return Response.json(
    {
      ok: false,
      code: "DB_NOT_CONFIGURED",
      message:
        "Database is not configured. For Cloudflare, bind a D1 database. For Vercel, Netlify, or self-hosted, set TURSO_DATABASE_URL (and optional TURSO_AUTH_TOKEN) or NEON_DATABASE_URL in environment variables.",
    },
    { status: 503 },
  );
}

export function isDbReady(db: AppDb | null): db is AppDb {
  return db !== null;
}
