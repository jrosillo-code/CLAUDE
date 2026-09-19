import type { Metadata } from "next";
import Link from "next/link";
import { coveredCountries, isStale, sourceLabel } from "@/lib/fieldbrief/rules";

export const metadata: Metadata = {
  title: "Can I fly my drone here? — Waypoint field briefs",
  description:
    "Country-by-country drone rules with sources and verification dates, plus light, wind and where friends have flown. Curated by pilots, never generated.",
  alternates: { canonical: "/fly" },
};

// The index of covered countries. This page and its children are the market
// test for the field brief: they are server-rendered and indexable in
// production (preview deployments keep the global noindex from app/layout).
export default function FlyIndexPage() {
  const countries = coveredCountries();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:py-16">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Waypoint field briefs</p>
      <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Can I fly my drone here?</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
        Drone rules by country, each with its sources and the date a person last checked
        them. Nothing on these pages is generated: a rule without a source and a date is not
        a rule, and a country we haven&apos;t verified says so instead of guessing. Waypoint
        never checks airspace for you — every page links to the national tool that does.
      </p>

      {countries.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-paper-2/60 p-5">
          <h2 className="font-display text-xl">No countries covered yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            The first briefs are being verified from the founders&apos; own flights. Until a
            country is checked against its authority&apos;s sources, it does not appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-line rounded-2xl border border-line bg-paper-2/40">
          {countries.map((c) => (
            <li key={c.countryCode}>
              <Link href={`/fly/${c.countryCode.toLowerCase()}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper-2">
                <span className="tnum w-8 text-xs font-semibold text-ink-3">{c.countryCode}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.countryName}</span>
                  <span className="block text-xs text-ink-3">
                    as of {c.lastVerifiedOn} · per {sourceLabel(c)}
                    {isStale(c) ? " · needs re-verification" : ""}
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
