"use client";

import { create } from "zustand";
import type { Friendship, Pin, TopPlace, User, Visibility } from "./types";
import {
  CURRENT_USER_ID,
  friendships as seedFriendships,
  pins as seedPins,
  topPlaces as seedTopPlaces,
  users as seedUsers,
} from "./seed";

export interface AddPinDraft {
  lng: number;
  lat: number;
  placeName: string;
  countryCode: string;
}

interface WaypointState {
  // Data (seeded now; a Supabase-backed impl would hydrate these instead).
  users: User[];
  pins: Pin[];
  friendships: Friendship[];
  topPlaces: TopPlace[];

  // Session / demo identity. Real app: derived from Supabase Auth.
  viewerId: string;
  setViewer: (id: string) => void;

  // Basemap mode (Apple-style Map / Satellite toggle) + 3D terrain.
  basemap: "map" | "satellite";
  setBasemap: (b: "map" | "satellite") => void;
  terrain3d: boolean;
  setTerrain3d: (v: boolean) => void;

  // Map layer state. `activeUserIds === null` => Everyone.
  activeUserIds: Set<string> | null;
  explore: boolean;
  showOnlyMe: () => void;
  showEveryone: () => void;
  showOnly: (id: string) => void;
  toggleUser: (id: string) => void;
  setExplore: (v: boolean) => void;

  // Reorder a user's Top 5 (drag-to-rank on the profile).
  reorderTop: (userId: string, orderedPinIds: string[]) => void;

  // Selection + flows.
  selectedPinId: string | null;
  selectPin: (id: string | null) => void;
  addDraft: AddPinDraft | null;
  startAddPin: (d: AddPinDraft) => void;
  cancelAddPin: () => void;

  // Camera intent — components read this to fly the map somewhere.
  flyTo: { lng: number; lat: number; zoom?: number; nonce: number } | null;
  requestFlyTo: (lng: number, lat: number, zoom?: number) => void;

  addPin: (input: {
    lng: number;
    lat: number;
    placeName: string;
    countryCode: string;
    title: string;
    note: string;
    visibility: Visibility;
    photoUrls: string[];
    dates?: [string, string];
  }) => Pin;
}

let pinCounter = seedPins.length;
let flyNonce = 0;

export const useStore = create<WaypointState>((set, get) => ({
  users: seedUsers,
  pins: seedPins,
  friendships: seedFriendships,
  topPlaces: seedTopPlaces,

  viewerId: CURRENT_USER_ID,
  setViewer: (id) => set({ viewerId: id, selectedPinId: null }),

  basemap: "map",
  setBasemap: (b) => set({ basemap: b }),
  terrain3d: true,
  setTerrain3d: (v) => set({ terrain3d: v }),

  activeUserIds: null, // Everyone by default — "a map should never feel empty"
  explore: false,
  showOnlyMe: () => set({ activeUserIds: new Set([get().viewerId]) }),
  showEveryone: () => set({ activeUserIds: null }),
  showOnly: (id) => set({ activeUserIds: new Set([id]) }),
  toggleUser: (id) =>
    set((s) => {
      // Materialise the current "everyone" set into an explicit set on first toggle.
      const base =
        s.activeUserIds ??
        new Set<string>(visibleOwnerIds(s.users, s.friendships, s.viewerId));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { activeUserIds: next };
    }),
  setExplore: (v) => set({ explore: v }),

  reorderTop: (userId, orderedPinIds) =>
    set((s) => {
      const others = s.topPlaces.filter((t) => t.userId !== userId);
      const byPin = new Map(
        s.topPlaces.filter((t) => t.userId === userId).map((t) => [t.pinId, t])
      );
      const reordered = orderedPinIds
        .map((pinId, i) => {
          const t = byPin.get(pinId);
          return t ? { ...t, rank: i + 1 } : null;
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);
      return { topPlaces: [...others, ...reordered] };
    }),

  selectedPinId: null,
  selectPin: (id) => set({ selectedPinId: id, addDraft: null }),

  addDraft: null,
  startAddPin: (d) => set({ addDraft: d, selectedPinId: null }),
  cancelAddPin: () => set({ addDraft: null }),

  flyTo: null,
  requestFlyTo: (lng, lat, zoom) =>
    set({ flyTo: { lng, lat, zoom, nonce: ++flyNonce } }),

  addPin: (input) => {
    const id = `pin-${++pinCounter}`;
    const pin: Pin = {
      id,
      userId: get().viewerId,
      lng: input.lng,
      lat: input.lat,
      placeName: input.placeName,
      countryCode: input.countryCode,
      title: input.title,
      note: input.note,
      visibility: input.visibility,
      startedOn: input.dates?.[0],
      endedOn: input.dates?.[1],
      photos: input.photoUrls.map((url, i) => ({
        id: `${id}-p${i + 1}`,
        url,
        width: 1200,
        height: 800,
      })),
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ pins: [...s.pins, pin], addDraft: null, selectedPinId: id }));
    return pin;
  },
}));

// The set of owner ids a viewer could see under "Everyone": self + accepted friends.
function visibleOwnerIds(
  users: User[],
  friendships: Friendship[],
  viewerId: string
): string[] {
  const ids = new Set<string>([viewerId]);
  for (const f of friendships) {
    if (f.status !== "accepted") continue;
    if (f.userA === viewerId) ids.add(f.userB);
    else if (f.userB === viewerId) ids.add(f.userA);
  }
  return [...ids].filter((id) => users.some((u) => u.id === id));
}
