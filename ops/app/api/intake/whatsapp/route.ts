import { NextResponse } from "next/server";
import { getRuntime, requireFirm } from "@/lib/runtime";
import { verifyChallenge, verifySignature, parseWebhook, GraphMediaFetcher } from "@/lib/intake/whatsapp";
import { receiveDocument } from "@/lib/pipeline";
import { enqueue } from "@/lib/jobs";
import { allow } from "@/lib/ratelimit";
import { log } from "@/lib/audit";

export const maxDuration = 300;

export async function GET(req: Request) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return new NextResponse("WHATSAPP_VERIFY_TOKEN no configurado", { status: 503 });
  const challenge = verifyChallenge(new URL(req.url).searchParams, token);
  return challenge ? new NextResponse(challenge) : new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!secret || !accessToken) return NextResponse.json({ error: "WhatsApp no configurado" }, { status: 503 });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new NextResponse("Bad signature", { status: 401 });
  const rt = getRuntime();
  const firm = await requireFirm(rt.store, new URL(req.url).searchParams.get("firmId"));
  if (!allow(`intake:${firm.id}`, 60, 60)) return NextResponse.json({ error: "Demasiadas entradas; espera un minuto" }, { status: 429 });
  const fetcher = new GraphMediaFetcher(accessToken);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const received: string[] = [];
  for (const item of parseWebhook(firm.id, payload)) {
    if (item.message.externalId && (await rt.store.inbound.byExternalId(firm.id, item.message.externalId))) continue; // idempotent
    await rt.store.inbound.insert(item.message);
    await log(rt.store, { firmId: firm.id, action: "inbound.received", entity: { type: "inbound", id: item.message.id }, detail: { channel: "whatsapp", media: item.media.length } });
    for (const m of item.media) {
      try {
        const file = await fetcher.fetch(m.mediaId);
        const doc = await receiveDocument(rt, { firm, fileName: m.fileName, mediaType: file.mediaType || m.mediaType, bytes: file.bytes, inbound: item.message });
        received.push(doc.id);
        await enqueue(rt.store, firm.id, "process_document", { documentId: doc.id });
      } catch (e) {
        await log(rt.store, { firmId: firm.id, action: "inbound.media_failed", entity: { type: "inbound", id: item.message.id }, detail: { mediaId: m.mediaId, error: e instanceof Error ? e.message : String(e) } });
      }
    }
  }
  return NextResponse.json({ received });
}
