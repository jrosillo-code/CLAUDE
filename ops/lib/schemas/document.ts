import { z } from "zod";

// Every extracted value is a Field: the value plus the exact text it was read
// from and the page. The model is instructed to leave a field null when the
// document does not state it. Validation later treats a value without a quote
// as missing, so nothing invented can become a fact downstream.

const field = <T extends z.ZodTypeAny>(value: T) =>
  z
    .object({
      value,
      quote: z.string().describe("Exact text in the document this value was read from"),
      page: z.number().int().nullable().describe("1-based page, or null if unknown"),
    })
    .nullable();

export const FacturaSchema = z.object({
  emisor_nombre: field(z.string()),
  emisor_nif: field(z.string()),
  receptor_nombre: field(z.string()),
  receptor_nif: field(z.string()),
  serie: field(z.string()),
  numero: field(z.string()),
  fecha_expedicion: field(z.string().describe("ISO date YYYY-MM-DD")),
  base_imponible: field(z.number()),
  tipo_iva: field(z.number().describe("percent, e.g. 21")),
  cuota_iva: field(z.number()),
  total: field(z.number()),
  concepto: field(z.string()),
});

export const ReciboSchema = z.object({
  pagador: field(z.string()),
  beneficiario: field(z.string()),
  importe: field(z.number()),
  fecha: field(z.string().describe("ISO date YYYY-MM-DD")),
  concepto: field(z.string()),
  referencia_poliza: field(z.string()),
  estado: field(z.enum(["pagado", "pendiente", "devuelto"])),
});

export const ParteSiniestroSchema = z.object({
  tipo: field(z.enum(["auto", "hogar", "salud", "otro"])),
  numero_poliza: field(z.string()),
  asegurado_nombre: field(z.string()),
  fecha_siniestro: field(z.string().describe("ISO date YYYY-MM-DD")),
  lugar: field(z.string()),
  descripcion: field(z.string()),
  terceros_implicados: field(z.boolean()),
  documentos_adjuntos: z
    .array(z.enum(["parte_amistoso", "fotos", "presupuesto", "factura_reparacion", "permiso_circulacion", "carnet_conducir", "informe_medico", "denuncia", "otro"]))
    .describe("Kinds of supporting documents actually present in this file"),
});

export const PolizaSchema = z.object({
  numero: field(z.string()),
  aseguradora: field(z.string()),
  tomador_nombre: field(z.string()),
  tomador_nif: field(z.string()),
  ramo: field(z.string()),
  fecha_efecto: field(z.string().describe("ISO date YYYY-MM-DD")),
  fecha_vencimiento: field(z.string().describe("ISO date YYYY-MM-DD")),
  prima_total: field(z.number()),
});

export const IdentidadSchema = z.object({
  nombre: field(z.string()),
  numero_documento: field(z.string()),
  fecha_caducidad: field(z.string().describe("ISO date YYYY-MM-DD")),
});

export const DocumentExtractionSchema = z.object({
  kind: z.enum(["factura", "recibo", "parte_siniestro", "poliza", "identidad", "otro"]),
  kind_confidence: z.number().min(0).max(1),
  language: z.string().describe("ISO 639-1 code of the document language"),
  summary: z.string().describe("One sentence, in Spanish, of what this document is"),
  factura: FacturaSchema.nullable(),
  recibo: ReciboSchema.nullable(),
  parte_siniestro: ParteSiniestroSchema.nullable(),
  poliza: PolizaSchema.nullable(),
  identidad: IdentidadSchema.nullable(),
});

export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;
export type Factura = z.infer<typeof FacturaSchema>;
export type Recibo = z.infer<typeof ReciboSchema>;
export type ParteSiniestro = z.infer<typeof ParteSiniestroSchema>;
export type Poliza = z.infer<typeof PolizaSchema>;

export const DraftSchema = z.object({
  subject: z.string().describe("Asunto breve, en español"),
  body: z.string().describe("Cuerpo del mensaje, en español, sin despedida ni firma"),
});
export type DraftOutput = z.infer<typeof DraftSchema>;
