import type { Draft } from "../types";
import type { Sender, SendResult } from "../sender";

// WhatsApp Cloud API text message. Outside the 24-hour customer service
// window Meta rejects free-form text (error 131047) and a template is
// required; the sender reports that so the approval stays pending and
// actionable instead of failing silently.
export class WhatsAppSender implements Sender {
  constructor(private phoneNumberId: string, private accessToken: string, private version = "v21.0", private fetchImpl: typeof fetch = fetch) {}
  static fromEnv(): WhatsAppSender | null {
    const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    return id && token ? new WhatsAppSender(id, token) : null;
  }
  async send(draft: Draft): Promise<SendResult> {
    if (draft.channel !== "whatsapp") return { ok: false, externalId: null, error: "El remitente de WhatsApp solo envía WhatsApp" };
    const to = draft.to.replace(/[^\d]/g, "");
    const res = await this.fetchImpl(`https://graph.facebook.com/${this.version}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: draft.body } }),
    });
    const body = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { code?: number; message?: string } };
    if (res.ok && body.messages?.[0]?.id) return { ok: true, externalId: body.messages[0].id };
    const code = body.error?.code;
    if (code === 131047) return { ok: false, externalId: null, error: "Fuera de la ventana de 24 horas: hace falta una plantilla aprobada", needsTemplate: true };
    return { ok: false, externalId: null, error: body.error?.message ?? `WhatsApp ${res.status}` };
  }
}
