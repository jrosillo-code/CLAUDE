import type {
  Friendship,
  InterviewQuestionId,
  Pin,
  ReflectionAnswer,
  TopPlace,
  Trip,
  TripReflection,
  User,
  Visibility,
} from "./types";
import { acceptedFriendIds, distanceKm } from "./data";
import { countryDisplayName } from "./format";

// The 60-second post-trip interview. Ask at most five questions, and never
// one the graph can already answer: if the trip has a clear favorite (a 9+/10
// pin or a Top-5 entry along the route), don't ask "what was your favorite?" —
// ask something only the traveler knows. Answers are stored verbatim and
// become quoted evidence in Ask-your-friends and Don't-miss.

/** A pin counts as "on the trip" within this range of any stop. */
export const TRIP_PIN_KM = 60;

export const MAX_QUESTIONS = 5;

export interface InterviewQuestion {
  id: InterviewQuestionId;
  prompt: string;
  placeholder: string;
  /** "return" renders yes/maybe/no chips alongside the optional text. */
  kind: "text" | "scale";
}

const QUESTIONS: Record<InterviewQuestionId, InterviewQuestion> = {
  favorite: {
    id: "favorite",
    prompt: "What was your favorite place on this trip?",
    placeholder: "The one you keep thinking about…",
    kind: "text",
  },
  dont_miss: {
    id: "dont_miss",
    prompt: "What would you tell a friend not to miss?",
    placeholder: "The thing you'd insist on…",
    kind: "text",
  },
  skip: {
    id: "skip",
    prompt: "What would you skip next time?",
    placeholder: "Honest answers help your friends most…",
    kind: "text",
  },
  surprise: {
    id: "surprise",
    prompt: "What surprised you?",
    placeholder: "Something no guide mentioned…",
    kind: "text",
  },
  return: {
    id: "return",
    prompt: "Would you go back?",
    placeholder: "Why, or why not? (optional)",
    kind: "scale",
  },
};

/** The owner's pins that belong to this trip (near any stop), newest first. */
export function tripPins(trip: Trip, pins: Pin[]): Pin[] {
  return pins
    .filter(
      (p) =>
        p.userId === trip.userId &&
        trip.stops.some((s) => distanceKm(s.lat, s.lng, p.lat, p.lng) <= TRIP_PIN_KM)
    )
    .sort((a, b) => (b.startedOn ?? b.createdAt).localeCompare(a.startedOn ?? a.createdAt));
}

/**
 * Pick the questions worth asking for THIS trip. Rules:
 * - "favorite" is skipped when the route already shows one (a 9+/10 pin, or a
 *   pin that sits in the owner's Top 5) — the rating already answered it.
 * - "return" is skipped when a route pin is in the Top 5 (they'd obviously
 *   return) — unless every rated route pin is 5 or lower, where the answer is
 *   genuinely open.
 * - Everything else ("don't miss", "skip", "surprise") is experiential and
 *   can't be inferred from structure, so it's always asked.
 */
export function questionsForTrip(args: {
  trip: Trip;
  pins: Pin[];
  topPlaces: TopPlace[];
}): InterviewQuestion[] {
  const { trip, pins, topPlaces } = args;
  const onTrip = tripPins(trip, pins);
  const topPinIds = new Set(topPlaces.filter((t) => t.userId === trip.userId).map((t) => t.pinId));
  const hasTopFivePin = onTrip.some((p) => topPinIds.has(p.id));
  const bestRating = Math.max(0, ...onTrip.map((p) => p.rating ?? 0));

  const out: InterviewQuestion[] = [];
  if (!hasTopFivePin && bestRating < 9) out.push(QUESTIONS.favorite);
  out.push(QUESTIONS.dont_miss, QUESTIONS.skip, QUESTIONS.surprise);
  if (!hasTopFivePin) out.push(QUESTIONS.return);
  return out.slice(0, MAX_QUESTIONS);
}

/** Attachment choices for an answer: the whole trip, or one of its pins. */
export interface AttachOption {
  pinId: string | null;
  label: string;
}

export function attachOptions(trip: Trip, pins: Pin[]): AttachOption[] {
  const opts: AttachOption[] = [{ pinId: null, label: "Whole trip" }];
  const seen = new Set<string>();
  for (const p of tripPins(trip, pins)) {
    if (seen.has(p.placeName)) continue;
    seen.add(p.placeName);
    opts.push({ pinId: p.id, label: p.placeName });
  }
  return opts;
}

/** Which reflections may this viewer read? Mirrors pin visibility rules. */
export function visibleReflections(
  reflections: TripReflection[],
  friendships: Friendship[],
  viewerId: string
): TripReflection[] {
  const friendIds = acceptedFriendIds(friendships, viewerId);
  return reflections.filter(
    (r) =>
      r.status === "complete" &&
      (r.userId === viewerId ||
        r.visibility === "public" ||
        (r.visibility === "friends" && friendIds.has(r.userId)))
  );
}

/** A reflection answer joined with everything the UI needs to attribute it. */
export interface QuoteWithContext {
  answer: ReflectionAnswer;
  reflection: TripReflection;
  owner: User;
  trip: Trip | undefined;
  pin: Pin | undefined;
}

