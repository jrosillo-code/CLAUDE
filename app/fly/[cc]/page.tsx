import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { coveredCountries, daysSinceVerified, isStale, rulesFor, sourceLabel } from "@/lib/fieldbrief/rules";
import { publicReportsFor } from "@/lib/fieldbrief/reports";
import FlyPageTracker from "@/components/FlyPageTracker";

// One page per curated country: the rules as of their verification date, the
// authority link, the stale warning, public field reports in pilots' own
// words, and the way into the map to add one. Uncovered codes render an
// honest "not yet covered" page that is not indexed — never a guessed rule.

export const dynamicParams = true;
// Public field reports and the stale warning refresh without a deploy.
export const revalidate = 3600;

export function generateStaticParams() {
  return coveredCountries().map((c) => ({ cc: c.countryCode.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ cc: string }> }): Promise<Metadata> {
  const { cc } = await params;
  const rules = rulesFor(cc);
  if (!rules) {
    return { title: `Drone rules: ${cc.toUpperCase()} not yet covered — Waypoint`, robots: { index: false, follow: true } };
  }
  return {
    title: `Drone rules in ${rules.countryName} (as of ${rules.lastVerifiedOn}) — Waypoint field brief`,
    description: `Registration, pilot certificate, altitude, insurance and no-fly highlights for ${rules.countryName}, per ${sourceLabel(rules)}, verified ${rules.lastVerifiedOn}. Plus light, wind and where friends have flown.`,
    alternates: { canonical: `/fly/${cc.toLowerCase()}` },
  };
}

function YesNo({ flag }: { flag: { value: boolean | null; note: string } }) {
  const word = flag.value === null ? "Depends" : flag.value ? "Yes" : "No";
  return (
    <span>
      <span className={`font-semibold ${flag.value ? "text-ink" : "text-ink-2"}`}>{word}</span>
      {flag.note ? <span className="text-ink-2"> — {flag.note}</span> : null}
    </span>
  );
}

export default async function FlyCountryPage({ params }: { params: Promise<{ cc: string }> }) {
  const { cc } = await params;
  if (!/^[a-zA-Z]{2}$/.test(cc)) notFound();
  const code = cc.toUpperCase();
  const rules = rulesFor(code);

  if (!rules) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:py-16">
        <FlyPageTracker countryCode={code} />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Waypoint field brief · {code}</p>
        <h1 className="mt-2 font-display text-4xl leading-tight">Not yet covered</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
          Nobody has verified {code}&apos;s drone rules against their sources for Waypoint yet, so
          this page shows nothing rather than a guess. Check the national aviation authority
          directly before flying.
        </p>
        <p className="mt-8 text-sm text-ink-3">
          <Link href="/fly" className="text-accent underline-offset-4 hover:underline">Covered countries</Link>
          {" · "}
          <Link href={`/?fly=${code}`} className="text-accent underline-offset-4 hover:underline">Add a field report on the map</Link>
        </p>
      </main>
    );
  }

  const stale = isStale(rules);
  const reports = await publicReportsFor(code);
  const flew = reports.filter((r) => r.outcome === "flew");
  const problems = reports.filter((r) => r.outcome !== "flew");
  const asOf = `as of ${rules.lastVerifiedOn}, per ${sourceLabel(rules)}`;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:py-16">
      <FlyPageTracker countryCode={code} />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Waypoint field brief · {code}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Drone rules in {rules.countryName}</h1>
      <p className="mt-3 text-sm text-ink-3">
        {asOf} · verified by @{rules.verifiedBy} · {rules.regime === "easa" ? "EASA harmonised rules" : "national rules"}
        {rules.coverage === "baseline" ? " · shared baseline only" : ""}
      </p>
      {rules.scope && <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">{rules.scope}</p>}

      {stale && (
        <div className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm leading-relaxed text-ink-2">
          <strong className="text-ink">Needs re-verification.</strong> These facts were last checked{" "}
          {daysSinceVerified(rules)} days ago. Rules change; confirm with the authority below before relying on them.
        </div>
      )}

      <section className="mt-8 rounded-2xl border border-line bg-paper-2/40 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">The basics, {asOf}</h2>
        <dl className="mt-3 space-y-3 text-[15px] leading-relaxed">
          <div><dt className="font-medium">Registration required?</dt><dd><YesNo flag={rules.registrationRequired} /></dd></div>
          <div><dt className="font-medium">Pilot certificate required?</dt><dd><YesNo flag={rules.pilotCertRequired} /></dd></div>
          <div><dt className="font-medium">Insurance required?</dt><dd><YesNo flag={rules.insuranceRequired} /></dd></div>
          <div><dt className="font-medium">Maximum altitude</dt><dd className="text-ink-2">{rules.maxAltitudeM != null ? `${rules.maxAltitudeM} m above ground` : "Not verified"}{rules.altitudeNote ? ` — ${rules.altitudeNote}` : ""}</dd></div>
          <div><dt className="font-medium">Distance</dt><dd className="text-ink-2">{rules.maxDistanceRule}</dd></div>
          <div>
            <dt className="font-medium">Bringing a drone in</dt>
            <dd className="text-ink-2">
              <span className="font-semibold text-ink">{{ none: "No restriction", declare: "Declare at the border", banned: "Banned", unknown: "Unknown" }[rules.importRestriction.value]}</span>
              {rules.importRestriction.note ? ` — ${rules.importRestriction.note}` : ""}
            </dd>
          </div>
        </dl>
      </section>

      {rules.weightClasses.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">By weight</h2>
          <ul className="mt-2 divide-y divide-line rounded-2xl border border-line">
            {rules.weightClasses.map((w) => (
              <li key={w.maxGrams} className="flex gap-4 px-4 py-3 text-sm">
                <span className="tnum w-20 shrink-0 font-semibold">≤ {w.maxGrams} g</span>
                <span className="text-ink-2">{w.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rules.noFlyHighlights.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Where people most often can&apos;t fly</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {rules.noFlyHighlights.map((h) => (
              <li key={h} className="rounded-full bg-paper-2 px-3 py-1 text-sm text-ink-2">{h}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">Highlights only — the official map below is the authority on airspace.</p>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-line p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Authority and tools</h2>
        <p className="mt-2 text-sm leading-relaxed">
          <a href={rules.authorityUrl} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-4 hover:underline">{rules.authorityName} ↗</a>
          <span className="text-ink-2"> — the national aviation authority. Waypoint does not check airspace, LAANC, UTM or geofences; use the official tool.</span>
        </p>
        {rules.nationalApp && (
          <p className="mt-2 text-sm">
            Official airspace map: <a href={rules.nationalApp.url} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-4 hover:underline">{rules.nationalApp.name} ↗</a>
          </p>
        )}
        {rules.permitProcess && (
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            <span className="font-medium text-ink">Permits:</span> {rules.permitProcess.who} — {rules.permitProcess.how}. Allow about {rules.permitProcess.leadTimeDays} days.{" "}
            <a href={rules.permitProcess.url} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">Details ↗</a>
          </p>
        )}
        {rules.notes && <p className="mt-3 text-sm leading-relaxed text-ink-2">{rules.notes}</p>}
        <p className="mt-3 text-xs text-ink-3">
          Sources:{" "}
          {rules.sourceUrls.map((u, i) => (
            <span key={u}>
              {i > 0 ? " · " : ""}
              <a href={u} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{new URL(u).hostname.replace(/^www\./, "")}</a>
            </span>
          ))}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Field reports from pilots</h2>
        {reports.length === 0 ? (
          <p className="mt-2 text-sm text-ink-2">No public field reports for {rules.countryName} yet.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold text-ink-2">Flew ({flew.length})</h3>
              <ul className="mt-2 space-y-2">
                {flew.map((r) => <ReportRow key={r.id} r={r} />)}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-ink-2">Problems ({problems.length})</h3>
              <ul className="mt-2 space-y-2">
                {problems.map((r) => <ReportRow key={r.id} r={r} />)}
              </ul>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-3">
          Quoted verbatim and attributed. Disagreement stays side by side; nothing is averaged into a verdict.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href={`/?fly=${code}`} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper">
          Add a field report on the map
        </Link>
        <Link href="/fly" className="text-sm text-ink-3 underline-offset-4 hover:underline">All covered countries</Link>
      </div>
    </main>
  );
}

const OUTCOME_LABEL: Record<string, string> = { flew: "flew", refused: "was refused", fined: "was fined", did_not_try: "didn't try" };

function ReportRow({ r }: { r: { id: string; quote: string; ownerHandle: string; flownOn: string; outcome: string; droneClass: string } }) {
  return (
    <li className="rounded-xl bg-paper-2/60 p-3 text-sm">
      <p className="italic leading-relaxed text-ink-2">“{r.quote}”</p>
      <p className="mt-1 text-[11px] text-ink-3">
        — @{r.ownerHandle} · {OUTCOME_LABEL[r.outcome] ?? r.outcome} · {r.flownOn}
        {r.droneClass ? ` · ${r.droneClass}` : ""}
      </p>
    </li>
  );
}
