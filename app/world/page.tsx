import type { Metadata } from "next";
import Link from "next/link";
import { LIST_FILES } from "@/lib/lists/data/index";
import { LIST_IDS, LIST_META } from "@/lib/lists/schema";
import { LIST_HONESTY } from "@/lib/lists/text";

// The world lists as public pages: the same ten collections the map offers,
// readable without an account, each place linking into the map. This is the
// front door for someone searching "best beaches in Portugal" who has never
// heard of Waypoint.

export const metadata: Metadata = {
  title: "World lists — the best beaches, hikes, dives, surf and more — Waypoint",
  description: "Ten curated world lists, about 200 places each, from public rankings: beaches, hikes, dive sites, surf, ski, kite, night skies, road trips, restaurants, drone spots. Open any place on the map.",
  alternates: { canonical: "/world" },
};

export default function WorldIndexPage() {
  const byId = new Map(LIST_FILES.map((l) => [l.id, l]));
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:py-16">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Waypoint · World lists</p>
      <h1 className="mt-2 font-display text-4xl leading-tight">The world&apos;s best places, ten lists at a time</h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
        {LIST_HONESTY} Each list is built from published rankings and travel guides, checked for
        geography, and shown on the map so you can see which of them your friends have actually
        been to.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {LIST_IDS.map((id) => {
          const meta = LIST_META[id];
          const list = byId.get(id);
          if (!list) return null;
          const countries = new Set(list.places.map((p) => p.countryCode)).size;
          return (
            <li key={id}>
              <Link href={`/world/${id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-paper-2/40 p-4 transition-colors hover:bg-paper-2">
                <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl" style={{ background: `${meta.color}1f`, boxShadow: `inset 0 0 0 1.5px ${meta.color}` }}>{meta.glyph}</span>
                <span className="min-w-0">
                  <span className="block font-display text-lg leading-tight">{meta.label}</span>
                  <span className="block text-xs text-ink-3">{list.places.length} places · {countries} countries</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-10 text-sm text-ink-3">
        <Link href="/" className="font-semibold text-accent">Open the map</Link> to see these lists next to your friends&apos; pins.
      </p>
    </main>
  );
}
