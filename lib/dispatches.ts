// Dispatches: a pin dropped while you are actually there. The same pin as
// always, plus a "here now" flag; the map is the feed. Nothing disappears —
// the pin stays on the map and in the recap — only the strip forgets a
// dispatch after three days.

import type { Pin, PinWithOwner, User } from "./types";

export const DISPATCH_TTL_MS = 72 * 3600 * 1000;

export function isLiveDispatch(pin: Pick<Pin, "hereNow" | "createdAt">, now: Date = new Date()): boolean {
  if (!pin.hereNow) return false;
  const age = now.getTime() - Date.parse(pin.createdAt);
  return age >= -60_000 && age < DISPATCH_TTL_MS;
}

export interface DispatchGroup {
  owner: User;
  /** Latest first. */
  pins: PinWithOwner[];
  latestAt: string;
}

/** Live dispatches from the pins the viewer may already see, grouped by
 *  traveler and ordered by the most recent. The viewer's own come first. */
export function liveDispatchesByUser(pins: PinWithOwner[], viewerId: string, now: Date = new Date()): DispatchGroup[] {
  const byUser = new Map<string, DispatchGroup>();
  for (const p of pins) {
    if (!isLiveDispatch(p, now)) continue;
    const g = byUser.get(p.userId) ?? { owner: p.owner, pins: [], latestAt: p.createdAt };
    g.pins.push(p);
    if (p.createdAt > g.latestAt) g.latestAt = p.createdAt;
    byUser.set(p.userId, g);
  }
  const groups = [...byUser.values()];
  for (const g of groups) g.pins.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return groups.sort((a, b) => {
    if (a.owner.id === viewerId) return -1;
    if (b.owner.id === viewerId) return 1;
    return b.latestAt.localeCompare(a.latestAt);
  });
}

/** "just now", "3h ago", "2d ago" */
export function agoLabel(iso: string, now: Date = new Date()): string {
  const m = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Suggest "here now" for a new pin: today's date (or none) and the device
 *  within `km` of the place. */
export function suggestHereNow(draft: { lat: number; lng: number }, device: { lat: number; lng: number } | null, startedOn: string | undefined, now: Date = new Date(), km = 25): boolean {
  if (!device) return false;
  if (startedOn && startedOn !== now.toISOString().slice(0, 10)) return false;
  const dLat = ((device.lat - draft.lat) * Math.PI) / 180, dLng = ((device.lng - draft.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((draft.lat * Math.PI) / 180) * Math.cos((device.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s)) <= km;
}
