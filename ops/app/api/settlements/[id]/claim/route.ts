import { NextResponse } from "next/server";
import { getRuntime, authorize, assertFirmAccess, safeBack } from "@/lib/runtime";
import { createClaim } from "@/lib/claims";

/** JSON or form: { to } — the insurer's settlements mailbox. Creates the claim draft and its approval; nothing is sent here. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const rt = getRuntime();
  let to = "";
  if ((req.headers.get("content-type") ?? "").includes("form")) to = String((await req.formData()).get("to") ?? "");
  else { try { to = String(((await req.json()) as { to?: string }).to ?? ""); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); } }
  const html = req.headers.get("accept")?.includes("text/html");
  const back = safeBack(req);
  try {
    const record = await rt.store.reconciliations.get(id);
    if (!record) return NextResponse.json({ error: "Liquidación no encontrada" }, { status: 404 });
    if (!(await assertFirmAccess(auth, record.firmId))) return NextResponse.json({ error: "No perteneces a este despacho" }, { status: 403 });
    const firm = await rt.store.firms.get(record.firmId);
    if (!firm) return NextResponse.json({ error: "Despacho no encontrado" }, { status: 404 });
    const result = await createClaim(rt.store, { firm, record, to, userId: auth.userId });
    if (html) return NextResponse.redirect(back, 303);
    return NextResponse.json({ approval: result.approval, draft: result.draft, totalEur: result.total }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (html) { const u = back; u.searchParams.set("error", message); return NextResponse.redirect(u, 303); }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
