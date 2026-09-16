import type { Metadata } from "next";
import { SiteNav, SiteFooter, CONTACT } from "@/components/site";
import { MeshCanvas } from "@/components/mesh-canvas";
import { getLang, type Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const COPY = {
  es: {
    meta: { title: "Contacto", description: "Cuéntanos tu flujo más lento. Te decimos en 30 minutos si se puede automatizar y cuánto costaría." },
    eyebrow: "Contacto", h1: "Cuéntame tu flujo más lento.", lede: "Te digo en 30 minutos si se puede automatizar y cuánto costaría. Respondo el mismo día laborable.",
    received: "Recibido.", receivedNote: "Te escribo hoy. Si prefieres, adelántate por ", errorNote: "",
    name: "Nombre", email: "Correo", phone: "Teléfono o WhatsApp (opcional)", firm: "Despacho", kind: "Tipo",
    kinds: [["correduria", "Correduría de seguros"], ["asesoria", "Asesoría o gestoría"], ["otro", "Otro"]] as Array<[string, string]>,
    message: "El flujo que más tiempo os cuesta", placeholder: "Por ejemplo: cada mes abrimos 40 liquidaciones en PDF y las cruzamos a mano con la cartera; nos lleva tres días.",
    website: "Sitio web", send: "Enviar", privacy1: "Al enviar aceptas la ", privacyLink: "política de privacidad", privacy2: ". Usamos tus datos solo para responderte.",
    direct: "Directo", after: "Qué pasa después", afterList: ["Llamada de 30 minutos sobre el flujo.", "Si hay encaje, auditoría la semana siguiente.", "Precio del sprint cerrado por escrito."],
    doc: "Si tienes un documento a mano", docNote: "Una liquidación o diez facturas, anonimizadas, y te devuelvo el resultado antes de la llamada.",
  },
  en: {
    meta: { title: "Contact", description: "Tell us your slowest workflow. In 30 minutes we tell you whether it can be automated and what it would cost." },
    eyebrow: "Contact", h1: "Tell me your slowest workflow.", lede: "In 30 minutes I will tell you whether it can be automated and what it would cost. I reply the same working day.",
    received: "Received.", receivedNote: "I will write to you today. If you prefer, get ahead on ", errorNote: "",
    name: "Name", email: "Email", phone: "Phone or WhatsApp (optional)", firm: "Firm", kind: "Type",
    kinds: [["correduria", "Insurance brokerage"], ["asesoria", "Accounting or tax firm"], ["otro", "Other"]] as Array<[string, string]>,
    message: "The workflow that costs you the most time", placeholder: "For example: every month we open 40 statements as PDFs and match them by hand against the book; it takes three days.",
    website: "Website", send: "Send", privacy1: "By sending you accept the ", privacyLink: "privacy policy", privacy2: " (in Spanish). We use your data only to reply to you.",
    direct: "Direct", after: "What happens next", afterList: ["A 30-minute call about the workflow.", "If there is a fit, an audit the following week.", "A fixed sprint price in writing."],
    doc: "If you have a document to hand", docNote: "One statement or ten invoices, anonymised, and I will return the result before the call.",
  },
} satisfies Record<Lang, unknown>;

export async function generateMetadata(): Promise<Metadata> {
  const c = COPY[await getLang()];
  return { title: c.meta.title, description: c.meta.description };
}

export default async function Contacto({ searchParams }: { searchParams: Promise<{ enviado?: string; error?: string; tipo?: string }> }) {
  const q = await searchParams;
  const c = COPY[await getLang()];
  return (
    <div className="wrap">
      <SiteNav current="/contacto" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">{c.eyebrow}</div>
        <h1>{c.h1}</h1>
        <p className="lede">{c.lede}</p>
      </section>
      <section>
        <div className="split" style={{ alignItems: "start" }}>
          {q.enviado ? (
            <div className="card"><h3>{c.received}</h3><p className="muted" style={{ marginTop: 8 }}>{c.receivedNote}<a href={CONTACT.whatsapp}>WhatsApp</a>.</p></div>
          ) : (
            <form action="/api/leads" method="post" className="form">
              {q.error && <div className="notice err" style={{ margin: 0 }}>{q.error}</div>}
              <label htmlFor="name">{c.name}<input id="name" name="name" required autoComplete="name" /></label>
              <label htmlFor="email">{c.email}<input id="email" name="email" type="email" required autoComplete="email" /></label>
              <label htmlFor="phone">{c.phone}<input id="phone" name="phone" autoComplete="tel" /></label>
              <label htmlFor="firm">{c.firm}<input id="firm" name="firm" autoComplete="organization" /></label>
              <label htmlFor="kind">{c.kind}
                <select id="kind" name="kind" defaultValue={q.tipo === "asesoria" ? "asesoria" : q.tipo === "correduria" ? "correduria" : "otro"}>
                  {c.kinds.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label htmlFor="message">{c.message}<textarea id="message" name="message" rows={6} required placeholder={c.placeholder} /></label>
              <div className="hp" aria-hidden="true"><label>{c.website}<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <input type="hidden" name="source" value="web-contacto" />
              <button type="submit" className="btn">{c.send}</button>
              <p className="small muted">{c.privacy1}<a href="/legal/privacidad">{c.privacyLink}</a>{c.privacy2}</p>
            </form>
          )}
          <div>
            <div className="card"><strong>{c.direct}</strong><p className="muted" style={{ marginTop: 6 }}>{CONTACT.phone}<br /><a href={CONTACT.whatsapp}>WhatsApp</a><br /><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></p></div>
            <div className="card"><strong>{c.after}</strong><ol className="list-plain" style={{ marginTop: 6 }}>{c.afterList.map((x) => <li key={x}>{x}</li>)}</ol></div>
            <div className="card"><strong>{c.doc}</strong><p className="muted" style={{ marginTop: 6 }}>{c.docNote}</p></div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
