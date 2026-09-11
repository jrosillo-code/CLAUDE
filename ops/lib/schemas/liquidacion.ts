import { z } from "zod";

// An insurer's commission settlement statement (liquidación de comisiones).
// Each insurer sends its own format (PDF, Excel, portal export); this schema
// is the common shape they are read into. Every value keeps its quote.

const field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, quote: z.string(), page: z.number().int().nullable() }).nullable();

export const LiquidacionLineSchema = z.object({
  numero_poliza: field(z.string()),
  numero_recibo: field(z.string()),
  tomador: field(z.string()),
  ramo: field(z.string()),
  prima: field(z.number()).describe("Prima neta o total del recibo, según figure"),
  comision_pct: field(z.number()),
  comision_importe: field(z.number()),
  fecha_efecto: field(z.string().describe("ISO date YYYY-MM-DD")),
  tipo_movimiento: field(z.enum(["cobro", "anulacion", "devolucion", "extorno", "otro"])),
});

export const LiquidacionSchema = z.object({
  aseguradora: field(z.string()),
  codigo_mediador: field(z.string()),
  periodo_inicio: field(z.string().describe("ISO date YYYY-MM-DD")),
  periodo_fin: field(z.string().describe("ISO date YYYY-MM-DD")),
  total_comisiones: field(z.number()),
  lineas: z.array(LiquidacionLineSchema),
});

export type Liquidacion = z.infer<typeof LiquidacionSchema>;
export type LiquidacionLine = z.infer<typeof LiquidacionLineSchema>;
