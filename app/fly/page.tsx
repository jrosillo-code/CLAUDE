import type { Metadata } from "next";
import Link from "next/link";
import { type CountryRules, DESK_REVIEW_LABEL, UNVERIFIED_LABEL, authorityOnlyCountries, countriesByTier, isStale, sourceLabel } from "@/lib/fieldbrief/rules";

export const metadata: Metadata = {
  title: "Can I fly my drone here? — Waypoint field briefs",
  description:
    "Country-by-country drone rules with sources and dates, labelled by how well each was checked, plus light, weather, wind and where friends have flown.",
  alternates: { canonical: "/fly" },
};

// The index of covered countries. This page and its children are the market
// test for the field brief: they are server-rendered and indexable in
// production (preview deployments keep the global noindex from app/layout).
export default function FlyIndexPage() {
  const tiers = countriesByTier();
  const authorityOnly = authorityOnlyCountries();
  const total = tiers.verified.length + tiers["desk-review"].length + tiers.unverified.length;
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:py-16">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Waypoint field briefs</p>
      <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Can I fly my drone here?</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
        Drone rules for {total} countries, each with its sources, a date, and an honest label
        for how well it was checked. A rule without a source and a date is not a rule; a
        summary nobody has verified says so on every page. Waypoint never checks airspace
        for you — every page links to the national authority that does.
      </p>

      <Tier
        title="Checked by a pilot"
        blurb="A named pilot read the sources and has flown there."
        countries={tiers.verified}
        empty="None yet — the first verified briefs come from the founders' own flights."
      />
      <Tier
        title="Desk review"
        blurb={DESK_REVIEW_LABEL}
        countries={tiers["desk-review"]}
      />
      <Tier
        title="Unverified summaries"
        blurb={`${UNVERIFIED_LABEL} Every one of these is a starting point, not a verdict.`}
        countries={tiers.unverified}
      />

      {authorityOnly.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl">Authority links only</h2>
          <p className="mt-1 text-sm text-ink-2">No rules record yet — just where to look.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {authorityOnly.map((a) => (
              <li key={a.countryCode}>
                <a href={a.authorityUrl} target="_blank" rel="noreferrer" className="rounded-full bg-paper-2 px-3 py-1 text-sm text-ink-2 underline-offset-4 hover:underline">
                  {a.name} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-sm text-ink-3">
        Flown somewhere and know the rules first-hand?{" "}
        <Link href="/" className="text-accent underline-offset-4 hover:underline">
          Open the map
        </Link>{" "}
        and add a field report to a pin — reports are quoted verbatim, attributed, and never
        averaged into a verdict.
      </p>
    </main>
  );
}

function Tier({ title, blurb, countries, empty }: { title: string; blurb: string; countries: CountryRules[]; empty?: string }) {
  if (countries.length === 0 && !empty) return null;
  return (
    <section className="mt-10" data-testid={`tier-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">{title}</h2>
        <span className="tnum text-xs text-ink-3">{countries.length}</span>
      </div>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-2">{blurb}</p>
      {countries.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-line bg-paper-2/60 p-4 text-sm text-ink-2">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-paper-2/40">
          {countries.map((c) => (
            <li key={c.countryCode}>
              <Link href={`/fly/${c.countryCode.toLowerCase()}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper-2">
                <span className="tnum w-8 text-xs font-semibold text-ink-3">{c.countryCode}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.countryName}</span>
                  <span className="block text-xs text-ink-3">
                    as of {c.lastVerifiedOn} · per {sourceLabel(c)}
                    {isStale(c) ? " · needs re-verification" : ""}
                    {c.cityNotes?.length ? ` · ${c.cityNotes.length} place ${c.cityNotes.length === 1 ? "note" : "notes"}` : ""}
                  </span>
                </span>
                <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-2">
                  {c.regime === "easa" ? "EASA" : "national"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
