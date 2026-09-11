import type { Draft } from "../types";
import type { Sender, SendResult } from "../sender";

// WhatsApp Cloud API text message. Outside the 24-hour customer service
// window Meta rejects free-form text (error 131047) and a template is
// required; the sender reports that so the approval stays pending and
// actionable instead of failing silently.
export interface WhatsAppTemplate {
  /** Name of an approved template with exactly one body parameter, {{1}}. */
  name: string;
  language: string;
}

export const WINDOW_CLOSED = 131047;

/** Template parameters cannot contain newlines, tabs or long runs of spaces. */
export function templateParam(body: string, max = 1024): string {
  const flat = body.replace(/\s*\n+\s*/g, " · ").replace(/[ \t]{2,}/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export class WhatsAppSender implements Sender {
  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    private version = "v21.0",
    private fetchImpl: typeof fetch = fetch,
    private template: WhatsAppTemplate | null = null,
  ) {}
  static fromEnv(): WhatsAppSender | null {
    const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const tpl = process.env.WHATSAPP_TEMPLATE_NAME ? { name: process.env.WHATSAPP_TEMPLATE_NAME, language: process.env.WHATSAPP_TEMPLATE_LANG || "es" } : null;
    return id && token ? new WhatsAppSender(id, token, "v21.0", fetch, tpl) : null;
  }
  private async post(payload: Record<string, unknown>) {
    const res = await this.fetchImpl(`https://graph.facebook.com/${this.version}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const body = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { code?: number; message?: string } };
    return { res, body };
  }
  async send(draft: Draft): Promise<SendResult> {
    if (draft.channel !== "whatsapp") return { ok: false, externalId: null, error: "El remitente de WhatsApp solo envía WhatsApp" };
    const to = draft.to.replace(/[^\d]/g, "");
    const first = await this.post({ to, type: "text", text: { body: draft.body } });
    if (first.res.ok && first.body.messages?.[0]?.id) return { ok: true, externalId: first.body.messages[0].id };
    if (first.body.error?.code !== WINDOW_CLOSED) return { ok: false, externalId: null, error: first.body.error?.message ?? `WhatsApp ${first.res.status}` };
    if (!this.template) return { ok: false, externalId: null, error: "Fuera de la ventana de 24 horas: hace falta una plantilla aprobada (WHATSAPP_TEMPLATE_NAME)", needsTemplate: true };
    // Outside the window: the approved template carries the same text as its one parameter.
    const second = await this.post({
      to,
      type: "template",
      template: { name: this.template.name, language: { code: this.template.language }, components: [{ type: "body", parameters: [{ type: "text", text: templateParam(draft.body) }] }] },
    });
    if (second.res.ok && second.body.messages?.[0]?.id) return { ok: true, externalId: `${second.body.messages[0].id} (plantilla ${this.template.name})` };
    return { ok: false, externalId: null, error: second.body.error?.message ?? `WhatsApp plantilla ${second.res.status}`, needsTemplate: true };
  }
}
