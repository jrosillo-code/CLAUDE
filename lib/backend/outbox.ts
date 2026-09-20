"use client";

// The outbox: every write-through to Supabase goes through here.
//
// Before, a write was fire-and-forget: the optimistic state stood, the
// failure went to the console, and the next full load quietly reverted
// whatever had not reached the server. Now a write that fails for a
// transient reason — no network, a paused project, a 5xx, a timeout — is
// kept on this device and retried with backoff and again when the browser
// comes back online; it survives a reload because the queue is persisted.
// A write the server refuses on purpose (row-level security, a constraint,
// a bad payload) is dropped and the person is told, since retrying it
// would never help.
//
// Ops are named and re-runnable from their payload, which is what lets a
// persisted entry run again after a reload.

import { toast } from "../toast";
import { reportError } from "../monitor";

export type OpRunner<P> = (payload: P) => Promise<void>;

interface Entry {
  id: string;
  op: string;
  payload: unknown;
  attempts: number;
  createdAt: string;
}

const KEY = "wp-outbox";
const MAX_ATTEMPTS = 8;
const BACKOFF_MS = [2_000, 8_000, 30_000, 120_000, 300_000];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ops = new Map<string, OpRunner<any>>();
let queue: Entry[] = [];
let loaded = false;
let timer: number | null = null;
let draining = false;
let saidOffline = false;

/** Register an op once; the runner receives the payload it was queued with. */
export function defineOp<P>(name: string, run: OpRunner<P>, onRefused?: (e: unknown) => void): (payload: P) => void {
  ops.set(name, run);
  return (payload: P) => void submit(name, payload, onRefused);
}

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    queue = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Entry[];
  } catch {
    queue = [];
  }
  window.addEventListener("online", () => void drain());
}

function persist(): void {
  try {
    if (queue.length) window.localStorage.setItem(KEY, JSON.stringify(queue));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode: the queue lives for this page only */
  }
}

/** True for failures that a later retry can fix. */
export function isTransient(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const err = e as { message?: string; code?: string; status?: number; name?: string } | null;
  if (!err) return false;
  const msg = String(err.message ?? "");
  if (err.name === "AbortError" || err.name === "TimeoutError") return true;
  if (/failed to fetch|network|load failed|timed out|timeout|socket|ECONN|fetch failed/i.test(msg)) return true;
  const status = err.status ?? (typeof err.code === "string" && /^5\d\d$/.test(err.code) ? Number(err.code) : undefined);
  if (status !== undefined && (status >= 500 || status === 429 || status === 408)) return true;
  // PostgREST: connection-level codes; anything else (42501 RLS, 23xxx
  // constraints, PGRST1xx shapes) is a refusal, not weather.
  if (typeof err.code === "string" && /^(08|53|57)/.test(err.code)) return true;
  return false;
}

/** Run now; on a transient failure, queue and retry later. Resolves when
 *  the op either succeeded or was queued or dropped. */
export async function submit(op: string, payload: unknown, onRefused?: (e: unknown) => void): Promise<void> {
  load();
  const run = ops.get(op);
  if (!run) throw new Error(`outbox: unknown op ${op}`);
  try {
    await run(payload);
  } catch (e) {
    if (isTransient(e)) {
      queue.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, op, payload, attempts: 1, createdAt: new Date().toISOString() });
      persist();
      if (!saidOffline) {
        saidOffline = true;
        toast("Saved on this device — it syncs as soon as Waypoint can reach the server.", { kind: "info", ttlMs: 6000 });
      }
      schedule(BACKOFF_MS[0]);
      return;
    }
    onRefused?.(e);
  }
}

function schedule(ms: number): void {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => void drain(), ms);
}

/** Retry everything queued, oldest first; stop at the first failure and
 *  wait for the next backoff step. */
export async function drain(): Promise<void> {
  load();
  if (draining || !queue.length) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  draining = true;
  try {
    while (queue.length) {
      const entry = queue[0];
      const run = ops.get(entry.op);
      if (!run) {
        queue.shift();
        continue;
      }
      try {
        await run(entry.payload);
        queue.shift();
        persist();
      } catch (e) {
        if (isTransient(e) && entry.attempts < MAX_ATTEMPTS) {
          entry.attempts += 1;
          persist();
          schedule(BACKOFF_MS[Math.min(entry.attempts - 1, BACKOFF_MS.length - 1)]);
          return;
        }
        // Refused, or out of patience: drop it and say so.
        queue.shift();
        persist();
        reportError(e, { kind: "backend", op: `outbox:${entry.op}` });
        toast(`A change from ${new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} could not be saved and was dropped. Reload to see what stands.`, { kind: "error" });
      }
    }
    if (saidOffline) {
      saidOffline = false;
      toast("Back in sync.", { kind: "success", ttlMs: 2500 });
    }
  } finally {
    draining = false;
  }
}

/** Called once the session exists: pick up whatever a previous page left. */
export function resumeOutbox(): void {
  load();
  if (queue.length) schedule(500);
}

/** How many writes are waiting (for a badge or a test). */
export function pendingWrites(): number {
  load();
  return queue.length;
}

/** Test hook. */
export function _resetOutbox(): void {
  queue = [];
  loaded = false;
  saidOffline = false;
  if (timer) { window.clearTimeout(timer); timer = null; }
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
