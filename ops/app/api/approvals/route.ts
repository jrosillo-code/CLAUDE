import { NextResponse } from "next/server";
import { getRuntime, authorize, requireFirm } from "@/lib/runtime";

export async function GET(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const rt = getRuntime();
  const firm = await requireFirm(rt.store, new URL(req.url).searchParams.get("firmId"));
  const pending = await rt.store.approvals.listPending(firm.id);
  const withDrafts = await Promise.all(pending.map(async (a) => ({ ...a, draft: a.draftId ? await rt.store.drafts.get(a.draftId) : null })));
  return NextResponse.json({ approvals: withDrafts });
}
