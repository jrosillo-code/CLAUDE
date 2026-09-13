import { NextResponse } from "next/server";
import { getRuntime, authorize, assertFirmAccess, safeBack } from "@/lib/runtime";
import { decide } from "@/lib/approvals";

/** JSON body: { decision: "approved" | "rejected", note? } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  let body: { decision?: string; note?: string } = {};
  if ((req.headers.get("content-type") ?? "").includes("form")) {
    const f = await req.formData();
    body = { decision: String(f.get("decision") ?? ""), note: (f.get("note") as string) || undefined };
  } else {
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  }
  if (body.decision !== "approved" && body.decision !== "rejected") return NextResponse.json({ error: "decision debe ser approved o rejected" }, { status: 400 });
  const rt = getRuntime();
  const existing = await rt.store.approvals.get(id);
  if (!existing) return NextResponse.json({ error: "Aprobación no encontrada" }, { status: 404 });
  if (!(await assertFirmAccess(auth, existing.firmId))) return NextResponse.json({ error: "No perteneces a este despacho" }, { status: 403 });
  const back = safeBack(req);
  try {
    const approval = await decide(rt.store, { sender: rt.sender, adapter: rt.adapter }, { approvalId: id, decision: body.decision, userId: auth.userId, note: body.note });
    if (req.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(back, 303);
    return NextResponse.json({ approval });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (req.headers.get("accept")?.includes("text/html")) { const u = back; u.searchParams.set("error", message); return NextResponse.redirect(u, 303); }
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
