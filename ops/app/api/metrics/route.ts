import { NextResponse } from "next/server";
import { getRuntime, authorize, requireFirm } from "@/lib/runtime";
import { computeMetrics } from "@/lib/metrics";

export async function GET(req: Request) {
  const rt = getRuntime();
  const url = new URL(req.url);
  const firm = await requireFirm(rt.store, url.searchParams.get("firmId"));
  const auth = await authorize(req, firm.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const metrics = await computeMetrics(rt.store, firm.id, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  return NextResponse.json(metrics);
}
