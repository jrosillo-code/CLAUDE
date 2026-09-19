// Hourly wind for one place and date from Open-Meteo's keyless forecast API.
// Cached per rounded coordinate + date for an hour, four-second timeout, and
// never a hard failure: the brief renders without wind rather than waiting.

export interface WindHour {
  /** ISO instant (UTC). */
  time: string;
  wind10m: number;
  wind120m: number;
  gust10m: number;
}

export type WindResult =
  | {
      source: "open-meteo";
      unit: "km/h";
      hours: WindHour[];
      /** The place's IANA zone and offset, as Open-Meteo resolves them. */
      timezone?: string;
      utcOffsetSeconds?: number;
    }
  | { unavailable: true; reason: string };

export const WIND_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 300;
const cache = new Map<string, { at: number; result: WindResult }>();

/** Hours whose gusts stay under this read as calm windows for flying. */
export const CALM_GUST_KMH = 30;

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export async function fetchWind(
  lat: number,
  lng: number,
  date: string,
  deps: { fetchImpl?: FetchLike; now?: () => number } = {}
): Promise<WindResult> {
  const fetchImpl = deps.fetchImpl ?? (fetch as unknown as FetchLike);
  const now = deps.now ?? Date.now;
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${date}`;
  const hit = cache.get(key);
  if (hit && now() - hit.at < CACHE_TTL_MS) return hit.result;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&hourly=wind_speed_10m,wind_speed_120m,wind_gusts_10m&wind_speed_unit=kmh&timezone=auto` +
    `&start_date=${date}&end_date=${date}`;
  let result: WindResult;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(WIND_TIMEOUT_MS) });
    if (!res.ok) {
      result = { unavailable: true, reason: res.status === 400 ? "Open-Meteo has no forecast for that date (about 16 days ahead, 3 months back)." : `Open-Meteo answered ${res.status}.` };
    } else {
      const data = (await res.json()) as {
        timezone?: string;
        utc_offset_seconds?: number;
        hourly?: { time?: string[]; wind_speed_10m?: (number | null)[]; wind_speed_120m?: (number | null)[]; wind_gusts_10m?: (number | null)[] };
      };
      const h = data?.hourly;
      // timezone=auto returns wall-clock times in the place's zone; convert
      // back to UTC instants so every consumer works in one clock.
      const offsetS = typeof data?.utc_offset_seconds === "number" && Number.isFinite(data.utc_offset_seconds) ? data.utc_offset_seconds : 0;
      const tz = typeof data?.timezone === "string" && data.timezone ? data.timezone : undefined;
      const times = Array.isArray(h?.time) ? h!.time! : [];
      // A malformed hour — unparseable time, missing, negative or non-finite
      // speed — is dropped rather than rendered as a 0 km/h calm hour.
      const speed = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
      const hours: WindHour[] = [];
      times.forEach((t, i) => {
        if (typeof t !== "string") return;
        let time: string | null = null;
        if (/Z$/.test(t)) time = t;
        else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) {
          const local = Date.parse(`${t}:00Z`);
          if (!Number.isNaN(local)) time = new Date(local - offsetS * 1000).toISOString();
        }
        if (!time || Number.isNaN(Date.parse(time))) return;
        const w10 = speed(h?.wind_speed_10m?.[i]);
        const w120 = speed(h?.wind_speed_120m?.[i]);
        const g10 = speed(h?.wind_gusts_10m?.[i]);
        if (w10 == null || g10 == null) return;
        hours.push({ time, wind10m: w10, wind120m: w120 ?? w10, gust10m: g10 });
      });
      result = hours.length
        ? { source: "open-meteo", unit: "km/h", hours, timezone: tz, utcOffsetSeconds: tz ? offsetS : undefined }
        : { unavailable: true, reason: "Open-Meteo returned no usable hours for that date." };
    }
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    result = { unavailable: true, reason: timeout ? "Wind lookup timed out after 4 s." : "Wind lookup failed." };
  }
  // Only cache successes: a transient failure should not stick for an hour.
  if (!("unavailable" in result)) {
    cache.set(key, { at: now(), result });
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  return result;
}

/** Contiguous runs of hours with gusts under the calm threshold. */
export function calmWindows(hours: WindHour[], maxGust = CALM_GUST_KMH): { start: string; end: string; hours: number }[] {
  const out: { start: string; end: string; hours: number }[] = [];
  let run: WindHour[] = [];
  const flush = () => {
    if (run.length) out.push({ start: run[0].time, end: run[run.length - 1].time, hours: run.length });
    run = [];
  };
  for (const h of hours) {
    // Only a finite, non-negative gust reading can count as calm.
    if (Number.isFinite(h.gust10m) && h.gust10m >= 0 && h.gust10m < maxGust) run.push(h);
    else flush();
  }
  flush();
  return out;
}

/** Test hook. */
export function _clearWindCache(): void {
  cache.clear();
}
