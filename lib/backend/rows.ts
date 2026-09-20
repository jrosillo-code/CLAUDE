"use client";

// Row shapes as PostgREST returns them, the mappers to app types, and the
// private-media helpers that turn stored paths into signed URLs.

import { sb, log } from "./core";
import type { ActivitySlug, FieldReport, Pin, ScoutNote, TripReflection, User, UserSocials, Visibility, InterviewQuestionId } from "../types";

// ── row shapes ─────────────────────────────────────────────────────────────

export interface UserRow {
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

export interface PinRow {
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
  here_now?: boolean | null;
  created_at: string;
  pin_photos: { id: string; storage_path: string; kind: "photo" | "video"; sort_order: number }[];
  pin_likes: { count: number }[];
}

export interface FriendshipRow {
  user_a: string;
  user_b: string;
  status: "pending" | "accepted";
  requested_by: string;
}

export interface TripRow {
  id: string;
  user_id: string;
  title: string;
  visibility: "friends" | "private";
  created_at: string | null;
  completed_on?: string | null;
  trip_stops: { id: string; lng: number | null; lat: number | null; place_name: string | null; sort_order: number }[];
}

export interface ReflectionRow {
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

export interface ScoutNoteRow {
  pin_id: string;
  user_id: string;
  bearing_deg: number | null;
  focal_mm: number | null;
  camera: string | null;
  drone: string | null;
  time_of_day: ScoutNote["timeOfDay"] | null;
  note: string | null;
}

export interface FieldReportRow {
  id: string;
  user_id: string;
  pin_id: string | null;
  country_code: string;
  flown_on: string;
  outcome: FieldReport["outcome"];
  drone_class: string | null;
  quote: string;
  visibility: Visibility;
  status?: "draft" | "complete" | null;
  created_at: string;
}

export function toReflection(r: ReflectionRow): TripReflection {
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

// ── media: private bucket, signed on read ──────────────────────────────────

const PUBLIC_PREFIX = /^.*\/storage\/v1\/object\/public\/pin-media\//;
/** Seven days: longer than any session, refreshed on every load anyway. */
export const SIGNED_TTL_S = 7 * 24 * 3600;

/** The object path behind a stored value: rows written before migration 0022
 *  hold the old public URL, rows after it hold the bare path. Anything else
 *  (seed photos, data URLs) is not ours to sign. */
export function storagePathOf(stored: string): string | null {
  if (!stored) return null;
  if (PUBLIC_PREFIX.test(stored)) return stored.replace(PUBLIC_PREFIX, "").split("?")[0];
  if (/^(https?:|data:|blob:)/.test(stored)) return null;
  return stored;
}

/** Replace every storage path in these pins with a signed URL, in one call
 *  per hundred objects. A path Storage refuses to sign (a photo whose pin is
 *  no longer visible) keeps the path, which simply fails to load. */
export async function signPinMedia(pins: Pin[]): Promise<void> {
  const sbc = sb();
  const paths = new Set<string>();
  for (const p of pins) for (const m of p.media) if (m.path) paths.add(m.path);
  if (!paths.size) return;
  const signed = new Map<string, string>();
  const all = [...paths];
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100);
    const { data, error } = await sbc.storage.from("pin-media").createSignedUrls(chunk, SIGNED_TTL_S);
    if (error) { log("signMedia")(error); continue; }
    for (const row of data ?? []) if (row.signedUrl && row.path) signed.set(row.path, row.signedUrl);
  }
  for (const p of pins) for (const m of p.media) {
    const u = m.path && signed.get(m.path);
    if (u) m.url = u;
  }
}

export const FALLBACK_COLORS = ["#c65d3b", "#2f6b6b", "#3b5bc6", "#4c8c3a", "#8a4fc6", "#d99a2b", "#b0574f"];

export function toUser(r: UserRow): User {
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

export function toPin(r: PinRow): Pin {
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
    hereNow: r.here_now ?? undefined,
    media: (r.pin_photos ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => {
        const path = storagePathOf(m.storage_path);
        return { id: m.id, kind: m.kind, url: m.storage_path, path: path ?? undefined };
      }),
    createdAt: r.created_at,
  };
}

export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** friendships store the pair ordered (user_a < user_b). */
export function pair(a: string, b: string): { user_a: string; user_b: string } {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

