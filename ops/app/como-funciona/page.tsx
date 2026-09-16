import Link from "next/link";
import type { Metadata } from "next";
import { MeshCanvas } from "@/components/mesh-canvas";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, QueueMock, AuditMock, DisclosureLine } from "@/components/site";
import { getLang, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COPY = {
  es: {
    meta: { title: "Cómo funciona", description: "El recorrido de un documento: entrada, extracción con cita, validación determinista, tareas, borrador con aviso de IA, aprobación humana, escritura en el sistema de gestión y registro de auditoría." },
    eyebrow: "Cómo funciona", h1: "Un documento, siete pasos, un clic humano.",
    lede: "Esto no es un chatbot. Es una cadena en la que la IA lee y propone, el código comprueba, y una persona decide. Así es el recorrido de cada documento, y así se ve en pantalla.",
    steps: { eyebrow: "Paso a paso", title: "Del correo o el WhatsApp al programa de gestión.",
      rows: [["Recibe", "Email, WhatsApp o subida. El archivo se guarda con su huella, su origen y la hora. Si llega dos veces, se reconoce."], ["Lee con cita", "El modelo rellena un esquema fijo por tipo de documento. Cada valor lleva el texto exacto y la página. Si no está escrito, el campo queda vacío: la instrucción es no deducir."], ["Valida", "Reglas, no IA: dígito de control de NIF y CIF, sumas que cuadran, fechas coherentes, lista de documentos por tipo de siniestro. Un valor sin cita se trata como ausente."], ["Crea tareas", "Cada elemento que falta es una tarea para el cliente; cada error de fondo, una tarea para el despacho."], ["Redacta", "Un mensaje breve que solo puede mencionar lo que la validación decidió. El aviso de IA lo añade el código, no el modelo."], ["Espera", "Aquí se detiene. Una persona ve el documento y la propuesta en la misma pantalla, corrige lo que haga falta, y aprueba o rechaza."], ["Ejecuta y registra", "Solo tras la aprobación se envía el mensaje o se escribe en el programa de gestión. Quién, cuándo, con qué modelo y qué costó quedan en el registro."]] },
    log: { eyebrow: "El registro", title: "Lo que queda escrito, tal cual se guarda.", auditNote: "Cinco filas reales del registro de un parte de siniestro: llega, se lee, se valida, una persona corrige una fecha, aprueba y se envía. Cada fila lleva actor, hora y coste del modelo.", disclosureNote: "El aviso que cierra cada mensaje. Lo añade el código al final del texto, después de la revisión; editar el borrador no lo quita." },
    screen: { eyebrow: "La pantalla", title: "Lo que ve tu equipo.", frame: "app / correduría demo / cola de revisión", note: "La misma pantalla, con datos de ejemplo. Cada campo muestra de dónde salió; las correcciones quedan marcadas con quién las hizo y se cuentan para medir el acierto." },
    kit: { eyebrow: "Kit de cumplimiento", title: "Lo que lleva cada flujo desde el primer día.",
      items: [["Aviso de IA", "En todo mensaje generado o asistido (Reglamento Europeo de IA, art. 50). Lo añade el sistema."], ["Revisión humana", "Ningún envío ni escritura sin aprobación. La cola de aprobación es parte del producto, no una opción."], ["Registro de actividad", "Documento recibido, lectura, validación, borrador, aprobación: fecha, usuario, modelo y coste. Exportable."], ["Trazabilidad", "Cada dato enlaza con su documento y página. La IA nunca inventa un dato: si no está, se marca ausente."], ["Datos", "Contrato de encargo (RGPD). Datos de salud y de terceros dentro de la UE. Retención definida por ti. Sin entrenamiento."], ["Coste", "Presupuesto mensual de tokens por despacho con aviso al 80 %; el registro muestra lo que costó cada lectura."]],
      link1: "El kit, punto por punto, para tu DPO →", link2: "Los controles técnicos →" },
    wrong: { eyebrow: "Cuándo se equivoca", title: "Qué pasa cuando la IA se equivoca.", a: "Tres mecanismos, en este orden. Primero, la cita: un valor sin texto de origen no existe para el sistema. Segundo, las reglas: lo que no cuadra se marca antes de que nadie lo vea como correcto. Tercero, la persona: corrige, aprueba o rechaza, y su corrección queda registrada con su nombre.", b: "Las correcciones alimentan la métrica que enseñamos cada mes: campos aprobados sin corrección, por tipo de documento. Si un tipo de documento baja del umbral que acordemos, se revisa el esquema, no se sigue enviando." },
  },
  en: {
    meta: { title: "How it works", description: "A document's journey: intake, extraction with citations, deterministic validation, tasks, a draft with the AI notice, human approval, writing into the management software and an audit trail." },
    eyebrow: "How it works", h1: "One document, seven steps, one human click.",
    lede: "This is not a chatbot. It is a chain in which the AI reads and proposes, the code checks, and a person decides. This is the journey of every document, and this is how it looks on screen.",
    steps: { eyebrow: "Step by step", title: "From email or WhatsApp to the management software.",
      rows: [["Receive", "Email, WhatsApp or upload. The file is stored with its hash, its origin and the time. If it arrives twice, it is recognised."], ["Read with citations", "The model fills a fixed schema per document type. Every value carries the exact text and the page. If it is not written, the field stays empty: the instruction is not to infer."], ["Validate", "Rules, not AI: tax id check digits, sums that add up, coherent dates, the document list per claim type. A value without a citation is treated as missing."], ["Create tasks", "Every missing item becomes a task for the client; every substantive error, a task for the firm."], ["Draft", "A short message that can only mention what validation decided. The AI notice is added by the code, not the model."], ["Wait", "Here it stops. A person sees the document and the proposal on one screen, corrects what is needed, and approves or rejects."], ["Execute and record", "Only after approval is the message sent or the record written into the management software. Who, when, with which model and at what cost go into the log."]] },
    log: { eyebrow: "The log", title: "What is written down, exactly as it is stored.", auditNote: "Five real rows from the log of a claim form: it arrives, is read, is validated, a person corrects a date, approves, and it is sent. Every row carries actor, time and model cost.", disclosureNote: "The notice that closes every message. The code appends it after review; editing the draft does not remove it." },
    screen: { eyebrow: "The screen", title: "What your team sees.", frame: "app / demo brokerage / review queue", note: "The same screen, with sample data. Every field shows where it came from; corrections are marked with who made them and count toward the accuracy figure." },
    kit: { eyebrow: "Compliance kit", title: "What every workflow carries from day one.",
      items: [["AI notice", "On every generated or assisted message (EU AI Act, art. 50). The system adds it."], ["Human review", "No send and no write without approval. The approval queue is part of the product, not an option."], ["Activity log", "Document received, reading, validation, draft, approval: date, user, model and cost. Exportable."], ["Traceability", "Every value links to its document and page. The AI never invents a value: if it is not there, it is marked missing."], ["Data", "Processing agreement (GDPR). Health and third-party data inside the EU. Retention set by you. No training."], ["Cost", "A monthly token budget per firm with a warning at 80%; the log shows what every read cost."]],
      link1: "The kit, point by point, for your DPO →", link2: "The technical controls →" },
    wrong: { eyebrow: "When it gets it wrong", title: "What happens when the AI gets it wrong.", a: "Three mechanisms, in this order. First, the citation: a value without source text does not exist for the system. Second, the rules: what does not add up is flagged before anyone sees it as correct. Third, the person: corrects, approves or rejects, and the correction is recorded under their name.", b: "Corrections feed the metric we show every month: fields approved without correction, by document type. If a document type drops below the threshold we agree, the schema is reviewed; sending does not continue." },
  },
} satisfies Record<Lang, unknown>;

export async function generateMetadata(): Promise<Metadata> {
  const c = COPY[await getLang()];
  return { title: c.meta.title, description: c.meta.description };
}

export default async function ComoFunciona() {
  const c = COPY[await getLang()];
  return (
    <div className="wrap">
      <SiteNav current="/como-funciona" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">{c.eyebrow}</div>
        <h1>{c.h1}</h1>
        <p className="lede">{c.lede}</p>
      </section>

      <Section eyebrow={c.steps.eyebrow} title={c.steps.title}>
        <div className="rows">{c.steps.rows.map(([h, p]) => <div key={h}><div><h3>{h}</h3><p>{p}</p></div></div>)}</div>
      </Section>

      <Section eyebrow={c.log.eyebrow} title={c.log.title}>
        <div className="two">
          <div><AuditMock /><p className="small muted" style={{ marginTop: 10 }}>{c.log.auditNote}</p></div>
          <div><DisclosureLine /><p className="small muted" style={{ marginTop: 10 }}>{c.log.disclosureNote}</p></div>
        </div>
      </Section>

      <Section band eyebrow={c.screen.eyebrow} title={c.screen.title}>
        <div className="frame"><div className="frame-bar"><i /><i /><i /><span className="url">{c.screen.frame}</span></div><QueueMock variant="siniestro" /></div>
        <p className="muted small" style={{ marginTop: 12 }}>{c.screen.note}</p>
      </Section>

      <Section eyebrow={c.kit.eyebrow} title={c.kit.title}>
        <div className="trust">{c.kit.items.map(([h, p]) => <div key={h}><strong>{h}</strong>{p}</div>)}</div>
        <p style={{ marginTop: 20 }}><Link href="/kit-cumplimiento">{c.kit.link1}</Link> · <Link href="/seguridad">{c.kit.link2}</Link></p>
      </Section>

      <Section eyebrow={c.wrong.eyebrow} title={c.wrong.title}>
        <div className="two"><div><p>{c.wrong.a}</p></div><div><p>{c.wrong.b}</p></div></div>
      </Section>

      <FinalCta />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
