// Local product analytics — measurement without surveillance. Events live in
// this browser only (localStorage), are capped, and carry IDS AND ENUMS ONLY:
// the meta type below has no free-text field on purpose, so a reflection's
// words can never end up in an event log. Nothing here is transmitted.
//
// Production note: the "your words helped a friend" indicator reads THIS
// device's log, so cross-device counts need a privacy-preserving server
// aggregate (event name + ids, same no-text rule) — see docs/reflections.md.

export type ProductEventName =
  | "debrief_started"
  | "debrief_resumed"
  | "debrief_completed"
  | "debrief_abandoned" // closed the sheet with the debrief still a draft
  | "reflection_viewed" // a friend's quotes rendered on a trip card
  | "reflection_expanded"
  | "quote_selected" // tapped any quote row
  | "reflection_ask_evidence" // a debrief quote surfaced in Ask-your-friends
  | "reflection_dontmiss_evidence" // a debrief quote powered a Don't-miss pick
  | "reflection_place_evidence" // a debrief quote shown on a place card
  | "reflection_pin_nav" // tapping a quote flew the map to its pin
  | "ask_question_submitted" // question asked (never the question text)
  | "trip_cloned" // any clone
  | "trip_cloned_with_debrief" // the cloned trip carried the owner's debrief
  | "visibility_selected" // which privacy level a debrief was saved with
  | "reward_viewed"; // the saved-answer reward screen rendered

/** IDs, enums and counts only — no free text, by type. */
export interface ProductEventMeta {
  reflectionId?: string;
  tripId?: string;
  pinId?: string;
  /** Who the surfaced words belong to. */
  ownerId?: string;
  /** Who was looking. */
  viewerId?: string;
  questionId?: string;
  /** Privacy level chosen (visibility_selected). */
  visibility?: "private" | "friends" | "public";
  /** Result sizes (e.g. evidence returned for an ask) — never content. */
  count?: number;
}

export interface ProductEvent {
  name: ProductEventName;
  at: string;
  meta: ProductEventMeta;
}

const KEY = "wp-events";
const CAP = 600;

let memory: ProductEvent[] | null = null;

function load(): ProductEvent[] {
  if (memory) return memory;
  try {
    memory = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as ProductEvent[];
  } catch {
    memory = [];
  }
  return memory!;
}

function persist(events: ProductEvent[]): void {
  memory = events;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    /* private mode / SSR — the in-memory log still works this session */
  }
}

export function track(name: ProductEventName, meta: ProductEventMeta = {}): void {
  if (typeof window === "undefined") return; // SSR
  const events = load();
  events.push({ name, at: new Date().toISOString(), meta });
  persist(events.slice(-CAP));
}

/** Dedup helper: fire an evidence event once per (event, reflection, viewer)
 *  per session, so re-renders don't inflate the log. */
const seenOnce = new Set<string>();
export function trackOnce(name: ProductEventName, meta: ProductEventMeta): void {
  const key = `${name}:${meta.reflectionId ?? ""}:${meta.viewerId ?? ""}:${meta.pinId ?? ""}`;
  if (seenOnce.has(key)) return;
  seenOnce.add(key);
  track(name, meta);
}

export function readEvents(): ProductEvent[] {
  if (typeof window === "undefined") return [];
  return [...load()];
}

const CONTRIBUTION_EVENTS: ProductEventName[] = [
  "reflection_ask_evidence",
  "reflection_dontmiss_evidence",
  "reflection_place_evidence",
  "trip_cloned_with_debrief",
];

/**
 * How often this user's debriefs did work for someone else, per this
 * device's log: evidence events where the words belonged to `userId` and the
 * viewer was someone else.
 */
export function contributionCount(userId: string, reflectionId?: string): number {
  return readEvents().filter(
    (e) =>
      CONTRIBUTION_EVENTS.includes(e.name) &&
      e.meta.ownerId === userId &&
      (reflectionId === undefined || e.meta.reflectionId === reflectionId) &&
      e.meta.viewerId !== undefined &&
      e.meta.viewerId !== userId
  ).length;
}
