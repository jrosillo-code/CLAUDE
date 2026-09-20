import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LIST_FILES } from "@/lib/lists/data/index";
import { LIST_IDS, LIST_META, type WorldListId } from "@/lib/lists/schema";
import { LIST_HONESTY, monthsLabel } from "@/lib/lists/text";

// One public page per world list, grouped by country, every place linking
// to the map with that list switched on and the place selected.

export function generateStaticParams() {
  return LIST_IDS.map((list) => ({ list }));
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ list: string }> }): Promise<Metadata> {
  const { list } = await params;
  const meta = LIST_META[list as WorldListId];
  const data = LIST_FILES.find((l) => l.id === list);
  if (!meta || !data) return { title: "World list not found — Waypoint", robots: { index: false } };
  const countries = new Set(data.places.map((p) => p.countryCode)).size;
  return {
    title: `${meta.label}: ${data.places.length} of the world's best, in ${countries} countries — Waypoint`,
    description: `${meta.blurb} ${data.places.length} places from public rankings, with the best months to go, on a map next to where your friends have been.`,
    alternates: { canonical: `/world/${list}` },
  };
}

export default async function WorldListPage({ params }: { params: Promise<{ list: string }> }) {
  const { list } = await params;
  const meta = LIST_META[list as WorldListId];
  const data = LIST_FILES.find((l) => l.id === list);
  if (!meta || !data) notFound();

  const byCountry = new Map<string, typeof data.places>();
  for (const p of data.places) {
    const arr = byCountry.get(p.countryCode) ?? [];
    arr.push(p);
    byCountry.set(p.countryCode, arr);
  }
  const countries = [...byCountry.entries()]
    .map(([code, places]) => ({ code, name: countryName(code), places: places.slice().sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => b.places.length - a.places.length || a.name.localeCompare(b.name));

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:py-16">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
        <Link href="/world">World lists</Link> · {meta.label}
      </p>
      <h1 className="mt-2 flex items-center gap-3 font-display text-4xl leading-tight">
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl" style={{ background: `${meta.color}1f`, boxShadow: `inset 0 0 0 1.5px ${meta.color}` }}>{meta.glyph}</span>
        {meta.label}
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">{meta.blurb} {LIST_HONESTY}</p>
      <p className="mt-2 text-sm text-ink-3">{data.places.length} places · {countries.length} countries</p>
      <p className="mt-6">
        <Link href={`/?list=${list}`} className="inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-paper">
          Show all {data.places.length} on the map
        </Link>
      </p>

      {countries.map((c) => (
        <section key={c.code} className="mt-10">
          <h2 className="font-display text-2xl">{c.name} <span className="text-base text-ink-3">· {c.places.length}</span></h2>
          <ul className="mt-3 divide-y divide-line">
            {c.places.map((p) => (
              <li key={p.id} className="py-3">
                <Link href={`/?place=${encodeURIComponent(p.id)}`} className="group block">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium group-hover:text-accent">{p.name}</span>
                    <span className="shrink-0 text-xs text-ink-3">{monthsLabel(p.bestMonths)}</span>
                  </span>
                  {p.region && <span className="block text-xs text-ink-3">{p.region}</span>}
                  {p.why && <span className="mt-1 block text-sm leading-snug text-ink-2">{p.why}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-12 text-sm text-ink-3">
        Sources: {[...new Set(data.places.map((p) => p.source).filter(Boolean))].slice(0, 6).join(" · ")}
      </p>
    </main>
  );
}
