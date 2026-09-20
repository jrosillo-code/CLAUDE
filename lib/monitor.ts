// Error reporting without a vendor. The browser sends what broke to
// /api/errors; the server prints it to the deploy's logs and, when
// ERROR_WEBHOOK_URL is set, posts it to a chat webhook — so a save that
// starts failing for some users on a Tuesday is seen on Tuesday.
//
// What is sent: the message, a trimmed stack, the page path, the app
// version, the browser and a coarse kind. What is never sent: pin text,
// names, coordinates, the viewer's id, anything typed. Five reports a
// minute per device at most; the rest stay in the console.

import pkg from "../package.json";
const APP_VERSION: string = (pkg as { version: string }).version;

export type ErrorKind = "error" | "rejection" | "render" | "backend";

export interface ErrorReport {
  kind: ErrorKind;
  message: string;
  stack?: string;
  path: string;
  version: string;
  ua: string;
  op?: string;
  digest?: string;
  at: string;
}

const sent: number[] = [];
const seen = new Set<string>();

function budget(): boolean {
  const now = Date.now();
  while (sent.length && now - sent[0] > 60_000) sent.shift();
  if (sent.length >= 5) return false;
  sent.push(now);
  return true;
}

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e).slice(0, 300);
  } catch {
    return String(e);
  }
}

/** Send one report; quiet on any failure, never throws. */
export function reportError(e: unknown, extra: Partial<Pick<ErrorReport, "kind" | "op" | "digest">> = {}): void {
  if (typeof window === "undefined") return;
  try {
    const message = messageOf(e).slice(0, 500);
    // The same failure on repeat is one report, not a stream.
    const key = `${extra.kind ?? "error"}:${extra.op ?? ""}:${message}`;
    if (seen.has(key)) return;
    if (!budget()) return;
    seen.add(key);
    const stack = e instanceof Error && e.stack ? e.stack.split("\n").slice(0, 8).join("\n").slice(0, 1500) : undefined;
    const body: ErrorReport = {
      kind: extra.kind ?? "error",
      message,
      stack,
      path: window.location.pathname,
      version: APP_VERSION,
      ua: navigator.userAgent.slice(0, 200),
      op: extra.op,
      digest: extra.digest,
      at: new Date().toISOString(),
    };
    const json = JSON.stringify(body);
    if (navigator.sendBeacon && navigator.sendBeacon("/api/errors", new Blob([json], { type: "application/json" }))) return;
    void fetch("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" }, body: json, keepalive: true }).catch(() => {});
  } catch {
    /* reporting must never be the thing that breaks */
  }
}

/** Wire the window handlers once. */
export function installErrorReporting(): () => void {
  if (typeof window === "undefined") return () => {};
  const onError = (ev: ErrorEvent) => reportError(ev.error ?? ev.message, { kind: "error" });
  const onRejection = (ev: PromiseRejectionEvent) => reportError(ev.reason, { kind: "rejection" });
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
