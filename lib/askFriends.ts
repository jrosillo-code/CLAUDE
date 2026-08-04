import type { Friendship, Pin, PinWithOwner, TopPlace, Trip, User } from "./types";
import { acceptedFriendIds, canView } from "./data";

// "Ask your friends": answer travel questions from the trust graph alone —
// friends' and followed creators' pins, ratings, Top 5s, notes and trips.
// This is the one travel question a generic AI can't answer: not "what's good
// in Lisbon" but "what did the people I trust think of Lisbon".
//
// The engine is deterministic retrieval: it matches the question against
// place names, regions, countries and activity words, then ranks the evidence
// by rating, Top-5 membership and likes. Every claim points at a real pin.
// The optional /api/ask-friends route lets Claude write a nicer narrative on
// top of the same evidence — the facts never come from the model.

export interface AskEvidence {
  pin: PinWithOwner;
  /** Why this pin matched, for the UI ("place", "country", "activity", "text"). */
  matched: MatchKind;
  /** The owner's Top-5 rank for this pin, when it has one. */
  topRank?: number;
  likes: number;
  score: number;
}

export interface AskTripHit {
  trip: Trip;
  owner: User;
  /** Stop names that matched the question. */
  matchedStops: string[];
}

export interface AskAnswer {
  /** Deterministic one-or-two-paragraph answer built from the evidence. */
  text: string;
  evidence: AskEvidence[];
  trips: AskTripHit[];
  /** Friends (or creators) with at least one matching pin, best first. */
  people: User[];
  /** True when nothing in the graph matched the question. */
  empty: boolean;
}

type MatchKind = "place" | "country" | "activity" | "text";

const STOPWORDS = new Set(
  ("a an and are at as be been best can could did do does for from go good great has have how i in is it its " +
    "me my of on or our place places she he she's spot spots that the their them they this to top was we were what " +
    "when where which who whos why will with would you your rate rated recommend recommends worth visit visited " +
    "been anyone anybody friends friend ever most really about tell know").split(" ")
);

// Activity vocabulary → the pin.activities slugs plus text fallbacks.
const ACTIVITY_WORDS: Record<string, string[]> = {
  surf: ["surf", "surfing", "wave", "waves", "break", "swell"],
  ski: ["ski", "skiing", "snowboard", "powder", "snow", "piste"],
  mtb: ["mtb", "bike", "biking", "cycling", "singletrack"],
  climb: ["climb", "climbing", "boulder", "crag"],
  dive: ["dive", "diving", "snorkel", "reef", "scuba"],
  run: ["run", "running", "trail", "marathon"],
  photography: ["photo", "photos", "photography", "shoot", "sunset", "sunrise"],
  soccer: ["soccer", "football", "match", "stadium"],
  basketball: ["basketball", "nba"],
};

// Text-intent words that aren't activities but often carry the question
// ("food", "beach", "hike") — matched against pin titles and notes.
const TEXT_INTENTS = [
  "food", "eat", "restaurant", "market", "coffee", "beach", "hike", "hiking",
  "museum", "temple", "island", "mountain", "volcano", "desert", "city",
  "nightlife", "cheap", "budget", "family", "glacier", "aurora", "stars",
];

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-zà-öø-ÿ0-9']+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Country code → lowercase English name, via Intl (no hardcoded table). */
const countryNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

function countryName(cc: string): string {
  if (!cc) return "";
  try {
    return (countryNames?.of(cc.toUpperCase()) ?? cc).toLowerCase();
  } catch {
    return cc.toLowerCase();
  }
}

export interface AskInputs {
  question: string;
  viewerId: string;
  users: User[];
  pins: Pin[];
  friendships: Friendship[];
  follows: Set<string>;
  topPlaces: TopPlace[];
  trips: Trip[];
  likeCounts: Record<string, number>;
}

