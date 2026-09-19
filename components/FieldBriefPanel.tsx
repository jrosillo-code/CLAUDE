"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sheet from "./Sheet";
import { useStore } from "@/lib/store";
import { acceptedFriendIds, canView, distanceKm } from "@/lib/data";
import { track } from "@/lib/analytics";
import { REPORT_OUTCOME_LABELS, TIME_OF_DAY_LABELS, type FieldReport, type ScoutNote } from "@/lib/types";
import type { FieldBrief, NearbySummary } from "@/lib/fieldbrief/assemble";
import { calmWindows, CALM_GUST_KMH } from "@/lib/fieldbrief/wind";
import { isWetHour, skyFor, weatherSummary } from "@/lib/fieldbrief/weather";
import { cityNotesFor } from "@/lib/fieldbrief/rules";

// The field brief: for a place and a date, can I legally fly and film here
// (as of a date, per a source — never "legal"), when is the light good, what
// will the wind do, and where have I or my friends shot before. Rules, light
// and wind come from the API; "nearby" is computed here from the store, which
// already holds only what the viewer may see. Keyless mode shows the cards;
// with an API key the same evidence also arrives as a short narrative.

const NEAR_KM = 40;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Wall-clock time at the PLACE, not on the viewer's device: a Tokyo brief
 *  read from Michigan shows Tokyo hours. */
function makeHhmm(offsetMinutes: number) {
  return (iso: string | null | undefined): string => {
    if (!iso) return "—";
    const t = new Date(new Date(iso).getTime() + offsetMinutes * 60_000);
    return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
  };
}

