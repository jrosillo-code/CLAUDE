import { NextResponse } from "next/server";
import { getRuntime, authorize, assertFirmAccess, safeBack } from "@/lib/runtime";
import { inviteMember, listMembers, canManage } from "@/lib/members";

/** GET: the team. POST (JSON or form: email, role=staff|owner): invite a person; owners or the machine key. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const rt = getRuntime();
  if (!(await assertFirmAccess(auth, id))) return NextResponse.json({ error: "No perteneces a este despacho" }, { status: 403 });
  return NextResponse.json({ members: await listMembers(rt.store, id) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const rt = getRuntime();
  const html = req.headers.get("accept")?.includes("text/html");
  const back = safeBack(req);
  let email = "", role = "staff";
  if ((req.headers.get("content-type") ?? "").includes("form")) { const f = await req.formData(); email = String(f.get("email") ?? ""); role = String(f.get("role") ?? "staff"); }
  else { try { const b = (await req.json()) as { email?: string; role?: string }; email = b.email ?? ""; role = b.role ?? "staff"; } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); } }
  try {
    const firm = await rt.store.firms.get(id);
    if (!firm) return NextResponse.json({ error: "Despacho no encontrado" }, { status: 404 });
    if (!(await canManage(rt.store, firm.id, auth.userId, auth.viaKey))) return NextResponse.json({ error: "Solo el propietario del despacho puede invitar" }, { status: 403 });
    const result = await inviteMember(rt.store, { firm, email, role: role as "owner" | "staff", actorId: auth.userId, redirectTo: `${new URL(req.url).origin}/auth/callback` });
    if (html) { back.searchParams.delete("error"); back.searchParams.set("invitado", result.invited ? "1" : "2"); return NextResponse.redirect(back, 303); }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (html) { back.searchParams.set("error", message); return NextResponse.redirect(back, 303); }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
