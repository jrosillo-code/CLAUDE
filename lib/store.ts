"use client";

import { create } from "zustand";
import type {
  ActivitySlug,
  AppNotification,
  Friendship,
  Pin,
  ReflectionAnswer,
  TopPlace,
  Trip,
  TripReflection,
  TripStop,
  User,
  UserSocials,
  Visibility,
} from "./types";
import type { ThemeId } from "./themes";
import { THEMES } from "./themes";
import type { OverlayId } from "./overlays";
import {
  CURRENT_USER_ID,
  friendships as seedFriendships,
  pins as seedPins,
  seedFollows,
  seedLikeCounts,
  seedNotifications,
  seedReflections,
  seedTrips,
  topPlaces as seedTopPlaces,
  users as seedUsers,
} from "./seed";
import { arrivedForPasswordRecovery, backendEnabled, supabase } from "./supabase";
import * as backend from "./backend";
import { track } from "./analytics";

// When the Supabase env is configured the store hydrates from the real
// backend and every mutation writes through; otherwise the seeded demo world
// is used and everything stays in-memory.
let authListenerBound = false;
// Live subscription plumbing (backend mode): one channel per signed-in user,
// world reloads debounced so a burst of events costs one fetch.
let unsubscribeRealtime: (() => void) | null = null;
let realtimeTimer: ReturnType<typeof setTimeout> | null = null;
// Hard ceiling on the loading screen — deliberately SHORTER than the load
// timeouts in lib/backend.ts. Being signed in is a fact we already know from
// the session; it does not depend on whether the world finished downloading.
// So after this long we show the app, and a load that is merely slow still
// populates it when it lands. The alternative — holding the splash until
// every request has answered — is what made a single unresponsive query look
// like a broken app.
const HYDRATE_WATCHDOG_MS = 6_000;

function followsFor(viewerId: string): Set<string> {
  return new Set(
    seedFollows.filter((f) => f.followerId === viewerId).map((f) => f.creatorId)
  );
}

/** Accept (map to accepted) or remove the friendship row between two users. */
function respondLocal(
  friendships: Friendship[],
  viewerId: string,
  userId: string,
  accept: boolean
): Friendship[] {
  const matches = (f: Friendship) =>
    (f.userA === userId && f.userB === viewerId) ||
    (f.userA === viewerId && f.userB === userId);
  return accept
    ? friendships.map((f) => (matches(f) ? { ...f, status: "accepted" as const } : f))
    : friendships.filter((f) => !matches(f));
}

export interface AddPinDraft {
  lng: number;
  lat: number;
  placeName: string;
  countryCode: string;
  region?: string;
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
  /** True while a password-recovery link is being acted on — see PasswordReset. */
  passwordRecovery: boolean;
  endPasswordRecovery: () => void;
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
  /** Device location for the blue you-are-here dot (set once permission is granted). */
  userLocation: { lng: number; lat: number } | null;
  setUserLocation: (l: { lng: number; lat: number } | null) => void;
  /** Wishlist layer: pins you saved render as ghost needles on the map. */
  showWishlist: boolean;
  setShowWishlist: (v: boolean) => void;
  /** World landmarks layer (UNESCO / monuments / parks / culture icons). */
  showLandmarks: boolean;
  setShowLandmarks: (v: boolean) => void;
  /** Lazy-loaded worldwide overlays: airports, train stations, stadiums. */
  showAirports: boolean;
  setShowAirports: (v: boolean) => void;
  showStations: boolean;
  setShowStations: (v: boolean) => void;
  showStadiums: boolean;
  setShowStadiums: (v: boolean) => void;
  selectedLandmarkId: string | null;
  selectLandmark: (id: string | null) => void;
  /** A tapped overlay feature (airport / station / stadium) → info card. */
  selectedOverlay: {
    kind: OverlayId;
    title: string;
    subtitle: string;
    lat: number;
    lng: number;
  } | null;
  selectOverlay: (v: WaypointState["selectedOverlay"]) => void;
  /** The place from the last search pick — powers the "who you trust has been
   *  here" trust-graph card. */
  searchedPlace: { name: string; lat: number; lng: number } | null;
  setSearchedPlace: (v: WaypointState["searchedPlace"]) => void;
  setTerrain3d: (v: boolean) => void;

