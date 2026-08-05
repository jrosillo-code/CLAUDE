"use client";

// Supabase data layer: row ↔ app-type mapping and every mutation the store
// write-through needs. All functions assume `supabase` is non-null — callers
// gate on `backendEnabled`. Errors are logged, never thrown into the UI; the
// optimistic local state stands and the next full load reconciles.

import { supabase } from "./supabase";
import { debugLoggingEnabled } from "./env";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  ActivitySlug,
  AppNotification,
  Friendship,
  InterviewQuestionId,
  Pin,
  Trip,
  TripReflection,
  TripStop,
  User,
  UserSocials,
  Visibility,
} from "./types";

const log = (op: string) => (e: unknown) =>
  console.error(`[backend] ${op} failed:`, e);

// ── row shapes ─────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  home_city: string | null;
  color: string;
  default_pin_visibility: Visibility;
  is_creator: boolean;
  follower_count: number | null;
  activities: string[] | null;
  socials: UserSocials | null;
}

interface PinRow {
  id: string;
  user_id: string;
  lng: number | null;
  lat: number | null;
  place_name: string;
  country_code: string | null;
  region?: string | null;
  title: string;
  note: string | null;
  started_on: string | null;
  ended_on: string | null;
  visibility: Visibility;
  rating: number | null;
  activities: string[] | null;
  created_at: string;
  pin_photos: { id: string; storage_path: string; kind: "photo" | "video"; sort_order: number }[];
  pin_likes: { count: number }[];
}

interface FriendshipRow {
  user_a: string;
  user_b: string;
  status: "pending" | "accepted";
  requested_by: string;
}

interface TripRow {
  id: string;
  user_id: string;
  title: string;
  visibility: "friends" | "private";
  created_at: string | null;
  completed_on?: string | null;
  trip_stops: { id: string; lng: number | null; lat: number | null; place_name: string | null; sort_order: number }[];
}

interface ReflectionRow {
  id: string;
  trip_id: string;
  user_id: string;
  visibility: Visibility;
  status: "draft" | "complete";
  created_at: string;
  updated_at: string;
  reflection_answers: {
    question_id: InterviewQuestionId;
    prompt: string;
    text: string;
    pin_id: string | null;
    scale: "yes" | "maybe" | "no" | null;
    source: "text" | "voice";
  }[];
}

function toReflection(r: ReflectionRow): TripReflection {
  return {
    id: r.id,
    tripId: r.trip_id,
    userId: r.user_id,
    visibility: r.visibility,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    answers: (r.reflection_answers ?? []).map((a) => ({
      questionId: a.question_id,
      prompt: a.prompt,
      text: a.text,
      pinId: a.pin_id,
      scale: a.scale ?? undefined,
      source: a.source,
    })),
  };
}

// ── mappers ────────────────────────────────────────────────────────────────

const FALLBACK_COLORS = ["#c65d3b", "#2f6b6b", "#3b5bc6", "#4c8c3a", "#8a4fc6", "#d99a2b", "#b0574f"];

function toUser(r: UserRow): User {
  return {
    id: r.id,
    handle: r.handle,
    displayName: r.display_name,
    avatarUrl: r.avatar_url || `https://picsum.photos/seed/${r.handle}/200/200`,
    bio: r.bio ?? "",
    homeCity: r.home_city ?? "",
    color: r.color || FALLBACK_COLORS[Math.abs(hash(r.id)) % FALLBACK_COLORS.length],
    defaultPinVisibility: r.default_pin_visibility,
    isCreator: r.is_creator || undefined,
    followerCount: r.follower_count ?? undefined,
    activities: (r.activities ?? undefined) as ActivitySlug[] | undefined,
    socials: r.socials ?? undefined,
  };
}

