import type { Draft } from "./types";

// Outbound messages. Real senders (SMTP provider, WhatsApp Cloud API) plug in
// here; the pipeline never calls them directly, only the approval step does.

export interface Sender {
  send(draft: Draft): Promise<{ ok: boolean; externalId: string | null }>;
}

export class RecordingSender implements Sender {
  readonly sent: Draft[] = [];
  async send(draft: Draft) {
    this.sent.push(draft);
    return { ok: true, externalId: `local-${this.sent.length}` };
  }
}

export class LoggingSender implements Sender {
  async send(draft: Draft) {
    console.log(`[ops] would send ${draft.channel} to ${draft.to}: ${draft.subject ?? ""}\n${draft.body}`);
    return { ok: true, externalId: null };
  }
}