/** Flatten visible reflections into attributable quotes. */
export function quotesFor(
  reflections: TripReflection[],
  friendships: Friendship[],
  viewerId: string,
  users: User[],
  trips: Trip[],
  pins: Pin[]
): QuoteWithContext[] {
  const usersById = new Map(users.map((u) => [u.id, u]));
  const tripsById = new Map(trips.map((t) => [t.id, t]));
  const pinsById = new Map(pins.map((p) => [p.id, p]));
  const out: QuoteWithContext[] = [];
  for (const r of visibleReflections(reflections, friendships, viewerId)) {
    const owner = usersById.get(r.userId);
    if (!owner) continue;
    for (const answer of r.answers) {
      if (!answer.text.trim() && !answer.scale) continue;
      out.push({
        answer,
        reflection: r,
        owner,
        trip: tripsById.get(r.tripId),
        pin: answer.pinId ? pinsById.get(answer.pinId) : undefined,
      });
    }
  }
  return out;
}

export const REFLECTION_VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "Only me",
  friends: "Friends",
  public: "Public",
};

// ── Surfacing helpers ───────────────────────────────────────────────────────

/** Collapsed-card priority: the most decision-changing answers first. */
export const QUOTE_PRIORITY: InterviewQuestionId[] = [
  "dont_miss",
  "skip",
  "surprise",
  "favorite",
  "return",
];

export function sortQuotesByPriority(quotes: QuoteWithContext[]): QuoteWithContext[] {
  const rank = new Map(QUOTE_PRIORITY.map((id, i) => [id, i]));
  return [...quotes].sort(
    (a, b) => (rank.get(a.answer.questionId) ?? 9) - (rank.get(b.answer.questionId) ?? 9)
  );
}

/**
 * Is this quote an endorsement, a warning, or a neutral observation?
 * Disagreement between quotes is shown side by side, never averaged.
 */
export type QuoteStance = "endorsement" | "warning" | "neutral";

export function quoteStance(a: ReflectionAnswer): QuoteStance {
  if (a.questionId === "dont_miss" || a.questionId === "favorite") return "endorsement";
  if (a.questionId === "skip") return "warning";
  if (a.questionId === "return") {
    if (a.scale === "yes") return "endorsement";
    if (a.scale === "no") return "warning";
  }
  return "neutral";
}

/**
 * The author's reward, honestly earned: after saving a debrief, tell them
 * where these exact answers can now surface — derived ONLY from what was
 * saved and what the retrieval layer actually does with it. A private
 * debrief promises nothing except privacy.
 */
export function rewardLines(args: {
  answers: ReflectionAnswer[];
  visibility: Visibility;
  trip: Trip;
  pins: Pin[];
}): string[] {
  const { answers, visibility, trip, pins } = args;
  const answered = answers.filter((a) => a.text.trim() || a.scale);
  if (answered.length === 0) return ["Nothing saved yet — answer a question or two first."];
  if (visibility === "private") {
    return [
      "Saved privately — only you can read this. Switch it to Friends when you want it working for your circle.",
    ];
  }

  const pinsById = new Map(pins.map((p) => [p.id, p]));
  const lines: string[] = [];
  let hasTripLevel = false;

  for (const a of answered) {
    const pin = a.pinId ? pinsById.get(a.pinId) : undefined;
    if (!pin) {
      hasTripLevel = true;
      continue;
    }
    const country = countryDisplayName(pin.countryCode);
    if (a.questionId === "dont_miss" || a.questionId === "favorite") {
      lines.push(
        `Your ${pin.placeName} tip can now appear in friends' “Don't leave without” picks near ${pin.placeName}${country ? ` and when they ask about ${country}` : ""}.`
      );
    } else if (a.questionId === "skip") {
      lines.push(
        `Your ${pin.placeName} warning can now steer friends' “Don't leave without” picks away from the same mistake.`
      );
    } else {
      lines.push(
        `Your ${pin.placeName} note can now appear when friends look at ${pin.placeName}${country ? ` or ask about ${country}` : ""}.`
      );
    }
  }

  if (hasTripLevel) {
    const stops = [...new Set(trip.stops.map((s) => s.placeName))].slice(0, 3);
    lines.push(
      `Your trip-level answers surface when friends ask about ${stops.join(", ")} — and on “${trip.title}” itself.`
    );
  }
  return lines;
}

/**
 * Quotes relevant to a location, matched by GEOGRAPHY, never by name — two
 * towns can share a name across the world, so a pin-anchored quote counts
 * only when its own pin is nearby, and a whole-trip quote counts when one of
 * the trip's stops is (that's how trip-level answers inherit destination
 * context).
 */
export function quotesNearPlace(
  quotes: QuoteWithContext[],
  anchor: { lat: number; lng: number },
  radiusKm = 25
): QuoteWithContext[] {
  return quotes.filter((q) => {
    if (q.pin) return distanceKm(anchor.lat, anchor.lng, q.pin.lat, q.pin.lng) <= radiusKm;
    if (q.trip)
      return q.trip.stops.some((s) => distanceKm(anchor.lat, anchor.lng, s.lat, s.lng) <= radiusKm);
    return false;
  });
}