export function askFriends(inputs: AskInputs): AskAnswer {
  const { question, viewerId, users, pins, friendships, follows, topPlaces, trips, likeCounts } =
    inputs;
  const tokens = tokenize(question);
  const friendIds = acceptedFriendIds(friendships, viewerId);
  const trusted = new Set<string>([...friendIds, ...follows]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const topByPin = new Map(topPlaces.map((t) => [t.pinId, t]));

  // Activity slugs the question mentions.
  const askedActivities = new Set<string>();
  for (const [slug, words] of Object.entries(ACTIVITY_WORDS)) {
    if (tokens.some((t) => words.includes(t))) askedActivities.add(slug);
  }
  const askedIntents = tokens.filter((t) => TEXT_INTENTS.includes(t));

  // Word-level matching only — substring matching turns "done" into a hit on
  // "Indonesia". A token matches a field when it equals one of its words
  // (with a forgiving plural strip on the question side).
  const wordSet = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-zà-öø-ÿ0-9']+/)
        .filter(Boolean)
    );
  const hasTok = (set: Set<string>, t: string) =>
    set.has(t) || (t.endsWith("s") && set.has(t.slice(0, -1)));

  interface Candidate {
    pin: Pin;
    owner: User;
    placeWords: Set<string>;
    regionWords: Set<string>;
    countryWords: Set<string>;
    cc: string;
    textWords: Set<string>;
    text: string;
  }
  const cands: Candidate[] = [];
  for (const pin of pins) {
    if (!trusted.has(pin.userId)) continue;
    if (!canView(pin, viewerId, friendIds, false)) continue;
    const owner = usersById.get(pin.userId);
    if (!owner) continue;
    cands.push({
      pin,
      owner,
      placeWords: wordSet(pin.placeName),
      regionWords: wordSet(pin.region ?? ""),
      countryWords: wordSet(countryName(pin.countryCode)),
      cc: pin.countryCode.toLowerCase(),
      textWords: wordSet(`${pin.title} ${pin.note}`),
      text: `${pin.title} ${pin.note}`.toLowerCase(),
    });
  }

  // Anchor tokens: question words that name an actual place or country in the
  // graph. When the question is anchored ("…in Portugal"), only pins matching
  // an anchor qualify — regions, notes and activities then refine the ranking
  // instead of dragging in noise from elsewhere in the world.
  const anchorTokens = new Set(
    tokens.filter((t) =>
      cands.some((c) => hasTok(c.placeWords, t) || hasTok(c.countryWords, t) || t === c.cc)
    )
  );

  const evidence: AskEvidence[] = [];
  for (const c of cands) {
    const { pin, owner } = c;
    let matched: MatchKind | null = null;
    let score = 0;
    let anchored = false;

    for (const t of tokens) {
      if (hasTok(c.placeWords, t)) {
        matched = "place";
        score += 30;
        anchored = true;
      } else if (hasTok(c.countryWords, t) || t === c.cc) {
        matched = matched ?? "country";
        score += 22;
        anchored = true;
      } else if (hasTok(c.regionWords, t)) {
        matched = matched ?? "place";
        score += 12;
      } else if (hasTok(c.textWords, t)) {
        matched = matched ?? "text";
        score += 6;
      }
    }
    if (anchorTokens.size > 0 && !anchored) continue;

    if (askedActivities.size) {
      const pinActs = new Set(pin.activities ?? []);
      const actHit =
        [...askedActivities].some((a) => pinActs.has(a as never)) ||
        [...askedActivities].some((a) => ACTIVITY_WORDS[a].some((w) => c.text.includes(w)));
      if (actHit) {
        matched = matched ?? "activity";
        score += 20;
      } else if (matched === null || (anchorTokens.size === 0 && matched === "text")) {
        continue; // an activity question only wants activity-relevant pins
      }
    }
    if (askedIntents.length && matched === null) continue;
    if (matched === null) continue;

    const top = topByPin.get(pin.id);
    const likes = likeCounts[pin.id] ?? 0;
    score += (pin.rating ?? 0) * 2 + (top ? 14 - top.rank * 2 : 0) + Math.min(8, likes / 40);
    evidence.push({ pin: { ...pin, owner }, matched, topRank: top?.rank, likes, score });
  }

  // A broad question with no matches at all ("where should I go next?") —
  // fall back to the trust graph's best-rated pins so the answer is never a
  // shrug, but say clearly that it's a general pick.
  const broadFallback = evidence.length === 0 && tokens.length > 0;
  if (broadFallback) {
    for (const pin of pins) {
      if (!trusted.has(pin.userId) || (pin.rating ?? 0) < 8) continue;
      if (!canView(pin, viewerId, friendIds, false)) continue;
      const owner = usersById.get(pin.userId);
      if (!owner) continue;
      const top = topByPin.get(pin.id);
      const likes = likeCounts[pin.id] ?? 0;
      evidence.push({
        pin: { ...pin, owner },
        matched: "text",
        topRank: top?.rank,
        likes,
        score: (pin.rating ?? 0) * 2 + (top ? 14 - top.rank * 2 : 0),
      });
    }
  }

  evidence.sort((a, b) => b.score - a.score);
  const best = evidence.slice(0, 8);

  // Friends' trips whose stops match the question (route-level answers:
  // "has anyone done the Portugal coast?").
  const tripHits: AskTripHit[] = [];
  for (const trip of trips) {
    if (trip.userId === viewerId || !trusted.has(trip.userId)) continue;
    if (trip.visibility === "private") continue;
    const owner = usersById.get(trip.userId);
    if (!owner) continue;
    const titleWords = wordSet(trip.title);
    const matchedStops = trip.stops
      .filter((s) => {
        const w = wordSet(s.placeName);
        return tokens.some((t) => hasTok(w, t));
      })
      .map((s) => s.placeName);
    const titleHit = tokens.some((t) => hasTok(titleWords, t));
    if (matchedStops.length || titleHit) {
      tripHits.push({
        trip,
        owner,
        matchedStops: matchedStops.length ? matchedStops : trip.stops.map((s) => s.placeName),
      });
    }
  }

  // People, best evidence first, deduped.
  const people: User[] = [];
  const seen = new Set<string>();
  for (const e of best) {
    if (!seen.has(e.pin.userId)) {
      people.push(e.pin.owner);
      seen.add(e.pin.userId);
    }
  }

  return {
    text: composeAnswer(question, best, tripHits, broadFallback),
    evidence: best,
    trips: tripHits,
    people,
    empty: best.length === 0 && tripHits.length === 0,
  };
}

