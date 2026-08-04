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
