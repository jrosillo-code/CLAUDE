"use client";

// The world load (everything the store needs, one parallel fetch, RLS
// scoped), the profile bootstrap, and the realtime subscription.

import type { RealtimeChannel } from "@supabase/supabase-js";
import { debugLoggingEnabled } from "../env";
import { sb, log, withTimeout, LOAD_TIMEOUT_MS } from "./core";
import { toUser, toPin, toReflection, signPinMedia, hash, FALLBACK_COLORS, type UserRow, type PinRow, type FriendshipRow, type TripRow, type ReflectionRow, type ScoutNoteRow, type FieldReportRow } from "./rows";
import type { AppNotification, FieldReport, Friendship, Pin, ScoutNote, Trip, TripReflection, TripStop, User } from "../types";

// ── world load ─────────────────────────────────────────────────────────────

export interface World {
  users: User[];
  pins: Pin[];
  friendships: Friendship[];
  trips: Trip[];
  reflections: TripReflection[];
  scoutNotes: ScoutNote[];
  fieldReports: FieldReport[];
  likeCounts: Record<string, number>;
  likedPinIds: Set<string>;
  savedPinIds: Set<string>;
  follows: Set<string>;
  notifications: AppNotification[];
  topPlaces: { userId: string; rank: number; pinId: string; blurb: string }[];
  /** People this viewer has blocked (the database already hides their pins). */
  blockedIds: Set<string>;
}

/** Everything the store needs, in one parallel fetch. RLS scopes all of it. */
export async function loadWorld(viewerId: string): Promise<World | null> {
  return withTimeout(loadWorldInner(viewerId), LOAD_TIMEOUT_MS, null, "loadWorld");
}

async function loadWorldInner(viewerId: string): Promise<World | null> {
  const sbc = sb();
  try {
    // allSettled, not all: one table that errors — an RLS policy that is too
    // strict, a migration not yet applied — should cost you that table, not
    // the entire map. `all` also rejects on the first failure and, worse, has
    // been seen never to settle at all when the failure is network-level.
    const settle = <T>(r: PromiseSettledResult<T>, fallbackName: string): T =>
      r.status === "fulfilled"
        ? r.value
        : (log(`loadWorld:${fallbackName}`)(r.reason), { data: null, error: r.reason } as T);
    const [usersR, pinsR, friendsR, tripsR, reflR, likesR, savesR, followsR, notifR, topR, scoutR, reportR, blocksR] = await Promise.allSettled([
      sbc.from("users").select("*"),
      sbc
        .from("pins")
        .select("*, pin_photos(*), pin_likes(count)")
        .order("created_at", { ascending: true }),
      sbc.from("friendships").select("*"),
      sbc.from("trips").select("*, trip_stops(*)"),
      sbc.from("trip_reflections").select("*, reflection_answers(*)"),
      sbc.from("pin_likes").select("pin_id").eq("user_id", viewerId),
      sbc.from("pin_saves").select("pin_id").eq("user_id", viewerId),
      sbc.from("follows").select("creator_id").eq("follower_id", viewerId),
      sbc
        .from("notifications")
        .select("*")
        .eq("user_id", viewerId)
        .order("created_at", { ascending: false })
        .limit(50),
      sbc.from("top_places").select("*"),
      sbc.from("scout_notes").select("*"),
      sbc.from("field_reports").select("*").order("flown_on", { ascending: false }).limit(500),
      sbc.from("blocks").select("blocked_id").eq("blocker_id", viewerId),
    ]);
    const usersQ = settle(usersR, "users");
    const pinsQ = settle(pinsR, "pins");
    const friendsQ = settle(friendsR, "friendships");
    const tripsQ = settle(tripsR, "trips");
    const reflQ = settle(reflR, "trip_reflections");
    const likesQ = settle(likesR, "pin_likes");
    const savesQ = settle(savesR, "pin_saves");
    const followsQ = settle(followsR, "follows");
    const notifQ = settle(notifR, "notifications");
    const topQ = settle(topR, "top_places");
    const scoutQ = settle(scoutR, "scout_notes");
    const reportQ = settle(reportR, "field_reports");
    // Older projects (before 0023) have no blocks table: nobody is blocked.
    const blocksQ = blocksR.status === "fulfilled" ? blocksR.value : { data: null };

    // Only the identity of the world is non-negotiable. If `users` and `pins`
    // both failed there is nothing worth rendering and the caller should fall
    // back; anything else missing just renders as empty, which is honest and
    // still leaves a usable app.
    if (usersQ.error && pinsQ.error) throw usersQ.error;

    const pins = ((pinsQ.data ?? []) as unknown as PinRow[]).map(toPin);
    await withTimeout(signPinMedia(pins), 8_000, undefined, "signPinMedia");
    const likeCounts: Record<string, number> = {};
    for (const r of (pinsQ.data ?? []) as unknown as PinRow[]) {
      likeCounts[r.id] = r.pin_likes?.[0]?.count ?? 0;
    }
    return {
      users: ((usersQ.data ?? []) as unknown as UserRow[]).map(toUser),
      pins,
      friendships: ((friendsQ.data ?? []) as unknown as FriendshipRow[]).map((f) => ({
        userA: f.user_a,
        userB: f.user_b,
        status: f.status,
        requestedBy: f.requested_by,
      })),
      trips: ((tripsQ.data ?? []) as unknown as TripRow[]).map((t) => ({
        id: t.id,
        userId: t.user_id,
        title: t.title,
        visibility: t.visibility,
        createdAt: t.created_at ?? new Date().toISOString(),
        completedOn: t.completed_on ?? undefined,
        stops: (t.trip_stops ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s): TripStop => ({ id: s.id, lng: s.lng ?? 0, lat: s.lat ?? 0, placeName: s.place_name ?? "" })),
      })),
      reflections: ((reflQ.data ?? []) as unknown as ReflectionRow[]).map(toReflection),
      scoutNotes: ((scoutQ.data ?? []) as unknown as ScoutNoteRow[]).map((n) => ({
        pinId: n.pin_id,
        bearingDeg: n.bearing_deg ?? undefined,
        focalMm: n.focal_mm ?? undefined,
        camera: n.camera || undefined,
        drone: n.drone || undefined,
        timeOfDay: n.time_of_day ?? undefined,
        note: n.note ?? "",
      })),
      fieldReports: ((reportQ.data ?? []) as unknown as FieldReportRow[]).map((r) => ({
        id: r.id,
        userId: r.user_id,
        pinId: r.pin_id ?? undefined,
        countryCode: r.country_code,
        flownOn: r.flown_on,
        outcome: r.outcome,
        droneClass: r.drone_class ?? "",
        quote: r.quote,
        visibility: r.visibility,
        status: r.status ?? "complete",
        createdAt: r.created_at,
      })),
      likeCounts,
      blockedIds: new Set(((blocksQ.data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id)),
      likedPinIds: new Set((likesQ.data ?? []).map((r) => r.pin_id as string)),
      savedPinIds: new Set((savesQ.data ?? []).map((r) => r.pin_id as string)),
      follows: new Set((followsQ.data ?? []).map((r) => r.creator_id as string)),
      notifications: ((notifQ.data ?? []) as { id: string; type: AppNotification["type"]; actor_id: string; pin_id: string | null; read: boolean; created_at: string }[]).map(
        (n) => ({
          id: n.id,
          type: n.type,
          actorId: n.actor_id,
          pinId: n.pin_id ?? undefined,
          read: n.read,
          createdAt: n.created_at,
        })
      ),
      topPlaces: ((topQ.data ?? []) as { user_id: string; rank: number; pin_id: string; blurb: string | null }[]).map((t) => ({
        userId: t.user_id,
        rank: t.rank,
        pinId: t.pin_id,
        blurb: t.blurb ?? "",
      })),
    };
  } catch (e) {
    log("loadWorld")(e);
    return null;
  }
}

