"use client";

import { create } from "zustand";
import type {
  Friendship,
  Pin,
  TopPlace,
  Trip,
  TripStop,
  User,
  Visibility,
} from "./types";
import type { ThemeId } from "./themes";
import { THEMES } from "./themes";
import {
  CURRENT_USER_ID,
  friendships as seedFriendships,
  pins as seedPins,
  seedFollows,
  seedLikeCounts,
  seedTrips,
  topPlaces as seedTopPlaces,
  users as seedUsers,
} from "./seed";

function followsFor(viewerId: string): Set<string> {
  return new Set(
    seedFollows.filter((f) => f.followerId === viewerId).map((f) => f.creatorId)
  );
}

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

  // Auth session. Demo-mode: sign-in buttons create a local session for the
  // seeded viewer; swap these for Supabase Auth (signInWithOAuth / magic link)
  // when the live backend is wired.
  session: { userId: string; method: "apple" | "google" | "email" } | null;
  sessionReady: boolean;
  hydrateSession: () => void;
  signIn: (method: "apple" | "google" | "email") => void;
  signOut: () => void;

  // Session / demo identity. Real app: derived from Supabase Auth.
  viewerId: string;
  setViewer: (id: string) => void;

  // What the map is showing: your world of pins, or trips only. Trips are
  // their own thing — never overlaid on the pin map.
  mapMode: "pins" | "trips";
  setMapMode: (m: "pins" | "trips") => void;

  // Basemap mode (Apple-style Map / Satellite toggle) + 3D terrain.
  basemap: "map" | "satellite";
  setBasemap: (b: "map" | "satellite") => void;
  terrain3d: boolean;
  /** World landmarks layer (UNESCO / monuments / parks / culture icons). */
  showLandmarks: boolean;
  setShowLandmarks: (v: boolean) => void;
  selectedLandmarkId: string | null;
  selectLandmark: (id: string | null) => void;
  setTerrain3d: (v: boolean) => void;

  // Theme (UI chrome + globe palette). Persisted to localStorage.
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;

  // Social: likes, saves ("favorite for later"), creator follows.
  likeCounts: Record<string, number>;
  likedPinIds: Set<string>;
  toggleLike: (pinId: string) => void;
  savedPinIds: Set<string>;
  toggleSave: (pinId: string) => void;
  follows: Set<string>;
  toggleFollow: (creatorId: string) => void;

  // Trips: ordered stops stitched by a thread. Draft mode turns map taps into
  // stops until saved. Visibility is friends-or-private only.
  trips: Trip[];
  shownTripIds: Set<string>;
  toggleTripShown: (id: string) => void;
  deleteTrip: (id: string) => void;
  tripDraft: { title: string; visibility: "friends" | "private"; stops: TripStop[] } | null;
  startTripDraft: () => void;
  cancelTripDraft: () => void;
  setTripDraftTitle: (t: string) => void;
  setTripDraftVisibility: (v: "friends" | "private") => void;
  addTripStop: (s: Omit<TripStop, "id">) => void;
  undoTripStop: () => void;
  saveTripDraft: () => Trip | null;

  // Map layer state. `activeUserIds === null` => Everyone.
  activeUserIds: Set<string> | null;
  explore: boolean;
  showOnlyMe: () => void;
  showEveryone: () => void;
  showOnlyCreators: () => void;
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

  // Camera intents — components read these to move the map.
  flyTo: { lng: number; lat: number; zoom?: number; nonce: number } | null;
  requestFlyTo: (lng: number, lat: number, zoom?: number) => void;
  fitBoundsTo: { w: number; s: number; e: number; n: number; nonce: number } | null;
  requestFitBounds: (b: { w: number; s: number; e: number; n: number }) => void;

  // Current viewport (updated by the map on move-end) — powers "Top spots in
  // this area". At planet scale it covers the whole world.
  viewBounds: { w: number; s: number; e: number; n: number; zoom: number } | null;
  setViewBounds: (b: { w: number; s: number; e: number; n: number; zoom: number }) => void;

  addPin: (input: {
    lng: number;
    lat: number;
    placeName: string;
    countryCode: string;
    title: string;
    note: string;
    visibility: Visibility;
    media: { kind: "photo" | "video"; url: string }[];
    dates?: [string, string];
    rating?: number;
  }) => Pin;
  /** Set (or clear with null) your own 1–10 score on a pin you own. */
  ratePin: (pinId: string, rating: number | null) => void;
}

