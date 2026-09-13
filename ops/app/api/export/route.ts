import { NextResponse } from "next/server";
import { getRuntime, authorize, requireFirm } from "@/lib/runtime";
import { toCsv, type Column } from "@/lib/csv";
import type { ActivityEntry, Correction, Extraction } from "@/lib/types";

// Compliance kit item 3: the activity log is the firm's, and exportable. The
// same for corrections (the accuracy dataset) and extractions (what was read).

const ACTIVITY: Column<ActivityEntry>[] = [
  { header: "fecha", value: (e) => e.at },
  { header: "accion", value: (e) => e.action },
  { header: "actor_tipo", value: (e) => e.actor.type },
  { header: "actor", value: (e) => e.actor.id },
  { header: "entidad_tipo", value: (e) => e.entity.type },
  { header: "entidad", value: (e) => e.entity.id },
  { header: "modelo", value: (e) => e.usage?.model ?? "" },
  { header: "tokens_entrada", value: (e) => e.usage?.inputTokens ?? "" },
  { header: "tokens_salida", value: (e) => e.usage?.outputTokens ?? "" },
  { header: "coste_usd", value: (e) => e.usage?.costUsd ?? "" },
  { header: "detalle", value: (e) => e.detail },
];
const CORRECTIONS: Column<Correction>[] = [
  { header: "fecha", value: (c) => c.createdAt },
  { header: "documento", value: (c) => c.documentId },
  { header: "campo", value: (c) => c.field },
  { header: "valor_leido", value: (c) => c.oldValue },
  { header: "valor_corregido", value: (c) => c.newValue },
  { header: "usuario", value: (c) => c.userId },
];
const EXTRACTIONS: Column<Extraction>[] = [
  { header: "fecha", value: (e) => e.createdAt },
  { header: "documento", value: (e) => e.documentId },
  { header: "tipo", value: (e) => e.kind },
  { header: "confianza", value: (e) => e.kindConfidence },
  { header: "modelo", value: (e) => e.usage?.model ?? "" },
  { header: "datos", value: (e) => e.data },
];

export async function GET(req: Request) {
  const rt = getRuntime();
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "activity";
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  try {
    const firm = await requireFirm(rt.store, url.searchParams.get("firmId"));
    const auth = await authorize(req, firm.id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    let csv: string;
    if (kind === "activity") csv = toCsv((await rt.store.activity.list(firm.id, 50000, from, to)).reverse(), ACTIVITY);
    else if (kind === "corrections") csv = toCsv(await rt.store.corrections.listByFirm(firm.id, from, to), CORRECTIONS);
    else if (kind === "extractions") csv = toCsv(await rt.store.extractions.listByFirm(firm.id, from, to), EXTRACTIONS);
    else return NextResponse.json({ error: "kind debe ser activity, corrections o extractions" }, { status: 400 });
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${kind}-${stamp}.csv"`, "cache-control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 400 });
  }
}
