// Lightweight in-memory sliding-window rate limiter.
// Replace with a Redis-backed limiter (e.g. @upstash/ratelimit) in production.

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = store.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= max) {
    store.set(key, bucket);
    return { ok: false, retryAfterMs: windowMs - (now - bucket.hits[0]) };
  }
  bucket.hits.push(now);
  store.set(key, bucket);
  return { ok: true, retryAfterMs: 0 };
}
