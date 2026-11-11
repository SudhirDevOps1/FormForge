/**
 * FormForge webhook retry policy.
 *
 * A failed delivery is not lost: it is scheduled for another attempt on an
 * exponential backoff. The schedule is deliberately coarse and human-readable
 * (1m → 5m → 30m → 2h → 12h) because a form backend usually receives one
 * submission at a time — rapid retries would only amplify an outage.
 *
 * Retryable vs terminal:
 *   • 408 Request Timeout, 429 Too Many Requests, 5xx, and transport errors
 *     are retryable.
 *   • Other 4xx responses are terminal: the receiver understood the request
 *     and rejected it, so repeating it will not help.
 */

export const MAX_DELIVERY_ATTEMPTS = 5;

/** Backoff schedule in milliseconds, indexed by attempt number - 1. */
export const RETRY_BACKOFF_MS: readonly number[] = [
  60_000, //  1 minute
  5 * 60_000, //  5 minutes
  30 * 60_000, // 30 minutes
  2 * 60 * 60_000, //  2 hours
  12 * 60 * 60_000, // 12 hours
];

/**
 * Delay before the next attempt.
 * Attempts beyond the schedule reuse the final (longest) delay.
 */
export function computeRetryDelay(attempt: number): number {
  const index = Math.max(0, Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1));
  return RETRY_BACKOFF_MS[index];
}

/** Absolute timestamp (ISO) of the next attempt. */
export function computeNextRetryAt(attempt: number, from: Date = new Date()): string {
  return new Date(from.getTime() + computeRetryDelay(attempt)).toISOString();
}

/**
 * Decide whether a delivery outcome deserves another attempt.
 *
 * @param statusCode HTTP status returned by the receiver, if any.
 * @param transportError True when the request never produced a response.
 */
export function shouldRetry(statusCode?: number | null, transportError = false): boolean {
  if (transportError) return true;
  if (statusCode === null || statusCode === undefined) return true;
  if (statusCode === 408 || statusCode === 429) return true;
  if (statusCode >= 500) return true;
  return false;
}

/** True when another attempt is still allowed. */
export function canAttemptAgain(attempts: number, maxAttempts = MAX_DELIVERY_ATTEMPTS): boolean {
  return attempts < maxAttempts;
}

/**
 * Resolve the full retry decision for a failed delivery.
 * Returns `null` when the delivery should not be retried.
 */
export function planRetry(
  attempts: number,
  statusCode?: number | null,
  transportError = false,
  maxAttempts = MAX_DELIVERY_ATTEMPTS,
): { nextRetryAt: string; attempt: number } | null {
  if (!shouldRetry(statusCode, transportError)) return null;
  if (!canAttemptAgain(attempts, maxAttempts)) return null;

  const nextAttempt = attempts + 1;
  return {
    attempt: nextAttempt,
    nextRetryAt: computeNextRetryAt(nextAttempt),
  };
}

/** Human-readable label for the dashboard delivery log. */
export function describeRetry(nextRetryAt: string | null): string {
  if (!nextRetryAt) return "No retry scheduled";
  const delay = new Date(nextRetryAt).getTime() - Date.now();
  if (delay <= 0) return "Retry due now";
  const minutes = Math.round(delay / 60_000);
  if (minutes < 60) return `Retry in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `Retry in ${hours}h`;
}
