import { NextResponse } from "next/server";
import { getRuntime, authorize, requireFirm } from "@/lib/runtime";
import { receiveDocument, processDocument } from "@/lib/pipeline";
import { BudgetExceeded } from "@/lib/budget";

export const maxDuration = 300;

/** multipart/form-data: file (required), firmId, clientRef, process=1 to run the chain now. */
export async function POST(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const rt = getRuntime();
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Se esperaba multipart/form-data" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  try {
    const firm = await requireFirm(rt.store, (form.get("firmId") as string) || null);
    const doc = await receiveDocument(rt, {
      firm,
      fileName: file.name || "documento",
      mediaType: file.type || "application/octet-stream",
      bytes: new Uint8Array(await file.arrayBuffer()),
      clientRef: (form.get("clientRef") as string) || null,
    });
    if (form.get("process") === "1") {
      const result = await processDocument(rt, firm, doc.id);
      return NextResponse.json({ document: result.document, validation: result.validation, tasks: result.tasks, approvals: result.approvals, draft: result.draft });
    }
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    if (err instanceof BudgetExceeded) return NextResponse.json({ error: err.message }, { status: 429 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
