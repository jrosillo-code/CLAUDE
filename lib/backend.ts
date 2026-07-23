"use client";

// Supabase data layer: row ↔ app-type mapping and every mutation the store
// write-through needs. All functions assume `supabase` is non-null — callers
// gate on `backendEnabled`. Errors are logged, never thrown into the UI; the
// optimistic local state stands and the next full load reconciles.

import { supabase } from "./supabase";
import type {
  ActivitySlug,
  Friendship,
  Pin,
  Trip,
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
  trip_stops: { id: string; lng: number | null; lat: number | null; place_name: string | null; sort_order: number }[];
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
  likeCounts: Record<string, number>;
  likedPinIds: Set<string>;
  savedPinIds: Set<string>;
  follows: Set<string>;
}

/** Everything the store needs, in one parallel fetch. RLS scopes all of it. */
export async function loadWorld(viewerId: string): Promise<World | null> {
  const sb = supabase!;
  try {
    const [usersQ, pinsQ, friendsQ, tripsQ, likesQ, savesQ, followsQ] = await Promise.all([
      sb.from("users").select("*"),
      sb
        .from("pins")
        .select("*, pin_photos(*), pin_likes(count)")
        .order("created_at", { ascending: true }),
      sb.from("friendships").select("*"),
      sb.from("trips").select("*, trip_stops(*)"),
      sb.from("pin_likes").select("pin_id").eq("user_id", viewerId),
      sb.from("pin_saves").select("pin_id").eq("user_id", viewerId),
      sb.from("follows").select("creator_id").eq("follower_id", viewerId),
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
        stops: (t.trip_stops ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((s): TripStop => ({ id: s.id, lng: s.lng ?? 0, lat: s.lat ?? 0, placeName: s.place_name ?? "" })),
      })),
      likeCounts,
      likedPinIds: new Set((likesQ.data ?? []).map((r) => r.pin_id as string)),
      savedPinIds: new Set((savesQ.data ?? []).map((r) => r.pin_id as string)),
      follows: new Set((followsQ.data ?? []).map((r) => r.creator_id as string)),
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
      title: pin.title,
      note: pin.note,
      started_on: pin.startedOn ?? null,
      ended_on: pin.endedOn ?? null,
      visibility: pin.visibility,
      rating: pin.rating ?? null,
      activities: pin.activities ?? [],
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

export function syncLike(pinId: string, userId: string, liked: boolean): void {
  const sb = supabase!;
  void (liked
    ? sb.from("pin_likes").insert({ pin_id: pinId, user_id: userId })
    : sb.from("pin_likes").delete().eq("pin_id", pinId).eq("user_id", userId)
  ).then(({ error }) => error && log("like")(error));
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
  void supabase!
    .from("friendships")
    .insert({ ...pair(viewerId, userId), status: "pending", requested_by: viewerId })
    .then(({ error }) => error && log("sendFriendRequest")(error));
}

export function syncRespondFriendRequest(viewerId: string, userId: string, accept: boolean): void {
  const sb = supabase!;
  const p = pair(viewerId, userId);
  void (accept
    ? sb.from("friendships").update({ status: "accepted" }).match(p)
    : sb.from("friendships").delete().match(p)
  ).then(({ error }) => error && log("respondFriendRequest")(error));
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

export function syncDeleteTrip(tripId: string): void {
  void supabase!
    .from("trips")
    .delete()
    .eq("id", tripId)
    .then(({ error }) => error && log("deleteTrip")(error));
}

export function syncSocials(userId: string, socials: UserSocials): void {
  void supabase!
    .from("users")
    .update({ socials })
    .eq("id", userId)
    .then(({ error }) => error && log("socials")(error));
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
