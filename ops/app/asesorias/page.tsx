import Link from "next/link";
import type { Metadata } from "next";
import { MeshCanvas } from "@/components/mesh-canvas";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, QueueMock, Faq, JsonLd, faqJsonLd } from "@/components/site";
import { getLang, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COPY = {
  es: {
    meta: { title: "Para asesorías y gestorías", description: "Entrada y validación de facturas de clientes, reclamación de lo que falta y preparación para Verifactu 2027, con revisión humana e integración con Holded, A3, Sage, Anfix y Quipu." },
    faq: [
      ["¿Hacéis el registro Verifactu?", "No, y es a propósito. El registro, el hash y el envío a la AEAT los hace un motor certificado que ya tienes o que integramos. Nosotros hacemos lo que está antes: que la factura llegue completa, correcta y a tiempo, y que tu equipo no persiga a nadie a mano."],
      ["¿Cuándo es obligatorio Verifactu?", "1 de enero de 2027 para sociedades y 1 de julio de 2027 para autónomos, tras el aplazamiento del Real Decreto-ley 15/2025. La factura electrónica B2B de la Ley Crea y Crece llega después, con plazos que dependen de la orden ministerial. Lo que vendemos sirve igual si la fecha vuelve a moverse."],
      ["¿Qué pasa con los clientes que facturan en Excel?", "Son el caso principal. La auditoría identifica cuántos son, el sprint construye la entrada y validación para ellos, y las tareas les piden lo que falta con un mensaje que tú apruebas."],
    ] as Array<[string, string]>,
    eyebrow: "Asesorías y gestorías",
    h1: "Las facturas de tus clientes, completas y validadas antes de que alguien tenga que perseguirlas.",
    lede: "Desde 2027, Verifactu para todos. Tus clientes seguirán mandando lo que puedan, como puedan. El sistema recibe, lee con cita, comprueba NIF, importes y fechas, y pide lo que falta. Tu equipo aprueba y contabiliza.",
    cta1: "Pide una auditoría de 30 minutos", cta2: "Ver precios",
    first: { eyebrow: "El primer flujo", title: "La factura entra por email. La tarea sale con lo que falta.",
      checks: ["Email, WhatsApp o carpeta compartida: cada archivo registrado con su origen y su huella.", "Lectura con cita: NIF emisor y receptor, número, fecha, base, tipo, cuota y total, cada uno con el texto del que se leyó.", "Validación determinista: dígito de control del NIF, cuota igual a base por tipo, total igual a base más cuota, fechas coherentes, requisitos de un registro Verifactu.", "Lo que falta se pide al cliente con un mensaje que tú apruebas y que lleva el aviso de IA.", "Lo aprobado se escribe en tu programa o se exporta para importar."] },
    next: { eyebrow: "Después", title: "Lo que sigue en una asesoría.",
      tiles: [["Migración de clientes en Excel", "Inventario de quién factura cómo, plan por cliente y plantillas de entrada para que lleguen en regla al 1 de enero de 2027."], ["Requerimientos", "Lectura del requerimiento, lista de lo que hay que aportar, tareas y recordatorios al cliente."], ["Conciliación bancaria", "Movimientos sin documento detectados y reclamados; no adivinamos, pedimos."], ["Cierre de periodo", "Documentación pendiente por cliente, con un mensaje por cliente, aprobado en bloque."]] },
    with: { eyebrow: "Con qué trabajamos", title: "Tu programa se queda.", systems: "Sistemas", frame: "Marco",
      systemsList: ["Holded", "A3 (Wolters Kluwer)", "Sage", "Anfix", "Quipu y Contasol por importación", "Motor Verifactu certificado, nunca propio"],
      frameList: ["Verifactu: 1 de enero de 2027 sociedades, 1 de julio de 2027 autónomos", "Factura electrónica B2B (Crea y Crece): tras la orden ministerial", "RGPD y contrato de encargo; datos en la UE", "Reglamento Europeo de IA, art. 50"] },
    faqHead: { eyebrow: "Preguntas", title: "Lo que preguntan las asesorías." },
    final: "Mándame diez facturas de tus clientes más desordenados (anonimizadas) y te devuelvo qué falta en cada una.",
  },
  en: {
    meta: { title: "For accounting and tax firms", description: "Client invoice intake and validation, chasing what is missing and getting ready for Verifactu 2027, with human review and integration with Holded, A3, Sage, Anfix and Quipu." },
    faq: [
      ["Do you do the Verifactu record?", "No, on purpose. The record, the hash and the submission to the tax agency are done by a certified engine you already have or that we integrate. We do what comes before: making sure the invoice arrives complete, correct and on time, and that your team chases nobody by hand."],
      ["When is Verifactu mandatory?", "1 January 2027 for companies and 1 July 2027 for the self-employed, after the postponement in Royal Decree-law 15/2025. B2B e-invoicing under the Crea y Crece law comes later, on dates that depend on the ministerial order. What we sell works the same if the date moves again."],
      ["What about clients who invoice in Excel?", "They are the main case. The audit counts how many there are, the sprint builds intake and validation for them, and the tasks ask them for what is missing with a message you approve."],
    ] as Array<[string, string]>,
    eyebrow: "Accounting and tax firms",
    h1: "Your clients' invoices, complete and validated before anyone has to chase them.",
    lede: "From 2027, Verifactu for everyone. Your clients will keep sending what they can, however they can. The system receives, reads with citations, checks tax ids, amounts and dates, and asks for what is missing. Your team approves and posts.",
    cta1: "Book a 30-minute audit", cta2: "See pricing",
    first: { eyebrow: "The first workflow", title: "The invoice arrives by email. The task comes out with what is missing.",
      checks: ["Email, WhatsApp or a shared folder: every file recorded with its origin and its hash.", "Reading with citations: issuer and recipient tax ids, number, date, base, rate, VAT and total, each with the text it was read from.", "Deterministic validation: tax id check digit, VAT equal to base times rate, total equal to base plus VAT, coherent dates, the requirements of a Verifactu record.", "What is missing is requested from the client with a message you approve, carrying the AI notice.", "What is approved is written into your software or exported for import."] },
    next: { eyebrow: "Afterwards", title: "What comes next in an accounting firm.",
      tiles: [["Moving clients off Excel", "An inventory of who invoices how, a plan per client and intake templates so they arrive compliant on 1 January 2027."], ["Tax authority requests", "Reading the request, listing what must be provided, tasks and reminders to the client."], ["Bank reconciliation", "Movements without a document found and chased; we do not guess, we ask."], ["Period close", "Outstanding documents per client, one message per client, approved in one go."]] },
    with: { eyebrow: "What we work with", title: "Your software stays.", systems: "Systems", frame: "Framework",
      systemsList: ["Holded", "A3 (Wolters Kluwer)", "Sage", "Anfix", "Quipu and Contasol through import", "A certified Verifactu engine, never our own"],
      frameList: ["Verifactu: 1 January 2027 for companies, 1 July 2027 for the self-employed", "B2B e-invoicing (Crea y Crece): after the ministerial order", "GDPR and processing agreement; data in the EU", "EU AI Act, art. 50"] },
    faqHead: { eyebrow: "Questions", title: "What accounting firms ask." },
    final: "Send me ten invoices from your messiest clients (anonymised) and I will return what is missing in each one.",
  },
} satisfies Record<Lang, unknown>;

export async function generateMetadata(): Promise<Metadata> {
  const c = COPY[await getLang()];
  return { title: c.meta.title, description: c.meta.description };
}

export default async function Asesorias() {
  const c = COPY[await getLang()];
  return (
    <div className="wrap">
      <JsonLd data={faqJsonLd(c.faq)} />
      <SiteNav current="/asesorias" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">{c.eyebrow}</div>
        <h1>{c.h1}</h1>
        <p className="lede">{c.lede}</p>
        <div className="ctas"><Link className="btn" href="/contacto?tipo=asesoria">{c.cta1}</Link><Link className="btn ghost" href="/precios">{c.cta2}</Link></div>
      </section>

      <Section band eyebrow={c.first.eyebrow} title={c.first.title}>
        <div className="split">
          <div><ul className="check">{c.first.checks.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <QueueMock variant="factura" />
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
