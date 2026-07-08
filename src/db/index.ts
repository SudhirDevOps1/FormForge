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
