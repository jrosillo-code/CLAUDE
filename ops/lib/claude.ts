import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ModelUsage } from "./types";
import { DocumentExtractionSchema, DraftSchema, type DocumentExtraction, type DraftOutput } from "./schemas/document";
import { LiquidacionSchema, type Liquidacion } from "./schemas/liquidacion";
import { estimateCostUsd } from "./pricing";
import { sha256 } from "./ids";

// The only file that talks to the model. Two calls exist: read a document into
// the provenance schema, and word a reply from facts the validator already
// decided. Both are stateless and both return usage for the audit log.

export const MODEL = process.env.OPS_MODEL || "claude-opus-5";

export interface DocumentInput {
  mediaType: string;
  bytes?: Uint8Array;
  text?: string;
  /** Original file name; context for the reader, never a source of facts. */
  fileName?: string;
}

export interface Extractor {
  extract(input: DocumentInput): Promise<{ data: DocumentExtraction; usage: ModelUsage }>;
}

export interface SettlementExtractor {
  extractSettlement(input: DocumentInput): Promise<{ data: Liquidacion; usage: ModelUsage }>;
}

export interface Drafter {
  draft(input: DraftInput): Promise<{ data: DraftOutput; usage: ModelUsage }>;
}

export interface DraftInput {
  firmName: string;
  firmKind: "correduria" | "asesoria";
  recipientName: string | null;
  channel: "email" | "whatsapp";
  documentSummary: string;
  missing: string[];
  warnings: string[];
}

// Frozen system prompts: stable text first so prompt caching hits across
// documents; nothing per-request goes in here.
const EXTRACT_SYSTEM = `Eres el sistema de lectura de documentos de un despacho español (correduría de seguros o asesoría).
Lees el documento adjunto y rellenas el esquema.
Reglas:
- Solo anotas un valor si aparece literalmente en el documento. Copia en "quote" el texto exacto del que lo lees y en "page" la página.
- Si un dato no consta, deja el campo en null. Nunca deduzcas, calcules ni completes datos que no estén escritos.
- Fechas en formato ISO AAAA-MM-DD. Importes como número sin símbolo.
- "kind" es el tipo principal del documento; rellena solo la sección correspondiente y deja las demás en null.
- "summary" es una frase en español que un administrativo entendería.`;

const SETTLEMENT_SYSTEM = `Eres el sistema de lectura de liquidaciones de comisiones de una correduría de seguros española.
Lees la liquidación que envía la aseguradora (PDF, imagen o texto exportado) y rellenas el esquema con TODAS las líneas.
Reglas:
- Solo anotas un valor si aparece literalmente. Copia en "quote" el texto exacto y en "page" la página.
- Si un dato no consta en una línea, déjalo en null; nunca lo calcules ni lo deduzcas de otras líneas.
- Importes como número sin símbolo, con el signo que figure (extornos y anulaciones en negativo si así aparecen).
- Fechas en formato ISO AAAA-MM-DD.`;

const DRAFT_SYSTEM = `Redactas mensajes breves y cordiales en español para un despacho profesional.
El mensaje pide a la persona los documentos o datos que faltan. Solo puedes mencionar los elementos de la lista "faltan"; no añadas, inventes ni supongas nada.
Sin saludo genérico largo, sin despedida ni firma (se añaden después). Tono profesional y directo; en WhatsApp, más corto y sin asunto elaborado.`;

function usageOf(model: string, promptHash: string, u: Anthropic.Messages.Usage): ModelUsage {
  const cacheRead = u.cache_read_input_tokens ?? 0;
  return {
    model,
    promptHash,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: cacheRead,
    costUsd: estimateCostUsd(model, u.input_tokens, u.output_tokens, cacheRead),
  };
}

