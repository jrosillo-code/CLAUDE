// Domain types for Waypoint. These mirror the v1 data model in the build plan
// (users, friendships, pins, pin_photos, top_places) so that the in-memory demo
// store and a future Supabase/PostGIS implementation share one shape.

export type Visibility = "public" | "friends" | "private";

export type FriendshipStatus = "pending" | "accepted";

/** Linked social accounts, shown as small icons on the profile. */
export interface UserSocials {
  instagram?: string;
  tiktok?: string;
  snapchat?: string;
  youtube?: string;
}

export interface User {
  id: string;
  handle: string; // unique, no @
  displayName: string;
  avatarUrl: string;
  bio: string;
  homeCity: string;
  /** Stable per-friend color used across the map + rails. */
  color: string;
  defaultPinVisibility: Visibility;
  isCreator?: boolean;
  /** Creator-only: public follower count and activity verticals (surf, mtb…). */
  followerCount?: number;
  activities?: ActivitySlug[];
  socials?: UserSocials;
}

export type ActivitySlug =
  | "surf"
  | "mtb"
  | "ski"
  | "climb"
  | "dive"
  | "run"
  | "soccer"
  | "basketball"
  | "photography";

export const ACTIVITY_LABELS: Record<ActivitySlug, string> = {
  surf: "Surf",
  mtb: "MTB",
  ski: "Ski",
  climb: "Climb",
  dive: "Dive",
  run: "Run",
  soccer: "Soccer",
  basketball: "Basketball",
  photography: "Photography",
};

export type MediaKind = "photo" | "video";

export interface PinMedia {
  id: string;
  kind: MediaKind;
  url: string;
  width?: number;
  height?: number;
}

export interface Pin {
  id: string;
  userId: string;
  lng: number;
  lat: number;
  placeName: string;
  countryCode: string;
  /** First-level admin area (state/province/region), when known. */
  region?: string;
  title: string;
  note: string;
  startedOn?: string; // ISO date
  endedOn?: string;
  visibility: Visibility;
  /** Photos and videos, in display order. */
  media: PinMedia[];
  /** Activity verticals this pin belongs to (mostly creator pins). */
  activities?: ActivitySlug[];
  /** The owner's own score for the place, 1–10. Only the owner sets it. */
  rating?: number;
  createdAt: string;
}

export interface Friendship {
  userA: string;
  userB: string;
  status: FriendshipStatus;
  requestedBy: string;
}

/** A planned-route stop; trips connect their stops with a thread on the map. */
export interface TripStop {
  id: string;
  lng: number;
  lat: number;
  placeName: string;
}

export interface Trip {
  id: string;
  userId: string;
  title: string;
  /** Trips are never public — at most your friends can see them. */
  visibility: "friends" | "private";
  stops: TripStop[];
  createdAt: string;
}

export interface TopPlace {
  userId: string;
  rank: number; // 1..5
  pinId: string;
  blurb: string; // one-line "why"
}

/** An in-app notification: someone acted on your world. */
export interface AppNotification {
  id: string;
  type: "like" | "friend_request" | "friend_accept";
  actorId: string;
  pinId?: string;
  read: boolean;
  createdAt: string;
}

/** A pin joined with its owner — the shape most UI actually renders. */
export interface PinWithOwner extends Pin {
  owner: User;
}
