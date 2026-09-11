import { timingSafeEqual } from "node:crypto";
import type { InboundMessage } from "../types";
import { newId, nowIso } from "../ids";

// Inbound email as most inbound-parse providers post it: a JSON body with
// sender, subject, text and base64 attachments, plus a shared secret header.

export interface EmailPayload {
  from: string;
  subject?: string;
  text?: string;
  messageId?: string;
  attachments?: Array<{ filename: string; contentType: string; contentBase64: string }>;
}

export function verifySecret(given: string | null, expected: string): boolean {
  if (!given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export function parseEmail(firmId: string, payload: EmailPayload): { message: InboundMessage; files: Array<{ fileName: string; mediaType: string; bytes: Uint8Array }> } {
  if (!payload.from) throw new Error("Correo sin remitente");
  const files = (payload.attachments ?? []).map((a) => ({
    fileName: a.filename || "adjunto",
    mediaType: a.contentType || "application/octet-stream",
    bytes: new Uint8Array(Buffer.from(a.contentBase64, "base64")),
  }));
  return {
    message: {
      id: newId(),
      firmId,
      channel: "email",
      fromAddress: payload.from,
      receivedAt: nowIso(),
      subject: payload.subject ?? null,
      text: payload.text ?? null,
      externalId: payload.messageId ?? null,
      attachments: [],
    },
    files,
  };
}