  // Theme (UI chrome + globe palette). Persisted to localStorage.
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  /** UI accent: Waymark terracotta (default) or glass blue. */
  accent: "blue" | "warm";
  setAccent: (a: "blue" | "warm") => void;

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
  /** Rename a saved trip (owner only). */
  renameTrip: (id: string, title: string) => void;
  tripDraft: { title: string; visibility: "friends" | "private"; stops: TripStop[] } | null;
  startTripDraft: () => void;
  /** Fork a friend's trip into your own draft — their stops, your route now. */
  cloneTripToDraft: (tripId: string) => boolean;
  /** Mark your trip finished — the cue for the 60-second debrief. */
  completeTrip: (tripId: string) => void;
  /**
   * A friend's debrief did work on one of the surfaces — record it so the
   * author can see that it helped (never who it helped).
   */
  noteCitation: (
    reflectionId: string,
    ownerId: string,
    surface: "ask" | "place" | "dontmiss" | "clone"
  ) => void;

  // ── Post-trip debriefs (reflections) ──
  reflections: TripReflection[];
  /** Times each of the viewer's own debriefs was cited, from the server. */
  citationCounts: Record<string, number>;
  /** Get-or-create the viewer's draft debrief for a trip; returns its id. */
  startReflection: (tripId: string) => string | null;
  /** Save one answer verbatim (replaces an earlier answer to the same question). */
  saveReflectionAnswer: (reflectionId: string, answer: ReflectionAnswer) => void;
  /** Drop one answered question from a debrief (edit flow). */
  removeReflectionAnswer: (reflectionId: string, questionId: ReflectionAnswer["questionId"]) => void;
  setReflectionVisibility: (reflectionId: string, v: Visibility) => void;
  /** Submit the debrief — it becomes evidence for Ask and Don't-miss. */
  completeReflection: (reflectionId: string) => void;
  /** Reopen a submitted debrief for editing. */
  reopenReflection: (reflectionId: string) => void;
  deleteReflection: (reflectionId: string) => void;
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
  /** Put one of your pins into a Top 5 slot — replacing whatever held it. */
  setTopPlace: (rank: number, pinId: string) => void;

  // Selection + flows.
  selectedPinId: string | null;
  selectPin: (id: string | null) => void;
  addDraft: AddPinDraft | null;
  startAddPin: (d: AddPinDraft) => void;
  cancelAddPin: () => void;

  // Camera intents — components read these to move the map.
  flyTo: { lng: number; lat: number; zoom?: number; flat?: boolean; nonce: number } | null;
  /** `flat` forces a straight-overhead (no-tilt) arrival — used for pin drops. */
  requestFlyTo: (lng: number, lat: number, zoom?: number, opts?: { flat?: boolean }) => void;
  fitBoundsTo: { w: number; s: number; e: number; n: number; nonce: number } | null;
  requestFitBounds: (b: { w: number; s: number; e: number; n: number }) => void;
  /** Recap flight film: run this year's flyover while recording a video. */
  recapFlightReq: number;
  requestRecapFlight: () => void;
  flightRecording: boolean;
  setFlightRecording: (b: boolean) => void;
  /** Offline film render progress 0..1, or null when not rendering. */
  flightProgress: number | null;
  setFlightProgress: (p: number | null) => void;

  // Current viewport (updated by the map on move-end) — powers "Top spots in
  // this area". At planet scale it covers the whole world.
  viewBounds: { w: number; s: number; e: number; n: number; zoom: number } | null;
  setViewBounds: (b: { w: number; s: number; e: number; n: number; zoom: number }) => void;

  addPin: (input: {
    lng: number;
    lat: number;
    placeName: string;
    countryCode: string;
    region?: string;
    title: string;
    note: string;
    visibility: Visibility;
    media: { kind: "photo" | "video"; url: string }[];
    dates?: [string, string];
    rating?: number;
    /** Backdated posts (Takeout import) — keeps the feed and year tags honest. */
    createdAt?: string;
  }) => Pin;
  /** Edit your own pin (title, note, visibility, rating). */
  updatePin: (pinId: string, patch: Partial<Pick<Pin, "title" | "note" | "visibility" | "rating" | "media">>) => void;
  /** Delete your own pin everywhere. */
  deletePin: (pinId: string) => void;
  /** Set (or clear with null) your own 1–10 score on a pin you own. */
  ratePin: (pinId: string, rating: number | null) => void;

  // ── Friends ──
  /** Send a friend request from the viewer to another traveler. */
  sendFriendRequest: (userId: string) => void;
  /** Accept (true) or decline (false) a pending request involving this user. */
  respondFriendRequest: (userId: string, accept: boolean) => void;
  /** Withdraw a request the viewer sent. */
  cancelFriendRequest: (userId: string) => void;

