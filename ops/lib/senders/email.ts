import nodemailer, { type Transporter } from "nodemailer";
import type { Draft } from "../types";
import type { Sender, SendResult } from "../sender";

// SMTP sender. SMTP_URL like smtps://user:pass@smtp.example.com:465 and
// MAIL_FROM like "Correduría Demo <hola@example.com>".
export class SmtpSender implements Sender {
  private transport: Transporter;
  constructor(smtpUrl: string, private from: string) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }
  static fromEnv(): SmtpSender | null {
    const url = process.env.SMTP_URL;
    const from = process.env.MAIL_FROM;
    return url && from ? new SmtpSender(url, from) : null;
  }
  async send(draft: Draft): Promise<SendResult> {
    if (draft.channel !== "email") return { ok: false, externalId: null, error: "El remitente SMTP solo envía correo" };
    try {
      const info = await this.transport.sendMail({ from: this.from, to: draft.to, subject: draft.subject ?? "", text: draft.body });
      return { ok: true, externalId: info.messageId ?? null };
    } catch (err) {
      return { ok: false, externalId: null, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
