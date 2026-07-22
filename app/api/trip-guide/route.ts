import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// AI route guide, grounded in real data. For every stop we first gather:
//   - Wikipedia: the article about the place (history + overview) plus nearby
//     articles (real sights in the vicinity), via geosearch.
//   - OpenStreetMap (Overpass): actual named hotels & hostels around the stop,
//     and actual attractions/museums/historic sites nearby.
// With ANTHROPIC_API_KEY set, Claude turns that grounding into a unique
// narrative brief per stop. Without it, the guide is assembled directly from
// the real data ("live"). Only if the network fails too do we fall back to a
// clearly-labeled generic demo.

export const maxDuration = 60;

interface GuideStop {
  placeName: string;
  overview: string;
  facts: string[];
  stay: { name: string; kind: "hotel" | "hostel"; note: string }[];
  activities: string[];
}

interface GuideResponse {
  source: "ai" | "live" | "demo";
  stops: GuideStop[];
}

interface ReqStop {
  placeName: string;
  lat: number;
  lng: number;
}

interface Grounding {
  wikiTitle: string | null;
  wikiExtract: string | null;
  wikiDescription: string | null;
  nearbyArticles: string[];
  hotels: { name: string; kind: "hotel" | "hostel"; distanceKm: number }[];
  attractions: { name: string; kind: string; distanceKm: number }[];
}

