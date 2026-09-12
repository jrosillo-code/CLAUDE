import { NextResponse } from "next/server";
import { getRuntime } from "@/lib/runtime";
import { validateLead, saveLead } from "@/lib/leads";
import { allow } from "@/lib/ratelimit";
import { log } from "@/lib/audit";
import { DEMO_FIRM } from "@/lib/runtime";

/** Public. JSON or form: name, email, phone?, firm?, kind?, message, website (honeypot, empty). */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!allow(`leads:${ip}`, 5, 5)) return NextResponse.json({ error: "Demasiadas solicitudes; espera un minuto" }, { status: 429 });
  const isForm = (req.headers.get("content-type") ?? "").includes("form");
  let body: Record<string, string> = {};
  if (isForm) { const f = await req.formData(); for (const [k, v] of f.entries()) body[k] = String(v); }
  else { try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); } }
  const html = req.headers.get("accept")?.includes("text/html");
  const v = validateLead({
    name: body.name ?? "", email: body.email ?? "", message: body.message ?? "",
    phone: body.phone, firm: body.firm, kind: body.kind, website: body.website,
    ip, source: body.source ?? "web",
  });
  if (!v.ok) {
    if (v.error === "spam") return html ? NextResponse.redirect(new URL("/contacto?enviado=1", req.url), 303) : NextResponse.json({ ok: true });
    if (html) { const u = new URL("/contacto", req.url); u.searchParams.set("error", v.error); return NextResponse.redirect(u, 303); }
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const rt = getRuntime();
  try {
    const { notified } = await saveLead(rt.store, v.lead, { sender: rt.sender, to: process.env.LEADS_TO ?? null, from: process.env.MAIL_FROM ?? null });
    await log(rt.store, { firmId: DEMO_FIRM.id, action: "lead.received", entity: { type: "lead", id: v.lead.id }, detail: { kind: v.lead.kind, source: v.lead.source, notified } });
    if (html) return NextResponse.redirect(new URL("/contacto?enviado=1", req.url), 303);
    return NextResponse.json({ ok: true, notified });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    if (html) { const u = new URL("/contacto", req.url); u.searchParams.set("error", "No se pudo guardar; escríbenos por WhatsApp"); return NextResponse.redirect(u, 303); }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
