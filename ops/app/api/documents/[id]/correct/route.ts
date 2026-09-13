import { NextResponse } from "next/server";
import { getRuntime, authorize, assertFirmAccess, safeBack } from "@/lib/runtime";
import { correctField } from "@/lib/corrections";

/** JSON or form: { field, value, draftId? }. field "draft.body" edits the draft. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const rt = getRuntime();
  let body: { field?: string; value?: string; draftId?: string } = {};
  const isForm = (req.headers.get("content-type") ?? "").includes("form");
  if (isForm) { const f = await req.formData(); body = { field: String(f.get("field") ?? ""), value: String(f.get("value") ?? ""), draftId: (f.get("draftId") as string) || undefined }; }
  else { try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); } }
  if (!body.field || body.value === undefined) return NextResponse.json({ error: "Se requieren field y value" }, { status: 400 });
  const doc = await rt.store.documents.get(id);
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  if (!(await assertFirmAccess(auth, doc.firmId))) return NextResponse.json({ error: "No perteneces a este despacho" }, { status: 403 });
  const firm = await rt.store.firms.get(doc.firmId);
  if (!firm) return NextResponse.json({ error: "Despacho no encontrado" }, { status: 404 });
  const back = safeBack(req);
  try {
    const result = await correctField(rt.store, { firm, documentId: id, field: body.field, value: body.value, userId: auth.userId, draftId: body.draftId ?? null });
    if (req.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(back, 303);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (req.headers.get("accept")?.includes("text/html")) { const u = back; u.searchParams.set("error", message); return NextResponse.redirect(u, 303); }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