function toPin(r: PinRow): Pin {
  return {
    id: r.id,
    userId: r.user_id,
    lng: r.lng ?? 0,
    lat: r.lat ?? 0,
    placeName: r.place_name,
    countryCode: r.country_code ?? "",
    region: r.region ?? undefined,
    title: r.title,
    note: r.note ?? "",
    startedOn: r.started_on ?? undefined,
    endedOn: r.ended_on ?? undefined,
    visibility: r.visibility,
    rating: r.rating ?? undefined,
    activities: (r.activities ?? undefined) as ActivitySlug[] | undefined,
    media: (r.pin_photos ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ id: m.id, kind: m.kind, url: m.storage_path })),
    createdAt: r.created_at,
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** friendships store the pair ordered (user_a < user_b). */
function pair(a: string, b: string): { user_a: string; user_b: string } {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

// ── world load ─────────────────────────────────────────────────────────────

export interface World {
  users: User[];
  pins: Pin[];
  friendships: Friendship[];
  trips: Trip[];
  reflections: TripReflection[];
  likeCounts: Record<string, number>;
  likedPinIds: Set<string>;
  savedPinIds: Set<string>;
  follows: Set<string>;
  notifications: AppNotification[];
  topPlaces: { userId: string; rank: number; pinId: string; blurb: string }[];
}

/** Everything the store needs, in one parallel fetch. RLS scopes all of it. */
export async function loadWorld(viewerId: string): Promise<World | null> {
  const sb = supabase!;
  try {
    const [usersQ, pinsQ, friendsQ, tripsQ, reflQ, likesQ, savesQ, followsQ, notifQ, topQ] = await Promise.all([
      sb.from("users").select("*"),
      sb
        .from("pins")
        .select("*, pin_photos(*), pin_likes(count)")
        .order("created_at", { ascending: true }),
      sb.from("friendships").select("*"),
      sb.from("trips").select("*, trip_stops(*)"),
      sb.from("trip_reflections").select("*, reflection_answers(*)"),
      sb.from("pin_likes").select("pin_id").eq("user_id", viewerId),
      sb.from("pin_saves").select("pin_id").eq("user_id", viewerId),
      sb.from("follows").select("creator_id").eq("follower_id", viewerId),
      sb
        .from("notifications")
        .select("*")
        .eq("user_id", viewerId)
        .order("created_at", { ascending: false })
        .limit(50),
      sb.from("top_places").select("*"),
    ]);
    const firstError =
      usersQ.error ?? pinsQ.error ?? friendsQ.error ?? tripsQ.error ?? likesQ.error ?? savesQ.error ?? followsQ.error;
    if (firstError) throw firstError;

    const pins = ((pinsQ.data ?? []) as unknown as PinRow[]).map(toPin);
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
      likeCounts,
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
  const sb = supabase!;
  try {
    const existing = await sb.from("users").select("*").eq("id", userId).maybeSingle();
    if (existing.data) return toUser(existing.data as unknown as UserRow);
    // The DB trigger normally creates this; fall back to a client-side insert.
    const base = (email?.split("@")[0] ?? "traveler").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "traveler";
    const handle = `${base}${Math.floor(Math.random() * 900 + 100)}`;
    const insert = await sb
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

// ── write-through mutations (fire and forget) ──────────────────────────────

/**
 * Live wire: whenever anything social changes server-side (a like lands, a
 * friend request arrives, someone drops a pin), poke the callback. The store
 * debounces and reloads the world — coarse but correct, and the payloads stay
 * RLS-scoped because the reload runs as the viewer.
 */
export function subscribeRealtime(viewerId: string, onWorldChange: () => void): () => void {
  if (!supabase) return () => {};
  const sb = supabase;
  // Order matters: realtime binds each postgres_changes listener with the
  // claims the socket holds AT SUBSCRIBE TIME. Joining as anon and calling
  // setAuth afterwards upgrades the socket but not the already-bound
  // listeners — RLS then filters the auth.uid()-scoped tables
  // (notifications, friendships) to silence. So: token first, then join.
  let ch: RealtimeChannel | null = null;
  let cancelled = false;
  void sb.auth.getSession().then(({ data }) => {
    if (cancelled) return;
    const token = data.session?.access_token;
    if (token) sb.realtime.setAuth(token);
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
    ch = sb
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
      .subscribe((status, err) => {
        // First thing to check when "realtime doesn't work" — SUBSCRIBED
        // means the channel joined; CHANNEL_ERROR/TIMED_OUT points at server
        // config (publication, realtime availability) rather than this client.
        if (debugLoggingEnabled)
          console.info(`[waypoint] realtime channel: ${status}${err ? ` — ${err.message}` : ""}`);
      });
  });
  return () => {
    cancelled = true;
    if (ch) void sb.removeChannel(ch);
  };
}

export function syncAddPin(pin: Pin): void {
  const sb = supabase!;
  void (async () => {
    const { error } = await sb.from("pins").insert({
      id: pin.id,
      user_id: pin.userId,
      lng: pin.lng,
      lat: pin.lat,
      place_name: pin.placeName,
      country_code: pin.countryCode || null,
      region: pin.region ?? null,
      title: pin.title,
      note: pin.note,
      started_on: pin.startedOn ?? null,
      ended_on: pin.endedOn ?? null,
      visibility: pin.visibility,
      rating: pin.rating ?? null,
      activities: pin.activities ?? [],
      created_at: pin.createdAt, // honors backdated imports
    });
    if (error) return log("addPin")(error);
    if (pin.media.length) {
      const { error: mediaErr } = await sb.from("pin_photos").insert(
        pin.media.map((m, i) => ({
          id: m.id,
          pin_id: pin.id,
          storage_path: m.url,
          kind: m.kind,
          sort_order: i,
        }))
      );
      if (mediaErr) log("addPin media")(mediaErr);
    }
  })();
}

export function syncUpdatePin(pin: Pin): void {
  void supabase!
    .from("pins")
    .update({
      title: pin.title,
      note: pin.note,
      visibility: pin.visibility,
      rating: pin.rating ?? null,
    })
    .eq("id", pin.id)
    .then(({ error }) => error && log("updatePin")(error));
}

/** Replace a pin's photos/videos wholesale (edit flow). */
export function syncReplacePinMedia(pinId: string, media: Pin["media"]): void {
  const sb = supabase!;
  void (async () => {
    await sb.from("pin_photos").delete().eq("pin_id", pinId);
    if (media.length) {
      const { error } = await sb.from("pin_photos").insert(
        media.map((m, i) => ({
          id: m.id,
          pin_id: pinId,
          storage_path: m.url,
          kind: m.kind,
          sort_order: i,
        }))
      );
      if (error) log("updatePin media")(error);
    }
  })();
}

export function syncDeletePin(pinId: string): void {
  void supabase!
    .from("pins")
    .delete()
    .eq("id", pinId)
    .then(({ error }) => error && log("deletePin")(error));
}

export function syncRatePin(pinId: string, rating: number | null): void {
  void supabase!
    .from("pins")
    .update({ rating })
    .eq("id", pinId)
    .then(({ error }) => error && log("ratePin")(error));
}

export function syncLike(pinId: string, userId: string, liked: boolean, pinOwnerId?: string): void {
  const sb = supabase!;
  void (liked
    ? sb.from("pin_likes").insert({ pin_id: pinId, user_id: userId })
    : sb.from("pin_likes").delete().eq("pin_id", pinId).eq("user_id", userId)
  ).then(({ error }) => error && log("like")(error));
  if (liked && pinOwnerId && pinOwnerId !== userId) {
    notify(pinOwnerId, userId, "like", pinId);
  }
}

/** Fire an in-app notification row for someone else. */
function notify(userId: string, actorId: string, type: "like" | "friend_request" | "friend_accept", pinId?: string): void {
  void supabase!
    .from("notifications")
    .insert({ user_id: userId, actor_id: actorId, type, pin_id: pinId ?? null })
    .then(({ error }) => error && log("notify")(error));
}

export function syncMarkNotificationRead(id: string): void {
  void supabase!
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .then(({ error }) => error && log("markNotificationRead")(error));
}

export function syncMarkNotificationsRead(userId: string): void {
  void supabase!
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false)
    .then(({ error }) => error && log("markNotificationsRead")(error));
}

export function syncSave(pinId: string, userId: string, saved: boolean): void {
  const sb = supabase!;
  void (saved
    ? sb.from("pin_saves").insert({ pin_id: pinId, user_id: userId })
    : sb.from("pin_saves").delete().eq("pin_id", pinId).eq("user_id", userId)
  ).then(({ error }) => error && log("save")(error));
}

export function syncFollow(creatorId: string, followerId: string, following: boolean): void {
  const sb = supabase!;
  void (following
    ? sb.from("follows").insert({ follower_id: followerId, creator_id: creatorId })
    : sb.from("follows").delete().eq("follower_id", followerId).eq("creator_id", creatorId)
  ).then(({ error }) => error && log("follow")(error));
}

export function syncSendFriendRequest(viewerId: string, userId: string): void {
  const sb = supabase!;
  const p = pair(viewerId, userId);
  void sb
    .from("friendships")
    .insert({ ...p, status: "pending", requested_by: viewerId })
    .then(({ error }) => {
      if (!error) {
        notify(userId, viewerId, "friend_request");
        return;
      }
      if (error.code === "23505") {
        // Requests crossed in the air: their row landed first. Both sides
        // want in — upgrade THEIR pending request to accepted (guards keep
        // this a no-op if the row is ours or already accepted).
        void sb
          .from("friendships")
          .update({ status: "accepted" })
          .match(p)
          .eq("status", "pending")
          .neq("requested_by", viewerId)
          .then(({ error: e2 }) => {
            if (e2) log("sendFriendRequest/crossed")(e2);
            else notify(userId, viewerId, "friend_accept");
          });
        return;
      }
      log("sendFriendRequest")(error);
    });
}

export function syncRespondFriendRequest(viewerId: string, userId: string, accept: boolean): void {
  const sb = supabase!;
  const p = pair(viewerId, userId);
  void (accept
    ? sb.from("friendships").update({ status: "accepted" }).match(p)
    : sb.from("friendships").delete().match(p)
  ).then(({ error }) => error && log("respondFriendRequest")(error));
  if (accept) notify(userId, viewerId, "friend_accept");
}

export function syncSaveTrip(trip: Trip): void {
  const sb = supabase!;
  void (async () => {
    const { error } = await sb.from("trips").upsert({
      id: trip.id,
      user_id: trip.userId,
      title: trip.title,
      visibility: trip.visibility,
    });
    if (error) return log("saveTrip")(error);
    await sb.from("trip_stops").delete().eq("trip_id", trip.id);
    const { error: stopsErr } = await sb.from("trip_stops").insert(
      trip.stops.map((s, i) => ({
        id: s.id,
        trip_id: trip.id,
        lng: s.lng,
        lat: s.lat,
        place_name: s.placeName,
        sort_order: i,
      }))
    );
    if (stopsErr) log("saveTrip stops")(stopsErr);
  })();
}

export function syncRenameTrip(tripId: string, title: string): void {
  void supabase!
    .from("trips")
    .update({ title })
    .eq("id", tripId)
    .then(({ error }) => error && log("renameTrip")(error));
}

export function syncDeleteTrip(tripId: string): void {
  void supabase!
    .from("trips")
    .delete()
    .eq("id", tripId)
    .then(({ error }) => error && log("deleteTrip")(error));
}

export function syncCompleteTrip(tripId: string, completedOn: string): void {
  void supabase!
    .from("trips")
    .update({ completed_on: completedOn })
    .eq("id", tripId)
    .then(({ error }) => error && log("completeTrip")(error));
}

/** Upsert a whole debrief — reflection row + its answers, wholesale (small set). */
export function syncSaveReflection(r: TripReflection): void {
  const sb = supabase!;
  void (async () => {
    const { error } = await sb.from("trip_reflections").upsert({
      id: r.id,
      trip_id: r.tripId,
      user_id: r.userId,
      visibility: r.visibility,
      status: r.status,
      updated_at: r.updatedAt,
    });
    if (error) return log("saveReflection")(error);
    await sb.from("reflection_answers").delete().eq("reflection_id", r.id);
    if (!r.answers.length) return;
    const { error: ansErr } = await sb.from("reflection_answers").insert(
      r.answers.map((a, i) => ({
        reflection_id: r.id,
        question_id: a.questionId,
        prompt: a.prompt,
        text: a.text,
        pin_id: a.pinId,
        scale: a.scale ?? null,
        source: a.source,
        sort_order: i,
      }))
    );
    if (ansErr) log("saveReflection answers")(ansErr);
  })();
}

/**
 * Record that a friend's debrief did work on one surface. Best-effort and
 * silent: the primary key dedupes repeat views, and a failure here must never
 * interrupt reading. Never called for your own words (the policy rejects it).
 */
export function syncRecordCitation(
  reflectionId: string,
  viewerId: string,
  surface: "ask" | "place" | "dontmiss" | "clone"
): void {
  void supabase!
    .from("reflection_citations")
    .upsert(
      { reflection_id: reflectionId, viewer_id: viewerId, surface },
      { onConflict: "reflection_id,viewer_id,surface", ignoreDuplicates: true }
    )
    .then(({ error }) => {
      // A rejected insert is expected when the debrief isn't visible to this
      // viewer; it is not worth surfacing.
      if (error && debugLoggingEnabled) log("recordCitation")(error);
    });
}

/** Counts for the viewer's OWN reflections. Never reveals who was reading. */
export async function loadCitationCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase!.rpc("reflection_citation_counts");
  if (error) {
    log("citationCounts")(error);
    return {};
  }
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { rid: string; citations: number }[]) {
    out[row.rid] = Number(row.citations);
  }
  return out;
}

export function syncDeleteReflection(reflectionId: string): void {
  void supabase!
    .from("trip_reflections")
    .delete()
    .eq("id", reflectionId)
    .then(({ error }) => error && log("deleteReflection")(error));
}

/** Replace the viewer's Top 5 rows wholesale (small set, simplest correct). */
export function syncTopPlaces(
  userId: string,
  entries: { rank: number; pinId: string; blurb: string }[]
): void {
  const sb = supabase!;
  void (async () => {
    const { error: delErr } = await sb.from("top_places").delete().eq("user_id", userId);
    if (delErr) return log("topPlaces clear")(delErr);
    if (!entries.length) return;
    const { error } = await sb.from("top_places").insert(
      entries.map((e) => ({ user_id: userId, rank: e.rank, pin_id: e.pinId, blurb: e.blurb }))
    );
    if (error) log("topPlaces insert")(error);
  })();
}

export function syncSocials(userId: string, socials: UserSocials): void {
  void supabase!
    .from("users")
    .update({ socials })
    .eq("id", userId)
    .then(({ error }) => error && log("socials")(error));
}

/** Signup: is this username still free? Fails open — the DB's unique
 *  constraint is the real gate; this just gives instant feedback. */
export async function checkHandleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await supabase!
    .from("users")
    .select("id")
    .eq("handle", handle)
    .limit(1);
  if (error) {
    log("handle check")(error);
    return true;
  }
  return !data?.length;
}

