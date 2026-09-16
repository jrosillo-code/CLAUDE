import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, QueueMock, SettlementMock, AuditMock, Faq, JsonLd, faqJsonLd, ORG_JSONLD, CONTACT } from "@/components/site";
import { LedgerCanvas } from "@/components/ledger-canvas";
import { MeshCanvas } from "@/components/mesh-canvas";
import { getLang, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COPY = {
  es: {
    meta: { title: "Operaciones con IA para corredurías y asesorías", description: "Entrada de documentos, extracción con cita, validación y conciliación de liquidaciones de comisiones, con cola de revisión humana y registro de auditoría. Para corredurías de seguros y asesorías en España." },
    faq: [
      ["¿Qué pasa cuando la IA se equivoca?", "Se ve. Cada dato extraído muestra el texto del que se leyó; si no hay texto, el campo aparece como ausente y nunca como un valor. Una persona aprueba, corrige o rechaza antes de que nada salga del despacho. Las correcciones quedan registradas y miden el acierto por tipo de documento."],
      ["¿Quién es el responsable del tratamiento?", "Tu despacho. Actuamos como encargado del tratamiento con contrato de encargo por escrito, datos en la UE y sin uso para entrenar modelos."],
      ["¿Funciona con mi programa de gestión?", "Escribimos en tu sistema a través de su API o, si no la tiene, mediante ficheros de importación revisables: ebroker, segElevia, Avant2, Mediator, Holded, A3, Sage y ficheros EIAC. Si usas otro, lo vemos en la auditoría."],
      ["¿Cuánto tarda?", "La auditoría, una semana. El sprint, dos semanas para un flujo en producción. En una correduría el primer flujo suele ser la conciliación de liquidaciones; en una asesoría, la entrada y validación de facturas."],
      ["¿Cuánto cuesta el modelo de IA cada mes?", "Cada despacho tiene un presupuesto mensual de tokens con aviso al 80 %. Un documento típico cuesta céntimos; una liquidación larga, algo más. El registro de actividad muestra el coste de cada lectura."],
    ] as Array<[string, string]>,
    eyebrow: "Corredurías de seguros · Asesorías y gestorías · España",
    h1: "Tus operaciones, con IA y con control.",
    lede: "Automatizamos la entrada de documentos, la extracción de datos, la validación y la conciliación de liquidaciones de comisiones. Cada resultado pasa por una cola de revisión humana y deja rastro de auditoría.",
    cta1: "Pide una auditoría de 30 minutos", cta2: "Ver cómo funciona", contact: "respuesta el mismo día",
    strip: "Escribimos en tu programa",
    what: { eyebrow: "Qué hacemos", title: "Cinco pasos que hoy hace tu equipo a mano.",
      tiles: [
        ["Entrada de documentos", "Por email, WhatsApp o subida directa. Cada archivo queda registrado con su huella y su origen."],
        ["Extracción con cita", "Pólizas, recibos, partes de siniestro, facturas. Cada dato lleva el texto exacto y la página de la que se leyó. Lo que no consta, se marca como ausente."],
        ["Validación", "NIF y CIF comprobados, importes que cuadran, fechas coherentes, checklist de documentos por tipo de siniestro, requisitos de Verifactu en facturas."],
        ["Conciliación de liquidaciones de comisiones", "La liquidación de la aseguradora, en el formato que sea, contra los recibos que esperabas cobrar. Salida: qué comisiones no se han pagado y cuánto suman, en euros, con una tarea por cada una."],
        ["Aprobación humana y auditoría", "Nada se envía ni se escribe en tu programa de gestión sin un clic de tu equipo. Quién, cuándo, con qué modelo y qué coste: todo queda registrado y se puede exportar."],
      ] },
    who: { eyebrow: "Para quién", title: "Dos tipos de despacho, el mismo problema: papeles que entran y decisiones que esperan.",
      a: ["Corredurías de seguros", "Liquidaciones de comisiones que llegan en 40 formatos, siniestros que se atascan por un documento, renovaciones que se pierden. Empezamos por la liquidación del mes.", "Ver el flujo de una correduría →"],
      b: ["Asesorías y gestorías", "Facturas de clientes que llegan como pueden, requerimientos, y desde 2027 Verifactu para todos. Empezamos por la entrada y validación de facturas.", "Ver el flujo de una asesoría →"] },
    how: { eyebrow: "Cómo funciona", title: "Llega el documento. La IA propone. Tu equipo aprueba.", frame: "app / correduría demo / cola de revisión",
      steps: [["Llega", "Un cliente manda fotos y el parte por WhatsApp. Una aseguradora envía la liquidación del mes en PDF. Un cliente de la asesoría manda sus facturas por email."], ["Se propone", "El sistema lee, valida, detecta qué falta, crea las tareas y redacta la petición. Cada dato enlaza con su origen; cada mensaje lleva el aviso de IA."], ["Se aprueba", "Una persona ve el documento y la propuesta en la misma pantalla y decide. Solo entonces se envía el mensaje o se escribe en el programa de gestión."]],
      link1: "Todo el recorrido →", link2: "El kit de cumplimiento, punto por punto →" },
    offers: { eyebrow: "Cómo trabajamos", title: "Empezamos por el flujo que más tiempo te cuesta.", lede: "Precios públicos. Si en el sprint no ahorramos horas medibles, no seguimos.",
      items: [
        ["Una semana", "Auditoría de flujos", "1.500 a 3.000 €", ["Mapa del despacho: tareas, horas, sistemas", "5 a 10 flujos con retorno estimado", "Prototipo funcionando del mejor", "Se descuenta íntegra del sprint"]],
        ["Dos semanas", "Sprint de automatización", "6.000 a 12.000 €", ["Un flujo en producción, integrado con tu programa de gestión", "Pruebas, documentación y formación", "Kit de cumplimiento incluido", "Una ronda de ajustes; 50 % al inicio"]],
        ["Mensual", "Operaciones gestionadas", "2.000 a 6.000 €/mes", ["Mantenimiento, medición y ampliación", "Nuevos flujos cada trimestre", "Informe de horas ahorradas y euros recuperados", "Facturación anual con descuento"]],
      ] as Array<[string, string, string, string[]]>, link: "Qué incluye cada uno y qué no →" },
    trust: { eyebrow: "Seguridad y cumplimiento", title: "Datos en la UE. Trazabilidad por defecto.",
      items: [["RGPD y encargado del tratamiento", "Contrato de encargo por escrito. Los datos de salud y de terceros no salen de la UE."], ["Sin entrenar modelos con tus datos", "Tus documentos se usan para tu despacho y para nada más. Retención definida por ti."], ["Aviso de IA en cada mensaje", "Reglamento Europeo de IA, artículo 50, en vigor desde el 2 de agosto de 2026. Lo añade el sistema, no depende de nadie."], ["Supervisión humana obligatoria", "Ningún envío ni escritura sin aprobación. Alineado con la supervisión humana del Reglamento de IA y con la opinión de EIOPA sobre gobernanza de IA en mediación."]],
      link: "Todos los controles, uno por uno →" },
    results: { eyebrow: "Resultados", title: "Lo que medimos, y con qué lo medimos.", lede: "Sin clientes que enseñar todavía, enseñamos el método. Los tres primeros despachos tienen precio de fundador y un caso de estudio con cifras.",
      stats: [["Horas", "por semana", "En el flujo elegido, antes del piloto y en la semana 6. La cifra de antes sale del inventario; la de después, del registro."], ["Euros", "por liquidación", "Comisiones no pagadas o pagadas de menos, detectadas línea a línea en cada liquidación conciliada."], ["Acierto", "por documento", "Campos aprobados sin corrección, por tipo de documento. Cada corrección de una persona cuenta en contra."]] },
    founder: { eyebrow: "Quién está detrás", title: "Una persona con nombre, no un formulario.", quote: "Crecí en una correduría familiar: sé qué es una liquidación que no cuadra y un siniestro que se atasca por un documento.", role: "fundador", bio: "Construyo software en producción dirigiendo agentes de IA, con base de datos, permisos por fila probados por decenas de comprobaciones automáticas y una capa de IA que nunca inventa un dato." },
    faqHead: { eyebrow: "Preguntas frecuentes", title: "Qué pasa cuando la IA se equivoca, y otras." },
  },
  en: {
    meta: { title: "AI operations for insurance brokerages and accounting firms", description: "Document intake, extraction with citations, validation and commission-statement reconciliation, with a human review queue and an audit trail. For insurance brokerages and accounting firms in Spain." },
    faq: [
      ["What happens when the AI gets it wrong?", "You see it. Every extracted value shows the text it was read from; if there is no text, the field is shown as missing, never as a value. A person approves, corrects or rejects before anything leaves the firm. Corrections are recorded and measure accuracy by document type."],
      ["Who is the data controller?", "Your firm. We act as processor under a written processing agreement, with data in the EU and no use for training models."],
      ["Does it work with my management software?", "We write into your system through its API or, where there is none, through reviewable import files: ebroker, segElevia, Avant2, Mediator, Holded, A3, Sage and EIAC files. If you use something else, we look at it during the audit."],
      ["How long does it take?", "The audit, one week. The sprint, two weeks to one workflow in production. In a brokerage the first workflow is usually statement reconciliation; in an accounting firm, invoice intake and validation."],
      ["What does the AI model cost each month?", "Each firm has a monthly token budget with a warning at 80%. A typical document costs cents; a long statement, a little more. The activity log shows the cost of every read."],
    ] as Array<[string, string]>,
    eyebrow: "Insurance brokerages · Accounting and tax firms · Spain",
    h1: "Your operations, with AI and with control.",
    lede: "We automate document intake, data extraction, validation and the reconciliation of commission statements. Every result passes through a human review queue and leaves an audit trail.",
    cta1: "Book a 30-minute audit", cta2: "See how it works", contact: "same-day reply",
    strip: "We write into your software",
    what: { eyebrow: "What we do", title: "Five steps your team does by hand today.",
      tiles: [
        ["Document intake", "By email, WhatsApp or direct upload. Every file is recorded with its hash and its origin."],
        ["Extraction with citations", "Policies, receipts, claim forms, invoices. Every value carries the exact text and the page it was read from. What is not there is marked as missing."],
        ["Validation", "Tax ids checked, amounts that add up, coherent dates, a document checklist per claim type, Verifactu requirements on invoices."],
        ["Commission-statement reconciliation", "The insurer's statement, in whatever format, against the receipts you expected to collect. Output: which commissions were not paid and what they add up to, in euros, with one task per line."],
        ["Human approval and audit", "Nothing is sent or written into your management software without a click from your team. Who, when, with which model and at what cost: everything is recorded and exportable."],
      ] },
    who: { eyebrow: "Who it is for", title: "Two kinds of firm, the same problem: paper coming in and decisions waiting.",
      a: ["Insurance brokerages", "Commission statements that arrive in 40 formats, claims stuck on one missing document, renewals that slip. We start with this month's statement.", "See a brokerage's workflow →"],
      b: ["Accounting and tax firms", "Client invoices that arrive however they can, tax authority requests, and from 2027 Verifactu for everyone. We start with invoice intake and validation.", "See an accounting firm's workflow →"] },
    how: { eyebrow: "How it works", title: "The document arrives. The AI proposes. Your team approves.", frame: "app / demo brokerage / review queue",
      steps: [["It arrives", "A client sends photos and the claim form by WhatsApp. An insurer emails the month's statement as a PDF. An accounting client sends invoices by email."], ["It is proposed", "The system reads, validates, spots what is missing, creates the tasks and drafts the request. Every value links to its source; every message carries the AI notice."], ["It is approved", "A person sees the document and the proposal on one screen and decides. Only then is the message sent or the record written into the management software."]],
      link1: "The whole journey →", link2: "The compliance kit, point by point →" },
    offers: { eyebrow: "How we work", title: "We start with the workflow that costs you the most time.", lede: "Public prices. If the sprint does not save measurable hours, we stop there.",
      items: [
        ["One week", "Workflow audit", "€1,500 to €3,000", ["Map of the firm: tasks, hours, systems", "5 to 10 workflows with estimated return", "A working prototype of the best one", "Fully credited against the sprint"]],
        ["Two weeks", "Automation sprint", "€6,000 to €12,000", ["One workflow in production, integrated with your management software", "Tests, documentation and training", "Compliance kit included", "One round of adjustments; 50% up front"]],
        ["Monthly", "Managed operations", "€2,000 to €6,000 per month", ["Maintenance, measurement and expansion", "New workflows every quarter", "Report of hours saved and euros recovered", "Annual billing with a discount"]],
      ] as Array<[string, string, string, string[]]>, link: "What each includes, and what it does not →" },
    trust: { eyebrow: "Security and compliance", title: "Data in the EU. Traceability by default.",
      items: [["GDPR and data processor", "A written processing agreement. Health data and third-party data never leave the EU."], ["No training on your data", "Your documents serve your firm and nothing else. Retention is set by you."], ["AI notice on every message", "EU AI Act, article 50, in force since 2 August 2026. The system adds it; it depends on nobody."], ["Mandatory human oversight", "No send and no write without approval. In line with the AI Act's human oversight and EIOPA's opinion on AI governance in insurance distribution."]],
      link: "Every control, one by one →" },
    results: { eyebrow: "Results", title: "What we measure, and what we measure it with.", lede: "With no clients to show yet, we show the method. The first three firms get a founder price and a case study with figures.",
      stats: [["Hours", "per week", "In the chosen workflow, before the pilot and in week 6. The before figure comes from the inventory; the after figure, from the log."], ["Euros", "per statement", "Commissions unpaid or underpaid, found line by line in every reconciled statement."], ["Accuracy", "per document", "Fields approved without correction, by document type. Every correction by a person counts against it."]] },
    founder: { eyebrow: "Who is behind it", title: "A person with a name, not a form.", quote: "I grew up in a family brokerage: I know what a statement that does not add up looks like, and a claim stuck on one document.", role: "founder", bio: "I build production software by directing AI agents, with a database, row-level permissions proven by dozens of automated checks, and an AI layer that never invents a value." },
    faqHead: { eyebrow: "Frequently asked", title: "What happens when the AI gets it wrong, and other questions." },
  },
} satisfies Record<Lang, unknown>;

export async function generateMetadata(): Promise<Metadata> {
  const c = COPY[await getLang()];
  return { title: { absolute: c.meta.title }, description: c.meta.description, openGraph: { title: c.meta.title, description: c.meta.description } };
}

export default async function Home() {
  const lang = await getLang();
  const c = COPY[lang];
  return (
    <div className="wrap">
      <JsonLd data={ORG_JSONLD} />
      <JsonLd data={faqJsonLd(c.faq)} />
      <SiteNav current="/" />

      <section className="hero">
        <MeshCanvas />
        <LedgerCanvas />
        <div>
          <div className="eyebrow">{c.eyebrow}</div>
          <h1 style={{ marginTop: 14 }}>{c.h1}</h1>
          <p className="lede">{c.lede}</p>
          <div className="ctas">
            <Link className="btn" href="/contacto">{c.cta1}</Link>
            <Link className="btn ghost" href="/como-funciona">{c.cta2}</Link>
          </div>
          <div className="contact">{CONTACT.phone} · <a href={CONTACT.whatsapp}>WhatsApp</a> · {c.contact}</div>
        </div>
        <div className="hero-art">
          <div className="back" aria-hidden="true"><SettlementMock compact /></div>
          <div className="front"><QueueMock variant="siniestro" /></div>
        </div>
      </section>
      <div className="strip" aria-label={c.strip}>
        <span className="lbl">{c.strip}</span>
        <div className="strip-viewport">
          <div className="strip-track">
            {[0, 1].map((copy) => ["ebroker", "segElevia", "Avant2", "Mediator", lang === "en" ? "EIAC files" : "ficheros EIAC", "Holded", "A3", "Sage", "Tesis", "Contasol"].map((n) => <span key={`${copy}-${n}`} aria-hidden={copy === 1 || undefined}>{n}</span>))}
          </div>
        </div>
      </div>

      <Section id="que" eyebrow={c.what.eyebrow} title={c.what.title}>
        <div className="bento">
          <div className="tile"><h3>{c.what.tiles[0][0]}</h3><p>{c.what.tiles[0][1]}</p></div>
          <div className="tile"><h3>{c.what.tiles[1][0]}</h3><p>{c.what.tiles[1][1]}</p></div>
          <div className="tile"><h3>{c.what.tiles[2][0]}</h3><p>{c.what.tiles[2][1]}</p></div>
          <div className="tile wide"><h3>{c.what.tiles[3][0]}</h3><p>{c.what.tiles[3][1]}</p><SettlementMock compact /></div>
          <div className="tile"><h3>{c.what.tiles[4][0]}</h3><p>{c.what.tiles[4][1]}</p><AuditMock /></div>
        </div>
      </Section>

      <Section eyebrow={c.who.eyebrow} title={c.who.title}>
        <div className="two">
          <div className="card">
            <h3>{c.who.a[0]}</h3>
            <p className="muted" style={{ marginTop: 8 }}>{c.who.a[1]}</p>
            <p style={{ marginTop: 12 }}><Link href="/corredurias">{c.who.a[2]}</Link></p>
          </div>
          <div className="card">
            <h3>{c.who.b[0]}</h3>
            <p className="muted" style={{ marginTop: 8 }}>{c.who.b[1]}</p>
            <p style={{ marginTop: 12 }}><Link href="/asesorias">{c.who.b[2]}</Link></p>
          </div>
        </div>
      </Section>

      <Section id="como" band eyebrow={c.how.eyebrow} title={c.how.title}>
        <div className="frame" style={{ marginBottom: 36 }}>
          <div className="frame-bar"><i /><i /><i /><span className="url">{c.how.frame}</span></div>
          <QueueMock variant="liquidacion" />
        </div>
        <div className="steps">
          {c.how.steps.map(([h, p]) => <div className="step" key={h}><h3>{h}</h3><p>{p}</p></div>)}
        </div>
        <p style={{ marginTop: 20 }}><Link href="/como-funciona">{c.how.link1}</Link> · <Link href="/kit-cumplimiento">{c.how.link2}</Link></p>
      </Section>

      <Section id="precios" band eyebrow={c.offers.eyebrow} title={c.offers.title} lede={c.offers.lede}>
        <div className="offers">
          {c.offers.items.map(([time, name, price, bullets], i) => (
            <div className={`offer${i === 1 ? " featured" : ""}`} key={name}><div className="time">{time}</div><h3>{name}</h3><div className="price">{price}</div><ul>{bullets.map((b) => <li key={b}>{b}</li>)}</ul></div>
          ))}
        </div>
        <p style={{ marginTop: 20 }}><Link href="/precios">{c.offers.link}</Link></p>
      </Section>

      <Section eyebrow={c.trust.eyebrow} title={c.trust.title}>
        <div className="trust">
          {c.trust.items.map(([h, p]) => <div key={h}><strong>{h}</strong>{p}</div>)}
        </div>
        <p style={{ marginTop: 20 }}><Link href="/seguridad">{c.trust.link}</Link></p>
      </Section>

      <Section eyebrow={c.results.eyebrow} title={c.results.title} lede={c.results.lede}>
        <div className="proof big">
          {c.results.stats.map(([n, u, l]) => <div className="stat" key={n}><div className="n">{n}<span className="u">{u}</span></div><div className="l">{l}</div></div>)}
        </div>
      </Section>

      <Section eyebrow={c.founder.eyebrow} title={c.founder.title}>
        <div className="founder">
          <div className="photo" aria-hidden="true">GR</div>
          <div>
            <blockquote className="pull" style={{ margin: 0 }}>{c.founder.quote}<small>{CONTACT.founder}, {c.founder.role}</small></blockquote>
            <p className="muted" style={{ marginTop: 16 }}>{c.founder.bio}</p>
          </div>
        </div>
      </Section>

      <Section id="faq" eyebrow={c.faqHead.eyebrow} title={c.faqHead.title}>
        <Faq items={c.faq} />
      </Section>

      <FinalCta />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
