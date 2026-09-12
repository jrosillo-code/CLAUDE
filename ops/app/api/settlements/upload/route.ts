import { NextResponse } from "next/server";
import { getRuntime, authorize, requireFirm } from "@/lib/runtime";
import { receiveDocument } from "@/lib/pipeline";
import { processSettlement } from "@/lib/settlements";
import { BudgetExceeded } from "@/lib/budget";
import { allow } from "@/lib/ratelimit";

export const maxDuration = 300;

/**
 * multipart/form-data: file (the insurer's statement), firmId, insurer?, period? (AAAA-MM).
 * Reads the statement, reconciles it against the firm's imported receipts and
 * returns the reconciliation. With example=1 in keyless mode, no file is needed:
 * the demo statement and matching receipts are loaded so the screen can be tried.
 */
export async function POST(req: Request) {
  const rt = getRuntime();
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Se esperaba multipart/form-data" }, { status: 400 }); }
  const html = req.headers.get("accept")?.includes("text/html");
  const back = req.headers.get("referer") ?? "/app";
  try {
    const firm = await requireFirm(rt.store, (form.get("firmId") as string) || null);
    const auth = await authorize(req, firm.id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!allow(`settlements:${firm.id}`)) return NextResponse.json({ error: "Demasiadas subidas; espera un minuto" }, { status: 429 });

    const example = form.get("example") === "1" && rt.mode.model === "demo";
    const file = form.get("file");
    if (!example && !(file instanceof File)) return NextResponse.json({ error: "Falta el archivo de la liquidación" }, { status: 400 });

    let insurer = ((form.get("insurer") as string) || "").trim() || null;
    let period = ((form.get("period") as string) || "").trim() || null;
    if (period && !/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: "El periodo debe ser AAAA-MM" }, { status: 400 });

    if (example) {
      insurer = "Aseguradora Ejemplo SA"; period = "2026-08";
      await rt.store.receipts.replaceForPeriod(firm.id, insurer, period, [
        { id: crypto.randomUUID(), firmId: firm.id, insurer, policyNumber: "HG-55-220931", receiptNumber: "R-1", premium: 412.5, expectedCommission: 82.5, period, holder: "Luis Ortega Vila" },
        { id: crypto.randomUUID(), firmId: firm.id, insurer, policyNumber: "AU-2024-778812", receiptNumber: "R-2", premium: 640, expectedCommission: 76.8, period, holder: "Marta Ruiz Pardo" },
        { id: crypto.randomUUID(), firmId: firm.id, insurer, policyNumber: "SA-1", receiptNumber: "R-3", premium: 100, expectedCommission: 12, period, holder: "Comunidad Prop. Sol 4" },
      ]);
    }
    const doc = await receiveDocument(rt, {
      firm,
      fileName: example ? "liquidacion-ejemplo-agosto.pdf" : (file as File).name || "liquidacion.pdf",
      mediaType: example ? "application/pdf" : (file as File).type || "application/octet-stream",
      bytes: example ? new TextEncoder().encode("demo settlement") : new Uint8Array(await (file as File).arrayBuffer()),
    });
    const result = await processSettlement(rt, { firm, documentId: doc.id, insurer, period });
    if (html) { const u = new URL(back, req.url); u.searchParams.delete("error"); u.searchParams.set("id", result.record.id); return NextResponse.redirect(u, 303); }
    return NextResponse.json({ document: doc, record: result.record, tasks: result.tasks }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    const status = err instanceof BudgetExceeded ? 429 : 500;
    if (html) { const u = new URL(back, req.url); u.searchParams.set("error", message); return NextResponse.redirect(u, 303); }
    return NextResponse.json({ error: message }, { status });
  }
}
