import Link from "next/link";
import type { Metadata } from "next";
import { MeshCanvas } from "@/components/mesh-canvas";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, AuditMock, DisclosureLine, JsonLd, ORG_JSONLD } from "@/components/site";
import { getLang, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// The compliance kit as a page: the same seven items that ship with every
// build, in the order a data protection officer reads them, printable as the
// document that goes with the pilot agreement.

type Item = { n: string; title: string; what: string; how: string; where: string };

const COPY = {
  es: {
    meta: { title: "Kit de cumplimiento", description: "Los siete controles que lleva cada flujo desde el primer día: aviso de IA (art. 50 del Reglamento de IA), revisión humana, registro de actividad exportable, trazabilidad de cada dato, contrato de encargo y datos en la UE, facturación con motor certificado Verifactu, presupuesto de modelo con aviso." },
    eyebrow: "Kit de cumplimiento", h1: "Siete controles que lleva cada flujo desde el primer día.",
    lede: "No es un chatbot cualquiera: es un flujo auditable diseñado para despachos regulados en España. Esta página es el kit completo, tal como se entrega con cada sprint; imprímela para tu delegado de protección de datos.",
    cta1: "Pedir el kit con el contrato de encargo", cta2: "Ver los controles técnicos",
    points: { eyebrow: "Los siete puntos", title: "Qué garantiza cada uno, cómo lo hace el sistema y dónde se ve.", how: "Cómo.", where: "Dónde." },
    items: [
      { n: "01", title: "Aviso de IA", what: "Toda comunicación generada o asistida por IA lo indica, como exige el artículo 50 del Reglamento Europeo de IA, en vigor desde el 2 de agosto de 2026.", how: "El sistema añade el aviso al final de cada mensaje después de la revisión humana; el modelo no participa. Editar el borrador no lo elimina.", where: "Pie de email y de WhatsApp. Texto estándar, sin variaciones." },
      { n: "02", title: "Revisión humana", what: "Ningún envío al exterior ni escritura definitiva en el programa de gestión sin la aprobación de una persona con nombre.", how: "Una única función del código es la puerta de salida y exige una aprobación pendiente. Si el envío falla, la aprobación sigue pendiente y el fallo queda registrado.", where: "Cola de revisión: documento y propuesta en la misma pantalla; aprobar, corregir o rechazar." },
      { n: "03", title: "Registro de actividad", what: "Cada documento recibido, cada lectura, cada validación, cada borrador, cada corrección y cada aprobación quedan registrados con fecha, usuario, versión del modelo y coste.", how: "La tabla solo admite inserciones: sin actualizar ni borrar, ni siquiera por el despacho. Sobrevive al borrado de los documentos.", where: "Pantalla de actividad y exportación en CSV desde la aplicación." },
      { n: "04", title: "Trazabilidad", what: "Cada dato extraído enlaza con el documento y la página de origen. La IA nunca inventa un dato: si no está en el documento, se marca como ausente.", how: "Un valor sin texto de origen se trata como ausente por código. La evaluación automática cuenta como inventado cualquier valor cuyo texto no aparece en el documento.", where: "Cada campo de la cola muestra la cita y la página; las correcciones guardan quién y cuándo." },
      { n: "05", title: "Datos", what: "Contrato de encargo del tratamiento (artículo 28 RGPD). Datos de salud y de terceros dentro de la UE. Retención definida por el despacho. Sin uso de los datos para entrenar nada.", how: "Base de datos, ficheros y autenticación en región europea; proveedor de modelos sin retención para entrenamiento. La retención se configura en días y la aplica una tarea diaria que borra originales y datos leídos, nunca el registro.", where: "Contrato de encargo y lista de subencargados; ajuste de retención en la aplicación." },
      { n: "06", title: "Facturación", what: "Si el flujo emite facturas, se integra un motor certificado Verifactu. No se implementa el registro, el hash ni el envío a la AEAT por cuenta propia.", how: "Evita la responsabilidad de productor de software y la declaración responsable. El sistema prepara los datos; el motor certificado firma y envía.", where: "Solo en flujos de facturación; en corredurías no aplica." },
      { n: "07", title: "Coste y límites", what: "Presupuesto mensual de tokens por despacho, con aviso al 80 %, para saber lo que cuesta el mes antes de que llegue la factura.", how: "Ninguna llamada al modelo sin comprobar el presupuesto; al llegar al techo el sistema se detiene hasta el mes siguiente. El aviso se registra y se envía al correo que el despacho indique.", where: "Cada lectura registra tokens y coste; el informe mensual los suma." },
    ] as Item[],
    looks: { eyebrow: "Tal cual se ve", title: "El registro y el aviso." },
    rules: { eyebrow: "Marco", title: "Las normas detrás de cada punto.",
      items: ["Reglamento (UE) 2024/1689 de Inteligencia Artificial, artículo 50: obligaciones de transparencia aplicables desde el 2 de agosto de 2026.", "RGPD, artículo 28: contrato de encargo del tratamiento; artículo 9: categorías especiales (salud) en vida, salud y decesos.", "Opinión de EIOPA sobre gobernanza y gestión de riesgos de IA en seguros (agosto de 2025) y prioridades de supervisión de la DGSFP 2026 a 2028.", "Verifactu (RD 1007/2023 y orden HAC/1177/2024): obligatorio para sociedades desde el 1 de enero de 2027 y para el resto desde el 1 de julio de 2027."],
      note1: "Las fechas se revisan antes de cada entrega; si una norma cambia, cambia el kit. Documentos relacionados: ", a: "contrato de encargo", sep: ", ", b: "política de privacidad", end: "." },
    final: "¿Tu DPO quiere ver el kit aplicado a tu flujo? Lo revisamos juntos en 30 minutos.",
  },
  en: {
    meta: { title: "Compliance kit", description: "The seven controls every workflow carries from day one: AI notice (art. 50 of the AI Act), human review, exportable activity log, traceability of every value, processing agreement and data in the EU, invoicing through a certified Verifactu engine, model budget with warning." },
    eyebrow: "Compliance kit", h1: "Seven controls every workflow carries from day one.",
    lede: "This is not just another chatbot: it is an auditable workflow designed for regulated firms in Spain. This page is the complete kit, as delivered with every sprint; print it for your data protection officer.",
    cta1: "Request the kit with the processing agreement", cta2: "See the technical controls",
    points: { eyebrow: "The seven points", title: "What each one guarantees, how the system does it and where you see it.", how: "How.", where: "Where." },
    items: [
      { n: "01", title: "AI notice", what: "Every communication generated or assisted by AI says so, as required by article 50 of the EU AI Act, in force since 2 August 2026.", how: "The system appends the notice at the end of every message after human review; the model plays no part. Editing the draft does not remove it.", where: "Email and WhatsApp footer. Standard text, no variations." },
      { n: "02", title: "Human review", what: "No external send and no definitive write into the management software without the approval of a named person.", how: "A single function in the code is the exit door and requires a pending approval. If the send fails, the approval stays pending and the failure is logged.", where: "Review queue: document and proposal on one screen; approve, correct or reject." },
      { n: "03", title: "Activity log", what: "Every document received, every reading, every validation, every draft, every correction and every approval is recorded with date, user, model version and cost.", how: "The table accepts inserts only: no updates, no deletes, not even by the firm. It survives the deletion of the documents.", where: "Activity screen and CSV export from the application." },
      { n: "04", title: "Traceability", what: "Every extracted value links to the source document and page. The AI never invents a value: if it is not in the document, it is marked missing.", how: "A value without source text is treated as missing by code. Automated evaluation counts any value whose text does not appear in the document as invented.", where: "Every field in the queue shows the citation and the page; corrections keep who and when." },
      { n: "05", title: "Data", what: "Data processing agreement (article 28 GDPR). Health and third-party data inside the EU. Retention set by the firm. No use of the data to train anything.", how: "Database, files and authentication in a European region; model provider without retention for training. Retention is set in days and applied by a daily job that deletes originals and extracted data, never the log.", where: "Processing agreement and sub-processor list; retention setting in the application." },
      { n: "06", title: "Invoicing", what: "If the workflow issues invoices, a certified Verifactu engine is integrated. The record, the hash and the submission to the tax agency are never implemented in-house.", how: "Avoids software-producer liability and the responsible declaration. The system prepares the data; the certified engine signs and submits.", where: "Only in invoicing workflows; not applicable to brokerages." },
      { n: "07", title: "Cost and limits", what: "A monthly token budget per firm, with a warning at 80%, so the month's cost is known before the invoice arrives.", how: "No model call without checking the budget; at the ceiling the system stops until next month. The warning is logged and emailed to the address the firm sets.", where: "Every read records tokens and cost; the monthly report adds them up." },
    ] as Item[],
    looks: { eyebrow: "As it looks", title: "The log and the notice." },
    rules: { eyebrow: "Framework", title: "The rules behind each point.",
      items: ["Regulation (EU) 2024/1689 on Artificial Intelligence, article 50: transparency obligations applicable since 2 August 2026.", "GDPR, article 28: data processing agreement; article 9: special categories (health) in life, health and funeral lines.", "EIOPA opinion on AI governance and risk management in insurance (August 2025) and DGSFP supervisory priorities 2026 to 2028.", "Verifactu (RD 1007/2023 and order HAC/1177/2024): mandatory for companies from 1 January 2027 and for everyone else from 1 July 2027."],
      note1: "Dates are reviewed before every delivery; if a rule changes, the kit changes. Related documents (in Spanish): ", a: "processing agreement", sep: ", ", b: "privacy policy", end: "." },
    final: "Does your DPO want to see the kit applied to your workflow? We review it together in 30 minutes.",
  },
} satisfies Record<Lang, unknown>;

export async function generateMetadata(): Promise<Metadata> {
  const c = COPY[await getLang()];
  return { title: c.meta.title, description: c.meta.description };
}

export default async function Kit() {
  const c = COPY[await getLang()];
  return (
    <div className="wrap">
      <JsonLd data={ORG_JSONLD} />
      <SiteNav current="/kit-cumplimiento" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">{c.eyebrow}</div>
        <h1>{c.h1}</h1>
        <p className="lede">{c.lede}</p>
        <div className="ctas no-print"><Link className="btn" href="/contacto">{c.cta1}</Link><Link className="btn ghost" href="/seguridad">{c.cta2}</Link></div>
      </section>

      <Section band eyebrow={c.points.eyebrow} title={c.points.title}>
        <div className="rows">
          {c.items.map((it) => (
            <div key={it.n}>
              <div>
                <h3>{it.title}</h3>
                <p>{it.what}</p>
                <p><strong style={{ color: "var(--ink)" }}>{c.points.how}</strong> {it.how}</p>
                <p><strong style={{ color: "var(--ink)" }}>{c.points.where}</strong> {it.where}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow={c.looks.eyebrow} title={c.looks.title}>
        <div className="two"><div><AuditMock /></div><div><DisclosureLine /></div></div>
      </Section>

      <Section eyebrow={c.rules.eyebrow} title={c.rules.title}>
        <ul className="list-plain">{c.rules.items.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="small muted" style={{ marginTop: 16 }}>{c.rules.note1}<a href="/legal/encargo">{c.rules.a}</a>{c.rules.sep}<a href="/legal/privacidad">{c.rules.b}</a>{c.rules.end}</p>
      </Section>

      <FinalCta title={c.final} />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
