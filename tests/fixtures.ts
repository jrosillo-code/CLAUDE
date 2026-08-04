import type {
  Friendship,
  Pin,
  TopPlace,
  Trip,
  TripReflection,
  User,
} from "../lib/types";

// Small synthetic world for deterministic tests: a viewer, one friend, one
// stranger. The friend finished a Portugal trip and left a debrief.

export const VIEWER = "u-viewer";
export const FRIEND = "u-friend";
export const STRANGER = "u-stranger";

const user = (id: string, name: string): User => ({
  id,
  handle: id.replace("u-", ""),
  displayName: name,
  avatarUrl: "",
  bio: "",
  homeCity: "",
  color: "#000",
  defaultPinVisibility: "friends",
});

export const users: User[] = [
  user(VIEWER, "Vera Viewer"),
  user(FRIEND, "Frida Friend"),
  user(STRANGER, "Sten Stranger"),
];

export const friendships: Friendship[] = [
  { userA: VIEWER, userB: FRIEND, status: "accepted", requestedBy: VIEWER },
];

const pin = (
  id: string,
  userId: string,
  place: string,
  cc: string,
  lat: number,
  lng: number,
  rating?: number,
  note = ""
): Pin => ({
  id,
  userId,
  lat,
  lng,
  placeName: place,
  countryCode: cc,
  title: place,
  note,
  visibility: "friends",
  media: [],
  rating,
  createdAt: "2026-01-01T00:00:00.000Z",
});

// Lisbon area geography (rough): Lisbon, Sintra ~25km, Ericeira ~40km,
// Peniche ~80km, Porto ~280km (outside the default 150km radius).
export const pins: Pin[] = [
  pin("p-viewer-lisbon", VIEWER, "Lisbon", "PT", 38.7223, -9.1393, 8),
  pin("p-friend-sintra", FRIEND, "Sintra", "PT", 38.7979, -9.3902, 5, "Palaces in the fog."),
  pin("p-friend-ericeira", FRIEND, "Ericeira", "PT", 38.9636, -9.4175, 8, "Clean lines."),
  pin("p-friend-peniche", FRIEND, "Peniche", "PT", 39.3558, -9.3812, 8, "Crowded but fun."),
  pin("p-friend-tokyo", FRIEND, "Tokyo", "JP", 35.6762, 139.6503, 9, "Neon everything."),
  pin("p-stranger-obidos", STRANGER, "Óbidos", "PT", 39.3606, -9.1575, 10, "Walled town."),
];

export const topPlaces: TopPlace[] = [
  { userId: FRIEND, rank: 1, pinId: "p-friend-tokyo", blurb: "The one that rewired me." },
];

export const trips: Trip[] = [
  {
    id: "t-friend-pt",
    userId: FRIEND,
    title: "Silver Coast run",
    visibility: "friends",
    createdAt: "2026-02-01T00:00:00.000Z",
    completedOn: "2026-02-20T00:00:00.000Z",
    stops: [
      { id: "s1", lat: 38.9636, lng: -9.4175, placeName: "Ericeira" },
      { id: "s2", lat: 39.3558, lng: -9.3812, placeName: "Peniche" },
    ],
  },
];

export const reflections: TripReflection[] = [
  {
    id: "r-friend-pt",
    tripId: "t-friend-pt",
    userId: FRIEND,
    visibility: "friends",
    status: "complete",
    createdAt: "2026-02-21T00:00:00.000Z",
    updatedAt: "2026-02-21T00:00:00.000Z",
    answers: [
      {
        questionId: "dont_miss",
        prompt: "What would you tell a friend not to miss?",
        text: "The sea mist over Sintra at dawn — skip the palace queue, walk the Moorish wall.",
        pinId: "p-friend-sintra",
        source: "text",
      },
      {
        questionId: "skip",
        prompt: "What would you skip next time?",
        text: "Peniche in August. Same waves, triple the crowd.",
        pinId: "p-friend-peniche",
        source: "text",
      },
      {
        questionId: "return",
        prompt: "Would you go back?",
        text: "",
        pinId: null,
        scale: "yes",
        source: "text",
      },
    ],
  },
];

export const likeCounts: Record<string, number> = {};
export const follows = new Set<string>();
