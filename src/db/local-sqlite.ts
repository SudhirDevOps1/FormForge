import { getRuntimeEnv, type AppDb } from "@/db";

/**
 * Local-only SQLite client factory.
 *
 * The database layer imports `createClient` from `@libsql/client/web`,
 * because that is the build that runs inside a Cloudflare Worker. The web
 * build **cannot open `file:` URLs** — it only speaks `libsql:`, `wss:`,
 * `ws:`, `https:` and `http:`. That is why the documented local development
 * flow (`npm run dev`) could never actually reach a database.
 *
 * The Node build of the client *does* support `file:` URLs, but importing it
 * statically would drag native bindings into the Worker bundle. Instead it is
 * resolved lazily, and only in a Node process:
 *
 *   • `process.getBuiltinModule()` is Node 22.3+ and returns a builtin
 *     synchronously, so `getDb()` can stay a synchronous function.
 *   • `process` does not exist in workerd, so on Cloudflare the whole block
 *     is skipped and the D1 / Turso / Neon paths behave exactly as before.
 *
 * The result is that local development works, and the production bundle is
 * byte-for-byte unaffected.
 */

interface NodeProcessLike {
  getBuiltinModule?: (id: string) => unknown;
  cwd?: () => string;
  versions?: { node?: string };
}

interface CreateRequireLike {
  createRequire: (from: string) => (id: string) => unknown;
}

/**
 * Build a Drizzle handle over a local SQLite file.
 * Returns `null` when the environment cannot support it.
 */
export function createLocalSqliteDb(url: string): AppDb | null {
  try {
    const proc = (globalThis as { process?: NodeProcessLike }).process;

    // Not Node (Cloudflare Workers, Deno, browsers) — nothing to do.
    if (!proc?.getBuiltinModule || !proc.cwd) {
      return null;
    }

    const nodeModule = proc.getBuiltinModule("module") as CreateRequireLike | undefined;
    if (!nodeModule?.createRequire) {
      return null;
    }

    // Resolve from the project root so the require map matches the
    // installed dependency tree.
    const requireLocal = nodeModule.createRequire(`${proc.cwd()}/package.json`);

    const libsql = requireLocal("@libsql/client/node") as {
      createClient: (options: { url: string }) => unknown;
    };
    const drizzleModule = requireLocal("drizzle-orm/libsql") as {
      drizzle: (client: unknown, config: unknown) => unknown;
    };

    const client = libsql.createClient({ url });
    return drizzleModule.drizzle(client, { schema: SCHEMA }) as AppDb;
  } catch {
    return null;
  }
}

/**
 * Resolve the local database URL.
 *
 * `DATABASE_URL=file:./formforge.db` opts in explicitly. Without it the
 * local fallback is only used outside production, so a misconfigured
 * deployment can never silently write to a stray file.
 */
export function resolveLocalDatabaseUrl(): string | null {
  const env = getRuntimeEnv();
  const configured = env.DATABASE_URL?.trim();

  if (configured?.startsWith("file:")) {
    return configured;
  }

  const isProduction = env.NODE_ENV === "production" || env.ENVIRONMENT === "production";
  if (!isProduction) {
    return "file:./formforge.db";
  }

  return null;
}

// Imported lazily to keep this module free of a static dependency on the
// schema at module-evaluation time.
import * as SCHEMA from "./schema";
