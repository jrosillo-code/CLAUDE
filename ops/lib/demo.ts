import type { Extractor, Drafter, DocumentInput, DraftInput } from "./claude";
import type { DocumentExtraction, DraftOutput } from "./schemas/document";
import type { ModelUsage } from "./types";

// Keyless mode. Without ANTHROPIC_API_KEY the pipeline still runs end to end
// on a deterministic reader, so the review queue, approvals and audit log can
// be exercised locally and in tests. The demo reader classifies by file name
// and returns provenance-bearing fields, including one deliberately missing
// item so a draft and a task are produced.

const usage = (model = "demo"): ModelUsage => ({ model, promptHash: "demo", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsd: 0 });

export class DemoExtractor implements Extractor {
  async extract(input: DocumentInput): Promise<{ data: DocumentExtraction; usage: ModelUsage }> {
    const name = `${input.fileName ?? ""} ${input.text ?? ""}`.toLowerCase();
    const base: DocumentExtraction = {
      kind: "otro", kind_confidence: 0.5, language: "es", summary: "Documento no reconocido (modo demo)",
      factura: null, recibo: null, parte_siniestro: null, poliza: null, identidad: null,
    };
    if (name.includes("siniestro") || name.includes("parte")) {
      return { usage: usage(), data: { ...base, kind: "parte_siniestro", kind_confidence: 0.92, summary: "Parte de siniestro de automóvil con fotos, sin permiso de circulación",
        parte_siniestro: {
          tipo: { value: "auto", quote: "Siniestro de automóvil", page: 1 },
          numero_poliza: { value: "AU-2024-778812", quote: "Póliza nº AU-2024-778812", page: 1 },
          asegurado_nombre: { value: "Marta Ruiz Pardo", quote: "Asegurada: Marta Ruiz Pardo", page: 1 },
          fecha_siniestro: { value: "2026-09-03", quote: "Fecha del siniestro: 03/09/2026", page: 1 },
          lugar: { value: "Calle Alcalá 120, Madrid", quote: "Lugar: Calle Alcalá 120, Madrid", page: 1 },
          descripcion: { value: "Colisión por alcance en semáforo", quote: "colisión por alcance en semáforo", page: 1 },
          terceros_implicados: { value: true, quote: "Otro vehículo implicado: sí", page: 1 },
          documentos_adjuntos: ["fotos", "parte_amistoso"],
        } } };
    }
    if (name.includes("factura")) {
      return { usage: usage(), data: { ...base, kind: "factura", kind_confidence: 0.95, summary: "Factura de servicios de Talleres Norte SL sin NIF del receptor",
        factura: {
          emisor_nombre: { value: "Talleres Norte SL", quote: "Talleres Norte SL", page: 1 },
          emisor_nif: { value: "B12345674", quote: "CIF B-12345674", page: 1 },
          receptor_nombre: { value: "Marta Ruiz Pardo", quote: "Cliente: Marta Ruiz Pardo", page: 1 },
          receptor_nif: null,
          serie: null,
          numero: { value: "2026/0412", quote: "Factura nº 2026/0412", page: 1 },
          fecha_expedicion: { value: "2026-09-05", quote: "Fecha: 05/09/2026", page: 1 },
          base_imponible: { value: 820, quote: "Base imponible 820,00", page: 1 },
          tipo_iva: { value: 21, quote: "IVA 21%", page: 1 },
          cuota_iva: { value: 172.2, quote: "Cuota IVA 172,20", page: 1 },
          total: { value: 992.2, quote: "TOTAL 992,20 €", page: 1 },
          concepto: { value: "Reparación paragolpes trasero", quote: "Reparación paragolpes trasero", page: 1 },
        } } };
    }
    if (name.includes("poliza") || name.includes("póliza")) {
      return { usage: usage(), data: { ...base, kind: "poliza", kind_confidence: 0.9, summary: "Póliza de hogar que vence en pocas semanas",
        poliza: {
          numero: { value: "HG-55-220931", quote: "Póliza HG-55-220931", page: 1 },
          aseguradora: { value: "Aseguradora Ejemplo SA", quote: "Aseguradora Ejemplo SA", page: 1 },
          tomador_nombre: { value: "Luis Ortega Vila", quote: "Tomador: Luis Ortega Vila", page: 1 },
          tomador_nif: { value: "12345678Z", quote: "NIF 12345678Z", page: 1 },
          ramo: { value: "Hogar", quote: "Ramo: Hogar", page: 1 },
          fecha_efecto: { value: "2025-10-15", quote: "Efecto 15/10/2025", page: 1 },
          fecha_vencimiento: { value: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), quote: "Vencimiento", page: 1 },
          prima_total: { value: 412.5, quote: "Prima total 412,50 €", page: 2 },
        } } };
    }
    return { usage: usage(), data: base };
  }
}

export class DemoDrafter implements Drafter {
  async draft(input: DraftInput): Promise<{ data: DraftOutput; usage: ModelUsage }> {
    const list = input.missing.map((m) => `- ${m}`).join("\n");
    return {
      usage: usage(),
      data: {
        subject: `Documentación pendiente: ${input.documentSummary.slice(0, 60)}`,
        body: `Hola,\n\nhemos recibido el documento (${input.documentSummary}). Para poder tramitarlo nos falta:\n${list}\n\n¿Nos lo puedes enviar por esta misma vía cuando puedas? Gracias.`,
      },
    };
  }
}

export class DemoSettlementExtractor {
  async extractSettlement(): Promise<{ data: import("./schemas/liquidacion").Liquidacion; usage: ModelUsage }> {
    const f = (v: string | number, q: string) => ({ value: v, quote: q, page: 1 });
    return {
      usage: usage(),
      data: {
        aseguradora: f("Aseguradora Ejemplo SA", "Aseguradora Ejemplo SA") as never,
        codigo_mediador: f("M-4471", "Mediador M-4471") as never,
        periodo_inicio: f("2026-08-01", "01/08/2026") as never,
        periodo_fin: f("2026-08-31", "31/08/2026") as never,
        total_comisiones: f(261.3, "Total comisiones 261,30") as never,
        lineas: [
          { numero_poliza: f("HG-55-220931", "HG-55-220931") as never, numero_recibo: f("R-1", "R-1") as never, tomador: f("Luis Ortega Vila", "Luis Ortega Vila") as never, ramo: f("Hogar", "Hogar") as never, prima: f(412.5, "412,50") as never, comision_pct: f(20, "20%") as never, comision_importe: f(82.5, "82,50") as never, fecha_efecto: f("2026-08-10", "10/08/2026") as never, tipo_movimiento: f("cobro", "Cobro") as never },
          { numero_poliza: f("AU-2024-778812", "AU-2024-778812") as never, numero_recibo: f("R-2", "R-2") as never, tomador: f("Marta Ruiz Pardo", "Marta Ruiz Pardo") as never, ramo: f("Autos", "Autos") as never, prima: f(640, "640,00") as never, comision_pct: f(12, "12%") as never, comision_importe: f(70.4, "70,40") as never, fecha_efecto: f("2026-08-14", "14/08/2026") as never, tipo_movimiento: f("cobro", "Cobro") as never },
          { numero_poliza: f("VD-90-000123", "VD-90-000123") as never, numero_recibo: null, tomador: f("Ana Pérez", "Ana Pérez") as never, ramo: f("Vida", "Vida") as never, prima: f(300, "300,00") as never, comision_pct: f(5, "5%") as never, comision_importe: f(15, "15,00") as never, fecha_efecto: null, tipo_movimiento: f("cobro", "Cobro") as never },
        ],
      },
    };
  }
}
