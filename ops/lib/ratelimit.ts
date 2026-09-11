// Per-key token bucket, in process. Enough to keep a misconfigured webhook or
// a runaway script from spending a firm's model budget in one burst.
const buckets = new Map<string, { tokens: number; at: number }>();

export function allow(key: string, capacity = 30, refillPerMinute = 30): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 60_000) * refillPerMinute);
  b.at = now;
  if (b.tokens < 1) { buckets.set(key, b); return false; }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) buckets.clear();
  return true;
}
