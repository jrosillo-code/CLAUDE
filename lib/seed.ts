import type { Friendship, Pin, PinPhoto, TopPlace, User } from "./types";

// Deterministic demo photography. picsum serves real photographs from a stable
// seed, so the demo never shows a broken image. In production these become
// Supabase Storage signed URLs (thumbnails for markers, full for carousels).
export function photo(seed: string, w = 1200, h = 800): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

function photos(pinId: string, n: number): PinPhoto[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${pinId}-p${i + 1}`,
    url: photo(`${pinId}-${i + 1}`, 1200, 800),
    width: 1200,
    height: 800,
  }));
}

export const CURRENT_USER_ID = "u-you";

export const users: User[] = [
  {
    id: "u-you",
    handle: "you",
    displayName: "You",
    avatarUrl: photo("avatar-you", 200, 200),
    bio: "Chasing swell, singletrack, and the perfect pastel de nata. Based in Lisbon.",
    homeCity: "Lisbon, Portugal",
    color: "#c65d3b",
    defaultPinVisibility: "friends",
  },
  {
    id: "u-maria",
    handle: "mariacomposta",
    displayName: "Maria Costa",
    avatarUrl: photo("avatar-maria", 200, 200),
    bio: "Trail runner. I collect ridgelines and cheap noodle bars.",
    homeCity: "Barcelona, Spain",
    color: "#2f6b6b",
    defaultPinVisibility: "friends",
  },
  {
    id: "u-kenji",
    handle: "kenjipow",
    displayName: "Kenji Watanabe",
    avatarUrl: photo("avatar-kenji", 200, 200),
    bio: "Powder in winter, reef breaks in summer. Photos > words.",
    homeCity: "Tokyo, Japan",
    color: "#3b5bc6",
    defaultPinVisibility: "friends",
    isCreator: true,
  },
  {
    id: "u-amara",
    handle: "amarawild",
    displayName: "Amara Okoro",
    avatarUrl: photo("avatar-amara", 200, 200),
    bio: "Overland routes and long climbs. Slowly circling the globe.",
    homeCity: "Cape Town, South Africa",
    color: "#4c8c3a",
    defaultPinVisibility: "friends",
  },
  {
    id: "u-leo",
    handle: "leomontero",
    displayName: "Leo Montero",
    avatarUrl: photo("avatar-leo", 200, 200),
    bio: "Van, board, camera. Coastlines only.",
    homeCity: "Ericeira, Portugal",
    color: "#8a4fc6",
    defaultPinVisibility: "friends",
  },
];

type Seed = [
  userId: string,
  lng: number,
  lat: number,
  place: string,
  cc: string,
  title: string,
  note: string,
  nPhotos: number,
  visibility?: Pin["visibility"],
  dates?: [string, string]
];

// prettier-ignore
const rows: Seed[] = [
  // — You —
  ["u-you", -9.1393, 38.7223, "Lisbon", "PT", "Home base", "Miradouro sunsets and the 28 tram. Start every trip here.", 3, "friends", ["2025-01-04", "2025-01-04"]],
  ["u-you", -9.4175, 38.9636, "Ericeira", "PT", "Ribeira d'Ilhas", "Cold water, long right-handers. Best morning of the winter.", 4, "friends", ["2025-02-11", "2025-02-13"]],
  ["u-you", -16.9298, 32.7607, "Funchal, Madeira", "PT", "Levada do Caldeirão Verde", "Tunnels, waterfalls, and vertigo. Bring a headlamp.", 3, "friends", ["2025-03-02", "2025-03-06"]],
  ["u-you", 2.1734, 41.3851, "Barcelona", "ES", "Weekend with Maria", "Ran Montjuïc at dawn, vermouth by noon.", 2, "friends", ["2025-04-18", "2025-04-20"]],
  ["u-you", -17.9186, 28.7136, "La Palma", "ES", "Roque de los Muchachos", "Above the clouds at the observatory. Silence you can hear.", 3, "public", ["2025-05-09", "2025-05-12"]],
  ["u-you", 12.4964, 41.9028, "Rome", "IT", "Cacio e pepe crawl", "Four trattorias, one afternoon. No regrets.", 2, "friends"],
  ["u-you", 25.2797, 54.6872, "Vilnius", "LT", "Užupis", "The self-declared republic of artists. Charming and strange.", 2, "public"],
  ["u-you", -21.9426, 64.1466, "Reykjavík", "IS", "Winter light", "Four hours of gold-hour a day. The whole country glows.", 3, "friends", ["2024-12-01", "2024-12-05"]],
  ["u-you", 139.6917, 35.6895, "Tokyo", "JP", "First time east", "Kenji showed me the good ramen. Overwhelmed in the best way.", 4, "friends", ["2024-10-20", "2024-10-27"]],
  ["u-you", 8.5417, 47.3769, "Zürich", "CH", "Layover swim", "Jumped in the Limmat between flights. Freezing, worth it.", 1, "private"],

  // — Maria —
  ["u-maria", 2.1734, 41.3851, "Barcelona", "ES", "Home turf", "Carretera de les Aigües before work most mornings.", 2],
  ["u-maria", 7.7491, 45.9237, "Cervinia", "IT", "Matterhorn traverse", "Ran the Italian side under the peak. Legs destroyed.", 3, "public"],
  ["u-maria", 86.9250, 27.9881, "Everest Base Camp", "NP", "EBC trek", "12 days up. Namche to Gorak Shep. The Khumbu is unreal.", 4, "public", ["2025-04-01", "2025-04-14"]],
  ["u-maria", -70.6693, -33.4489, "Santiago", "CL", "Cajón del Maipo", "Andes on the doorstep. Empanadas at altitude.", 2],
  ["u-maria", 13.7522, 45.6495, "Trieste", "IT", "Coffee & karst", "Ran the Rilke path over the Adriatic.", 2],
  ["u-maria", 20.9394, 40.0759, "Ohrid", "MK", "Lake Ohrid", "Ancient, clear, and empty. Best-kept Balkan secret.", 3, "public"],
  ["u-maria", -16.2518, 28.4636, "Tenerife", "ES", "Teide by moonlight", "Started at 2am to summit for sunrise. Above the clouds.", 3, "public"],
  ["u-maria", 11.2558, 43.7696, "Florence", "IT", "Chianti hills", "Long run through vineyards. Stopped for far too much wine.", 2],

  // — Kenji —
  ["u-kenji", 139.6917, 35.6895, "Tokyo", "JP", "Home", "Golden Gai after midnight. My favorite six square meters on earth.", 3],
  ["u-kenji", 141.3469, 43.0642, "Niseko", "JP", "Japow", "Waist-deep and still falling. Best week of the season.", 4, "public", ["2025-01-18", "2025-01-25"]],
  ["u-kenji", -157.8583, 21.3069, "Oʻahu", "US", "North Shore", "Pipeline was too big for me. Watched the pros instead.", 3, "public"],
  ["u-kenji", 115.1889, -8.4095, "Bali", "ID", "Uluwatu", "Reef break at sunset. Paddled out with ten locals and no crowd.", 4, "public", ["2025-06-02", "2025-06-12"]],
  ["u-kenji", 149.1300, -35.2809, "Canberra", "AU", "Stromlo", "Flew down for a mountain-bike festival. Loam heaven.", 2],
  ["u-kenji", 170.1421, -43.4645, "Franz Josef", "NZ", "Glacier country", "Heli-hiked the ice. Sci-fi blue all the way down.", 3, "public"],
  ["u-kenji", 138.7274, 35.3606, "Mt Fuji", "JP", "Yoshida trail", "Overnight climb to catch goraikō — sunrise from the summit.", 3, "public"],
  ["u-kenji", 127.6809, 26.2124, "Okinawa", "JP", "Kerama blue", "Freediving the reefs. Water so clear it disappears.", 4, "public"],

  // — Amara —
  ["u-amara", 18.4241, -33.9249, "Cape Town", "ZA", "Home / Table Mountain", "Platteklip before sunrise, ocean the whole way up.", 3],
  ["u-amara", 37.3556, -3.0674, "Kilimanjaro", "TZ", "Machame route", "Uhuru Peak, 5,895m. Cried at the sign. Everyone does.", 4, "public", ["2025-02-01", "2025-02-08"]],
  ["u-amara", 34.9137, -19.8436, "Gorongosa", "MZ", "Overland", "Two weeks off-grid through the park. Elephants at the tent.", 3, "public"],
  ["u-amara", 27.5628, -25.9945, "Waterberg", "ZA", "Bush climbing", "Sport routes on warm sandstone. Baboons for spectators.", 2],
  ["u-amara", 35.2433, -0.0236, "Great Rift Valley", "KE", "The escarpment", "Overland north. The road just keeps opening up.", 3, "public"],
  ["u-amara", 6.8498, 45.9237, "Chamonix", "FR", "First alpine season", "Traded desert heat for the Mont Blanc massif. Humbled daily.", 3, "public"],
  ["u-amara", -68.1193, -16.4897, "La Paz", "BO", "Death Road", "Rode it top to bottom. Terrifying and glorious.", 3, "public"],
  ["u-amara", 57.5522, -20.3484, "Mauritius", "MU", "Le Morne", "Rest week after the overland. Earned every hammock hour.", 2, "friends"],

  // — Leo —
  ["u-leo", -9.4175, 38.9636, "Ericeira", "PT", "Van home", "Wake up to the sound of the break. Never getting a real house.", 3],
  ["u-leo", -1.8262, 43.4832, "Hossegor", "FR", "La Gravière", "French beach-break perfection. Barrels and baguettes.", 4, "public"],
  ["u-leo", -6.2603, 35.7595, "Taghazout", "MA", "Anchor Point", "Long walls, warm water, mint tea between sessions.", 4, "public", ["2025-03-15", "2025-03-30"]],
  ["u-leo", -8.6291, 41.1579, "Porto", "PT", "Coast run north", "Followed the swell up the whole coast in the van.", 2],
  ["u-leo", -17.1094, 28.0916, "El Hierro", "ES", "The edge of Europe", "Smallest Canary, zero crowds. Dove with turtles daily.", 3, "public"],
  ["u-leo", 174.7633, -36.8485, "Piha", "NZ", "Black sand", "Flew across the world for a wave. It delivered.", 3, "public"],
  ["u-leo", -70.9083, -53.1638, "Punta Arenas", "CL", "Patagonia surf mission", "Coldest water I've ever paddled. Icebergs on the horizon.", 4, "public"],
];

export const pins: Pin[] = rows.map((r, i) => {
  const id = `pin-${i + 1}`;
  const [userId, lng, lat, place, cc, title, note, n, vis, dates] = r;
  return {
    id,
    userId,
    lng,
    lat,
    placeName: place,
    countryCode: cc,
    title,
    note,
    visibility: vis ?? "friends",
    startedOn: dates?.[0],
    endedOn: dates?.[1],
    photos: photos(id, n),
    createdAt: new Date(2025, 0, 1 + i).toISOString(),
  };
});

function pinIdFor(userId: string, place: string): string {
  const p = pins.find((x) => x.userId === userId && x.placeName === place);
  if (!p) throw new Error(`seed: no pin for ${userId} @ ${place}`);
  return p.id;
}

// Everyone in the demo is connected to "you" (accepted), plus a couple among
// each other, so the "Everyone" overlay and friend maps are populated.
export const friendships: Friendship[] = [
  { userA: "u-you", userB: "u-maria", status: "accepted", requestedBy: "u-you" },
  { userA: "u-you", userB: "u-kenji", status: "accepted", requestedBy: "u-kenji" },
  { userA: "u-you", userB: "u-amara", status: "accepted", requestedBy: "u-you" },
  { userA: "u-you", userB: "u-leo", status: "accepted", requestedBy: "u-leo" },
  { userA: "u-maria", userB: "u-amara", status: "accepted", requestedBy: "u-maria" },
  { userA: "u-kenji", userB: "u-leo", status: "accepted", requestedBy: "u-leo" },
];

export const topPlaces: TopPlace[] = [
  { userId: "u-you", rank: 1, pinId: pinIdFor("u-you", "Tokyo"), blurb: "The city that recalibrated what a city could be." },
  { userId: "u-you", rank: 2, pinId: pinIdFor("u-you", "Ericeira"), blurb: "Cold, empty, perfect. My reset button." },
  { userId: "u-you", rank: 3, pinId: pinIdFor("u-you", "Reykjavík"), blurb: "Four hours of daylight and I'd move tomorrow." },
  { userId: "u-you", rank: 4, pinId: pinIdFor("u-you", "Funchal, Madeira"), blurb: "A whole island of hiking trails and no crowds." },
  { userId: "u-you", rank: 5, pinId: pinIdFor("u-you", "La Palma"), blurb: "Standing above the clouds at the observatory." },

  { userId: "u-maria", rank: 1, pinId: pinIdFor("u-maria", "Everest Base Camp"), blurb: "Twelve days that reset my definition of hard." },
  { userId: "u-maria", rank: 2, pinId: pinIdFor("u-maria", "Ohrid"), blurb: "The Balkans' best secret. Don't tell anyone." },
  { userId: "u-maria", rank: 3, pinId: pinIdFor("u-maria", "Cervinia"), blurb: "Running under the Matterhorn. Unreal." },
  { userId: "u-maria", rank: 4, pinId: pinIdFor("u-maria", "Tenerife"), blurb: "Teide sunrise above the clouds." },
  { userId: "u-maria", rank: 5, pinId: pinIdFor("u-maria", "Santiago"), blurb: "Andes on the doorstep." },

  { userId: "u-kenji", rank: 1, pinId: pinIdFor("u-kenji", "Niseko"), blurb: "The lightest snow on earth. I'm biased." },
  { userId: "u-kenji", rank: 2, pinId: pinIdFor("u-kenji", "Bali"), blurb: "Uluwatu at sunset ruined every other wave." },
  { userId: "u-kenji", rank: 3, pinId: pinIdFor("u-kenji", "Okinawa"), blurb: "Water so clear it disappears." },
  { userId: "u-kenji", rank: 4, pinId: pinIdFor("u-kenji", "Franz Josef"), blurb: "Sci-fi blue glacier ice." },
  { userId: "u-kenji", rank: 5, pinId: pinIdFor("u-kenji", "Mt Fuji"), blurb: "Sunrise from the summit. Once is enough — but do it." },

  { userId: "u-amara", rank: 1, pinId: pinIdFor("u-amara", "Kilimanjaro"), blurb: "Uhuru Peak. I cried at the sign." },
  { userId: "u-amara", rank: 2, pinId: pinIdFor("u-amara", "Gorongosa"), blurb: "Two weeks off-grid, elephants at the tent." },
  { userId: "u-amara", rank: 3, pinId: pinIdFor("u-amara", "La Paz"), blurb: "The Death Road, top to bottom." },
  { userId: "u-amara", rank: 4, pinId: pinIdFor("u-amara", "Chamonix"), blurb: "The massif humbled me daily." },
  { userId: "u-amara", rank: 5, pinId: pinIdFor("u-amara", "Great Rift Valley"), blurb: "The road just keeps opening up." },

  { userId: "u-leo", rank: 1, pinId: pinIdFor("u-leo", "Taghazout"), blurb: "Long walls, warm water, mint tea. Home from home." },
  { userId: "u-leo", rank: 2, pinId: pinIdFor("u-leo", "Hossegor"), blurb: "Beach-break perfection." },
  { userId: "u-leo", rank: 3, pinId: pinIdFor("u-leo", "Punta Arenas"), blurb: "Icebergs on the horizon while you surf." },
  { userId: "u-leo", rank: 4, pinId: pinIdFor("u-leo", "El Hierro"), blurb: "The quiet edge of Europe." },
  { userId: "u-leo", rank: 5, pinId: pinIdFor("u-leo", "Piha"), blurb: "Flew across the world for one wave. Worth it." },
];
