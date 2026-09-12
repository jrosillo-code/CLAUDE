import { NextResponse, after } from "next/server";
import { getRuntime, requireFirm } from "@/lib/runtime";
import { verifySecret, parseEmail, type EmailPayload } from "@/lib/intake/email";
import { receiveDocument } from "@/lib/pipeline";
import { enqueue, runJobs } from "@/lib/jobs";
import { allow } from "@/lib/ratelimit";
import { log } from "@/lib/audit";

export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "EMAIL_WEBHOOK_SECRET no configurado" }, { status: 503 });
  if (!verifySecret(req.headers.get("x-webhook-secret"), secret)) return new NextResponse("Bad secret", { status: 401 });
  const rt = getRuntime();
  const firm = await requireFirm(rt.store, new URL(req.url).searchParams.get("firmId"));
  if (!allow(`intake:${firm.id}`, 60, 60)) return NextResponse.json({ error: "Demasiadas entradas; espera un minuto" }, { status: 429 });
  let payload: EmailPayload;
  try { payload = (await req.json()) as EmailPayload; } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const { message, files } = parseEmail(firm.id, payload);
  if (message.externalId && (await rt.store.inbound.byExternalId(firm.id, message.externalId))) return NextResponse.json({ received: [], duplicate: true });
  await rt.store.inbound.insert(message);
  await log(rt.store, { firmId: firm.id, action: "inbound.received", entity: { type: "inbound", id: message.id }, detail: { channel: "email", attachments: files.length } });
  const received: string[] = [];
  for (const f of files) {
    const doc = await receiveDocument(rt, { firm, fileName: f.fileName, mediaType: f.mediaType, bytes: f.bytes, inbound: message });
    received.push(doc.id);
    await enqueue(rt.store, firm.id, "process_document", { documentId: doc.id });
  }
  if (received.length) after(() => runJobs(rt, 5).catch((e) => console.error("[ops] drain failed", e)));
  return NextResponse.json({ received });
}
