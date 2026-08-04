/**
 * Sliding-window in-memory rate limiter for expensive operations (analysis /
 * re-analysis). Per-process only — enough for the single-instance prototype;
 * a real deployment would back this with a shared store.
 */

export interface RateLimiterOptions {
  /** Max allowed events per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export class RateLimiter {
  private events = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(opts: RateLimiterOptions) {
    this.limit = opts.limit;
    this.windowMs = opts.windowMs;
    this.now = opts.now ?? Date.now;
  }

  /** Returns true (and records the event) if allowed; false if the key is over its limit. */
  tryAcquire(key: string): boolean {
    const t = this.now();
    const cutoff = t - this.windowMs;
    const timestamps = (this.events.get(key) ?? []).filter((ts) => ts > cutoff);
    if (timestamps.length >= this.limit) {
      this.events.set(key, timestamps);
      return false;
    }
    timestamps.push(t);
    this.events.set(key, timestamps);
    return true;
  }

  /** Seconds until the key can retry (0 when not limited). */
  retryAfterSeconds(key: string): number {
    const t = this.now();
    const cutoff = t - this.windowMs;
    const timestamps = (this.events.get(key) ?? []).filter((ts) => ts > cutoff);
    if (timestamps.length < this.limit) return 0;
    const oldest = Math.min(...timestamps);
    return Math.max(1, Math.ceil((oldest + this.windowMs - t) / 1000));
  }
}
