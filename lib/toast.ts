// Tiny toast bus: anything (the backend layer included) can say one short
// line to the user without knowing about React. The Toaster component
// subscribes and renders. Messages are plain words about what happened and
// what to do next — never a stack trace.

export type ToastKind = "error" | "info" | "success";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional action, e.g. "Retry". */
  action?: { label: string; run: () => void };
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, number>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function dismissToast(id: number): void {
  const t = timers.get(id);
  if (t) window.clearTimeout(t);
  timers.delete(id);
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

export function toast(message: string, opts: { kind?: ToastKind; ttlMs?: number; action?: Toast["action"] } = {}): number {
  if (typeof window === "undefined") return 0;
  // One line per message: a burst of identical failures reads as one.
  const dup = toasts.find((t) => t.message === message);
  if (dup) return dup.id;
  const id = nextId++;
  toasts = [...toasts, { id, kind: opts.kind ?? "info", message, action: opts.action }].slice(-3);
  emit();
  const ttl = opts.ttlMs ?? (opts.kind === "error" ? 7000 : 4000);
  timers.set(id, window.setTimeout(() => dismissToast(id), ttl));
  return id;
}

export function subscribeToasts(l: Listener): () => void {
  listeners.add(l);
  l(toasts);
  return () => {
    listeners.delete(l);
  };
}
