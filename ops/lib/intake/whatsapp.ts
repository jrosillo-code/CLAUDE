import { createHmac, timingSafeEqual } from "node:crypto";
import type { InboundMessage } from "../types";
import { newId, nowIso } from "../ids";

// WhatsApp Cloud API webhook. Verification handshake, signature check, and a
// parser that turns the provider payload into InboundMessages with media ids
// to fetch. Media download is a separate step (fetchMedia) so the webhook
// answers fast and the pipeline can retry.

export function verifyChallenge(query: URLSearchParams, verifyToken: string): string | null {
  if (query.get("hub.mode") === "subscribe" && query.get("hub.verify_token") === verifyToken) {
    return query.get("hub.challenge");
  }
  return null;
}

export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

export interface WhatsAppMedia {
  mediaId: string;
  mediaType: string;
  fileName: string;
  caption: string | null;
}

export interface ParsedWhatsApp {
  message: Omit<InboundMessage, "attachments"> & { attachments: [] };
  media: WhatsAppMedia[];
}

interface WaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  image?: { id: string; mime_type: string; caption?: string };
}

export function parseWebhook(firmId: string, payload: unknown): ParsedWhatsApp[] {
  const out: ParsedWhatsApp[] = [];
  const entries = (payload as { entry?: Array<{ changes?: Array<{ value?: { messages?: WaMessage[] } }> }> })?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const media: WhatsAppMedia[] = [];
        if (m.type === "document" && m.document) {
          media.push({ mediaId: m.document.id, mediaType: m.document.mime_type, fileName: m.document.filename ?? `documento-${m.id}`, caption: m.document.caption ?? null });
        } else if (m.type === "image" && m.image) {
          const ext = m.image.mime_type.split("/")[1] ?? "jpg";
          media.push({ mediaId: m.image.id, mediaType: m.image.mime_type, fileName: `imagen-${m.id}.${ext}`, caption: m.image.caption ?? null });
        }
        out.push({
          message: {
            id: newId(),
            firmId,
            channel: "whatsapp",
            fromAddress: m.from,
            receivedAt: new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString(),
            subject: null,
            text: m.text?.body ?? media[0]?.caption ?? null,
            externalId: m.id,
            attachments: [],
          },
          media,
        });
      }
    }
  }
  return out;
}

export interface MediaFetcher {
  fetch(mediaId: string): Promise<{ bytes: Uint8Array; mediaType: string }>;
}

/** Graph API: GET /{media-id} returns a URL; GET that URL with the same token returns bytes. */
export class GraphMediaFetcher implements MediaFetcher {
  constructor(private accessToken: string, private version = "v21.0") {}
  async fetch(mediaId: string) {
    const meta = await fetch(`https://graph.facebook.com/${this.version}/${mediaId}`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!meta.ok) throw new Error(`WhatsApp media metadata ${meta.status}`);
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!res.ok) throw new Error(`WhatsApp media download ${res.status}`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), mediaType: mime_type };
  }
}