export async function POST(req: Request) {
  let body: { title?: string; stops?: ReqStop[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const stops = (body.stops ?? [])
    .filter(
      (s) =>
        s &&
        typeof s.placeName === "string" &&
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng)
    )
    .slice(0, 12);
  if (stops.length === 0) {
    return NextResponse.json({ error: "No stops" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.slice(0, 120) : "Trip";

  // Ground every stop in parallel (each stop runs wiki + OSM in parallel too).
  const grounding = await Promise.all(stops.map((s) => groundStop(s)));

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return NextResponse.json(await askClaude(title, stops, grounding));
    } catch (err) {
      console.error("trip-guide: Claude call failed, using live data", err);
    }
  }

  // No key (or Claude failed): build the guide straight from the real data.
  const anyData = grounding.some((g) => g.wikiExtract || g.hotels.length || g.attractions.length);
  if (anyData) {
    return NextResponse.json(liveGuide(stops, grounding));
  }
  return NextResponse.json(demoGuide(stops));
}

// ── Grounding: Wikipedia + OpenStreetMap ───────────────────────────────────

const cache = new Map<string, Grounding>();

async function groundStop(stop: ReqStop): Promise<Grounding> {
  const key = `${stop.lat.toFixed(3)},${stop.lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Places: Geoapify when a free key is configured (faster, more reliable),
  // otherwise the keyless Overpass API.
  const places = GEOAPIFY_KEY
    ? fetchGeoapifyPlaces(stop).then((r) =>
        r.hotels.length || r.attractions.length ? r : fetchOverpass(stop)
      )
    : fetchOverpass(stop);
  const [wiki, osm] = await Promise.all([fetchWikipedia(stop), places]);
  const g: Grounding = { ...wiki, ...osm };
  cache.set(key, g);
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  return g;
}

async function fetchWikipedia(stop: ReqStop): Promise<Pick<Grounding, "wikiTitle" | "wikiExtract" | "wikiDescription" | "nearbyArticles">> {
  const empty = { wikiTitle: null, wikiExtract: null, wikiDescription: null, nearbyArticles: [] as string[] };
  try {
    // Nearby articles: real named places/sights around the coordinates.
    const geoUrl =
      `https://en.wikipedia.org/w/api.php?action=query&list=geosearch` +
      `&gscoord=${stop.lat}%7C${stop.lng}&gsradius=10000&gslimit=14&format=json&origin=*`;
    const geoRes = await fetch(geoUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Waypoint travel app (demo)" },
    });
    const geo = geoRes.ok ? await geoRes.json() : null;
    const nearby: { title: string; dist: number }[] = (geo?.query?.geosearch ?? []).map(
      (r: { title: string; dist: number }) => ({ title: r.title, dist: r.dist })
    );

    // Pick the article that IS the place: exact/loose name match, else nearest.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(stop.placeName);
    const main =
      nearby.find((a) => norm(a.title) === target) ??
      nearby.find((a) => norm(a.title).includes(target) || target.includes(norm(a.title))) ??
      nearby[0];

    let extract: string | null = null;
    let description: string | null = null;
    let mainTitle: string | null = null;
    // Try the matched geosearch article, then the raw place name.
    for (const t of [main?.title, stop.placeName]) {
      if (!t || extract) continue;
      try {
        const sumRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`,
          { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Waypoint travel app (demo)" } }
        );
        if (sumRes.ok) {
          const sum = await sumRes.json();
          if (sum?.extract && sum.type !== "disambiguation") {
            extract = sum.extract as string;
            description = (sum.description as string) ?? null;
            mainTitle = (sum.title as string) ?? t;
          }
        }
      } catch {
        /* next candidate */
      }
    }

    return {
      wikiTitle: mainTitle,
      wikiExtract: extract,
      wikiDescription: description,
      nearbyArticles: nearby
        .filter((a) => a.title !== mainTitle)
        .slice(0, 10)
        .map((a) => a.title),
    };
  } catch {
    return empty;
  }
}

// Free-tier Geoapify key (geoapify.com — 3,000 req/day, no card required).
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY || process.env.NEXT_PUBLIC_GEOAPIFY_KEY;

async function fetchGeoapifyPlaces(stop: ReqStop): Promise<Pick<Grounding, "hotels" | "attractions">> {
  const empty = { hotels: [], attractions: [] } as Pick<Grounding, "hotels" | "attractions">;
  try {
    const base = "https://api.geoapify.com/v2/places";
    const around = (radius: number) =>
      `filter=circle:${stop.lng},${stop.lat},${radius}&bias=proximity:${stop.lng},${stop.lat}`;
    const [stayRes, sightRes] = await Promise.all([
      fetch(
        `${base}?categories=accommodation.hotel,accommodation.hostel,accommodation.guest_house&${around(5000)}&limit=20&apiKey=${GEOAPIFY_KEY}`,
        { signal: AbortSignal.timeout(9000) }
      ),
      fetch(
        `${base}?categories=tourism.sights,tourism.attraction,entertainment.museum,national_park,leisure.park&${around(7000)}&limit=20&apiKey=${GEOAPIFY_KEY}`,
        { signal: AbortSignal.timeout(9000) }
      ),
    ]);

    type Feat = {
      properties?: {
        name?: string;
        distance?: number;
        categories?: string[];
      };
    };
    const parse = async (res: Response): Promise<Feat[]> =>
      res.ok ? (((await res.json())?.features ?? []) as Feat[]) : [];
    const [stays, sights] = await Promise.all([parse(stayRes), parse(sightRes)]);

    const seen = new Set<string>();
    const named = (f: Feat) => {
      const name = f.properties?.name;
      if (!name || seen.has(name.toLowerCase())) return null;
      seen.add(name.toLowerCase());
      return name;
    };

    const hotels: Grounding["hotels"] = [];
    for (const f of stays) {
      const name = named(f);
      if (!name) continue;
      const cats = f.properties?.categories ?? [];
      hotels.push({
        name,
        kind: cats.some((c) => c.includes("hostel") || c.includes("guest_house")) ? "hostel" : "hotel",
        distanceKm: (f.properties?.distance ?? 0) / 1000,
      });
    }
    const attractions: Grounding["attractions"] = [];
    for (const f of sights) {
      const name = named(f);
      if (!name) continue;
      const cats = f.properties?.categories ?? [];
      attractions.push({
        name,
        kind: cats.find((c) => c.startsWith("entertainment.") || c.startsWith("tourism."))?.split(".").pop() ?? "sight",
        distanceKm: (f.properties?.distance ?? 0) / 1000,
      });
    }
    hotels.sort((a, b) => a.distanceKm - b.distanceKm);
    attractions.sort((a, b) => a.distanceKm - b.distanceKm);
    return { hotels: hotels.slice(0, 18), attractions: attractions.slice(0, 18) };
  } catch {
    return empty;
  }
}

async function fetchOverpass(stop: ReqStop): Promise<Pick<Grounding, "hotels" | "attractions">> {
  const empty = { hotels: [], attractions: [] } as Pick<Grounding, "hotels" | "attractions">;
  try {
    const q = `
[out:json][timeout:12];
(
  nwr["tourism"~"^(hotel|hostel|guest_house)$"]["name"](around:5000,${stop.lat},${stop.lng});
  nwr["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park)$"]["name"](around:7000,${stop.lat},${stop.lng});
  nwr["historic"~"^(castle|fort|monument|ruins|archaeological_site|city_gate|tower)$"]["name"](around:7000,${stop.lat},${stop.lng});
);
out center 80;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(q)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(14000),
    });
    if (!res.ok) return empty;
    const data = await res.json();

    const hotels: Grounding["hotels"] = [];
    const attractions: Grounding["attractions"] = [];
    const seen = new Set<string>();
    for (const el of data?.elements ?? []) {
      const tags = el.tags ?? {};
      const name: string | undefined = tags["name:en"] || tags.name;
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const distanceKm =
        lat != null && lon != null ? haversineKm(stop.lat, stop.lng, lat, lon) : 0;
      const t = tags.tourism;
      if (t === "hotel" || t === "hostel" || t === "guest_house") {
        hotels.push({ name, kind: t === "hotel" ? "hotel" : "hostel", distanceKm });
      } else {
        attractions.push({ name, kind: tags.historic ?? t ?? "sight", distanceKm });
      }
    }
    hotels.sort((a, b) => a.distanceKm - b.distanceKm);
    attractions.sort((a, b) => a.distanceKm - b.distanceKm);
    return { hotels: hotels.slice(0, 18), attractions: attractions.slice(0, 18) };
  } catch {
    return empty;
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── AI narrative (grounded) ────────────────────────────────────────────────

async function askClaude(
  title: string,
  stops: ReqStop[],
  grounding: Grounding[]
): Promise<GuideResponse> {
  const client = new Anthropic();

  const stopBlocks = stops
    .map((s, i) => {
      const g = grounding[i];
      return [
        `### Stop ${i + 1}: ${s.placeName} (lat ${s.lat.toFixed(3)}, lng ${s.lng.toFixed(3)})`,
        g.wikiExtract ? `Wikipedia (${g.wikiTitle}): ${g.wikiExtract}` : "Wikipedia: (nothing found)",
        g.nearbyArticles.length ? `Nearby Wikipedia articles: ${g.nearbyArticles.join("; ")}` : "",
        g.hotels.length
          ? `Real places to stay (OpenStreetMap, with distance): ${g.hotels
              .map((h) => `${h.name} [${h.kind}, ${h.distanceKm.toFixed(1)}km]`)
              .join("; ")}`
          : "Places to stay: (none found in OSM — use well-known real options you are confident exist here)",
        g.attractions.length
          ? `Real nearby attractions (OpenStreetMap): ${g.attractions
              .map((a) => `${a.name} [${a.kind}]`)
              .join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const message = await client.messages
    .stream({
      model: "claude-opus-4-8",
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      system:
        "You are an expert local travel writer. You will get a trip's stops WITH grounding data " +
        "(Wikipedia summaries and real OpenStreetMap places). Write a guide that is specific and unique " +
        "to each location — never generic filler that could describe anywhere. Reply with ONLY a JSON object, " +
        "no markdown fences, matching exactly: " +
        '{"stops":[{"placeName":string,"overview":string,"facts":[string],"stay":[{"name":string,"kind":"hotel"|"hostel","note":string}],"activities":[string]}]}. ' +
        "Rules per stop: overview = 2-4 vivid sentences about what THIS place is and why it matters, weaving in its history from the grounding. " +
        "facts = 2-3 short surprising historical or cultural facts specific to the place. " +
        "stay = 3-4 entries picked from the provided real OSM list when available (keep exact names; note = one line on location/vibe using the distance given); include at least one hostel/budget pick when one exists. " +
        "activities = 4-6 concrete things to do IN or NEAR this stop, using the real attraction names provided plus what you know of the area — name the actual sight, hike, beach or neighborhood; no generic 'walking tour' filler. " +
        "Never invent hotel names when a real list was provided. One entry per stop, same order as given.",
      messages: [
        { role: "user", content: `Trip: "${title}"\n\n${stopBlocks}` },
      ],
    })
    .finalMessage();

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
    stops: GuideStop[];
  };
  if (!Array.isArray(parsed.stops)) throw new Error("Malformed guide");

  return {
    source: "ai",
    stops: stops.map((s, i) => ({
      placeName: s.placeName,
      overview: parsed.stops[i]?.overview ?? "",
      facts: (parsed.stops[i]?.facts ?? []).slice(0, 3),
      stay: (parsed.stops[i]?.stay ?? []).slice(0, 4),
      activities: (parsed.stops[i]?.activities ?? []).slice(0, 6),
    })),
  };
}

// ── Live guide (real data, no AI narrative) ────────────────────────────────

function liveGuide(stops: ReqStop[], grounding: Grounding[]): GuideResponse {
  return {
    source: "live",
    stops: stops.map((s, i) => {
      const g = grounding[i];

      const overview = g.wikiExtract
        ? trimToSentences(g.wikiExtract, 3)
        : `No encyclopedia entry found for ${s.placeName} — it may be a small or remote spot. The listings below are real places from OpenStreetMap.`;

      const facts: string[] = [];
      if (g.wikiDescription) facts.push(capitalize(g.wikiDescription));
      if (g.wikiExtract) {
        const rest = sentences(g.wikiExtract).slice(3, 5);
        facts.push(...rest.map((x) => x.trim()).filter((x) => x.length > 30 && x.length < 220));
      }

      const hostels = g.hotels.filter((h) => h.kind === "hostel");
      const hotels = g.hotels.filter((h) => h.kind === "hotel");
      const stay = [...hotels.slice(0, 3), ...hostels.slice(0, 2)]
        .slice(0, 4)
        .map((h) => ({
          name: h.name,
          kind: h.kind,
          note: `${h.distanceKm < 1 ? `${Math.round(h.distanceKm * 1000)} m` : `${h.distanceKm.toFixed(1)} km`} from this stop`,
        }));

      const activities = [
        ...g.attractions.slice(0, 5).map((a) => a.name),
        ...g.nearbyArticles.filter(
          (t) => !g.attractions.some((a) => a.name.toLowerCase() === t.toLowerCase())
        ),
      ].slice(0, 6);

      return { placeName: s.placeName, overview, facts: facts.slice(0, 3), stay, activities };
    }),
  };
}

function sentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [text];
}

function trimToSentences(text: string, n: number): string {
  return sentences(text).slice(0, n).join(" ").trim();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Last-resort demo (offline AND keyless) ─────────────────────────────────

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const OVERVIEWS = [
  "A place that rewards slowing down — mornings at the market, long afternoons wandering the old quarter, and golden-hour views that fill everyone's camera roll.",
  "Compact and walkable, with most of the character packed into a few lively streets. Come for the food, stay an extra night for the atmosphere.",
  "The kind of stop people plan two days for and wish they had four. The surrounding landscape is the real headline — build in time to get out of town.",
  "Equal parts historic and laid-back. The center is postcard material, but the best moments happen in the side streets and along the waterfront at dusk.",
];

const STAY_HOTELS = [
  ["Grand Central Hotel", "Classic full-service hotel steps from the main square."],
  ["The Harborview", "Mid-range rooms with the best breakfast terrace in town."],
  ["Casa del Sol Boutique", "Small boutique stay — quiet courtyard, big design energy."],
  ["Station House Hotel", "Reliable and well-located, right by the transit hub."],
];

const STAY_HOSTELS = [
  ["Wanderers' Hostel", "Social hostel with a rooftop common area — great for meeting people."],
  ["The Backpack Yard", "Budget bunks, spotless kitchen, free walking-tour meetups."],
  ["Nomad House", "Quiet-hours hostel with private pods — best cheap sleep in town."],
];

const ACTIVITY_POOL = [
  "Free walking tour of the old town",
  "Sunset viewpoint hike",
  "Local food market crawl",
  "Bike loop along the waterfront",
  "Day trip to the nearby national park",
  "Museum of local history",
  "Kayak or paddle session",
  "Street-food night market",
  "Coffee-shop hopping in the arts district",
  "Photography walk at golden hour",
];

function pick<T>(arr: T[], seed: number, n: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(seed + i * 7) % arr.length]);
  return [...new Set(out)];
}

function demoGuide(stops: ReqStop[]): GuideResponse {
  return {
    source: "demo",
    stops: stops.map((s) => {
      const h = hash(s.placeName);
      const hotel1 = STAY_HOTELS[h % STAY_HOTELS.length];
      const hotel2 = STAY_HOTELS[(h + 2) % STAY_HOTELS.length];
      const hostel = STAY_HOSTELS[h % STAY_HOSTELS.length];
      return {
        placeName: s.placeName,
        overview: OVERVIEWS[h % OVERVIEWS.length],
        facts: [],
        stay: [
          { name: hotel1[0], kind: "hotel" as const, note: hotel1[1] },
          ...(hotel2[0] !== hotel1[0]
            ? [{ name: hotel2[0], kind: "hotel" as const, note: hotel2[1] }]
            : []),
          { name: hostel[0], kind: "hostel" as const, note: hostel[1] },
        ],
        activities: pick(ACTIVITY_POOL, h % ACTIVITY_POOL.length, 5),
      };
    }),
  };
}