function contentFor(input: DocumentInput, instruction: string): Anthropic.Messages.ContentBlockParam[] {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];
  if (input.bytes) {
    const data = Buffer.from(input.bytes).toString("base64");
    if (input.mediaType === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    } else if (/^image\/(png|jpeg|gif|webp)$/.test(input.mediaType)) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: input.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data },
      });
    } else if (input.mediaType.startsWith("text/")) {
      blocks.push({ type: "text", text: Buffer.from(input.bytes).toString("utf8") });
    } else {
      throw new Error(`Tipo de archivo no admitido para lectura: ${input.mediaType}`);
    }
  }
  if (input.text) blocks.push({ type: "text", text: input.text });
  if (input.fileName) blocks.push({ type: "text", text: `Nombre del archivo: ${input.fileName}` });
  blocks.push({ type: "text", text: instruction });
  return blocks;
}

export class ClaudeExtractor implements Extractor {
  private client: Anthropic;
  private promptHash: string;
  constructor(client = new Anthropic(), private model = MODEL) {
    this.client = client;
    this.promptHash = sha256(EXTRACT_SYSTEM + JSON.stringify(zodOutputFormat(DocumentExtractionSchema)));
  }
  async extract(input: DocumentInput) {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(DocumentExtractionSchema) },
      system: [{ type: "text", text: EXTRACT_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: contentFor(input, "Lee el documento y rellena el esquema.") }],
    });
    if (response.stop_reason === "refusal") {
      throw new Error(`El modelo declinó leer el documento (${response.stop_details?.category ?? "sin categoría"})`);
    }
    if (!response.parsed_output) throw new Error("La lectura no devolvió un resultado válido");
    return { data: response.parsed_output, usage: usageOf(this.model, this.promptHash, response.usage) };
  }
}

export class ClaudeSettlementExtractor implements SettlementExtractor {
  private client: Anthropic;
  private promptHash: string;
  constructor(client = new Anthropic(), private model = MODEL) {
    this.client = client;
    this.promptHash = sha256(SETTLEMENT_SYSTEM + JSON.stringify(zodOutputFormat(LiquidacionSchema)));
  }
  async extractSettlement(input: DocumentInput) {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: zodOutputFormat(LiquidacionSchema) },
      system: [{ type: "text", text: SETTLEMENT_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: contentFor(input, "Lee la liquidación completa y rellena el esquema con todas las líneas.") }],
    });
    if (response.stop_reason === "refusal") throw new Error("El modelo declinó leer la liquidación");
    if (!response.parsed_output) throw new Error("La lectura de la liquidación no devolvió un resultado válido");
    return { data: response.parsed_output, usage: usageOf(this.model, this.promptHash, response.usage) };
  }
}

export class ClaudeDrafter implements Drafter {
  private client: Anthropic;
  private promptHash: string;
  constructor(client = new Anthropic(), private model = MODEL) {
    this.client = client;
    this.promptHash = sha256(DRAFT_SYSTEM + JSON.stringify(zodOutputFormat(DraftSchema)));
  }
  async draft(input: DraftInput) {
    const facts = [
      `Despacho: ${input.firmName} (${input.firmKind === "correduria" ? "correduría de seguros" : "asesoría"})`,
      `Destinatario: ${input.recipientName ?? "cliente"}`,
      `Canal: ${input.channel}`,
      `Documento recibido: ${input.documentSummary}`,
      `Faltan: ${input.missing.length ? input.missing.map((m) => `- ${m}`).join("\n") : "(nada)"}`,
      input.warnings.length ? `Avisos a mencionar: ${input.warnings.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: zodOutputFormat(DraftSchema) },
      system: [{ type: "text", text: DRAFT_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: facts }],
    });
    if (response.stop_reason === "refusal") throw new Error("El modelo declinó redactar el mensaje");
    if (!response.parsed_output) throw new Error("La redacción no devolvió un resultado válido");
    return { data: response.parsed_output, usage: usageOf(this.model, this.promptHash, response.usage) };
  }
}

/**
 * Appended to every outbound draft, after the model's text, by code. This is
 * the EU AI Act Article 50 disclosure; it is not something the model is asked
 * to remember.
 */
export function withDisclosure(body: string, firmName: string): string {
  return `${body.trim()}\n\n${firmName}\nEste mensaje se ha preparado con ayuda de un sistema de inteligencia artificial y ha sido revisado por una persona antes de enviarse.`;
}
