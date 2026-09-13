import { NextResponse } from "next/server";
import { getRuntime, authorize, assertFirmAccess, safeBack } from "@/lib/runtime";
import { log } from "@/lib/audit";

/** JSON or form: { status: "open" | "done" }. Members may close their firm's tasks. */
async function update(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const rt = getRuntime();
  let status = "";
  if ((req.headers.get("content-type") ?? "").includes("form")) status = String((await req.formData()).get("status") ?? "");
  else { try { status = String(((await req.json()) as { status?: string }).status ?? ""); } catch { /* empty */ } }
  if (status !== "open" && status !== "done") return NextResponse.json({ error: "status debe ser open o done" }, { status: 400 });
  const task = await rt.store.tasks.get(id);
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  if (!(await assertFirmAccess(auth, task.firmId))) return NextResponse.json({ error: "No perteneces a este despacho" }, { status: 403 });
  await rt.store.tasks.update(id, { status });
  await log(rt.store, { firmId: task.firmId, action: `task.${status}`, entity: { type: "task", id }, actor: { type: "user", id: auth.userId }, detail: { title: task.title } });
  if (req.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(safeBack(req), 303);
  return NextResponse.json({ ok: true });
}

export const POST = update;
export const PATCH = update;
