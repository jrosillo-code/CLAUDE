import Link from "next/link";
import type { Metadata } from "next";
import { MeshCanvas } from "@/components/mesh-canvas";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, Faq, JsonLd, faqJsonLd, ORG_JSONLD } from "@/components/site";
import { getLang, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COPY = {
  es: {
    meta: { title: "Precios", description: "Auditoría de flujos de 1.500 a 3.000 €, sprint de automatización de 6.000 a 12.000 € en dos semanas, operaciones gestionadas de 2.000 a 6.000 € al mes. Precios públicos." },
    faq: [
      ["¿Por qué un rango y no un precio fijo?", "Porque el tamaño del despacho y el estado de sus sistemas cambian el trabajo. La auditoría cierra el precio exacto del sprint por escrito antes de empezar, y se descuenta íntegra."],
      ["¿Qué significa 'si no ahorramos horas, no seguimos'?", "En la auditoría medimos las horas actuales del flujo. Al final del sprint las volvemos a medir. Si no hay ahorro medible, no proponemos operaciones gestionadas y te quedas con lo construido."],
      ["¿Hay costes aparte?", "El uso del modelo de IA, que se factura por lo consumido y suele ser de céntimos por documento. Cada despacho tiene un presupuesto mensual con aviso al 80 %. No hay licencias por usuario."],
      ["¿Y las ayudas públicas?", "El Kit Digital cerró su última convocatoria en octubre de 2025; el Kit Consulting y el Ticket Innova siguen abiertos con importes menores. Te decimos qué aplica, pero no basamos la propuesta en una subvención."],
    ] as Array<[string, string]>,
    eyebrow: "Precios", h1: "Precios públicos. Alcance cerrado por escrito. 50 % al inicio.", lede: "Vendemos alcance, no horas. Empezamos por el flujo que más tiempo te cuesta y medimos antes y después.",
    offers: { eyebrow: "Tres formas de trabajar", title: "Auditoría, sprint, operaciones.",
      items: [
        ["Una semana", "Auditoría de flujos", "1.500 a 3.000 €", ["Un día en el despacho o en remoto con quien hace el trabajo", "Inventario de tareas, horas, sistemas y canales", "5 a 10 flujos automatizables con horas estimadas y retorno", "Prototipo funcionando del mejor, con tus documentos", "Precio cerrado del sprint por escrito", "Se descuenta íntegra si contratas el sprint"]],
        ["Dos semanas", "Sprint de automatización", "6.000 a 12.000 €", ["Un flujo en producción, integrado con tu programa de gestión", "Kit de cumplimiento: aviso de IA, revisión humana, registro, contrato de encargo", "Pruebas automáticas y documentación", "Formación del equipo, media jornada", "Una ronda de ajustes", "Medición de horas al final"]],
        ["Mensual", "Operaciones gestionadas", "2.000 a 6.000 €/mes", ["Mantenimiento y guardia", "Nuevos flujos cada trimestre", "Informe mensual: horas ahorradas, euros recuperados, acierto por tipo de documento, coste del modelo", "Presupuesto de tokens con aviso", "Facturación anual con descuento"]],
      ] as Array<[string, string, string, string[]]> },
    compare: { eyebrow: "Comparativa", title: "Qué incluye cada opción.", cols: ["Auditoría", "Sprint", "Operaciones"], yes: "Incluido",
      rows: [["Precio", "1.500 a 3.000 €", "6.000 a 12.000 €", "2.000 a 6.000 €/mes"], ["Duración", "Una semana", "Dos semanas", "Mensual, trimestres"], ["Inventario de tareas, horas y sistemas", "yes", "yes", "yes"], ["Prototipo con tus documentos", "yes", "yes", "yes"], ["Un flujo en producción, integrado", "—", "yes", "yes"], ["Kit de cumplimiento", "—", "yes", "yes"], ["Pruebas automáticas y documentación", "—", "yes", "yes"], ["Formación del equipo", "—", "Media jornada", "Continua"], ["Nuevos flujos", "—", "—", "Uno por trimestre"], ["Informe mensual de horas, euros y acierto", "—", "Al cierre", "yes"], ["Guardia y mantenimiento", "—", "Una ronda de ajustes", "yes"], ["Pago", "Por adelantado", "50 % al inicio", "Anual con descuento"]] as Array<[string, string, string, string]>,
      note1: "El ", kitLink: "kit de cumplimiento", note2: " es el mismo en el sprint y en operaciones: aviso de IA, revisión humana, registro exportable, trazabilidad, contrato de encargo, presupuesto de modelo." },
    not: { eyebrow: "Qué no incluye", title: "Para que no haya sorpresas.", items: ["El motor de facturación Verifactu: se integra uno certificado, no lo escribimos nosotros (evitamos la responsabilidad de productor y la declaración responsable).", "Las licencias de tu programa de gestión, ni las de WhatsApp Business o correo.", "El consumo del modelo de IA, facturado por uso y visible en el registro.", "Trabajo fuera del flujo acordado: se presupuesta aparte o entra en el siguiente trimestre de operaciones."] },
    founder: { eyebrow: "Precio de fundador", title: "Tres primeros despachos.", quote: "Auditoría descontada aunque no continúen, y el primer trimestre de operaciones al mínimo del rango, a cambio de un caso de estudio con cifras reales y anonimizadas.", small: "Vale para los tres primeros sprints firmados." },
    faqHead: { eyebrow: "Preguntas", title: "Sobre el precio." },
    final: "Cuéntame el flujo y te digo en qué rango cae antes de la llamada.",
  },
  en: {
    meta: { title: "Pricing", description: "Workflow audit from €1,500 to €3,000, automation sprint from €6,000 to €12,000 in two weeks, managed operations from €2,000 to €6,000 a month. Public prices." },
    faq: [
      ["Why a range and not a fixed price?", "Because the size of the firm and the state of its systems change the work. The audit fixes the exact sprint price in writing before we start, and is fully credited."],
      ["What does 'if we do not save hours, we stop' mean?", "During the audit we measure the workflow's current hours. At the end of the sprint we measure them again. If there is no measurable saving, we do not propose managed operations and you keep what was built."],
      ["Are there costs on top?", "The AI model's usage, billed as consumed and usually cents per document. Each firm has a monthly budget with a warning at 80%. There are no per-user licences."],
      ["What about public grants?", "Kit Digital closed its last call in October 2025; Kit Consulting and Ticket Innova remain open with smaller amounts. We tell you what applies, but we never base the proposal on a grant."],
    ] as Array<[string, string]>,
    eyebrow: "Pricing", h1: "Public prices. Scope fixed in writing. 50% up front.", lede: "We sell scope, not hours. We start with the workflow that costs you the most time and measure before and after.",
    offers: { eyebrow: "Three ways to work", title: "Audit, sprint, operations.",
      items: [
        ["One week", "Workflow audit", "€1,500 to €3,000", ["One day at the firm or remote with the people doing the work", "Inventory of tasks, hours, systems and channels", "5 to 10 automatable workflows with estimated hours and return", "A working prototype of the best one, with your documents", "Fixed sprint price in writing", "Fully credited if you book the sprint"]],
        ["Two weeks", "Automation sprint", "€6,000 to €12,000", ["One workflow in production, integrated with your management software", "Compliance kit: AI notice, human review, log, processing agreement", "Automated tests and documentation", "Team training, half a day", "One round of adjustments", "Hours measured at the end"]],
        ["Monthly", "Managed operations", "€2,000 to €6,000 per month", ["Maintenance and on-call", "New workflows every quarter", "Monthly report: hours saved, euros recovered, accuracy by document type, model cost", "Token budget with warning", "Annual billing with a discount"]],
      ] as Array<[string, string, string, string[]]> },
    compare: { eyebrow: "Comparison", title: "What each option includes.", cols: ["Audit", "Sprint", "Operations"], yes: "Included",
      rows: [["Price", "€1,500 to €3,000", "€6,000 to €12,000", "€2,000 to €6,000 per month"], ["Duration", "One week", "Two weeks", "Monthly, by quarter"], ["Inventory of tasks, hours and systems", "yes", "yes", "yes"], ["Prototype with your documents", "yes", "yes", "yes"], ["One workflow in production, integrated", "—", "yes", "yes"], ["Compliance kit", "—", "yes", "yes"], ["Automated tests and documentation", "—", "yes", "yes"], ["Team training", "—", "Half a day", "Ongoing"], ["New workflows", "—", "—", "One per quarter"], ["Monthly report of hours, euros and accuracy", "—", "At close", "yes"], ["On-call and maintenance", "—", "One round of adjustments", "yes"], ["Payment", "In advance", "50% up front", "Annual with a discount"]] as Array<[string, string, string, string]>,
      note1: "The ", kitLink: "compliance kit", note2: " is the same in the sprint and in operations: AI notice, human review, exportable log, traceability, processing agreement, model budget." },
    not: { eyebrow: "What is not included", title: "So there are no surprises.", items: ["The Verifactu invoicing engine: a certified one is integrated, we do not write it (we avoid producer liability and the responsible declaration).", "Licences for your management software, WhatsApp Business or email.", "AI model usage, billed as consumed and visible in the log.", "Work outside the agreed workflow: quoted separately or scheduled into the next quarter of operations."] },
    founder: { eyebrow: "Founder price", title: "The first three firms.", quote: "The audit credited even if they do not continue, and the first quarter of operations at the bottom of the range, in exchange for a case study with real, anonymised figures.", small: "Valid for the first three signed sprints." },
    faqHead: { eyebrow: "Questions", title: "About the price." },
    final: "Tell me the workflow and I will tell you which range it falls in before the call.",
  },
} satisfies Record<Lang, unknown>;

export async function generateMetadata(): Promise<Metadata> {
  const c = COPY[await getLang()];
  return { title: c.meta.title, description: c.meta.description };
}

export default async function Precios() {
  const c = COPY[await getLang()];
  return (
    <div className="wrap">
      <JsonLd data={ORG_JSONLD} />
      <JsonLd data={faqJsonLd(c.faq)} />
      <SiteNav current="/precios" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">{c.eyebrow}</div>
        <h1>{c.h1}</h1>
        <p className="lede">{c.lede}</p>
      </section>

      <Section eyebrow={c.offers.eyebrow} title={c.offers.title}>
        <div className="offers">
          {c.offers.items.map(([time, name, price, bullets], i) => (
            <div className={`offer${i === 1 ? " featured" : ""}`} key={name}><div className="time">{time}</div><h3>{name}</h3><div className="price">{price}</div><ul>{bullets.map((b) => <li key={b}>{b}</li>)}</ul></div>
          ))}
        </div>
      </Section>

      <Section band eyebrow={c.compare.eyebrow} title={c.compare.title}>
        <div className="table-wrap">
          <table className="compare">
            <thead><tr><th style={{ width: "34%" }}></th><th>{c.compare.cols[0]}</th><th className="featured">{c.compare.cols[1]}</th><th>{c.compare.cols[2]}</th></tr></thead>
            <tbody>
              {c.compare.rows.map(([label, a, b, d]) => (
                <tr key={label}><td>{label}</td>{[a, b, d].map((v, i) => <td key={i} className={`${i === 1 ? "featured " : ""}${v === "yes" ? "yes" : v === "—" ? "muted" : /€/.test(v) ? "num" : ""}`}>{v === "yes" ? c.compare.yes : v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>{c.compare.note1}<Link href="/kit-cumplimiento">{c.compare.kitLink}</Link>{c.compare.note2}</p>
      </Section>

      <Section eyebrow={c.not.eyebrow} title={c.not.title}>
        <ul className="list-plain">{c.not.items.map((x) => <li key={x}>{x}</li>)}</ul>
      </Section>

      <Section eyebrow={c.founder.eyebrow} title={c.founder.title}>
        <blockquote className="pull" style={{ margin: 0 }}>{c.founder.quote}<small>{c.founder.small}</small></blockquote>
      </Section>

      <Section eyebrow={c.faqHead.eyebrow} title={c.faqHead.title}><Faq items={c.faq} /></Section>
      <FinalCta title={c.final} />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
