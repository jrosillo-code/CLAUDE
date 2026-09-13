import { NextResponse } from "next/server";
import { getRuntime, authorize, assertFirmAccess, safeBack } from "@/lib/runtime";
import { updateFirmSettings, type SettingsInput } from "@/lib/settings";
import { firmSettings } from "@/lib/types";

/** JSON or form: { retentionDays?, alertEmail?, baselineHoursPerWeek?, insurerEmails? }. Members of the firm or the machine key. */
async function update(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const rt = getRuntime();
  const html = req.headers.get("accept")?.includes("text/html");
  let body: SettingsInput = {};
  if ((req.headers.get("content-type") ?? "").includes("form")) {
    const f = await req.formData();
    body = { retentionDays: String(f.get("retentionDays") ?? ""), alertEmail: String(f.get("alertEmail") ?? ""), baselineHoursPerWeek: String(f.get("baselineHoursPerWeek") ?? ""), insurerEmails: String(f.get("insurerEmails") ?? "") };
  } else {
    try { body = (await req.json()) as SettingsInput; } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  }
  const back = safeBack(req);
  try {
    const firm = await rt.store.firms.get(id);
    if (!firm) return NextResponse.json({ error: "Despacho no encontrado" }, { status: 404 });
    if (!(await assertFirmAccess(auth, firm.id))) return NextResponse.json({ error: "No perteneces a este despacho" }, { status: 403 });
    const updated = await updateFirmSettings(rt.store, firm, body, auth.userId);
    if (html) { back.searchParams.delete("error"); back.searchParams.set("guardado", "1"); return NextResponse.redirect(back, 303); }
    return NextResponse.json({ settings: firmSettings(updated) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (html) { back.searchParams.set("error", message); return NextResponse.redirect(back, 303); }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const POST = update;
export const PATCH = update;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const firm = await getRuntime().store.firms.get(id);
  if (!firm) return NextResponse.json({ error: "Despacho no encontrado" }, { status: 404 });
  if (!(await assertFirmAccess(auth, firm.id))) return NextResponse.json({ error: "No perteneces a este despacho" }, { status: 403 });
  return NextResponse.json({ firm: { id: firm.id, name: firm.name, kind: firm.kind, monthlyTokenBudget: firm.monthlyTokenBudget }, settings: firmSettings(firm) });
}
