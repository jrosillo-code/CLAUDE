import { makePdf } from "./pdf";

// Fixture documents with the ground truth the reader should produce. The
// text mirrors lib/demo.ts so the harness passes trivially on the demo
// reader and measures the real one with ANTHROPIC_API_KEY set. Replace or
// extend with anonymised real documents from the pilot firm as they arrive.

export interface ExpectedField { value: string | number | boolean | null }
export interface Fixture {
  name: string;
  fileName: string;
  kind: "factura" | "recibo" | "parte_siniestro" | "poliza" | "identidad" | "liquidacion";
  lines: string[];
  title: string;
  /** Section fields expected; null means the document does not state it. */
  expected: Record<string, string | number | boolean | null>;
  /** For settlements: expected number of lines. */
  expectedLines?: number;
  pdf: () => Uint8Array;
}

const f = (name: string, fileName: string, kind: Fixture["kind"], title: string, lines: string[], expected: Fixture["expected"], expectedLines?: number): Fixture => ({
  name, fileName, kind, title, lines, expected, expectedLines, pdf: () => makePdf([{ title, lines }]),
});

export const FIXTURES: Fixture[] = [
  f("factura completa", "factura-taller.pdf", "factura", "FACTURA", [
    "Talleres Norte SL", "CIF B-12345674", "Calle Industria 4, 28850 Torrejón de Ardoz", "",
    "Factura nº 2026/0412", "Fecha: 05/09/2026", "Cliente: Marta Ruiz Pardo", "",
    "Concepto: Reparación paragolpes trasero", "Base imponible 820,00", "IVA 21%", "Cuota IVA 172,20", "TOTAL 992,20 €",
  ], { emisor_nombre: "Talleres Norte SL", emisor_nif: "B12345674", numero: "2026/0412", fecha_expedicion: "2026-09-05", base_imponible: 820, tipo_iva: 21, cuota_iva: 172.2, total: 992.2, receptor_nif: null }),
  f("parte de siniestro auto", "parte-siniestro.pdf", "parte_siniestro", "PARTE DE SINIESTRO", [
    "Siniestro de automóvil", "Póliza nº AU-2024-778812", "Asegurada: Marta Ruiz Pardo", "Fecha del siniestro: 03/09/2026",
    "Lugar: Calle Alcalá 120, Madrid", "Descripción: colisión por alcance en semáforo", "Otro vehículo implicado: sí",
    "Documentos adjuntos: fotografías de los daños (4), parte amistoso firmado",
  ], { numero_poliza: "AU-2024-778812", asegurado_nombre: "Marta Ruiz Pardo", fecha_siniestro: "2026-09-03", tipo: "auto", terceros_implicados: true }),
  f("póliza hogar", "poliza-hogar.pdf", "poliza", "CONDICIONES PARTICULARES", [
    "Aseguradora Ejemplo SA", "Póliza HG-55-220931", "Ramo: Hogar", "Tomador: Luis Ortega Vila", "NIF 12345678Z",
    "Efecto 15/10/2025", "Vencimiento 15/10/2026", "Prima total 412,50 €",
  ], { numero: "HG-55-220931", aseguradora: "Aseguradora Ejemplo SA", tomador_nombre: "Luis Ortega Vila", tomador_nif: "12345678Z", ramo: "Hogar", fecha_efecto: "2025-10-15", fecha_vencimiento: "2026-10-15", prima_total: 412.5 }),
  f("liquidación agosto", "liquidacion-agosto.pdf", "liquidacion", "LIQUIDACIÓN DE COMISIONES", [
    "Aseguradora Ejemplo SA", "Mediador M-4471", "Periodo: 01/08/2026 a 31/08/2026", "",
    "Póliza          Recibo  Tomador             Ramo   Prima    %    Comisión  Efecto      Mov.",
    "HG-55-220931    R-1     Luis Ortega Vila    Hogar  412,50   20%  82,50     10/08/2026  Cobro",
    "AU-2024-778812  R-2     Marta Ruiz Pardo    Autos  640,00   12%  70,40     14/08/2026  Cobro",
    "VD-90-000123            Ana Pérez           Vida   300,00   5%   15,00                 Cobro",
    "", "Total comisiones 261,30",
  ], { aseguradora: "Aseguradora Ejemplo SA", codigo_mediador: "M-4471", periodo_inicio: "2026-08-01", periodo_fin: "2026-08-31", total_comisiones: 261.3 }, 3),
];
