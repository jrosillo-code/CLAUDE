import { createHash } from "node:crypto";
import type { Store } from "./store";
import type { Sender } from "./sender";
import { newId, nowIso } from "./ids";

// A contact request from the website. Validated, rate-limited by the route,
// stored server-side, and forwarded to the founder by email when SMTP is
// configured. The honeypot field catches bots without a captcha.

export interface LeadInput {
  name: string;
  email: string;
  phone?: string;
  firm?: string;
  kind?: string;
  message: string;
  /** Honeypot: must be empty. */
  website?: string;
  source?: string;
  ip?: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  firm: string | null;
  kind: "correduria" | "asesoria" | "otro";
  message: string;
  source: string;
  ipHash: string | null;
  createdAt: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateLead(input: LeadInput): { ok: true; lead: Lead } | { ok: false; error: string } {
  if (input.website && input.website.trim()) return { ok: false, error: "spam" };
  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const message = (input.message ?? "").trim();
  if (name.length < 2 || name.length > 120) return { ok: false, error: "Indica tu nombre" };
  if (!EMAIL.test(email) || email.length > 200) return { ok: false, error: "Indica un correo válido" };
  if (message.length < 10 || message.length > 4000) return { ok: false, error: "Cuéntanos el flujo en al menos una frase" };
  const kind = input.kind === "correduria" || input.kind === "asesoria" ? input.kind : "otro";
  return {
    ok: true,
    lead: {
      id: newId(),
      name,
      email,
      phone: (input.phone ?? "").trim().slice(0, 40) || null,
      firm: (input.firm ?? "").trim().slice(0, 160) || null,
      kind,
      message,
      source: (input.source ?? "web").slice(0, 40),
      ipHash: input.ip ? createHash("sha256").update(input.ip).digest("hex").slice(0, 16) : null,
      createdAt: nowIso(),
    },
  };
}

export async function saveLead(store: Store, lead: Lead, notify: { sender: Sender; to: string | null; from: string | null }): Promise<{ notified: boolean }> {
  await store.leads.insert(lead);
  if (!notify.to) return { notified: false };
  const r = await notify.sender.send({
    id: lead.id, firmId: "-", documentId: "-", channel: "email", to: notify.to,
    subject: `Nueva solicitud: ${lead.firm ?? lead.name} (${lead.kind})`,
    body: `${lead.name} <${lead.email}>${lead.phone ? ` · ${lead.phone}` : ""}\n${lead.firm ?? ""} · ${lead.kind} · ${lead.source}\n\n${lead.message}`,
    usage: null, createdAt: lead.createdAt,
  });
  return { notified: r.ok };
}