/** Claim the username picked at signup (the auto-profile trigger derived a
 *  placeholder from the email). Display name starts as the username too. */
export async function claimHandle(userId: string, handle: string): Promise<void> {
  const { error } = await supabase!
    .from("users")
    .update({ handle, display_name: handle })
    .eq("id", userId);
  if (error) log("handle claim")(error);
}

export function syncProfile(
  userId: string,
  p: { displayName: string; bio: string; homeCity: string }
): void {
  void supabase!
    .from("users")
    .update({ display_name: p.displayName, bio: p.bio, home_city: p.homeCity })
    .eq("id", userId)
    .then(({ error }) => error && log("profile")(error));
}

export function syncApplyCreator(userId: string, activities: ActivitySlug[], link: string): void {
  void supabase!
    .from("creator_applications")
    .upsert({ user_id: userId, activities, link })
    .then(({ error }) => error && log("applyCreator")(error));
}

/** Upload an avatar (dataURL) to Storage; returns the public URL. */
export async function uploadAvatar(userId: string, dataUrl: string): Promise<string | null> {
  const sb = supabase!;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${userId}/avatar.jpg`;
    const { error } = await sb.storage.from("avatars").upload(path, blob, {
      upsert: true,
      contentType: "image/jpeg",
    });
    if (error) throw error;
    const { data } = sb.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    const { error: rowErr } = await sb.from("users").update({ avatar_url: url }).eq("id", userId);
    if (rowErr) throw rowErr;
    return url;
  } catch (e) {
    log("uploadAvatar")(e);
    return null;
  }
}

/** Upload a pin photo/video file to Storage; returns its public URL. */
export async function uploadPinMedia(userId: string, file: File | Blob, ext: string): Promise<string | null> {
  const sb = supabase!;
  try {
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("pin-media").upload(path, file, { upsert: false });
    if (error) throw error;
    return sb.storage.from("pin-media").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    log("uploadPinMedia")(e);
    return null;
  }
}
