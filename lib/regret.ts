import type { Friendship, Pin, PinWithOwner, TopPlace, User } from "./types";
import { acceptedFriendIds, canView, distanceKm } from "./data";

// The regret minimizer, powered by trust instead of urgency. Around a place
// you're looking at, surface at most THREE spots your friends genuinely rate —
// Top-5 entries or 8+/10 pins — that you haven't been to yourself. Honest by
// design: no fake scarcity, a hard cap of three, and when your own pins
// already cover the area it says so instead of inventing more.

export interface DontMissPick {
  pin: PinWithOwner;
  /** Why it matters, from the friend's own record ("Maria's #2 — …"). */
  reason: string;
  distanceKm: number;
  topRank?: number;
}

export interface DontMissResult {
  picks: DontMissPick[];
  /** True when the viewer has already pinned the friend-endorsed spots here. */
  alreadyCovered: boolean;
}

const MIN_RATING = 8; // "genuinely rate", not "happened to visit"
const VISITED_KM = 25; // your own pin this close = you've done this one

export function dontMissPicks(args: {
  anchor: { lat: number; lng: number };
  radiusKm?: number;
  viewerId: string;
  users: User[];
  pins: Pin[];
  friendships: Friendship[];
  follows: Set<string>;
  topPlaces: TopPlace[];
}): DontMissResult {
  const { anchor, viewerId, users, pins, friendships, follows, topPlaces } = args;
  const radius = args.radiusKm ?? 150;
  const friendIds = acceptedFriendIds(friendships, viewerId);
  const trusted = new Set<string>([...friendIds, ...follows]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const topByPin = new Map(topPlaces.map((t) => [t.pinId, t]));
  const myPins = pins.filter((p) => p.userId === viewerId);

  let endorsedNearby = 0;
  const candidates: DontMissPick[] = [];

  for (const pin of pins) {
    if (!trusted.has(pin.userId)) continue;
    if (!canView(pin, viewerId, friendIds, false)) continue;
    const owner = usersById.get(pin.userId);
    if (!owner) continue;

    const dist = distanceKm(anchor.lat, anchor.lng, pin.lat, pin.lng);
    if (dist > radius) continue;

    const top = topByPin.get(pin.id);
    const endorsed = top !== undefined || (pin.rating ?? 0) >= MIN_RATING;
    if (!endorsed) continue;
    endorsedNearby++;

    // Skip what the viewer has already done — the point is the real gap,
    // not a to-do list of everything.
    const visited = myPins.some((m) => distanceKm(m.lat, m.lng, pin.lat, pin.lng) <= VISITED_KM);
    if (visited) continue;

    const first = owner.displayName.split(" ")[0];
    const reason = top
      ? `#${top.rank} in ${first}'s Top 5${top.blurb ? ` — “${top.blurb}”` : ""}`
      : `${first} rated it ${pin.rating}/10${pin.note ? ` — “${pin.note}”` : ""}`;

    candidates.push({
      pin: { ...pin, owner },
      reason,
      distanceKm: dist,
      topRank: top?.rank,
    });
  }

  // Rank: Top-5 membership first (rank 1 strongest), then rating, then near.
  candidates.sort((a, b) => {
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
