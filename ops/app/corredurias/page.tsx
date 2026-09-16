import Link from "next/link";
import type { Metadata } from "next";
import { MeshCanvas } from "@/components/mesh-canvas";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, QueueMock, SettlementMock, Faq, JsonLd, faqJsonLd } from "@/components/site";
import { getLang, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COPY = {
  es: {
    meta: { title: "Para corredurías de seguros", description: "Conciliación de liquidaciones de comisiones, documentación de siniestros y renovaciones con revisión humana, integrado con ebroker, segElevia, Avant2, Mediator y ficheros EIAC." },
    faq: [
      ["¿Necesito cambiar de programa de gestión?", "No. Escribimos en el que ya usas: ebroker por sus servicios web, segElevia y Avant2 por sus integraciones, Mediator por ficheros de importación, y leemos ficheros EIAC cuando la aseguradora los envía. Lo que no llega por EIAC (PDF, Excel, portal) es exactamente lo que automatizamos."],
      ["¿Qué pasa con los datos de salud de las pólizas de vida?", "Se tratan como categoría especial: dentro de la UE, con contrato de encargo, sin uso para entrenar modelos, y con retención definida por ti. El flujo de liquidaciones no toca datos de salud."],
      ["¿Cuánto tarda una liquidación?", "Una liquidación de 40 a 60 líneas se lee y concilia en menos de dos minutos. La revisión humana de las incidencias es lo que marca el tiempo total, y son pocas: lo que cuadra no requiere ningún clic."],
    ] as Array<[string, string]>,
    eyebrow: "Corredurías de seguros",
    h1: "Cerramos las liquidaciones del mes en horas, no en días. Y te decimos qué comisiones no te han pagado.",
    lede: "Cada aseguradora liquida en un formato distinto. Alguien las abre una a una y las cruza con la cartera. Ese trabajo, y las comisiones que se pierden por el camino, es el primer flujo que automatizamos en una correduría.",
    cta1: "Pide una auditoría de 30 minutos", cta2: "Ver precios",
    first: { eyebrow: "El primer flujo", title: "La liquidación entra. Las incidencias salen con su importe.",
      checks: ["Leemos la liquidación en PDF, Excel o exportación del portal, línea a línea, con cita de cada importe.", "La cruzamos con los recibos que esperabas cobrar, exportados de tu programa de gestión o leídos del fichero EIAC.", "Cada recibo no liquidado o pagado de menos se convierte en una tarea con su importe y su aseguradora.", "Tú apruebas la reclamación. Nada se envía a la aseguradora sin tu clic.", "Cada mes ves un número: euros detectados, líneas conciliadas, tiempo empleado."],
      settle: "Así queda la liquidación conciliada", settleNote: "Cada línea con su estado; las reclamables suman su importe. La carta a la aseguradora la redacta el sistema con esas líneas, y solo sale cuando alguien del despacho la aprueba." },
    next: { eyebrow: "Después", title: "Los siguientes flujos, en el orden en que suelen doler.",
      tiles: [["Documentación de siniestros", "El cliente manda fotos y el parte por WhatsApp; el sistema comprueba la lista por tipo de siniestro y redacta la petición de lo que falta. Tú la apruebas."], ["Renovaciones", "Pólizas que vencen en 45 días, con la comparativa y la propuesta preparadas. La cartera crece un 5 % y la nueva producción cae: defenderla es ingreso, no solo ahorro."], ["Recibos devueltos", "Aviso, seguimiento y mensaje al cliente, con registro de cada intento."], ["Consultas sobre condicionados", "Un asistente privado sobre tus condicionados y tu cartera que cita cláusula y página. Lo que hoy saben dos veteranos, disponible para todo el equipo."], ["Bandeja compartida", "WhatsApp y email del despacho en una sola cola, con cada documento registrado con su origen."], ["DEC y documentación regulatoria", "Los datos que la DGSFP pide cada año, recogidos durante el año y no la semana antes."]] },
    with: { eyebrow: "Con qué trabajamos", title: "Tu programa de gestión se queda. Nosotros escribimos en él.", systems: "Sistemas", frame: "Marco",
      systemsList: ["ebroker (servicios web y API)", "MPM segElevia", "Codeoscopic Avant2 y Tesis", "Mediator (ficheros de importación)", "Ficheros EIAC de pólizas, recibos, siniestros y liquidaciones"],
      frameList: ["RGPD y contrato de encargo; datos en la UE", "Reglamento Europeo de IA, art. 50: aviso en cada mensaje", "Opinión de EIOPA sobre gobernanza de IA en mediación: supervisión humana, registros, proporcionalidad", "Prioridades de supervisión de la DGSFP 2026 a 2028: trazabilidad y explicabilidad", "DORA no aplica a corredurías micro y pequeñas; te lo explicamos si te lo preguntan"] },
    faqHead: { eyebrow: "Preguntas", title: "Lo que preguntan las corredurías." },
    final: "Mándame una liquidación de este mes (anonimizada) y te devuelvo la conciliación hecha. Sin compromiso.",
  },
  en: {
    meta: { title: "For insurance brokerages", description: "Commission-statement reconciliation, claims documentation and renewals with human review, integrated with ebroker, segElevia, Avant2, Mediator and EIAC files." },
    faq: [
      ["Do I need to change my management software?", "No. We write into the one you already use: ebroker through its web services, segElevia and Avant2 through their integrations, Mediator through import files, and we read EIAC files whenever the insurer sends them. What does not arrive as EIAC (PDF, Excel, portal) is exactly what we automate."],
      ["What about health data in life policies?", "It is treated as a special category: inside the EU, under a processing agreement, never used to train models, with retention set by you. The statement workflow does not touch health data."],
      ["How long does a statement take?", "A statement of 40 to 60 lines is read and reconciled in under two minutes. Human review of the exceptions sets the total time, and they are few: what matches needs no click at all."],
    ] as Array<[string, string]>,
    eyebrow: "Insurance brokerages",
    h1: "We close the month's statements in hours, not days. And we tell you which commissions you were not paid.",
    lede: "Every insurer settles in a different format. Someone opens them one by one and matches them against the book. That work, and the commissions lost along the way, is the first workflow we automate in a brokerage.",
    cta1: "Book a 30-minute audit", cta2: "See pricing",
    first: { eyebrow: "The first workflow", title: "The statement comes in. The exceptions come out with their amounts.",
      checks: ["We read the statement from PDF, Excel or a portal export, line by line, citing every amount.", "We match it against the receipts you expected to collect, exported from your management software or read from the EIAC file.", "Every receipt unpaid or underpaid becomes a task with its amount and its insurer.", "You approve the claim. Nothing is sent to the insurer without your click.", "Every month you see one number: euros found, lines reconciled, time spent."],
      settle: "The reconciled statement, as it looks", settleNote: "Every line with its state; the claimable ones add up. The letter to the insurer is drafted by the system from those lines, and it only goes out when someone at the firm approves it." },
    next: { eyebrow: "Afterwards", title: "The next workflows, in the order they usually hurt.",
      tiles: [["Claims documentation", "The client sends photos and the claim form by WhatsApp; the system checks the list for that claim type and drafts the request for what is missing. You approve it."], ["Renewals", "Policies expiring in 45 days, with the comparison and the proposal ready. The book grows 5% a year while new business falls: defending it is revenue, not only savings."], ["Returned receipts", "Notice, follow-up and a message to the client, with every attempt logged."], ["Questions about policy wordings", "A private assistant over your wordings and your book that cites clause and page. What two veterans know today, available to the whole team."], ["Shared inbox", "The firm's WhatsApp and email in one queue, every document recorded with its origin."], ["DEC and regulatory filings", "The data the DGSFP asks for every year, collected during the year and not the week before."]] },
    with: { eyebrow: "What we work with", title: "Your management software stays. We write into it.", systems: "Systems", frame: "Framework",
      systemsList: ["ebroker (web services and API)", "MPM segElevia", "Codeoscopic Avant2 and Tesis", "Mediator (import files)", "EIAC files for policies, receipts, claims and statements"],
      frameList: ["GDPR and processing agreement; data in the EU", "EU AI Act, art. 50: a notice on every message", "EIOPA opinion on AI governance in insurance distribution: human oversight, records, proportionality", "DGSFP supervisory priorities 2026 to 2028: traceability and explainability", "DORA does not apply to micro and small brokerages; we explain it if you are asked"] },
    faqHead: { eyebrow: "Questions", title: "What brokerages ask." },
    final: "Send me one of this month's statements (anonymised) and I will return it reconciled. No strings.",
  },
} satisfies Record<Lang, unknown>;

export async function generateMetadata(): Promise<Metadata> {
  const c = COPY[await getLang()];
  return { title: c.meta.title, description: c.meta.description };
}

export default async function Corredurias() {
  const c = COPY[await getLang()];
  return (
    <div className="wrap">
      <JsonLd data={faqJsonLd(c.faq)} />
      <SiteNav current="/corredurias" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">{c.eyebrow}</div>
        <h1>{c.h1}</h1>
        <p className="lede">{c.lede}</p>
        <div className="ctas"><Link className="btn" href="/contacto?tipo=correduria">{c.cta1}</Link><Link className="btn ghost" href="/precios">{c.cta2}</Link></div>
      </section>

      <Section band eyebrow={c.first.eyebrow} title={c.first.title}>
        <div className="split">
          <div><ul className="check">{c.first.checks.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <QueueMock variant="liquidacion" />
        </div>
        <div style={{ marginTop: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{c.first.settle}</div>
          <SettlementMock />
          <p className="small muted" style={{ marginTop: 10 }}>{c.first.settleNote}</p>
        </div>
      </Section>

      <Section eyebrow={c.next.eyebrow} title={c.next.title}>
        <div className="bento">{c.next.tiles.map(([h, p]) => <div className="tile" key={h}><h3>{h}</h3><p>{p}</p></div>)}</div>
      </Section>

      <Section eyebrow={c.with.eyebrow} title={c.with.title}>
        <div className="two">
          <div><h3>{c.with.systems}</h3><ul className="list-plain" style={{ marginTop: 8 }}>{c.with.systemsList.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h3>{c.with.frame}</h3><ul className="list-plain" style={{ marginTop: 8 }}>{c.with.frameList.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
      </Section>

      <Section eyebrow={c.faqHead.eyebrow} title={c.faqHead.title}><Faq items={c.faq} /></Section>
      <FinalCta title={c.final} />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
