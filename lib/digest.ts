// The evening digest: of everything your friends pinned lately, the few
// places most worth a look — far from home, somewhere nobody in the circle
// had been, on a world list, loved by the others, told well. Pure functions
// over data the store already holds; nothing is fetched and no model writes
// a word. Every pick carries the reasons it was chosen, in plain words, so
// the ranking is never a mystery.

import type { Pin, PinWithOwner } from "./types";

export interface DigestPick {
  pin: PinWithOwner;
  score: number;
  /** Why it made the cut, most important first, at most three. */
  reasons: string[];
}

export interface DigestWindow {
  /** "today" = last 24 h, "week" = last 7 days, "lately" = newest overall. */
  span: "today" | "week" | "lately";
  since: string;
}

export interface DigestInput {
  /** Every pin the viewer may see, owners attached (the visible set). */
  pins: PinWithOwner[];
  viewerId: string;
  likeCounts: Record<string, number>;
  now?: Date;
  /** Nearest world-list place, when the lists are on the device. */
  listNear?: (lat: number, lng: number) => { name: string; list: string } | null;
  /** How many picks at most. */
  limit?: number;
}

const DAY = 86_400_000;

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, dLat = ((bLat - aLat) * Math.PI) / 180, dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Where "home" is for distance: the median of the viewer's own pins. */
export function homeOf(pins: Pin[], viewerId: string): { lat: number; lng: number } | null {
  const mine = pins.filter((p) => p.userId === viewerId);
  if (!mine.length) return null;
  const lats = mine.map((p) => p.lat).sort((a, b) => a - b);
  const lngs = mine.map((p) => p.lng).sort((a, b) => a - b);
  return { lat: lats[Math.floor(lats.length / 2)], lng: lngs[Math.floor(lngs.length / 2)] };
}

/** Pick the window: last 24 h if it holds two friend pins, else the last
 *  week, else whatever is newest. The digest is never empty when friends
 *  have pinned anything at all. */
export function digestWindow(pins: PinWithOwner[], viewerId: string, now = new Date()): DigestWindow {
  const friends = pins.filter((p) => p.userId !== viewerId);
  const dayAgo = new Date(now.getTime() - DAY).toISOString();
  if (friends.filter((p) => p.createdAt >= dayAgo).length >= 2) return { span: "today", since: dayAgo };
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  if (friends.filter((p) => p.createdAt >= weekAgo).length >= 2) return { span: "week", since: weekAgo };
  return { span: "lately", since: "" };
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Rank friends' recent pins by how exotic and interesting they are. */
export function buildDigest(input: DigestInput): { window: DigestWindow; picks: DigestPick[] } {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 5;
  const window = digestWindow(input.pins, input.viewerId, now);
  const home = homeOf(input.pins, input.viewerId);

  // Country rarity across the whole visible history: a country only one
  // person has ever pinned is news; one everybody has pinned is not.
  const pinnersByCountry = new Map<string, Set<string>>();
  for (const p of input.pins) {
    if (!p.countryCode) continue;
    const cc = p.countryCode.toUpperCase();
    if (!pinnersByCountry.has(cc)) pinnersByCountry.set(cc, new Set());
    pinnersByCountry.get(cc)!.add(p.userId);
  }
  const viewerCountries = new Set(input.pins.filter((p) => p.userId === input.viewerId && p.countryCode).map((p) => p.countryCode.toUpperCase()));

  let pool = input.pins.filter((p) => p.userId !== input.viewerId);
  if (window.since) pool = pool.filter((p) => p.createdAt >= window.since);
  else pool = pool.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);

  const scored: DigestPick[] = pool.map((pin) => {
    let score = 0;
    const reasons: { w: number; text: string }[] = [];
    const cc = pin.countryCode?.toUpperCase() ?? "";

    if (home) {
      const km = distanceKm(home.lat, home.lng, pin.lat, pin.lng);
      // 0 at home, ~1 by 3,000 km, ~2 by 10,000 km
      const far = Math.min(2.4, Math.log1p(km / 1500));
      score += far;
      if (km >= 2500) reasons.push({ w: far, text: `${Math.round(km / 100) * 100 >= 1000 ? `${(km / 1000).toFixed(km >= 10000 ? 0 : 1)},000` : Math.round(km)} km from your home base`.replace(/(\d)\.0,000/, "$1,000") });
    }

    if (cc) {
      const pinners = pinnersByCountry.get(cc)?.size ?? 1;
      if (!viewerCountries.has(cc)) {
        if (pinners === 1) { score += 2; reasons.push({ w: 2, text: `first of your friends in ${countryName(cc)}` }); }
        else { score += 1; reasons.push({ w: 1, text: `${countryName(cc)} — you haven't pinned it` }); }
      } else if (pinners === 1) {
        score += 0.6;
      }
    }

    const near = input.listNear?.(pin.lat, pin.lng);
    if (near) { score += 1.2; reasons.push({ w: 1.2, text: `on the ${near.list} list: ${near.name}` }); }

    const likes = input.likeCounts[pin.id] ?? 0;
    if (likes > 0) { const w = Math.min(1.5, Math.log2(1 + likes) * 0.5); score += w; reasons.push({ w, text: `${likes} ${likes === 1 ? "friend likes" : "friends like"} it` }); }

    if (pin.rating != null && pin.rating >= 8) { const w = (pin.rating - 7) * 0.4; score += w; reasons.push({ w, text: `${pin.owner.displayName.split(" ")[0]} rated it ${pin.rating}/10` }); }
    if (pin.media.length > 0) score += 0.4;
    if (pin.note.trim().length > 60) { score += 0.4; reasons.push({ w: 0.4, text: "with a proper note" }); }
    if (pin.hereNow) { score += 0.5; reasons.push({ w: 0.5, text: "they're there right now" }); }

    return { pin, score, reasons: reasons.sort((a, b) => b.w - a.w).slice(0, 3).map((r) => r.text) };
  });

  // Best first; at most two per friend and one per place name, so five
  // picks read as five places, not one person's whole trip.
  scored.sort((a, b) => b.score - a.score || b.pin.createdAt.localeCompare(a.pin.createdAt));
  const perFriend = new Map<string, number>();
  const seenPlace = new Set<string>();
  const picks: DigestPick[] = [];
  for (const s of scored) {
    const place = s.pin.placeName.toLowerCase();
    const n = perFriend.get(s.pin.userId) ?? 0;
    if (n >= 2 || seenPlace.has(place)) continue;
    perFriend.set(s.pin.userId, n + 1);
    seenPlace.add(place);
    picks.push(s);
    if (picks.length >= limit) break;
  }
  return { window, picks };
}

/** Whether it is digest time: evening, local. */
export function isEvening(now = new Date()): boolean {
  const h = now.getHours();
  return h >= 17 || h < 4;
}

/** The storage key that marks today's digest as seen. */
export function digestSeenKey(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  // an evening runs past midnight: count 00:00–04:00 as the previous day
  if (now.getHours() < 4) local.setUTCDate(local.getUTCDate() - 1);
  return `wp-digest-${local.toISOString().slice(0, 10)}`;
}

export function digestTitle(window: DigestWindow): string {
  return window.span === "today" ? "Tonight's picks" : window.span === "week" ? "This week's picks" : "Worth a look";
}

export function digestSubtitle(window: DigestWindow): string {
  return window.span === "today"
    ? "The most interesting places your friends pinned in the last day."
    : window.span === "week"
      ? "Quiet day — the best of what your friends pinned this week."
      : "The most interesting of your friends' latest pins.";
}
