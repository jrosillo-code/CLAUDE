import type {
  Friendship,
  Pin,
  PinWithOwner,
  TopPlace,
  Trip,
  User,
  Visibility,
} from "./types";

// Pure query helpers. These encode the same visibility rules the plan pins to
// Postgres RLS ("visibility enforced in SQL, never client-side"): a viewer sees
// their own pins, friends' friends|public pins, and — in explore mode — anyone's
// public pins. In production these run as SQL; here they run over seed arrays.

export function acceptedFriendIds(friendships: Friendship[], userId: string): Set<string> {
  const ids = new Set<string>();
  for (const f of friendships) {
    if (f.status !== "accepted") continue;
    if (f.userA === userId) ids.add(f.userB);
    else if (f.userB === userId) ids.add(f.userA);
  }
  return ids;
}

export function friendshipStatus(
  friendships: Friendship[],
  a: string,
  b: string
): Friendship | undefined {
  return friendships.find(
    (f) => (f.userA === a && f.userB === b) || (f.userA === b && f.userB === a)
  );
}

export function canView(
  pin: Pin,
  viewerId: string,
  friendIds: Set<string>,
  explore: boolean
): boolean {
  if (pin.userId === viewerId) return true;
  if (pin.visibility === "public") return true;
  if (pin.visibility === "friends") return friendIds.has(pin.userId);
  // private
  return false;
}

interface VisibleArgs {
  pins: Pin[];
  users: User[];
  friendships: Friendship[];
  viewerId: string;
  /** Creators the viewer follows — their public pins overlay the map. */
  follows: Set<string>;
  /** userIds whose layer is toggled on. `null` means "everyone visible". */
  activeUserIds: Set<string> | null;
  explore: boolean;
}

export function visiblePins({
  pins,
  users,
  friendships,
  viewerId,
  follows,
  activeUserIds,
  explore,
}: VisibleArgs): PinWithOwner[] {
  const friendIds = acceptedFriendIds(friendships, viewerId);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const out: PinWithOwner[] = [];
  for (const pin of pins) {
    if (activeUserIds && !activeUserIds.has(pin.userId)) continue;
    // Owner gating: your own map shows you, accepted friends, and creators you
    // follow. Strangers' pins only surface in explore mode (public ones).
    const isOwnLayer =
      pin.userId === viewerId || friendIds.has(pin.userId) || follows.has(pin.userId);
    if (!isOwnLayer && !explore) continue;
    if (!canView(pin, viewerId, friendIds, explore)) continue;
    const owner = usersById.get(pin.userId);
    if (!owner) continue;
    out.push({ ...pin, owner });
  }
  return out;
}

export function pinsForUser(pins: Pin[], userId: string): Pin[] {
  return pins.filter((p) => p.userId === userId);
}

export function countryCount(pins: Pin[], userId: string): number {
  const set = new Set(pins.filter((p) => p.userId === userId).map((p) => p.countryCode));
  return set.size;
}

export interface RankedPlace extends TopPlace {
  pin: Pin;
}

export function topPlacesFor(
  topPlaces: TopPlace[],
  pins: Pin[],
  userId: string
): RankedPlace[] {
  const byId = new Map(pins.map((p) => [p.id, p]));
  return topPlaces
    .filter((t) => t.userId === userId)
    .map((t) => ({ ...t, pin: byId.get(t.pinId) }))
    .filter((t): t is RankedPlace => Boolean(t.pin))
    .sort((a, b) => a.rank - b.rank);
}

/** Great-circle distance between two points, in kilometres (haversine). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const KM = 111; // rough degrees→km at the equator; fine for "same place" grouping

/** Friends (and you) who have a pin within ~2km of the given pin. */
export function friendsWhoVisited(
  pins: Pin[],
  users: User[],
  target: Pin,
  radiusKm = 2
): User[] {
  const usersById = new Map(users.map((u) => [u.id, u]));
  const seen = new Set<string>();
  const out: User[] = [];
  for (const p of pins) {
    if (p.userId === target.userId) continue;
    const dLng = (p.lng - target.lng) * Math.cos((target.lat * Math.PI) / 180);
    const dLat = p.lat - target.lat;
    const km = Math.sqrt(dLng * dLng + dLat * dLat) * KM;
    if (km <= radiusKm && !seen.has(p.userId)) {
      const u = usersById.get(p.userId);
      if (u) {
        out.push(u);
        seen.add(p.userId);
      }
    }
  }
  return out;
}

/** Trips the viewer may see: their own, plus friends' friends-visible trips. */
export function visibleTrips(
  trips: Trip[],
  friendships: Friendship[],
  viewerId: string
): Trip[] {
  const friendIds = acceptedFriendIds(friendships, viewerId);
  return trips.filter(
    (t) =>
      t.userId === viewerId ||
      (t.visibility === "friends" && friendIds.has(t.userId))
  );
}

/** First photo of a pin (marker thumbs, covers). Videos don't qualify. */
export function coverUrl(pin: Pin): string | undefined {
  return pin.media.find((m) => m.kind === "photo")?.url;
}

/**
 * Small variant of a pin's cover for map marker heads (~26 px on screen).
 * Full-size covers are 1200 px — decoding hundreds of those during a zoom is
 * the difference between a smooth globe and a janky one. Picsum URLs get
 * rewritten to a 120 px square; other URLs (uploads, data URLs) pass through.
 */
export function thumbUrl(pin: Pin): string | undefined {
  const url = coverUrl(pin);
  if (!url) return undefined;
  const picsum = url.match(/^(https:\/\/picsum\.photos\/seed\/[^/]+)\/\d+\/\d+/);
  if (picsum) return `${picsum[1]}/120/120`;
  return url;
}

export const visibilityLabel: Record<Visibility, string> = {
  public: "Public",
  friends: "Friends",
  private: "Only me",
};
