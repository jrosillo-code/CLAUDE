import { NextResponse } from "next/server";
import { getRuntime, authorize, requireFirm } from "@/lib/runtime";
import { budgetStatus } from "@/lib/budget";

export async function GET(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const rt = getRuntime();
  const firm = await requireFirm(rt.store, new URL(req.url).searchParams.get("firmId"));
  const [entries, budget] = await Promise.all([rt.store.activity.list(firm.id, 200), budgetStatus(rt.store, firm)]);
  return NextResponse.json({ budget, entries });
}
