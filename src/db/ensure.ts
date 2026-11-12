import type { AppDb } from "@/db";

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