function firstName(u: User): string {
  return u.displayName.split(" ")[0];
}

function composeAnswer(
  question: string,
  best: AskEvidence[],
  tripHits: AskTripHit[],
  broadFallback: boolean
): string {
  if (best.length === 0 && tripHits.length === 0) {
    return "No one you're connected with has been there yet — you'd be the first. Try a nearby region, or ask about a country.";
  }

  const parts: string[] = [];
  if (broadFallback) {
    parts.push(
      "Nothing in your circle matches that exactly, but here's what the people you trust rate highest:"
    );
  } else {
    const names = [...new Set(best.map((e) => firstName(e.pin.owner)))];
    const who =
      names.length === 1
        ? names[0]
        : names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    parts.push(`From your circle, ${who} can answer that.`);
  }

  for (const e of best.slice(0, 3)) {
    const name = firstName(e.pin.owner);
    const rating = e.pin.rating != null ? ` rated it ${e.pin.rating}/10` : " has been";
    const top = e.topRank ? ` — it's #${e.topRank} in ${name}'s Top 5` : "";
    const note = e.pin.note ? ` "${e.pin.note}"` : "";
    parts.push(`${name}${rating} at ${e.pin.placeName}${top}.${note}`);
  }

  for (const t of tripHits.slice(0, 2)) {
    parts.push(
      `${firstName(t.owner)}'s trip "${t.trip.title}" runs through ${t.matchedStops.join(
        " and "
      )} — you can view the route or clone it as your own draft.`
    );
  }

  return parts.join(" ");
}

/** Compact, model-ready view of the evidence for the optional AI narrative. */
export function evidenceForApi(a: AskAnswer) {
  return {
    pins: a.evidence.map((e) => ({
      friend: e.pin.owner.displayName,
      place: e.pin.placeName,
      country: e.pin.countryCode,
      title: e.pin.title,
      note: e.pin.note,
      rating: e.pin.rating ?? null,
      topFiveRank: e.topRank ?? null,
      likes: e.likes,
    })),
    trips: a.trips.map((t) => ({
      friend: t.owner.displayName,
      title: t.trip.title,
      stops: t.trip.stops.map((s) => s.placeName),
    })),
  };
}
