import { NextResponse } from "next/server";
import { getRuntime, authorize } from "@/lib/runtime";
import { processSettlement } from "@/lib/settlements";
import { BudgetExceeded } from "@/lib/budget";

export const maxDuration = 300;

/** JSON body: { insurer?, period? } to override what the statement says. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const rt = getRuntime();
  let body: { insurer?: string; period?: string } = {};
  try { body = await req.json(); } catch { /* optional */ }
  try {
    const doc = await rt.store.documents.get(id);
    if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    const firm = await rt.store.firms.get(doc.firmId);
    if (!firm) return NextResponse.json({ error: "Despacho no encontrado" }, { status: 404 });
    const result = await processSettlement(rt, { firm, documentId: id, insurer: body.insurer ?? null, period: body.period ?? null });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BudgetExceeded) return NextResponse.json({ error: err.message }, { status: 429 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
