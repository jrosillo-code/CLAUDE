import type { Friendship, Pin, PinWithOwner, TopPlace, Trip, TripReflection, User } from "./types";
import { acceptedFriendIds, canView, distanceKm } from "./data";
import { quotesFor } from "./interview";

// The regret minimizer, powered by trust instead of urgency. Around a place
// you're looking at, surface at most THREE spots your friends genuinely
// endorse — Top-5 entries, 8+/10 pins, or a "don't miss" debrief answer in
// their own words — that you haven't been to yourself. Honest by design: no
// fake scarcity, a hard cap of three, and when your own pins already cover
// the area it says so instead of inventing more.
//
// Debrief signals are explicit, so they outrank inferred ones: a pin-anchored
// "don't miss" quote endorses a place even below the rating bar, and a
// pin-anchored "skip" quote removes a place whose only endorsement was a
// rating. Explicit-versus-explicit keeps the positive — contested places stay
// visible with the endorser's words, never silently hidden.

export interface DontMissPick {
  pin: PinWithOwner;
  /** Why it matters, from the friend's own record ("Maria's #2 — …"). */
  reason: string;
  distanceKm: number;
  topRank?: number;
  /** Set when the reason is a verbatim debrief quote. */
  fromDebrief?: boolean;
}

export interface DontMissResult {
  picks: DontMissPick[];
  /** True when the viewer has already pinned the friend-endorsed spots here. */
  alreadyCovered: boolean;
}

const MIN_RATING = 8; // "genuinely rate", not "happened to visit"
// Your own pin this close = you've done this one. Town-scale on purpose: a
// Lisbon pin must not mark Sintra (23 km away, its own destination) as done.
const VISITED_KM = 10;

export function dontMissPicks(args: {
  anchor: { lat: number; lng: number };
  radiusKm?: number;
  viewerId: string;
  users: User[];
  pins: Pin[];
  friendships: Friendship[];
  follows: Set<string>;
  topPlaces: TopPlace[];
  /** Post-trip debriefs — pin-anchored answers endorse or demote places. */
  reflections?: TripReflection[];
  trips?: Trip[];
}): DontMissResult {
  const { anchor, viewerId, users, pins, friendships, follows, topPlaces } = args;
  const radius = args.radiusKm ?? 150;
  const friendIds = acceptedFriendIds(friendships, viewerId);
  const trusted = new Set<string>([...friendIds, ...follows]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const topByPin = new Map(topPlaces.map((t) => [t.pinId, t]));
  const myPins = pins.filter((p) => p.userId === viewerId);

  // Pin-anchored debrief signals, keyed by place name (friends' separate pins
  // on the same place should agree with each other).
  const quotes = quotesFor(
    args.reflections ?? [],
    friendships,
    viewerId,
    users,
    args.trips ?? [],
    pins
  ).filter((q) => q.owner.id !== viewerId && q.pin);
  const placeKey = (name: string) => name.trim().toLowerCase();
  const endorseQuotes = new Map<string, (typeof quotes)[number]>();
  const skipPlaces = new Set<string>();
  for (const q of quotes) {
    const key = placeKey(q.pin!.placeName);
    if (q.answer.questionId === "skip") skipPlaces.add(key);
    else if (
      (q.answer.questionId === "dont_miss" || q.answer.questionId === "favorite") &&
      q.answer.text.trim() &&
      !endorseQuotes.has(key)
    ) {
      endorseQuotes.set(key, q);
    }
  }

  let endorsedNearby = 0;
  const candidates: DontMissPick[] = [];

  for (const pin of pins) {
    if (!trusted.has(pin.userId)) continue;
    if (!canView(pin, viewerId, friendIds, false)) continue;
    const owner = usersById.get(pin.userId);
    if (!owner) continue;

    const dist = distanceKm(anchor.lat, anchor.lng, pin.lat, pin.lng);
    if (dist > radius) continue;

    const key = placeKey(pin.placeName);
    const top = topByPin.get(pin.id);
    const quote = endorseQuotes.get(key);
    const ratingEndorsed = (pin.rating ?? 0) >= MIN_RATING;
    const endorsed = top !== undefined || ratingEndorsed || quote !== undefined;
    if (!endorsed) continue;
    // An explicit "skip" beats an implicit rating; it never beats an explicit
    // positive (Top-5 or a "don't miss" quote) — contested places stay shown.
    if (skipPlaces.has(key) && !top && !quote) continue;
    endorsedNearby++;

    // Skip what the viewer has already done — the point is the real gap,
    // not a to-do list of everything.
    const visited = myPins.some((m) => distanceKm(m.lat, m.lng, pin.lat, pin.lng) <= VISITED_KM);
    if (visited) continue;

    const first = owner.displayName.split(" ")[0];
    const quoteFirst = quote ? quote.owner.displayName.split(" ")[0] : null;
    const reason = quote
      ? `“${quote.answer.text}” — ${quoteFirst}${quote.trip ? `, after “${quote.trip.title}”` : ""}`
      : top
        ? `#${top.rank} in ${first}'s Top 5${top.blurb ? ` — “${top.blurb}”` : ""}`
        : `${first} rated it ${pin.rating}/10${pin.note ? ` — “${pin.note}”` : ""}`;

    candidates.push({
      pin: { ...pin, owner },
      reason,
      distanceKm: dist,
      topRank: top?.rank,
      fromDebrief: quote !== undefined,
    });
  }

  // Rank: verbatim "don't miss" quotes first (the explicit signal), then
  // Top-5 membership (rank 1 strongest), then rating, then near.
  candidates.sort((a, b) => {
    if (a.fromDebrief !== b.fromDebrief) return a.fromDebrief ? -1 : 1;
    const at = a.topRank ?? 99;
    const bt = b.topRank ?? 99;
    if (at !== bt) return at - bt;
    const ar = a.pin.rating ?? 0;
    const br = b.pin.rating ?? 0;
    if (ar !== br) return br - ar;
    return a.distanceKm - b.distanceKm;
  });

  // One pick per place name so three friends at the same spot don't fill the list.
  const seenPlaces = new Set<string>();
  const picks: DontMissPick[] = [];
  for (const c of candidates) {
    const key = c.pin.placeName.toLowerCase();
    if (seenPlaces.has(key)) continue;
    seenPlaces.add(key);
    picks.push(c);
    if (picks.length === 3) break;
  }

  return { picks, alreadyCovered: picks.length === 0 && endorsedNearby > 0 };
}