let pinCounter = seedPins.length;
let flyNonce = 0;

export const useStore = create<WaypointState>((set, get) => ({
  users: seedUsers,
  pins: seedPins,
  friendships: seedFriendships,
  topPlaces: seedTopPlaces,

  session: null,
  sessionReady: false,
  hydrateSession: () => {
    let session: WaypointState["session"] = null;
    try {
      const raw = window.localStorage.getItem("wp-session");
      if (raw) session = JSON.parse(raw) as WaypointState["session"];
    } catch {
      /* private mode / bad JSON */
    }
    set({ session, sessionReady: true });
  },
  signIn: (method) => {
    const session = { userId: CURRENT_USER_ID, method };
    try {
      window.localStorage.setItem("wp-session", JSON.stringify(session));
    } catch {
      /* ignore */
    }
    set({ session, viewerId: CURRENT_USER_ID });
  },
  signOut: () => {
    try {
      window.localStorage.removeItem("wp-session");
    } catch {
      /* ignore */
    }
    set({ session: null });
  },

  viewerId: CURRENT_USER_ID,
  setViewer: (id) =>
    set({
      viewerId: id,
      selectedPinId: null,
      follows: followsFor(id),
      likedPinIds: new Set(),
      savedPinIds: new Set(),
    }),

  mapMode: "pins",
  setMapMode: (m) =>
    set((s) => ({
      mapMode: m,
      // Leaving trips mode abandons any in-progress draft; entering clears pin UI.
      tripDraft: m === "trips" ? s.tripDraft : null,
      selectedPinId: null,
      addDraft: null,
    })),

  basemap: "map",
  setBasemap: (b) => set({ basemap: b }),
  terrain3d: true,
  setTerrain3d: (v) => set({ terrain3d: v }),
  showLandmarks: true,
  setShowLandmarks: (v) => set({ showLandmarks: v, selectedLandmarkId: null }),
  selectedLandmarkId: null,
  selectLandmark: (id) => set({ selectedLandmarkId: id }),

  theme: "daylight",
  setTheme: (t) => {
    if (!THEMES[t]) return;
    set({ theme: t });
    try {
      window.localStorage.setItem("wp-theme", t);
    } catch {
      /* SSR / private mode */
    }
  },

  likeCounts: { ...seedLikeCounts },
  likedPinIds: new Set<string>(),
  toggleLike: (pinId) =>
    set((s) => {
      const liked = new Set(s.likedPinIds);
      const counts = { ...s.likeCounts };
      if (liked.has(pinId)) {
        liked.delete(pinId);
        counts[pinId] = Math.max(0, (counts[pinId] ?? 0) - 1);
      } else {
        liked.add(pinId);
        counts[pinId] = (counts[pinId] ?? 0) + 1;
      }
      return { likedPinIds: liked, likeCounts: counts };
    }),

  savedPinIds: new Set<string>(),
  toggleSave: (pinId) =>
    set((s) => {
      const saved = new Set(s.savedPinIds);
      if (saved.has(pinId)) saved.delete(pinId);
      else saved.add(pinId);
      return { savedPinIds: saved };
    }),

  follows: followsFor(CURRENT_USER_ID),
  toggleFollow: (creatorId) =>
    set((s) => {
      const follows = new Set(s.follows);
      if (follows.has(creatorId)) follows.delete(creatorId);
      else follows.add(creatorId);
      // If layers were materialised into an explicit set, keep it in sync so a
      // newly-followed creator appears immediately.
      let activeUserIds = s.activeUserIds;
      if (activeUserIds) {
        activeUserIds = new Set(activeUserIds);
        if (follows.has(creatorId)) activeUserIds.add(creatorId);
        else activeUserIds.delete(creatorId);
      }
      return { follows, activeUserIds };
    }),

  activeUserIds: null, // Everyone by default — "a map should never feel empty"
  explore: false,
  showOnlyMe: () => set({ activeUserIds: new Set([get().viewerId]) }),
  showEveryone: () => set({ activeUserIds: null }),
  showOnlyCreators: () => set({ activeUserIds: new Set(get().follows) }),
  showOnly: (id) => set({ activeUserIds: new Set([id]) }),
  toggleUser: (id) =>
    set((s) => {
      // Materialise the current "everyone" set into an explicit set on first toggle.
      const base =
        s.activeUserIds ??
        new Set<string>(visibleOwnerIds(s.users, s.friendships, s.viewerId, s.follows));
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

  trips: [...seedTrips],
  shownTripIds: new Set(seedTrips.filter((t) => t.userId === CURRENT_USER_ID).map((t) => t.id)),
  toggleTripShown: (id) =>
    set((s) => {
      const shown = new Set(s.shownTripIds);
      if (shown.has(id)) shown.delete(id);
      else shown.add(id);
      return { shownTripIds: shown };
    }),
  deleteTrip: (id) =>
    set((s) => ({
      trips: s.trips.filter((t) => !(t.id === id && t.userId === s.viewerId)),
      shownTripIds: new Set([...s.shownTripIds].filter((x) => x !== id)),
    })),
  tripDraft: null,
  startTripDraft: () =>
    set({
      tripDraft: { title: "", visibility: "friends", stops: [] },
      mapMode: "trips",
      selectedPinId: null,
      addDraft: null,
    }),
  cancelTripDraft: () => set({ tripDraft: null }),
  setTripDraftTitle: (t) =>
    set((s) => (s.tripDraft ? { tripDraft: { ...s.tripDraft, title: t } } : {})),
  setTripDraftVisibility: (v) =>
    set((s) => (s.tripDraft ? { tripDraft: { ...s.tripDraft, visibility: v } } : {})),
  addTripStop: (stop) =>
    set((s) => {
      if (!s.tripDraft) return {};
      const id = `stop-${s.tripDraft.stops.length + 1}-${s.tripDraft.stops.length}`;
      return {
        tripDraft: { ...s.tripDraft, stops: [...s.tripDraft.stops, { ...stop, id }] },
      };
    }),
  undoTripStop: () =>
    set((s) =>
      s.tripDraft
        ? { tripDraft: { ...s.tripDraft, stops: s.tripDraft.stops.slice(0, -1) } }
        : {}
    ),
  saveTripDraft: () => {
    const s = get();
    if (!s.tripDraft || s.tripDraft.stops.length < 2) return null;
    const id = `trip-${s.trips.length + 1}-${Math.abs(s.trips.length * 7 + 13)}`;
    const trip: Trip = {
      id,
      userId: s.viewerId,
      title: s.tripDraft.title.trim() || "Untitled trip",
      visibility: s.tripDraft.visibility,
      stops: s.tripDraft.stops,
      createdAt: new Date().toISOString(),
    };
    set({
      trips: [...s.trips, trip],
      tripDraft: null,
      shownTripIds: new Set([...s.shownTripIds, id]),
    });
    return trip;
  },

  selectedPinId: null,
  selectPin: (id) => set({ selectedPinId: id, addDraft: null }),

  addDraft: null,
  startAddPin: (d) => set({ addDraft: d, selectedPinId: null }),
  cancelAddPin: () => set({ addDraft: null }),

  flyTo: null,
  requestFlyTo: (lng, lat, zoom) =>
    set({ flyTo: { lng, lat, zoom, nonce: ++flyNonce } }),
  fitBoundsTo: null,
  requestFitBounds: (b) => set({ fitBoundsTo: { ...b, nonce: ++flyNonce } }),

  viewBounds: null,
  setViewBounds: (b) => set({ viewBounds: b }),

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
      media: input.media.map((m, i) => ({
        id: `${id}-m${i + 1}`,
        kind: m.kind,
        url: m.url,
      })),
      rating: input.rating,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ pins: [...s.pins, pin], addDraft: null, selectedPinId: id }));
    return pin;
  },

  ratePin: (pinId, rating) =>
    set((s) => ({
      pins: s.pins.map((p) =>
        p.id === pinId && p.userId === s.viewerId
          ? { ...p, rating: rating ?? undefined }
          : p
      ),
    })),
}));

// The set of owner ids a viewer could see under "Everyone": self + accepted
// friends + followed creators.
function visibleOwnerIds(
  users: User[],
  friendships: Friendship[],
  viewerId: string,
  follows: Set<string>
): string[] {
  const ids = new Set<string>([viewerId, ...follows]);
  for (const f of friendships) {
    if (f.status !== "accepted") continue;
    if (f.userA === viewerId) ids.add(f.userB);
    else if (f.userB === viewerId) ids.add(f.userA);
  }
  return [...ids].filter((id) => users.some((u) => u.id === id));
}
