import type { Draft } from "./types";

// Outbound messages. Real senders (SMTP provider, WhatsApp Cloud API) plug in
// here; the pipeline never calls them directly, only the approval step does.

export interface SendResult {
  ok: boolean;
  externalId: string | null;
  error?: string;
  /** WhatsApp outside the 24-hour window: a template is required. */
  needsTemplate?: boolean;
}

export interface Sender {
  send(draft: Draft): Promise<SendResult>;
}

export class RecordingSender implements Sender {
  readonly sent: Draft[] = [];
  /** Set to make the next send fail, to test that approvals stay pending. */
  failNextWith: string | null = null;
  async send(draft: Draft): Promise<SendResult> {
    if (this.failNextWith) { const e = this.failNextWith; this.failNextWith = null; return { ok: false, externalId: null, error: e }; }
    this.sent.push(draft);
    return { ok: true, externalId: `local-${this.sent.length}` };
  }
}

/** Routes by channel to the configured real sender, else logs. */
export class RoutingSender implements Sender {
  constructor(private email: Sender | null, private whatsapp: Sender | null, private fallback: Sender = new LoggingSender()) {}
  async send(draft: Draft): Promise<SendResult> {
    const s = draft.channel === "email" ? this.email : this.whatsapp;
    return (s ?? this.fallback).send(draft);
  }
}

export class LoggingSender implements Sender {
  async send(draft: Draft): Promise<SendResult> {
    console.log(`[ops] would send ${draft.channel} to ${draft.to}: ${draft.subject ?? ""}\n${draft.body}`);
    return { ok: true, externalId: null };
  }
}
