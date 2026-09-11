import { NextResponse } from "next/server";
import { getRuntime, authorize } from "@/lib/runtime";
import { decide } from "@/lib/approvals";

/** JSON body: { decision: "approved" | "rejected", note? } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  let body: { decision?: string; note?: string } = {};
  try { body = await req.json(); } catch { /* form fallback below */ }
  if (!body.decision) {
    try { const f = await req.formData(); body = { decision: String(f.get("decision") ?? ""), note: (f.get("note") as string) || undefined }; } catch { /* ignore */ }
  }
  if (body.decision !== "approved" && body.decision !== "rejected") return NextResponse.json({ error: "decision debe ser approved o rejected" }, { status: 400 });
  const rt = getRuntime();
  try {
    const approval = await decide(rt.store, { sender: rt.sender, adapter: rt.adapter }, { approvalId: id, decision: body.decision, userId: auth.userId, note: body.note });
    if (req.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL("/revisar", req.url), 303);
    return NextResponse.json({ approval });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 409 });
  }
}
