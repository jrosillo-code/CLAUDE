import { readEvents, type ProductEventName } from "./analytics";

// The user-test funnel, computed from this device's local event log:
//
//   Viewed friend evidence
//   → Asked a question or cloned a trip
//   → Started own debrief
//   → Completed own debrief
//
// Local/admin-only by construction — the underlying log never leaves the
// device and never contains text.

export interface FunnelStage {
  label: string;
  /** Events (any of) that satisfy the stage for this viewer. */
  events: ProductEventName[];
  count: number;
  reached: boolean;
}

export function computeFunnel(viewerId: string): FunnelStage[] {
  const events = readEvents().filter((e) => e.meta.viewerId === viewerId);
  const countOf = (names: ProductEventName[]) =>
    events.filter((e) => names.includes(e.name)).length;

  const stages: Omit<FunnelStage, "count" | "reached">[] = [
    {
      label: "Viewed friend evidence",
      events: [
        "reflection_viewed",
        "reflection_expanded",
        "quote_selected",
        "reflection_place_evidence",
        "reflection_ask_evidence",
      ],
    },
    {
      label: "Asked a question or cloned a trip",
      events: ["ask_question_submitted", "trip_cloned"],
    },
    { label: "Started own debrief", events: ["debrief_started", "debrief_resumed"] },
    { label: "Completed own debrief", events: ["debrief_completed"] },
  ];

  return stages.map((s) => {
    const count = countOf(s.events);
    return { ...s, count, reached: count > 0 };
  });
}
