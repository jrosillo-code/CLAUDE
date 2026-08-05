import type { Friendship, Pin, PinWithOwner, TopPlace, Trip, TripReflection, User } from "./types";
import { acceptedFriendIds, canView } from "./data";
import { quotesFor, type QuoteWithContext } from "./interview";

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
  /** Verbatim debrief answers that match — friends' own words, attributed. */
  quotes: QuoteWithContext[];
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
  /** Post-trip debriefs — verbatim answers become quotable evidence. */
  reflections?: TripReflection[];
}

export function askFriends(inputs: AskInputs): AskAnswer {
  const { question, viewerId, users, pins, friendships, follows, topPlaces, trips, likeCounts } =
    inputs;
  const reflections = inputs.reflections ?? [];
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

  // Debrief quotes: friends' verbatim interview answers. A quote matches when
  // the question's tokens hit its text, its anchored pin's place/country, or
  // its trip's title/stops — under the same anchoring rule as pins, so a
  // "Portugal" question never surfaces an Alps quote.
  // Ask is a trust surface: only people you're connected to speak here, even
  // though a `public` debrief is world-readable elsewhere.
  const allQuotes = quotesFor(reflections, friendships, viewerId, users, trips, pins).filter(
    (qc) => qc.owner.id !== viewerId && trusted.has(qc.owner.id)
  );
  // Stops carry no country — borrow it from any pin at the same place so a
  // "Portugal" question can find a quote from a Lisbon–Porto trip.
  const countryWordsByPlace = new Map<string, Set<string>>();
  for (const p of pins) {
    const key = p.placeName.toLowerCase();
    if (!countryWordsByPlace.has(key)) {
      countryWordsByPlace.set(
        key,
        new Set([...wordSet(countryName(p.countryCode)), p.countryCode.toLowerCase()])
      );
    }
  }
  const quoteHits: { q: QuoteWithContext; score: number }[] = [];
  for (const qc of allQuotes) {
    const textWords = wordSet(qc.answer.text);
    const anchorWords = new Set<string>();
    if (qc.pin) {
      for (const w of wordSet(qc.pin.placeName)) anchorWords.add(w);
      for (const w of wordSet(countryName(qc.pin.countryCode))) anchorWords.add(w);
    }
    if (qc.trip) {
      for (const w of wordSet(qc.trip.title)) anchorWords.add(w);
      for (const s of qc.trip.stops) {
        for (const w of wordSet(s.placeName)) anchorWords.add(w);
        for (const w of countryWordsByPlace.get(s.placeName.toLowerCase()) ?? []) anchorWords.add(w);
      }
    }
    let score = 0;
    let anchored = false;
    for (const t of tokens) {
      if (hasTok(anchorWords, t)) {
        score += 25;
        anchored = true;
      } else if (hasTok(textWords, t)) {
        score += 8;
      }
    }
    if (score === 0) continue;
    if (anchorTokens.size > 0 && !anchored) continue;
    // Question intent bonus: "skip"/"miss"-type questions prefer the matching
    // debrief question ("what would you skip?" → skip answers first).
    if (tokens.includes("skip") && qc.answer.questionId === "skip") score += 15;
    if ((tokens.includes("miss") || tokens.includes("missed")) && qc.answer.questionId === "dont_miss")
      score += 15;
    quoteHits.push({ q: qc, score });
  }
  quoteHits.sort((a, b) => b.score - a.score);
  const quotes = quoteHits.slice(0, 4).map((h) => h.q);

  // People, best evidence first, deduped.
  const people: User[] = [];
  const seen = new Set<string>();
  for (const e of best) {
    if (!seen.has(e.pin.userId)) {
      people.push(e.pin.owner);
      seen.add(e.pin.userId);
    }
  }
  for (const qc of quotes) {
    if (!seen.has(qc.owner.id)) {
      people.push(qc.owner);
      seen.add(qc.owner.id);
    }
  }

  return {
    text: composeAnswer(question, best, tripHits, quotes, broadFallback),
    evidence: best,
    trips: tripHits,
    quotes,
    people,
    empty: best.length === 0 && tripHits.length === 0 && quotes.length === 0,
  };
}

function firstName(u: User): string {
  return u.displayName.split(" ")[0];
}

function composeAnswer(
  question: string,
  best: AskEvidence[],
  tripHits: AskTripHit[],
  quotes: QuoteWithContext[],
  broadFallback: boolean
): string {
  if (best.length === 0 && tripHits.length === 0 && quotes.length === 0) {
    return "No one you're connected with has been there yet — you'd be the first. Try a nearby region, or ask about a country.";
  }

  const parts: string[] = [];
  if (broadFallback && quotes.length === 0) {
    parts.push(
      "Nothing in your circle matches that exactly, but here's what the people you trust rate highest:"
    );
  } else {
    const names = [
      ...new Set([...best.map((e) => firstName(e.pin.owner)), ...quotes.map((q) => firstName(q.owner))]),
    ];
    // Only planned trips matched: nobody has actually been yet, so naming
    // people as if they could answer would overstate what we know. (Reaching
    // the old join with an empty list also rendered a literal "and undefined".)
    if (names.length === 0) {
      parts.push("No one you're connected with has been yet, but it's on someone's route:");
    } else {
      const who =
        names.length === 1
          ? names[0]
          : names.length === 2
            ? `${names[0]} and ${names[1]}`
            : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
      parts.push(`From your circle, ${who} can answer that.`);
    }
  }

  // Debrief quotes lead — they're the richest, most recent signal.
  for (const qc of quotes.slice(0, 2)) {
    const where = qc.pin ? ` about ${qc.pin.placeName}` : qc.trip ? ` after "${qc.trip.title}"` : "";
    parts.push(`${firstName(qc.owner)}${where}: "${qc.answer.text}"`);
  }

  for (const e of best.slice(0, quotes.length ? 2 : 3)) {
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
    // Verbatim debrief answers — the model may quote these, never reword them.
    quotes: a.quotes.map((q) => ({
      friend: q.owner.displayName,
      question: q.answer.prompt,
      answer: q.answer.text,
      scale: q.answer.scale ?? null,
      about: q.pin?.placeName ?? (q.trip ? `the trip "${q.trip.title}"` : "their trip"),
    })),
  };
}
