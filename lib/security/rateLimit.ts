// Deliberately simple, in-memory, IP-based rate limiting — no auth, no DB,
// no distributed store. Good enough to stop casual abuse of a single
// server instance. On serverless platforms with multiple instances this
// resets per-instance, which is an accepted tradeoff for the MVP.

interface Bucket {
  count: number;
  windowStartMs: number;
}

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 8;

const buckets = new Map<string, Bucket>();

// Periodically forget old buckets so this doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartMs > WINDOW_MS) buckets.delete(key);
  }
}, WINDOW_MS).unref?.();

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const existing = buckets.get(identifier);

  if (!existing || now - existing.windowStartMs > WINDOW_MS) {
    buckets.set(identifier, { count: 1, windowStartMs: now });
    return { allowed: true };
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - existing.windowStartMs) };
  }

  existing.count += 1;
  return { allowed: true };
}
