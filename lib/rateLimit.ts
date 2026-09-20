// A small per-IP budget for the API routes that spend money (Claude,
// Geoapify) or reach third parties (Open-Meteo, Nominatim) on the caller's
// behalf. In-memory and per serverless instance, which is enough to make
// casual abuse cheap without an external dependency. Every route that calls
// out shares this one helper, so none is left open by forgetting.

const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim() || "local";
}

/** True when this caller still has budget in `scope`; records the hit. */
export function withinRateLimit(req: Request, scope: string, max: number, windowMs = 60_000): boolean {
  const key = `${scope}:${clientIp(req)}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // bound memory
  return true;
}

/** Test hook. */
export function resetRateLimits(): void {
  hits.clear();
}