  // ── Socials on your profile ──
  setMySocials: (socials: UserSocials) => void;
  /** Swap your profile picture — updates everywhere your avatar renders. */
  setMyAvatar: (dataUrl: string) => void;
  /** Edit profile: display name, bio, home city. */
  setMyProfile: (p: { displayName: string; bio: string; homeCity: string }) => void;

  // ── Creator application ──
  creatorApplied: boolean;
  applyCreator: (data: { activities: ActivitySlug[]; link: string }) => void;

  // ── Notifications ──
  notifications: AppNotification[];
  /** Mark one notification read (hovering/tapping its row). */
  markNotificationRead: (id: string) => void;
  markNotificationsRead: () => void;
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
  // Read from the landing URL rather than waited for as an event — see the
  // note in lib/supabase.ts on why the event alone is unreliable.
  passwordRecovery: backendEnabled && arrivedForPasswordRecovery,
  endPasswordRecovery: () => set({ passwordRecovery: false }),
  hydrateSession: () => {
    // ── Live backend: session comes from Supabase Auth ──
    if (backendEnabled) {
      const applyAuthUser = async (userId: string, email?: string) => {
        // Whatever happens below, a signed-in user ends up signed in and
        // looking at the app. A backend that is down means an empty map they
        // can sign out of — never a loading screen they cannot leave.
        try {
          await loadEverything(userId, email);
        } catch (e) {
          console.error("[waypoint] hydrate failed; continuing with what loaded", e);
          set({ session: { userId, method: "email" }, viewerId: userId });
        } finally {
          set({ sessionReady: true });
        }
      };

      const loadEverything = async (userId: string, email?: string) => {
        const profile = await backend.ensureProfile(userId, email);
        // A username picked on the signup form waits in localStorage until
        // the session exists, then becomes the account's handle.
        try {
          const pending = window.localStorage.getItem("wp-pending-handle");
          if (pending) {
            await backend.claimHandle(userId, pending);
            window.localStorage.removeItem("wp-pending-handle");
          }
        } catch {
          /* private mode */
        }
        const world = await backend.loadWorld(userId);
        // Citations are read separately: an aggregate over the viewer's own
        // debriefs, never the rows behind it. Bounded, because nothing during
        // startup is allowed to hold the loading screen open.
        const counts = await backend.withTimeout(
          backend.loadCitationCounts(),
          backend.LOAD_TIMEOUT_MS,
          {} as Record<string, number>,
          "loadCitationCounts"
        );
        set((s) => ({
          session: { userId, method: "email" },
          sessionReady: true,
          viewerId: userId,
          users: world?.users?.length
            ? world.users
            : profile
              ? [profile]
              : s.users,
          pins: world?.pins ?? [],
          friendships: world?.friendships ?? [],
          trips: world?.trips ?? [],
          reflections: world?.reflections ?? [],
          citationCounts: counts,
          topPlaces: world?.topPlaces ?? [],
          likeCounts: world?.likeCounts ?? {},
          likedPinIds: world?.likedPinIds ?? new Set(),
          savedPinIds: world?.savedPinIds ?? new Set(),
          follows: world?.follows ?? new Set(),
          notifications: world?.notifications ?? [],
          shownTripIds: new Set(
            (world?.trips ?? []).filter((t) => t.userId === userId).map((t) => t.id)
          ),
          activeUserIds: null,
        }));

        // Realtime: likes, friend requests, and fresh pins land without a
        // reload — any relevant server change reloads the world (debounced).
        unsubscribeRealtime?.();
        unsubscribeRealtime = backend.subscribeRealtime(userId, () => {
          if (realtimeTimer) clearTimeout(realtimeTimer);
          realtimeTimer = setTimeout(async () => {
            realtimeTimer = null;
            const w = await backend.loadWorld(userId);
            if (!w || get().viewerId !== userId) return;
            const counts = await backend.withTimeout(
              backend.loadCitationCounts(),
              backend.LOAD_TIMEOUT_MS,
              {} as Record<string, number>,
              "loadCitationCounts"
            );
            set({
              citationCounts: counts,
              users: w.users,
              pins: w.pins,
              friendships: w.friendships,
              trips: w.trips,
              reflections: w.reflections,
              topPlaces: w.topPlaces,
              likeCounts: w.likeCounts,
              likedPinIds: w.likedPinIds,
              savedPinIds: w.savedPinIds,
              follows: w.follows,
              notifications: w.notifications,
            });
          }, 700);
        });
      };
      // The loading screen is shown until sessionReady flips, so EVERY path
      // out of here must flip it — including the ones that fail. Previously
      // it was set in exactly one place, at the end of a chain of awaited
      // network calls, with nothing catching: any failure in that chain left
      // the app on its pulsing logo permanently, with no error and no way
      // forward. A signed-in user could not even reach the sign-out button.
      const finish = () => {
        if (!get().sessionReady) set({ sessionReady: true });
      };

      // Last line of defence. If hydration has not finished by now something
      // is wrong that we cannot see from here; show the app anyway (signed in
      // with whatever loaded, or the login screen) rather than a spinner.
      window.setTimeout(finish, HYDRATE_WATCHDOG_MS);

      void supabase!.auth
        .getSession()
        .then(({ data }) => {
          const u = data.session?.user;
          if (!u) {
            set({ session: null, sessionReady: true });
            return;
          }
          // Being signed in is known NOW, from the stored session — it does
          // not depend on the world downloading. Record it immediately so
          // that if the watchdog has to step in, it shows this user their
          // (empty) app rather than a login screen they don't need. The
          // seeded demo world is cleared at the same time: better an empty
          // map than someone else's pins while the real ones are in flight.
          set({
            session: { userId: u.id, method: "email" },
            viewerId: u.id,
            pins: [],
            trips: [],
            reflections: [],
            friendships: [],
            topPlaces: [],
          });
          return applyAuthUser(u.id, u.email);
        })
        .catch((e) => {
          console.error("[waypoint] session restore failed", e);
          set({ session: null });
        })
        .finally(finish);
      if (!authListenerBound) {
        authListenerBound = true;
        supabase!.auth.onAuthStateChange((event, session) => {
          // Keep the realtime socket's JWT fresh — RLS-scoped subscriptions
          // (notifications, friendships) go silent once the token expires.
          if (session?.access_token) supabase!.realtime.setAuth(session.access_token);
          // A recovery link signs the user in like any other session, so
          // without catching this event the reset would appear to do nothing:
          // the app would just open and the password would be unchanged.
          if (event === "PASSWORD_RECOVERY") {
            set({ passwordRecovery: true });
            if (session?.user) void applyAuthUser(session.user.id, session.user.email);
          } else if (event === "SIGNED_IN" && session?.user) {
            void applyAuthUser(session.user.id, session.user.email);
          } else if (event === "SIGNED_OUT") {
            set({ session: null });
          }
        });
      }
      return;
    }

    // ── Demo mode: local session + locally persisted profile extras ──
    let session: WaypointState["session"] = null;
    try {
      const raw = window.localStorage.getItem("wp-session");
      if (raw) session = JSON.parse(raw) as WaypointState["session"];
    } catch {
      /* private mode / bad JSON */
    }
    // Restore locally-persisted profile extras (socials, creator application).
    let creatorApplied = false;
    let savedSocials: UserSocials | null = null;
    let savedAvatar: string | null = null;
    let savedProfile: { displayName: string; bio: string; homeCity: string } | null = null;
    try {
      creatorApplied = !!window.localStorage.getItem("wp-creator-app");
      const rawSocials = window.localStorage.getItem("wp-socials");
      if (rawSocials) savedSocials = JSON.parse(rawSocials) as UserSocials;
      savedAvatar = window.localStorage.getItem("wp-avatar");
      const rawProfile = window.localStorage.getItem("wp-profile");
      if (rawProfile) savedProfile = JSON.parse(rawProfile) as typeof savedProfile;
    } catch {
      /* ignore */
    }
    set((s) => ({
      session,
      sessionReady: true,
      creatorApplied,
      users:
        savedSocials || savedAvatar || savedProfile
          ? s.users.map((u) =>
              u.id === s.viewerId
                ? {
                    ...u,
                    ...(savedSocials ? { socials: savedSocials } : {}),
                    ...(savedAvatar ? { avatarUrl: savedAvatar } : {}),
                    ...(savedProfile ?? {}),
                  }
                : u
            )
          : s.users,
    }));
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
    unsubscribeRealtime?.();
    unsubscribeRealtime = null;
    if (realtimeTimer) clearTimeout(realtimeTimer);
    if (backendEnabled) void supabase!.auth.signOut();
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
  terrain3d: false, // flat by default — 3D is an opt-in flourish
  setTerrain3d: (v) => set({ terrain3d: v }),
  userLocation: null,
  setUserLocation: (l) => set({ userLocation: l }),
  showWishlist: false,
  setShowWishlist: (v) => set({ showWishlist: v }),
  // Off by default — travelers opt in from the map controls.
  showLandmarks: false,
  setShowLandmarks: (v) => set({ showLandmarks: v, selectedLandmarkId: null }),

  showAirports: false,
  setShowAirports: (v) => set({ showAirports: v }),
  showStations: false,
  setShowStations: (v) => set({ showStations: v }),
  showStadiums: false,
  setShowStadiums: (v) => set({ showStadiums: v }),
  selectedLandmarkId: null,
  selectLandmark: (id) => set({ selectedLandmarkId: id, selectedOverlay: null, searchedPlace: null }),
  selectedOverlay: null,
  selectOverlay: (v) => set({ selectedOverlay: v, selectedLandmarkId: null, selectedPinId: null, searchedPlace: null }),
  searchedPlace: null,
  setSearchedPlace: (v) => set({ searchedPlace: v, selectedPinId: null, selectedLandmarkId: null, selectedOverlay: null }),

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

  accent: "warm",
  setAccent: (a) => {
    set({ accent: a });
    try {
      window.localStorage.setItem("wp-accent", a);
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
      if (backendEnabled) {
        const owner = s.pins.find((p) => p.id === pinId)?.userId;
        backend.syncLike(pinId, s.viewerId, liked.has(pinId), owner);
      }
      return { likedPinIds: liked, likeCounts: counts };
    }),

  savedPinIds: new Set<string>(),
  toggleSave: (pinId) =>
    set((s) => {
      const saved = new Set(s.savedPinIds);
      if (saved.has(pinId)) saved.delete(pinId);
      else saved.add(pinId);
      if (backendEnabled) backend.syncSave(pinId, s.viewerId, saved.has(pinId));
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
      if (backendEnabled) backend.syncFollow(creatorId, s.viewerId, follows.has(creatorId));
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
      if (backendEnabled && userId === s.viewerId) backend.syncTopPlaces(userId, reordered);
      return { topPlaces: [...others, ...reordered] };
    }),

  setTopPlace: (rank, pinId) =>
    set((s) => {
      const pin = s.pins.find((p) => p.id === pinId && p.userId === s.viewerId);
      if (!pin || rank < 1 || rank > 5) return {};
      const others = s.topPlaces.filter((t) => t.userId !== s.viewerId);
      const mine = s.topPlaces.filter((t) => t.userId === s.viewerId);
      const occupant = mine.find((t) => t.rank === rank);
      const already = mine.find((t) => t.pinId === pinId);
      let next = mine.filter((t) => t.rank !== rank && t.pinId !== pinId);
      next.push({ userId: s.viewerId, rank, pinId, blurb: pin.note.slice(0, 90) });
      // If the chosen pin already held another slot, the displaced pin takes it
      // (a swap, so no rank is ever left empty by accident).
      if (already && occupant && already.rank !== rank) {
        next.push({ ...occupant, rank: already.rank });
      }
      next = next.sort((a, b) => a.rank - b.rank);
      if (backendEnabled) backend.syncTopPlaces(s.viewerId, next);
      return { topPlaces: [...others, ...next] };
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
    set((s) => {
      if (!s.trips.some((t) => t.id === id && t.userId === s.viewerId)) return {};
      if (backendEnabled) backend.syncDeleteTrip(id);
      return {
        trips: s.trips.filter((t) => !(t.id === id && t.userId === s.viewerId)),
        shownTripIds: new Set([...s.shownTripIds].filter((x) => x !== id)),
      };
    }),
  renameTrip: (id, title) =>
    set((s) => {
      const t = title.trim();
      if (!t) return {};
      if (!s.trips.some((x) => x.id === id && x.userId === s.viewerId)) return {};
      if (backendEnabled) backend.syncRenameTrip(id, t);
      return {
        trips: s.trips.map((x) =>
          x.id === id && x.userId === s.viewerId ? { ...x, title: t } : x
        ),
      };
    }),
  tripDraft: null,
  startTripDraft: () =>
    set({
      tripDraft: { title: "", visibility: "friends", stops: [] },
      mapMode: "trips",
      selectedPinId: null,
      addDraft: null,
    }),
  cloneTripToDraft: (tripId) => {
    const s = get();
    const source = s.trips.find((t) => t.id === tripId);
    // Only trips the viewer can already see are cloneable (own or friends').
    if (!source || source.stops.length === 0) return false;
    const owner = s.users.find((u) => u.id === source.userId);
    const first = owner?.displayName.split(" ")[0];
    const title =
      source.userId === s.viewerId || !first ? `${source.title} (copy)` : `${first}'s ${source.title}`;
    track("trip_cloned", { tripId, ownerId: source.userId, viewerId: s.viewerId });
    // Contribution signal: the clone carried the owner's completed debrief.
    const debrief = s.reflections.find(
      (r) => r.tripId === tripId && r.userId === source.userId && r.status === "complete"
    );
    if (debrief && source.userId !== s.viewerId) {
      track("trip_cloned_with_debrief", {
        reflectionId: debrief.id,
        tripId,
        ownerId: source.userId,
        viewerId: s.viewerId,
      });
    }
    set({
      tripDraft: {
        title,
        visibility: "friends",
        stops: source.stops.map((stop, i) => ({
          ...stop,
          id: backendEnabled ? crypto.randomUUID() : `clone-${tripId}-${i}`,
        })),
      },
      mapMode: "trips",
      selectedPinId: null,
      addDraft: null,
    });
    return true;
  },
  noteCitation: (reflectionId, ownerId, surface) => {
    const s = get();
    if (!backendEnabled || !s.viewerId || ownerId === s.viewerId) return;
    backend.syncRecordCitation(reflectionId, s.viewerId, surface);
  },

  completeTrip: (tripId) =>
    set((s) => {
      const trip = s.trips.find((t) => t.id === tripId && t.userId === s.viewerId);
      if (!trip || trip.completedOn) return {};
      const completedOn = new Date().toISOString();
      if (backendEnabled) backend.syncCompleteTrip(tripId, completedOn);
      return {
        trips: s.trips.map((t) => (t.id === tripId ? { ...t, completedOn } : t)),
      };
    }),

  reflections: [...seedReflections],
  citationCounts: {},
  startReflection: (tripId) => {
    const s = get();
    const trip = s.trips.find((t) => t.id === tripId && t.userId === s.viewerId);
    if (!trip) return null;
    const existing = s.reflections.find(
      (r) => r.tripId === tripId && r.userId === s.viewerId
    );
    if (existing) return existing.id;
    const now = new Date().toISOString();
    const reflection: TripReflection = {
      id: backendEnabled ? crypto.randomUUID() : `refl-${tripId}-${s.viewerId}`,
      tripId,
      userId: s.viewerId,
      visibility: "friends",
      status: "draft",
      answers: [],
      createdAt: now,
      updatedAt: now,
    };
    if (backendEnabled) backend.syncSaveReflection(reflection);
    set({ reflections: [...s.reflections, reflection] });
    return reflection.id;
  },
  saveReflectionAnswer: (reflectionId, answer) =>
    set((s) => {
      if (!answer.text.trim() && !answer.scale) return {};
      const reflections = s.reflections.map((r) => {
        if (r.id !== reflectionId || r.userId !== s.viewerId) return r;
        const next: TripReflection = {
          ...r,
          answers: [
            ...r.answers.filter((a) => a.questionId !== answer.questionId),
            answer,
          ],
          updatedAt: new Date().toISOString(),
        };
        if (backendEnabled) backend.syncSaveReflection(next);
        return next;
      });
      return { reflections };
    }),
  removeReflectionAnswer: (reflectionId, questionId) =>
    set((s) => {
      const reflections = s.reflections.map((r) => {
        if (r.id !== reflectionId || r.userId !== s.viewerId) return r;
        const next: TripReflection = {
          ...r,
          answers: r.answers.filter((a) => a.questionId !== questionId),
          updatedAt: new Date().toISOString(),
        };
        if (backendEnabled) backend.syncSaveReflection(next);
        return next;
      });
      return { reflections };
    }),
  setReflectionVisibility: (reflectionId, v) =>
    set((s) => {
      const reflections = s.reflections.map((r) => {
        if (r.id !== reflectionId || r.userId !== s.viewerId) return r;
        const next: TripReflection = { ...r, visibility: v, updatedAt: new Date().toISOString() };
        if (backendEnabled) backend.syncSaveReflection(next);
        return next;
      });
      return { reflections };
    }),
  completeReflection: (reflectionId) =>
    set((s) => {
      const reflections = s.reflections.map((r) => {
        if (r.id !== reflectionId || r.userId !== s.viewerId) return r;
        const next: TripReflection = {
          ...r,
          status: "complete" as const,
          updatedAt: new Date().toISOString(),
        };
        if (backendEnabled) backend.syncSaveReflection(next);
        return next;
      });
      return { reflections };
    }),
  reopenReflection: (reflectionId) =>
    set((s) => {
      const reflections = s.reflections.map((r) => {
        if (r.id !== reflectionId || r.userId !== s.viewerId) return r;
        const next: TripReflection = {
          ...r,
          status: "draft" as const,
          updatedAt: new Date().toISOString(),
        };
        if (backendEnabled) backend.syncSaveReflection(next);
        return next;
      });
      return { reflections };
    }),
  deleteReflection: (reflectionId) =>
    set((s) => {
      if (!s.reflections.some((r) => r.id === reflectionId && r.userId === s.viewerId)) return {};
      if (backendEnabled) backend.syncDeleteReflection(reflectionId);
      return {
        reflections: s.reflections.filter(
          (r) => !(r.id === reflectionId && r.userId === s.viewerId)
        ),
      };
    }),

  cancelTripDraft: () => set({ tripDraft: null }),
  setTripDraftTitle: (t) =>
    set((s) => (s.tripDraft ? { tripDraft: { ...s.tripDraft, title: t } } : {})),
  setTripDraftVisibility: (v) =>
    set((s) => (s.tripDraft ? { tripDraft: { ...s.tripDraft, visibility: v } } : {})),
  addTripStop: (stop) =>
    set((s) => {
      if (!s.tripDraft) return {};
      const id = backendEnabled
        ? crypto.randomUUID()
        : `stop-${s.tripDraft.stops.length + 1}-${s.tripDraft.stops.length}`;
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
    const id = backendEnabled
      ? crypto.randomUUID()
      : `trip-${s.trips.length + 1}-${Math.abs(s.trips.length * 7 + 13)}`;
    const trip: Trip = {
      id,
      userId: s.viewerId,
      title: s.tripDraft.title.trim() || "Untitled trip",
      visibility: s.tripDraft.visibility,
      stops: s.tripDraft.stops,
      createdAt: new Date().toISOString(),
    };
    if (backendEnabled) backend.syncSaveTrip(trip);
    set({
      trips: [...s.trips, trip],
      tripDraft: null,
      shownTripIds: new Set([...s.shownTripIds, id]),
    });
    return trip;
  },

  selectedPinId: null,
  selectPin: (id) => set({ selectedPinId: id, addDraft: null, selectedOverlay: null, searchedPlace: null }),

  addDraft: null,
  startAddPin: (d) => set({ addDraft: d, selectedPinId: null }),
  cancelAddPin: () => set({ addDraft: null }),

  flyTo: null,
  requestFlyTo: (lng, lat, zoom, opts) =>
    set({ flyTo: { lng, lat, zoom, flat: opts?.flat, nonce: ++flyNonce } }),
  fitBoundsTo: null,
  requestFitBounds: (b) => set({ fitBoundsTo: { ...b, nonce: ++flyNonce } }),

  recapFlightReq: 0,
  requestRecapFlight: () => set((s) => ({ recapFlightReq: s.recapFlightReq + 1 })),
  flightRecording: false,
  setFlightRecording: (b) => set({ flightRecording: b }),
  flightProgress: null,
  setFlightProgress: (p) => set({ flightProgress: p }),

  viewBounds: null,
  setViewBounds: (b) => set({ viewBounds: b }),

  addPin: (input) => {
    const id = backendEnabled ? crypto.randomUUID() : `pin-${++pinCounter}`;
    const pin: Pin = {
      id,
      userId: get().viewerId,
      lng: input.lng,
      lat: input.lat,
      placeName: input.placeName,
      countryCode: input.countryCode,
      region: input.region,
      title: input.title,
      note: input.note,
      visibility: input.visibility,
      startedOn: input.dates?.[0],
      endedOn: input.dates?.[1],
      media: input.media.map((m, i) => ({
        id: backendEnabled ? crypto.randomUUID() : `${id}-m${i + 1}`,
        kind: m.kind,
        url: m.url,
      })),
      rating: input.rating,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    if (backendEnabled) backend.syncAddPin(pin);
    set((s) => ({ pins: [...s.pins, pin], addDraft: null, selectedPinId: id }));
    return pin;
  },

  updatePin: (pinId, patch) =>
    set((s) => {
      const pins = s.pins.map((p) => {
        if (p.id !== pinId || p.userId !== s.viewerId) return p;
        const next = { ...p, ...patch };
        if (backendEnabled) {
          backend.syncUpdatePin(next);
          // Media lives in its own table — replace it only when it changed.
          if (patch.media !== undefined) backend.syncReplacePinMedia(pinId, next.media);
        }
        return next;
      });
      return { pins };
    }),

  deletePin: (pinId) =>
    set((s) => {
      if (!s.pins.some((p) => p.id === pinId && p.userId === s.viewerId)) return {};
      if (backendEnabled) backend.syncDeletePin(pinId);
      return {
        pins: s.pins.filter((p) => p.id !== pinId),
        topPlaces: s.topPlaces.filter((t) => t.pinId !== pinId),
        selectedPinId: s.selectedPinId === pinId ? null : s.selectedPinId,
      };
    }),

  ratePin: (pinId, rating) =>
    set((s) => {
      if (!s.pins.some((p) => p.id === pinId && p.userId === s.viewerId)) return {};
      if (backendEnabled) backend.syncRatePin(pinId, rating);
      return {
        pins: s.pins.map((p) =>
          p.id === pinId && p.userId === s.viewerId
            ? { ...p, rating: rating ?? undefined }
            : p
        ),
      };
    }),

  sendFriendRequest: (userId) =>
    set((s) => {
      if (userId === s.viewerId) return {};
      const edge = s.friendships.find(
        (f) =>
          (f.userA === s.viewerId && f.userB === userId) ||
          (f.userA === userId && f.userB === s.viewerId)
      );
      // Crossed requests: they already asked us. Sending ours means both
      // sides want in — accept the standing request instead of stacking a
      // second one.
      if (edge?.status === "pending" && edge.requestedBy === userId) {
        if (backendEnabled) backend.syncRespondFriendRequest(s.viewerId, userId, true);
        return { friendships: respondLocal(s.friendships, s.viewerId, userId, true) };
      }
      if (edge) return {};
      if (backendEnabled) backend.syncSendFriendRequest(s.viewerId, userId);
      return {
        friendships: [
          ...s.friendships,
          { userA: s.viewerId, userB: userId, status: "pending" as const, requestedBy: s.viewerId },
        ],
      };
    }),

  respondFriendRequest: (userId, accept) =>
    set((s) => {
      if (backendEnabled) backend.syncRespondFriendRequest(s.viewerId, userId, accept);
      return { friendships: respondLocal(s.friendships, s.viewerId, userId, accept) };
    }),

  cancelFriendRequest: (userId) =>
    set((s) => {
      const match = s.friendships.some(
        (f) =>
          f.status === "pending" &&
          f.requestedBy === s.viewerId &&
          ((f.userA === s.viewerId && f.userB === userId) ||
            (f.userA === userId && f.userB === s.viewerId))
      );
      if (!match) return {};
      if (backendEnabled) backend.syncRespondFriendRequest(s.viewerId, userId, false);
      return { friendships: respondLocal(s.friendships, s.viewerId, userId, false) };
    }),

  setMySocials: (socials) =>
    set((s) => {
      if (backendEnabled) backend.syncSocials(s.viewerId, socials);
      else {
        try {
          window.localStorage.setItem("wp-socials", JSON.stringify(socials));
        } catch {
          /* private mode */
        }
      }
      return {
        users: s.users.map((u) => (u.id === s.viewerId ? { ...u, socials } : u)),
      };
    }),

  setMyAvatar: (dataUrl) => {
    const viewerId = get().viewerId;
    // Optimistic: show the new photo immediately everywhere.
    set((s) => ({
      users: s.users.map((u) => (u.id === viewerId ? { ...u, avatarUrl: dataUrl } : u)),
    }));
    if (backendEnabled) {
      // Upload to Storage, then swap in the durable public URL.
      void backend.uploadAvatar(viewerId, dataUrl).then((url) => {
        if (url)
          set((s) => ({
            users: s.users.map((u) => (u.id === viewerId ? { ...u, avatarUrl: url } : u)),
          }));
      });
    } else {
      try {
        window.localStorage.setItem("wp-avatar", dataUrl);
      } catch {
        /* quota/private mode — keep it for this session anyway */
      }
    }
  },

  setMyProfile: (p) =>
    set((s) => {
      if (backendEnabled) backend.syncProfile(s.viewerId, p);
      else {
        try {
          window.localStorage.setItem("wp-profile", JSON.stringify(p));
        } catch {
          /* private mode — keep it for this session anyway */
        }
      }
      return {
        users: s.users.map((u) =>
          u.id === s.viewerId
            ? { ...u, displayName: p.displayName, bio: p.bio, homeCity: p.homeCity }
            : u
        ),
      };
    }),

  notifications: [...seedNotifications],
  markNotificationRead: (id) =>
    set((s) => {
      const target = s.notifications.find((n) => n.id === id);
      if (!target || target.read) return {};
      if (backendEnabled) backend.syncMarkNotificationRead(id);
      return {
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      };
    }),
  markNotificationsRead: () => {
    if (backendEnabled) backend.syncMarkNotificationsRead(get().viewerId);
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  },

  creatorApplied: false,
  applyCreator: (data) => {
    if (backendEnabled) backend.syncApplyCreator(get().viewerId, data.activities, data.link);
    try {
      window.localStorage.setItem("wp-creator-app", JSON.stringify(data));
    } catch {
      /* private mode */
    }
    set({ creatorApplied: true });
  },
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
