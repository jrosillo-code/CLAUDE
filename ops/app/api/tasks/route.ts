import { NextResponse } from "next/server";
import { getRuntime, authorize, requireFirm } from "@/lib/runtime";

export async function GET(req: Request) {
  const rt = getRuntime();
  const firm = await requireFirm(rt.store, new URL(req.url).searchParams.get("firmId"));
  const auth = await authorize(req, firm.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ tasks: await rt.store.tasks.listOpenByFirm(firm.id) });
}
