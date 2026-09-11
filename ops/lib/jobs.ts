import Anthropic from "@anthropic-ai/sdk";
import type { Job, JobKind, Firm } from "./types";
import type { Store } from "./store";
import type { Extractor, Drafter, SettlementExtractor } from "./claude";
import { processDocument } from "./pipeline";
import { processSettlement } from "./settlements";
import { BudgetExceeded } from "./budget";
import { log } from "./audit";
import { newId, nowIso } from "./ids";

// Background work. Webhooks enqueue; a runner (cron, or a call to
// /api/jobs/run) claims due jobs and executes them. Transient model errors
// retry with backoff; anything else, or a third failure, marks the job and the
// document failed with the reason in the audit log.

export const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 30_000;

export interface JobDeps {
  store: Store;
  extractor: Extractor;
  drafter: Drafter;
  settlementExtractor: SettlementExtractor;
}

export async function enqueue(store: Store, firmId: string, kind: JobKind, payload: Record<string, unknown>): Promise<Job> {
  const job: Job = { id: newId(), firmId, kind, payload, status: "queued", attempts: 0, runAfter: nowIso(), lastError: null, createdAt: nowIso(), updatedAt: nowIso() };
  await store.jobs.enqueue(job);
  return job;
}

/** Transient: worth retrying. Everything else is a real failure. */
export function isTransient(err: unknown): boolean {
  if (err instanceof BudgetExceeded) return false;
  if (err instanceof Anthropic.RateLimitError) return true;
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.InternalServerError) return true;
  if (err instanceof Anthropic.APIError) return (err.status ?? 0) >= 500 || err.status === 408 || err.status === 409 || err.status === 529;
  return false;
}

export function backoffMs(attempt: number): number {
  return BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
}

export interface RunSummary { claimed: number; done: number; retried: number; failed: number }

export async function runJobs(deps: JobDeps, limit = 10, now: () => Date = () => new Date()): Promise<RunSummary> {
  const { store } = deps;
  const jobs = await store.jobs.claim(limit);
  const summary: RunSummary = { claimed: jobs.length, done: 0, retried: 0, failed: 0 };
  for (const job of jobs) {
    const firm = await store.firms.get(job.firmId);
    if (!firm) { await store.jobs.fail(job.id, "Despacho no encontrado", null); summary.failed++; continue; }
    try {
      await execute(deps, firm, job);
      await store.jobs.complete(job.id);
      summary.done++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retry = isTransient(err) && job.attempts < MAX_ATTEMPTS;
      const retryAt = retry ? new Date(now().getTime() + backoffMs(job.attempts)).toISOString() : null;
      await store.jobs.fail(job.id, message, retryAt);
      if (retry) {
        summary.retried++;
        await log(store, { firmId: firm.id, action: "job.retry", entity: { type: "job", id: job.id }, detail: { kind: job.kind, attempt: job.attempts, retryAt, error: message } });
      } else {
        summary.failed++;
        const documentId = typeof job.payload.documentId === "string" ? job.payload.documentId : null;
        if (documentId) await store.documents.update(documentId, { status: "failed" });
        await log(store, { firmId: firm.id, action: "job.failed", entity: { type: "job", id: job.id }, detail: { kind: job.kind, attempts: job.attempts, error: message, documentId } });
      }
    }
  }
  return summary;
}

async function execute(deps: JobDeps, firm: Firm, job: Job): Promise<void> {
  const documentId = String(job.payload.documentId ?? "");
  if (!documentId) throw new Error("El trabajo no indica documento");
  switch (job.kind) {
    case "process_document":
      await processDocument(deps, firm, documentId);
      return;
    case "reconcile_settlement":
      await processSettlement(deps, { firm, documentId, insurer: (job.payload.insurer as string) ?? null, period: (job.payload.period as string) ?? null });
      return;
    default:
      throw new Error(`Tipo de trabajo desconocido: ${String(job.kind)}`);
  }
}
