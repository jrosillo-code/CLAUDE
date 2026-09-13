import { NextResponse } from "next/server";
import { getRuntime, authorize, requireFirm, safeBack } from "@/lib/runtime";
import { parseExpectedReceiptsCsv } from "@/lib/reconcile";
import { newId } from "@/lib/ids";
import { log } from "@/lib/audit";

/** multipart: file (CSV with columns aseguradora;poliza;recibo;tomador;prima;comision;periodo), firmId, insurer, period. */
export async function POST(req: Request) {
  const rt = getRuntime();
  const form = await req.formData();
  const file = form.get("file");
  const insurer = (form.get("insurer") as string) || "";
  const period = (form.get("period") as string) || "";
  if (!(file instanceof File) || !insurer || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "Se requieren file, insurer y period (AAAA-MM)" }, { status: 400 });
  }
  try {
    const firm = await requireFirm(rt.store, (form.get("firmId") as string) || null);
    const auth = await authorize(req, firm.id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rows = parseExpectedReceiptsCsv(firm.id, await file.text(), newId).map((r) => ({ ...r, insurer, period }));
    await rt.store.receipts.replaceForPeriod(firm.id, insurer, period, rows);
    await log(rt.store, { firmId: firm.id, action: "receipts.imported", entity: { type: "receipts", id: `${insurer}:${period}` }, actor: { type: "user", id: auth.userId }, detail: { rows: rows.length } });
    if (req.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(safeBack(req), 303);
    return NextResponse.json({ imported: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (req.headers.get("accept")?.includes("text/html")) { const u = safeBack(req); u.searchParams.set("error", message); return NextResponse.redirect(u, 303); }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