/** Make sure the signed-in auth user has a profile row; return it. */
export async function ensureProfile(userId: string, email: string | undefined): Promise<User | null> {
  const sbc = sb();
  try {
    const existing = await sbc.from("users").select("*").eq("id", userId).maybeSingle();
    if (existing.data) return toUser(existing.data as unknown as UserRow);
    // The DB trigger normally creates this; fall back to a client-side insert.
    const base = (email?.split("@")[0] ?? "traveler").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "traveler";
    const handle = `${base}${Math.floor(Math.random() * 900 + 100)}`;
    const insert = await sbc
      .from("users")
      .insert({ id: userId, handle, display_name: base, color: FALLBACK_COLORS[Math.abs(hash(userId)) % FALLBACK_COLORS.length] })
      .select("*")
      .single();
    if (insert.error) throw insert.error;
    return toUser(insert.data as unknown as UserRow);
  } catch (e) {
    log("ensureProfile")(e);
    return null;
  }
}


export function subscribeRealtime(viewerId: string, onWorldChange: () => void): () => void {
  const sbc = sb();
  // Order matters: realtime binds each postgres_changes listener with the
  // claims the socket holds AT SUBSCRIBE TIME. Joining as anon and calling
  // setAuth afterwards upgrades the socket but not the already-bound
  // listeners — RLS then filters the auth.uid()-scoped tables
  // (notifications, friendships) to silence. So: token first, then join.
  let ch: RealtimeChannel | null = null;
  let cancelled = false;
  void sbc.auth.getSession().then(({ data }) => {
    if (cancelled) return;
    const token = data.session?.access_token;
    if (token) sbc.realtime.setAuth(token);
    const tap = (label: string) => (payload: unknown) => {
      if (debugLoggingEnabled)
        console.info(`[waypoint] realtime event: ${label}`, payload && (payload as { eventType?: string }).eventType);
      onWorldChange();
    };
    // Reflections ride the same coarse-but-correct pattern as everything
    // else: the payload is never rendered — any event triggers a debounced
    // world reload AS THE VIEWER, so restrictions apply on arrival exactly
    // like on a fresh load. Supabase filters events per-subscriber through
    // RLS, so a draft or a stranger's private debrief never even emits to
    // us; and because the reload recomputes every trust surface from
    // scratch, tightened visibility / unfriending / deletions REMOVE
    // evidence as promptly as additions appear. The debounce (700 ms in
    // store.ts) collapses event bursts into one fetch — no duplicate rows,
    // and analytics stay deduped by trackOnce independent of reloads.
    ch = sbc
      .channel(`wp-live-${viewerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${viewerId}` },
        tap("notifications")
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, tap("friendships"))
      .on("postgres_changes", { event: "*", schema: "public", table: "pins" }, tap("pins"))
      .on("postgres_changes", { event: "*", schema: "public", table: "pin_likes" }, tap("pin_likes"))
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, tap("trips"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_reflections" },
        tap("trip_reflections")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reflection_answers" },
        tap("reflection_answers")
      )
      .subscribe((status: string, err?: Error) => {
        // First thing to check when "realtime doesn't work" — SUBSCRIBED
        // means the channel joined; CHANNEL_ERROR/TIMED_OUT points at server
        // config (publication, realtime availability) rather than this client.
        if (debugLoggingEnabled)
          console.info(`[waypoint] realtime channel: ${status}${err ? ` — ${err.message}` : ""}`);
      });
  });
  return () => {
    cancelled = true;
    if (ch) void sbc.removeChannel(ch);
  };
}
