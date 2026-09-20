import { NextResponse } from "next/server";
import { withinRateLimit } from "@/lib/rateLimit";

// Client error reports (see lib/monitor.ts). Printed to the server log,
// where Vercel keeps them, and forwarded to ERROR_WEBHOOK_URL when set —
// any chat webhook that accepts JSON with a "text" or "content" field.
// No auth: a report is small, bounded and rate-limited, and a broken page
// is exactly when a session may be missing.

export const maxDuration = 10;

const KINDS = new Set(["error", "rejection", "render", "backend"]);

export async function POST(req: Request) {
  if (!withinRateLimit(req, "errors", 20)) return NextResponse.json({ ok: false }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).slice(0, max) : "");
  const report = {
    kind: KINDS.has(str("kind", 20)) ? str("kind", 20) : "error",
    message: str("message", 500),
    stack: str("stack", 1500),
    path: str("path", 200),
    version: str("version", 20),
    ua: str("ua", 200),
    op: str("op", 60),
    digest: str("digest", 60),
    at: str("at", 40),
  };
  if (!report.message) return NextResponse.json({ ok: false }, { status: 400 });

  console.error(`[client-error] ${report.kind}${report.op ? ` ${report.op}` : ""} @ ${report.path} v${report.version}: ${report.message}`, report.stack ? `\n${report.stack}` : "");

  const hook = process.env.ERROR_WEBHOOK_URL;
  if (hook) {
    const text = `Waypoint ${report.kind}${report.op ? ` (${report.op})` : ""} on ${report.path} v${report.version}\n${report.message}${report.stack ? `\n\`\`\`\n${report.stack.slice(0, 900)}\n\`\`\`` : ""}\n${report.ua}`;
    try {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, content: text.slice(0, 1900), event: report }),
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      /* the log line above is the record; the webhook is a courtesy */
    }
  }
  return NextResponse.json({ ok: true });
}
