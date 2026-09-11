import type { ActivityEntry, ModelUsage } from "./types";
import type { Store } from "./store";
import { newId, nowIso, monthKey } from "./ids";

// Append-only record of what happened, who or what did it, and what it cost.
// Model calls are logged with their prompt hash and token counts so a firm can
// audit any output back to the model version and prompt that produced it.

export interface LogInput {
  firmId: string;
  action: string;
  entity: { type: string; id: string };
  actor?: ActivityEntry["actor"];
  usage?: ModelUsage | null;
  detail?: Record<string, unknown> | null;
}

export async function log(store: Store, input: LogInput): Promise<ActivityEntry> {
  const entry: ActivityEntry = {
    id: newId(),
    firmId: input.firmId,
    at: nowIso(),
    actor: input.actor ?? { type: "system", id: null },
    action: input.action,
    entity: input.entity,
    usage: input.usage ?? null,
    detail: input.detail ?? null,
  };
  await store.activity.append(entry);
  if (entry.usage) {
    await store.usage.add(input.firmId, monthKey(), entry.usage.inputTokens + entry.usage.outputTokens, entry.usage.costUsd);
  }
  return entry;
}
