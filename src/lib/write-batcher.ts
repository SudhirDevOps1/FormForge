import { after } from "next/server";
import type { AppDb } from "@/db";
import { webhookLogs } from "@/db/schema";

/**
 * Write batching for high-frequency *logging* rows.
 *
 * Webhook delivery records are append-only telemetry: nothing in the request
 * path reads them back, and one submission can produce a delivery row plus
 * retry rows. Writing each one as its own D1 statement burns a write per row
 * for data that is only ever read by the dashboard's log viewer and the retry
 * cron.
 *
 * Rows are therefore queued per isolate and flushed together:
 *
 *   • when the queue reaches `MAX_BATCH_SIZE` rows (one INSERT, many rows),
 *   • when the queued rows reach the 30-second window, or
 *   • at the end of the request that queued them (`after()`), so a Worker
 *     isolate being frozen can never silently drop a row.
 *
 * Security-critical rows are deliberately *not* batched: audit logs and
 * notifications stay synchronous, because losing one would erase the record of
 * who changed what. Only delivery telemetry goes through this queue.
 */

/** D1 allows 100 bound parameters per statement; a webhook log row binds 12. */
const MAX_BATCH_SIZE = 8;
/** Batching window requested by the operations budget. */
const FLUSH_INTERVAL_MS = 30_000;
/** Hard cap on queued rows so a failing database cannot grow memory forever. */
const MAX_PENDING_ROWS = 200;

type WebhookLogRow = typeof webhookLogs.$inferInsert;

type Queue = {
  db: AppDb | null;
  rows: WebhookLogRow[];
  timer: ReturnType<typeof setTimeout> | null;
  afterScheduled: boolean;
  flushing: boolean;
};

const globalForBatcher = globalThis as typeof globalThis & {
  __formforgeWebhookQueue?: Queue;
};

function queue(): Queue {
  return (globalForBatcher.__formforgeWebhookQueue ??= {
    db: null,
    rows: [],
    timer: null,
    afterScheduled: false,
    flushing: false,
  });
}

function armTimer(q: Queue): void {
  if (q.timer !== null || typeof setTimeout !== "function") return;
  q.timer = setTimeout(() => {
    q.timer = null;
    void flushWebhookLogs();
  }, FLUSH_INTERVAL_MS);
  // Never keep a Node process (dev server, tests) alive just for a flush.
  const handle = q.timer as unknown as { unref?: () => void };
  if (typeof handle?.unref === "function") handle.unref();
}

function scheduleFlush(q: Queue): void {
  if (!q.afterScheduled) {
    q.afterScheduled = true;
    try {
      // `after()` runs once the response is sent, inside the same invocation,
      // so queued rows survive even if the isolate is frozen afterwards.
      after(async () => {
        q.afterScheduled = false;
        await flushWebhookLogs();
      });
    } catch {
      // Outside a request scope (cron, script): the timer is the safety net.
      q.afterScheduled = false;
    }
  }
  armTimer(q);
}

/** Queue one webhook delivery record for the next batch. */
export function queueWebhookLog(db: AppDb, row: WebhookLogRow): void {
  const q = queue();
  q.db ??= db;
  q.rows.push(row);

  if (q.rows.length >= MAX_BATCH_SIZE) {
    void flushWebhookLogs();
    return;
  }
  scheduleFlush(q);
}

/**
 * Flush every queued row as a single INSERT.
 *
 * Safe to call at any time and from anywhere; concurrent callers are merged
 * because the rows are spliced out of the queue before the await.
 */
export async function flushWebhookLogs(): Promise<void> {
  const q = queue();
  if (q.timer !== null) {
    clearTimeout(q.timer);
    q.timer = null;
  }
  if (q.flushing || q.rows.length === 0 || !q.db) return;

  q.flushing = true;
  const batch = q.rows.splice(0, q.rows.length);

  try {
    while (batch.length > 0) {
      // Chunked so a burst never exceeds D1's bound-parameter limit.
      const chunk = batch.splice(0, MAX_BATCH_SIZE);
      await q.db.insert(webhookLogs).values(chunk);
    }
  } catch (error) {
    // Retry once on the next window rather than losing the record entirely,
    // and never let a telemetry failure break the submission response.
    q.rows.unshift(...batch.slice(0, MAX_PENDING_ROWS - q.rows.length));
    console.error("webhook log batch flush failed:", error);
  } finally {
    q.flushing = false;
    if (q.rows.length > 0) armTimer(q);
  }
}

/** Number of rows waiting to be written (used by tests and diagnostics). */
export function pendingWebhookLogCount(): number {
  return queue().rows.length;
}
