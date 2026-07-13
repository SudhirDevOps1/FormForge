import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type AppDb = DrizzleD1Database<typeof schema>;

type CloudflareEnv = {
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
  // S3-Compatible Storage
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET_NAME?: string;
  S3_REGION?: string;
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
    // S3 Storage
    S3_ENDPOINT: cfEnv?.S3_ENDPOINT ?? process.env.S3_ENDPOINT,
    S3_ACCESS_KEY_ID: cfEnv?.S3_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: cfEnv?.S3_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: cfEnv?.S3_BUCKET_NAME ?? process.env.S3_BUCKET_NAME,
    S3_REGION: cfEnv?.S3_REGION ?? process.env.S3_REGION,
    // R2
    FILES_BUCKET: cfEnv?.FILES_BUCKET,
  };
}

let cachedDb: AppDb | null = null;
let cachedD1: D1Database | null = null;

export function getDb(): AppDb | null {
  const d1 = getRuntimeEnv().DB;

  if (!d1) {
    return null;
  }

  if (cachedDb && cachedD1 === d1) {
    return cachedDb;
  }

  cachedD1 = d1;
  cachedDb = drizzle(d1, { schema });
  return cachedDb;
}

export function databaseUnavailableResponse() {
  return Response.json(
    {
      ok: false,
      code: "D1_NOT_CONFIGURED",
      message:
        "Cloudflare D1 binding DB is not available. Create a D1 database, add database_id in wrangler.jsonc, apply migrations, then deploy with OpenNext.",
    },
    { status: 503 },
  );
}

export function isDbReady(db: AppDb | null): db is AppDb {
  return db !== null;
}
