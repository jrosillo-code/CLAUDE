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
  /** Set when the owner marks the trip finished — unlocks the debrief. */
  completedOn?: string;
}

// ── Post-trip debrief (the 60-second interview) ─────────────────────────────

export type InterviewQuestionId =
  | "favorite" // What was your favorite place?
  | "dont_miss" // What would you tell a friend not to miss?
  | "skip" // What would you skip next time?
  | "surprise" // What surprised you?
  | "return"; // Would you go back?

/**
 * One answered question. The user's words are stored VERBATIM — they are
 * quoted as evidence in Ask-your-friends and Don't-miss, never paraphrased.
 */
export interface ReflectionAnswer {
  questionId: InterviewQuestionId;
  /** The question exactly as it was asked (survives future copy changes). */
  prompt: string;
  /** The user's own words, untouched. */
  text: string;
  /** Anchor: a specific pin, or null = the trip as a whole. */
  pinId: string | null;
  /** Structured extra for "would you return?" — filters without text-mining. */
  scale?: "yes" | "maybe" | "no";
  /** How the answer was captured. Voice transcription lands here later. */
  source: "text" | "voice";
}

/** A trip's debrief. `draft` = started, resumable; `complete` = submitted. */
export interface TripReflection {
  id: string;
  tripId: string;
  userId: string;
  /** Own visibility, independent of the trip's (a private trip can still
   *  yield public advice — and the reverse). */
  visibility: Visibility;
  status: "draft" | "complete";
  answers: ReflectionAnswer[];
  createdAt: string;
  updatedAt: string;
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

// ── Field brief: scout notes and field reports ──────────────────────────────

export type TimeOfDay = "dawn" | "golden_am" | "day" | "golden_pm" | "blue" | "night";

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  dawn: "Dawn",
  golden_am: "Golden hour (am)",
  day: "Day",
  golden_pm: "Golden hour (pm)",
  blue: "Blue hour",
  night: "Night",
};

/**
 * Photographic scouting details on a pin, one to one. Visibility is the
 * pin's: whoever may see the pin may see its scout note, nobody else.
 */
export interface ScoutNote {
  pinId: string;
  bearingDeg?: number;
  focalMm?: number;
  camera?: string;
  drone?: string;
  timeOfDay?: TimeOfDay;
  note: string;
}

export type ReportOutcome = "flew" | "refused" | "fined" | "did_not_try";

export const REPORT_OUTCOME_LABELS: Record<ReportOutcome, string> = {
  flew: "Flew",
  refused: "Refused",
  fined: "Fined",
  did_not_try: "Didn't try",
};

/**
 * A first-hand account of trying to fly in a country. The quote is stored
 * VERBATIM and shown attributed — the same contract as debrief answers.
 */
export interface FieldReport {
  id: string;
  userId: string;
  pinId?: string;
  countryCode: string;
  /** ISO date of the flight (or the attempt). */
  flownOn: string;
  outcome: ReportOutcome;
  droneClass: string;
  quote: string;
  visibility: Visibility;
  createdAt: string;
}
