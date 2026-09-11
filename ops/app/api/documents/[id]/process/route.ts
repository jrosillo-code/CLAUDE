import { NextResponse } from "next/server";
import { getRuntime, authorize, assertFirmAccess } from "@/lib/runtime";
import { processDocument } from "@/lib/pipeline";
import { BudgetExceeded } from "@/lib/budget";

export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(_req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const rt = getRuntime();
  try {
    const doc = await rt.store.documents.get(id);
    if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    if (!(await assertFirmAccess(auth, doc.firmId))) return NextResponse.json({ error: "No perteneces a este despacho" }, { status: 403 });
    const firm = await rt.store.firms.get(doc.firmId);
    if (!firm) return NextResponse.json({ error: "Despacho no encontrado" }, { status: 404 });
    const result = await processDocument(rt, firm, id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BudgetExceeded) return NextResponse.json({ error: err.message }, { status: 429 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
