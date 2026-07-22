import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// AI route guide: given a trip's ordered stops, return a travel brief for each
// one — what the place is, where to stay (hotels + hostels), and what to do.
//
// With ANTHROPIC_API_KEY set this asks Claude; without it we return a
// deterministic demo guide so the feature works out of the box.

export const maxDuration = 60;

interface GuideStop {
  placeName: string;
  overview: string;
  stay: { name: string; kind: "hotel" | "hostel"; note: string }[];
  activities: string[];
}

interface GuideResponse {
  source: "ai" | "demo";
  stops: GuideStop[];
}

interface ReqStop {
  placeName: string;
  lat: number;
  lng: number;
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

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const guide = await askClaude(title, stops);
      return NextResponse.json(guide);
    } catch (err) {
      console.error("trip-guide: Claude call failed, serving demo guide", err);
    }
  }

  return NextResponse.json(demoGuide(stops));
}

async function askClaude(title: string, stops: ReqStop[]): Promise<GuideResponse> {
  const client = new Anthropic();

  const stopList = stops
    .map((s, i) => `${i + 1}. ${s.placeName} (lat ${s.lat.toFixed(3)}, lng ${s.lng.toFixed(3)})`)
    .join("\n");

  const message = await client.messages
    .stream({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system:
        "You are a concise, knowledgeable travel guide. Reply with ONLY a JSON object, no markdown fences, matching exactly: " +
        '{"stops":[{"placeName":string,"overview":string,"stay":[{"name":string,"kind":"hotel"|"hostel","note":string}],"activities":[string]}]}. ' +
        "One entry per stop, in the given order. overview: 2-3 sentences on what the place is like for a traveler. " +
        "stay: 3 real, well-known places to sleep there — mix hotels and at least one hostel or budget option, each with a short note on why. " +
        "activities: 4-6 specific things to do there. Use the coordinates to disambiguate the place. " +
        "If a stop is obscure, describe the surrounding region honestly rather than inventing specifics.",
      messages: [
        {
          role: "user",
          content: `Trip: "${title}". Stops in order:\n${stopList}`,
        },
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
      stay: (parsed.stops[i]?.stay ?? []).slice(0, 4),
      activities: (parsed.stops[i]?.activities ?? []).slice(0, 6),
    })),
  };
}

// ── Offline demo guide ─────────────────────────────────────────────────────
// Deterministic per place name so the UI is fully explorable without a key.

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
