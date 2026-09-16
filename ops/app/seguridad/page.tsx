import type { Metadata } from "next";
import { MeshCanvas } from "@/components/mesh-canvas";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, AuditMock, DisclosureLine } from "@/components/site";
import { getLang, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COPY = {
  es: {
    meta: { title: "Seguridad y cumplimiento", description: "Controles técnicos y contractuales: RGPD y encargo del tratamiento, datos en la UE, sin entrenamiento, seguridad por filas, registro de actividad inmutable, revisión humana, aviso de IA, presupuesto de modelo." },
    controls: [
      ["Aislamiento por despacho", "Seguridad por filas en la base de datos: cada fila lleva el despacho, y una persona solo ve las de los despachos a los que pertenece. Lo aplica la base de datos, no la aplicación.", "Comprobado por 33 aserciones automáticas contra la migración real en cada cambio."],
      ["Registro inmutable", "Documento recibido, lectura, validación, borrador, aprobación, envío, escritura, corrección: con fecha, usuario, modelo y coste. Se puede añadir, no editar ni borrar.", "Política de base de datos: inserción permitida, actualización y borrado denegados incluso a miembros."],
      ["Revisión humana", "Enviar un mensaje o escribir en el programa de gestión solo ocurre tras una aprobación con nombre. Si el envío falla, la aprobación sigue pendiente.", "Una única función en el código es la puerta de salida; las pruebas comprueban que nada sale antes."],
      ["Trazabilidad de cada dato", "Cada valor extraído guarda el texto exacto y la página. Un valor sin texto de origen se trata como ausente.", "Evaluación automática: cualquier valor cuyo texto no aparece en el documento cuenta como inventado y bloquea la entrega."],
      ["Aviso de IA", "Todo mensaje generado lleva el aviso del artículo 50 del Reglamento Europeo de IA. Lo añade el código al final del texto, no el modelo.", "Editar un borrador conserva el aviso."],
      ["Datos en la UE", "Base de datos, ficheros y autenticación en región europea. Proveedor de modelos con retención limitada y sin uso para entrenar.", "Los subencargados se listan en el contrato de encargo."],
      ["Presupuesto de modelo", "Cada despacho tiene un techo mensual de tokens con aviso al 80 %. Ninguna llamada al modelo sin comprobarlo.", "Cada lectura registra tokens y coste estimado."],
      ["Acceso a documentos", "Los originales están en un almacén privado; se sirven solo a miembros del despacho a través de la aplicación.", "Sin enlaces públicos."],
      ["Autenticación", "Acceso por enlace único al correo, sin contraseñas que robar. Sesiones en cookies seguras y solo desde el propio sitio.", "Alta de usuarios solo por el propietario del despacho."],
      ["Límites y abuso", "Límites por despacho en la entrada de documentos y en las comprobaciones públicas; webhooks firmados (WhatsApp) o con secreto (correo).", "Idempotencia por identificador del mensaje: un envío repetido no crea dos documentos."],
    ] as Array<[string, string, string]>,
    eyebrow: "Seguridad y cumplimiento", h1: "Sin sellos que no tenemos. Con los controles, uno por uno.",
    lede: "No tenemos todavía una ISO 27001; tenemos un sistema diseñado para despachos regulados en España y la lista de lo que hace cada control. Cuando la certificación llegue, se añadirá aquí.",
    table: { eyebrow: "Controles", title: "Qué hace el sistema, y cómo se comprueba.", cols: ["Control", "Qué hace", "Cómo se comprueba"] },
    looks: { eyebrow: "Cómo se ve", title: "El registro y el aviso, tal como los verá tu DPO.", a: "Registro de actividad: solo se añade, nunca se edita. Exportable en CSV desde la aplicación.", b: "Aviso del artículo 50 del Reglamento de IA, añadido por el sistema a cada mensaje aprobado." },
    frame: { eyebrow: "Marco", title: "Lo que aplica a tu despacho.", a: "Corredurías", b: "Asesorías",
      aList: ["RGPD; datos de salud en vida, salud y decesos como categoría especial", "Reglamento de IA: transparencia (art. 50) desde el 2 de agosto de 2026; alto riesgo en tarificación es cosa de la aseguradora, no del corredor", "Opinión de EIOPA sobre gobernanza de IA (agosto de 2025)", "Prioridades de supervisión DGSFP 2026 a 2028", "DORA: excluidas las corredurías micro, pequeñas y medianas"],
      bList: ["Verifactu: 1 de enero de 2027 y 1 de julio de 2027", "Factura electrónica B2B (Crea y Crece), tras la orden ministerial", "RGPD y contrato de encargo por cada cliente final cuando proceda", "Reglamento de IA: transparencia en mensajes a clientes"] },
    docs: { eyebrow: "Documentos", title: "Para tu delegado de protección de datos.", items: [["/legal/encargo", "Contrato de encargo del tratamiento", " (modelo, artículo 28 RGPD)"], ["/legal/privacidad", "Política de privacidad", ""], ["", "Lista de subencargados y regiones, en el anexo del contrato", ""], ["", "Registro de actividad exportable por despacho, en CSV, desde la aplicación", ""], ["/kit-cumplimiento", "Kit de cumplimiento", ", imprimible"]] as Array<[string, string, string]> },
    final: "¿Tu DPO tiene preguntas? Que me escriba directamente.",
  },
  en: {
    meta: { title: "Security and compliance", description: "Technical and contractual controls: GDPR and data processing, data in the EU, no training, row-level security, an immutable activity log, human review, AI notice, model budget." },
    controls: [
      ["Isolation per firm", "Row-level security in the database: every row carries the firm, and a person only sees rows of the firms they belong to. The database enforces it, not the application.", "Checked by 33 automated assertions against the real migration on every change."],
      ["Immutable log", "Document received, reading, validation, draft, approval, send, write, correction: with date, user, model and cost. Rows can be added, never edited or deleted.", "Database policy: insert allowed, update and delete denied even to members."],
      ["Human review", "Sending a message or writing into the management software only happens after a named approval. If the send fails, the approval stays pending.", "A single function in the code is the exit door; the tests check that nothing leaves before it."],
      ["Traceability of every value", "Every extracted value keeps the exact text and the page. A value without source text is treated as missing.", "Automated evaluation: any value whose text does not appear in the document counts as invented and blocks the release."],
      ["AI notice", "Every generated message carries the notice required by article 50 of the EU AI Act. The code appends it at the end of the text, not the model.", "Editing a draft keeps the notice."],
      ["Data in the EU", "Database, files and authentication in a European region. Model provider with limited retention and no use for training.", "Sub-processors are listed in the processing agreement."],
      ["Model budget", "Each firm has a monthly token ceiling with a warning at 80%. No model call without checking it.", "Every read records tokens and estimated cost."],
      ["Document access", "Originals live in a private store; they are served only to members of the firm through the application.", "No public links."],
      ["Authentication", "Access by one-time link to the email, no passwords to steal. Sessions in secure cookies, accepted only from the site itself.", "Users are added only by the firm's owner."],
      ["Limits and abuse", "Per-firm limits on document intake and on public checks; signed webhooks (WhatsApp) or a shared secret (email).", "Idempotency by message id: a repeated delivery never creates two documents."],
    ] as Array<[string, string, string]>,
    eyebrow: "Security and compliance", h1: "No badges we do not hold. The controls, one by one.",
    lede: "We do not have an ISO 27001 yet; we have a system designed for regulated firms in Spain and the list of what every control does. When the certification arrives, it will be added here.",
    table: { eyebrow: "Controls", title: "What the system does, and how it is checked.", cols: ["Control", "What it does", "How it is checked"] },
    looks: { eyebrow: "How it looks", title: "The log and the notice, as your DPO will see them.", a: "Activity log: append-only, never edited. Exportable as CSV from the application.", b: "The article 50 notice of the AI Act, added by the system to every approved message." },
    frame: { eyebrow: "Framework", title: "What applies to your firm.", a: "Brokerages", b: "Accounting firms",
      aList: ["GDPR; health data in life, health and funeral lines as a special category", "AI Act: transparency (art. 50) since 2 August 2026; high risk in pricing sits with the insurer, not the broker", "EIOPA opinion on AI governance (August 2025)", "DGSFP supervisory priorities 2026 to 2028", "DORA: micro, small and medium brokerages are excluded"],
      bList: ["Verifactu: 1 January 2027 and 1 July 2027", "B2B e-invoicing (Crea y Crece), after the ministerial order", "GDPR and a processing agreement per end client where applicable", "AI Act: transparency in messages to clients"] },
    docs: { eyebrow: "Documents", title: "For your data protection officer.", items: [["/legal/encargo", "Data processing agreement", " (template, article 28 GDPR, in Spanish)"], ["/legal/privacidad", "Privacy policy", " (in Spanish)"], ["", "List of sub-processors and regions, in the agreement's annex", ""], ["", "Activity log exportable per firm, as CSV, from the application", ""], ["/kit-cumplimiento", "Compliance kit", ", printable"]] as Array<[string, string, string]> },
    final: "Does your DPO have questions? Have them write to me directly.",
  },
} satisfies Record<Lang, unknown>;

export async function generateMetadata(): Promise<Metadata> {
  const c = COPY[await getLang()];
  return { title: c.meta.title, description: c.meta.description };
}

export default async function Seguridad() {
  const c = COPY[await getLang()];
  return (
    <div className="wrap">
      <SiteNav current="/seguridad" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">{c.eyebrow}</div>
        <h1>{c.h1}</h1>
        <p className="lede">{c.lede}</p>
      </section>

      <Section band eyebrow={c.table.eyebrow} title={c.table.title}>
        <div className="table-wrap"><table>
          <thead><tr>{c.table.cols.map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>{c.controls.map(([k, w, h]) => <tr key={k}><td><strong>{k}</strong></td><td className="muted">{w}</td><td className="muted">{h}</td></tr>)}</tbody>
        </table></div>
      </Section>

      <Section eyebrow={c.looks.eyebrow} title={c.looks.title}>
        <div className="two">
          <div><AuditMock /><p className="small muted" style={{ marginTop: 10 }}>{c.looks.a}</p></div>
          <div><DisclosureLine /><p className="small muted" style={{ marginTop: 10 }}>{c.looks.b}</p></div>
        </div>
      </Section>

      <Section eyebrow={c.frame.eyebrow} title={c.frame.title}>
        <div className="two">
          <div><h3>{c.frame.a}</h3><ul className="list-plain" style={{ marginTop: 8 }}>{c.frame.aList.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h3>{c.frame.b}</h3><ul className="list-plain" style={{ marginTop: 8 }}>{c.frame.bList.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
      </Section>

      <Section eyebrow={c.docs.eyebrow} title={c.docs.title}>
        <ul className="list-plain">{c.docs.items.map(([href, label, rest]) => <li key={label}>{href ? <a href={href}>{label}</a> : label}{rest}</li>)}</ul>
      </Section>

      <FinalCta title={c.final} />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