function offsetLabel(min: number): string {
  const sign = min < 0 ? "−" : "+";
  const a = Math.abs(min);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? ":" + String(a % 60).padStart(2, "0") : ""}`;
}

function bearingWord(deg: number): string {
  const words = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return words[Math.round(deg / 45) % 8];
}

export default function FieldBriefPanel() {
  const target = useStore((s) => s.briefTarget)!;
  const closeBrief = useStore((s) => s.closeBrief);
  const viewerId = useStore((s) => s.viewerId);
  const users = useStore((s) => s.users);
  const pins = useStore((s) => s.pins);
  const friendships = useStore((s) => s.friendships);
  const follows = useStore((s) => s.follows);
  const scoutNotes = useStore((s) => s.scoutNotes);
  const fieldReports = useStore((s) => s.fieldReports);
  const selectPin = useStore((s) => s.selectPin);
  const requestFlyTo = useStore((s) => s.requestFlyTo);

  const [date, setDate] = useState(todayIso());
  const [brief, setBrief] = useState<FieldBrief | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [hoursOpen, setHoursOpen] = useState(false);
  const clock = brief?.clock ?? { timezone: null, utcOffsetMinutes: Math.round(target.lng / 15) * 60, exact: false };
  const hhmm = makeHhmm(clock.utcOffsetMinutes);
  const clockLabel = clock.exact && clock.timezone ? `${clock.timezone.replace(/_/g, " ")} (${offsetLabel(clock.utcOffsetMinutes)})` : `≈ local time (${offsetLabel(clock.utcOffsetMinutes)})`;

  // Nearby: your own scout pins and those of friends and followed creators,
  // and their field reports, within day-trip range. Visibility rules apply
  // client-side for UX; the store only ever held what RLS allowed.
  const nearby = useMemo<{ summary: NearbySummary; notes: (ScoutNote & { pin: (typeof pins)[number]; ownerName: string; distanceKm: number })[]; reports: (FieldReport & { ownerHandle: string; placeName?: string })[] }>(() => {
    const friendIds = acceptedFriendIds(friendships, viewerId);
    const trusted = new Set<string>([viewerId, ...friendIds, ...follows]);
    const usersById = new Map(users.map((u) => [u.id, u]));
    const pinsById = new Map(pins.map((p) => [p.id, p]));
    const notes = scoutNotes
      .flatMap((n) => {
        const pin = pinsById.get(n.pinId);
        if (!pin || !trusted.has(pin.userId)) return [];
        if (pin.userId !== viewerId && !canView(pin, viewerId, friendIds, false)) return [];
        const d = distanceKm(pin.lat, pin.lng, target.lat, target.lng);
        if (d > NEAR_KM) return [];
        return [{ ...n, pin, ownerName: usersById.get(pin.userId)?.displayName ?? "Someone", distanceKm: d }];
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 12);
    const cc = target.countryCode?.toUpperCase();
    const reports = fieldReports
      .filter((r) => {
        if (!trusted.has(r.userId)) return false;
        if (r.userId !== viewerId && r.status !== "complete") return false;
        if (r.userId !== viewerId && r.visibility === "private") return false;
        if (r.userId !== viewerId && r.visibility === "friends" && !friendIds.has(r.userId)) return false;
        const pin = r.pinId ? pinsById.get(r.pinId) : undefined;
        if (pin) return distanceKm(pin.lat, pin.lng, target.lat, target.lng) <= NEAR_KM * 4;
        return !!cc && r.countryCode === cc;
      })
      .sort((a, b) => b.flownOn.localeCompare(a.flownOn))
      .slice(0, 12)
      .map((r) => ({ ...r, ownerHandle: usersById.get(r.userId)?.handle ?? "pilot", placeName: r.pinId ? pinsById.get(r.pinId)?.placeName : undefined }));
    const summary: NearbySummary = {
      scoutPins: notes.map((n) => ({ pinId: n.pinId, placeName: n.pin.placeName, ownerName: n.ownerName, distanceKm: n.distanceKm, timeOfDay: n.timeOfDay, bearingDeg: n.bearingDeg, note: n.note })),
      reports: reports.map((r) => ({ id: r.id, ownerHandle: r.ownerHandle, outcome: r.outcome, flownOn: r.flownOn, droneClass: r.droneClass, quote: r.quote, placeName: r.placeName })),
    };
    return { summary, notes, reports };
  }, [scoutNotes, fieldReports, pins, users, friendships, follows, viewerId, target]);

  useEffect(() => {
    track("brief_open", { countryCode: target.countryCode, pinId: target.pinId, origin: target.origin, viewerId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch("/api/field-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: target.lat, lng: target.lng, date, countryCode: target.countryCode, nearby: nearby.summary }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as FieldBrief;
      })
      .then((b) => {
        if (cancelled) return;
        setBrief(b);
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
    // nearby is derived from the store; refetch only for place/date changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.lat, target.lng, target.countryCode, date]);

  const legality = brief?.legality;
  const wind = brief?.wind;
  const weather = wind && !("unavailable" in wind) ? weatherSummary(wind.hours) : null;
  const cityNotes = legality?.covered ? cityNotesFor(legality, target.placeName) : [];
  const calm = wind && !("unavailable" in wind) ? calmWindows(wind.hours) : [];
  const gustMax = wind && !("unavailable" in wind) ? Math.max(1, ...wind.hours.map((h) => h.gust10m)) : 1;

  return (
    <Sheet onClose={closeBrief}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">Field brief</div>
          <h2 className="mt-0.5 truncate font-display text-xl leading-tight">{target.placeName}</h2>
          <div className="mt-0.5 text-xs text-ink-3">
            {target.lat.toFixed(4)}, {target.lng.toFixed(4)}
            {target.countryCode ? ` · ${target.countryCode.toUpperCase()}` : ""}
          </div>
        </div>
        <button onClick={closeBrief} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="px-5 pt-3">
        <label className="flex items-center gap-2 text-xs text-ink-2">
          <span className="font-medium">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink"
            data-testid="brief-date"
          />
        </label>
      </div>

      <div className="scroll-thin mt-3 flex-1 space-y-3 overflow-y-auto px-5 pb-6">
        {brief?.narrative && (
          <p className="rounded-2xl bg-paper-2/60 p-3.5 text-[13px] leading-relaxed text-ink-2">{brief.narrative}</p>
        )}
        {state === "error" && (
          <p className="rounded-2xl border border-line p-3 text-sm text-ink-2">Couldn&apos;t load the brief. Check your connection and try again.</p>
        )}

        {/* 1. Rules — as of a date, per a source. Never "legal". */}
        <Card title="Rules" hint={legality?.covered ? legality.asOf : undefined} loading={state === "loading"}>
          {legality && legality.covered ? (
            <div className="space-y-2 text-[13px] leading-relaxed">
              {legality.reviewTier !== "verified" && (
                <p className={`rounded-xl px-3 py-2 text-xs text-ink-2 ${legality.reviewTier === "unverified" ? "bg-accent/15" : "bg-paper-2"}`} data-testid="brief-tier">
                  <strong className="text-ink">{legality.reviewTier === "unverified" ? "Unverified" : "Desk review"}</strong> — {legality.tierLabel}
                </p>
              )}
              {legality.stale && (
                <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-ink-2">
                  <strong className="text-ink">Needs re-verification</strong> — last checked {legality.daysSinceVerified} days ago.
                </p>
              )}
              <Row k="Registration" v={legality.registrationRequired} />
              <Row k="Pilot certificate" v={legality.pilotCertRequired} />
              <Row k="Insurance" v={legality.insuranceRequired} />
              <p><span className="font-medium">Ceiling</span> <span className="text-ink-2">{legality.maxAltitudeM != null ? `${legality.maxAltitudeM} m` : "not verified"} · {legality.maxDistanceRule}</span></p>
              {legality.noFlyHighlights.length > 0 && (
                <p className="text-ink-2"><span className="font-medium text-ink">Often off limits:</span> {legality.noFlyHighlights.join(" · ")}</p>
              )}
              {cityNotes.length > 0 && (
                <ul className="space-y-1" data-testid="brief-city-notes">
                  {cityNotes.map((n) => (
                    <li key={n.city} className="text-ink-2">
                      <span className="font-medium text-ink">{n.city}:</span> {n.note}
                      {n.reviewTier === "unverified" ? <span className="text-ink-3"> (unverified)</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {brief && brief.airfields.length > 0 && (
                <p className="text-ink-2" data-testid="brief-airfields">
                  <span className="font-medium text-ink">Nearest airfield:</span>{" "}
                  {brief.airfields.map((a) => `${a.name}${a.iata ? ` (${a.iata})` : ""} ${a.distanceKm < 10 ? a.distanceKm.toFixed(1) : Math.round(a.distanceKm)} km ${bearingWord(a.bearingDeg)}`).join(" · ")}
                  <span className="text-ink-3"> — a distance, not an airspace check.</span>
                </p>
              )}
              <p className="text-xs text-ink-3">
                Waypoint doesn&apos;t check airspace.{" "}
                <a href={legality.nationalApp?.url ?? legality.authority.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">
                  {legality.nationalApp?.name ?? legality.authority.name} ↗
                </a>
                {" · "}
                <Link href={legality.flyPath} className="text-accent underline-offset-4 hover:underline">Full country page</Link>
              </p>
            </div>
          ) : legality ? (
            <p className="text-[13px] leading-relaxed text-ink-2">
              {legality.countryCode ? `${legality.countryCode} is not yet covered` : "Country unknown — not yet covered"}. Nobody has verified these rules for Waypoint, so nothing is shown rather than a guess.{" "}
              {legality.authority && (
                <>
                  Start at <a href={legality.authority.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">{legality.authority.name} ↗</a>.{" "}
                </>
              )}
              <Link href="/fly" className="text-accent underline-offset-4 hover:underline">Covered countries</Link>
            </p>
          ) : null}
        </Card>

        {/* 2. Light */}
        <Card title="Light" hint={brief?.light.polar === "day" ? "polar day" : brief?.light.polar === "night" ? "polar night" : clockLabel} loading={state === "loading"}>
          {brief && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              <Dt k="Blue hour am" v={brief.light.blueAm ? `${hhmm(brief.light.blueAm[0])} – ${hhmm(brief.light.blueAm[1])}` : "—"} />
              <Dt k="Golden hour am" v={brief.light.goldenAm ? `${hhmm(brief.light.goldenAm[0])} – ${hhmm(brief.light.goldenAm[1])}` : "—"} />
              <Dt k="Sunrise" v={hhmm(brief.light.sunrise)} />
              <Dt k="Sunset" v={hhmm(brief.light.sunset)} />
              <Dt k="Golden hour pm" v={brief.light.goldenPm ? `${hhmm(brief.light.goldenPm[0])} – ${hhmm(brief.light.goldenPm[1])}` : "—"} />
              <Dt k="Blue hour pm" v={brief.light.bluePm ? `${hhmm(brief.light.bluePm[0])} – ${hhmm(brief.light.bluePm[1])}` : "—"} />
              {brief.light.sunAzimuthAtGoldenPm != null && (
                <Dt k="Evening sun from" v={`${bearingWord(brief.light.sunAzimuthAtGoldenPm)} (${brief.light.sunAzimuthAtGoldenPm}°)`} />
              )}
            </dl>
          )}
        </Card>

        {/* 3. Weather: sky, rain and temperature hour by hour, from the same forecast as wind */}
        <Card title="Weather" hint={weather ? `Open-Meteo · ${clockLabel}` : undefined} loading={state === "loading"}>
          {wind && "unavailable" in wind ? (
            <p className="text-[13px] text-ink-2">Weather unavailable — {wind.reason}</p>
          ) : wind && !weather ? (
            <p className="text-[13px] text-ink-2">The forecast came back without sky conditions for this date.</p>
          ) : wind && weather ? (
            <div>
              <p className="text-[13px] leading-relaxed">
                <span className="text-lg" aria-hidden>{weather.dominant.glyph}</span>{" "}
                <span className="font-medium">{weather.dominant.label}</span>
                <span className="text-ink-2">
                  {" "}for most of the day
                  {weather.rainHours > 0 ? ` · ${weather.rainHours} of ${weather.totalHours} hours likely wet` : " · no wet hours forecast"}
                  {weather.tempMinC != null && weather.tempMaxC != null ? ` · ${Math.round(weather.tempMinC)}–${Math.round(weather.tempMaxC)} °C` : ""}
                </span>
              </p>
              {weather.rainHours > 0 && weather.dryWindows.length > 0 && (
                <p className="mt-1 text-[13px] text-ink-2">
                  <span className="font-medium text-ink">Dry windows:</span>{" "}
                  {weather.dryWindows.map((w) => `${hhmm(w.start)}–${hhmm(w.end)}`).join(", ")}
                </p>
              )}
              <div className="scroll-thin mt-2 overflow-x-auto" data-testid="weather-hours">
                <table className="tnum w-full text-[11px]">
                  <thead className="text-left text-[10px] uppercase tracking-wide text-ink-3">
                    <tr><th className="py-1 font-medium">Hour</th><th className="py-1 font-medium">Sky</th><th className="py-1 font-medium">Rain</th><th className="py-1 font-medium">Temp</th><th className="py-1 font-medium">Cloud</th></tr>
                  </thead>
                  <tbody>
                    {wind.hours.map((h) => {
                      const sky = skyFor(h.weatherCode);
                      return (
                        <tr key={h.time} className={isWetHour(h) ? "text-ink-3" : "text-ink"}>
                          <td className="py-0.5">{hhmm(h.time)}</td>
                          <td className="py-0.5"><span aria-hidden>{sky.glyph}</span> {sky.label}</td>
                          <td className="py-0.5">{h.precipProb != null ? `${Math.round(h.precipProb)} %` : "—"}{h.precipMm ? ` · ${h.precipMm.toFixed(1)} mm` : ""}</td>
                          <td className="py-0.5">{h.tempC != null ? `${Math.round(h.tempC)} °` : "—"}</td>
                          <td className="py-0.5">{h.cloudCover != null ? `${Math.round(h.cloudCover)} %` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Card>

        {/* 4. Wind: gust sparkline, calm windows highlighted */}
        <Card title="Wind" hint={wind && !("unavailable" in wind) ? `Open-Meteo · gusts, km/h · ${clockLabel}` : undefined} loading={state === "loading"}>
          {wind && "unavailable" in wind ? (
            <p className="text-[13px] text-ink-2">Wind unavailable — {wind.reason}</p>
          ) : wind ? (
            <div>
              <svg viewBox="0 0 240 60" className="h-16 w-full" role="img" aria-label="Gusts through the day" data-testid="wind-sparkline">
                {wind.hours.map((h, i) => {
                  const x = (i / Math.max(1, wind.hours.length - 1)) * 236 + 2;
                  const y = 56 - (h.gust10m / gustMax) * 50;
                  const calmHour = h.gust10m < CALM_GUST_KMH;
                  return <rect key={h.time} x={x - 3.5} y={y} width="7" height={56 - y + 2} rx="1.5" fill={calmHour ? "var(--color-accent)" : "var(--color-ink-3)"} opacity={calmHour ? 0.9 : 0.45} />;
                })}
                <line x1="0" x2="240" y1={56 - (CALM_GUST_KMH / gustMax) * 50} y2={56 - (CALM_GUST_KMH / gustMax) * 50} stroke="var(--color-ink-3)" strokeDasharray="3 3" strokeWidth="1" />
              </svg>
              <div className="mt-1 flex justify-between text-[10px] text-ink-3">
                <span>{hhmm(wind.hours[0]?.time)}</span>
                <span>max gust {Math.round(gustMax)} km/h</span>
                <span>{hhmm(wind.hours[wind.hours.length - 1]?.time)}</span>
              </div>
              <p className="mt-2 text-[13px] text-ink-2">
                {calm.length ? (
                  <>
                    <span className="font-medium text-ink">Calm windows</span> (gusts under {CALM_GUST_KMH} km/h):{" "}
                    {calm.map((c) => `${hhmm(c.start)}–${hhmm(c.end)}`).join(", ")}
                  </>
                ) : (
                  "No hour under the calm threshold — gusty all day."
                )}
              </p>
              <button
                type="button"
                onClick={() => setHoursOpen((o) => !o)}
                aria-expanded={hoursOpen}
                className="mt-2 text-[11px] font-semibold text-accent"
                data-testid="wind-hours-toggle"
              >
                {hoursOpen ? "Hide hourly table" : "Hourly table"}
              </button>
              {hoursOpen && (
                <table className="tnum mt-2 w-full text-[11px]" data-testid="wind-hours">
                  <thead className="text-left text-[10px] uppercase tracking-wide text-ink-3">
                    <tr><th className="py-1 font-medium">Hour</th><th className="py-1 font-medium">10 m</th><th className="py-1 font-medium">120 m</th><th className="py-1 font-medium">Gust</th></tr>
                  </thead>
                  <tbody>
                    {wind.hours.map((h) => (
                      <tr key={h.time} className={h.gust10m < CALM_GUST_KMH ? "text-ink" : "text-ink-3"}>
                        <td className="py-0.5">{hhmm(h.time)}</td>
                        <td className="py-0.5">{Math.round(h.wind10m)}</td>
                        <td className="py-0.5">{Math.round(h.wind120m)}</td>
                        <td className="py-0.5 font-medium">{Math.round(h.gust10m)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </Card>

        {/* 5. Nearby: your circle's scout pins and field reports */}
        <Card title="Nearby" hint={`${nearby.notes.length} scout ${nearby.notes.length === 1 ? "pin" : "pins"} · ${nearby.reports.length} ${nearby.reports.length === 1 ? "report" : "reports"}`}>
          {nearby.notes.length === 0 && nearby.reports.length === 0 ? (
            <p className="text-[13px] text-ink-2">Nobody in your circle has scouted or reported here yet. Add scout details to a pin, or a field report after you fly.</p>
          ) : (
            <div className="space-y-2">
              {nearby.notes.map((n) => (
                <button
                  key={n.pinId}
                  onClick={() => {
                    selectPin(n.pinId);
                    requestFlyTo(n.pin.lng, n.pin.lat, 12, { flat: true });
                    closeBrief();
                  }}
                  className="flex w-full items-start gap-2.5 rounded-xl bg-paper-2/60 p-2.5 text-left transition-colors hover:bg-paper-2"
                  data-testid={`brief-scout-${n.pinId}`}
                >
                  <span className="mt-0.5 shrink-0 text-accent">◎</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm">
                      <span className="truncate font-medium">{n.pin.placeName}</span>
                      <span className="tnum shrink-0 text-[10px] text-ink-3">{n.distanceKm < 10 ? `${n.distanceKm.toFixed(1)} km` : `${Math.round(n.distanceKm)} km`}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">
                      {n.ownerName}
                      {n.timeOfDay ? ` · ${TIME_OF_DAY_LABELS[n.timeOfDay]}` : ""}
                      {n.bearingDeg != null ? ` · facing ${bearingWord(n.bearingDeg)}` : ""}
                      {n.focalMm ? ` · ${n.focalMm} mm` : ""}
                    </span>
                    {n.note && <span className="mt-0.5 block text-xs italic leading-relaxed text-ink-2">“{n.note}”</span>}
                  </span>
                </button>
              ))}
              {nearby.reports.map((r) => (
                <div key={r.id} className="rounded-xl bg-paper-2/60 p-2.5" data-testid={`brief-report-${r.id}`}>
                  <p className="text-xs italic leading-relaxed text-ink-2">“{r.quote}”</p>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    — @{r.ownerHandle} · {REPORT_OUTCOME_LABELS[r.outcome]} · {r.flownOn}
                    {r.placeName ? ` · ${r.placeName}` : ""}
                    {r.droneClass ? ` · ${r.droneClass}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <p className="text-[11px] leading-relaxed text-ink-3">
          Rules show as of their verification date, per their source, and Waypoint never checks airspace for you. Light is computed; wind is a forecast. Times are the place&apos;s own{clock.exact ? "" : ", estimated from longitude until a forecast confirms the zone"}.
          {brief?.source === "ai" ? " The summary at the top is a selection of sentences composed from these cards; the model chose which to show and wrote none of them." : ""}
        </p>
      </div>
    </Sheet>
  );
}

function Card({ title, hint, loading, children }: { title: string; hint?: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-paper p-3.5" data-testid={`brief-card-${title.toLowerCase()}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{title}</h3>
        {hint && <span className="truncate text-[10px] text-ink-3">{hint}</span>}
      </div>
      <div className="mt-2">{loading ? <div className="h-10 animate-pulse rounded-xl bg-paper-2/70" /> : children}</div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: { value: boolean | null; note: string } }) {
  return (
    <p>
      <span className="font-medium">{k}</span>{" "}
      <span className={v.value ? "text-ink" : "text-ink-2"}>{v.value === null ? "depends" : v.value ? "required" : "not required"}</span>
      {v.note ? <span className="text-ink-3"> — {v.note}</span> : null}
    </p>
  );
}

function Dt({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-ink-3">{k}</dt>
      <dd className="tnum font-medium">{v}</dd>
    </div>
  );
}
