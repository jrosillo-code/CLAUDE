import Link from "next/link";
import { Effects } from "./effects";
import { Motion } from "./motion";
import { getLang, t, type Lang } from "@/lib/i18n";

// Shared site chrome and the signature components, built from DESIGN.md.
// Everything here is server-rendered; the only client behaviour is CSS.

export const CONTACT = {
  email: "hola@example.com",
  whatsapp: "https://wa.me/34600000000",
  phone: "+34 600 000 000",
  founder: "Guillermo Rosillo",
  brand: "Operaciones con IA",
};

const NAV: Record<Lang, ReadonlyArray<readonly [string, string]>> = {
  es: [["/corredurias", "Corredurías"], ["/asesorias", "Asesorías"], ["/como-funciona", "Cómo funciona"], ["/precios", "Precios"], ["/seguridad", "Seguridad"], ["/contacto", "Contacto"]],
  en: [["/corredurias", "Brokerages"], ["/asesorias", "Accounting firms"], ["/como-funciona", "How it works"], ["/precios", "Pricing"], ["/seguridad", "Security"], ["/contacto", "Contact"]],
};

/** The language switch: one link that sets the cookie and comes back to this page. */
export function LangSwitch({ lang, className }: { lang: Lang; className?: string }) {
  const other: Lang = lang === "en" ? "es" : "en";
  return <a href={`/lang/${other}`} className={className ?? "lang-switch"} hrefLang={other} lang={other} aria-label={other === "en" ? "Switch to English" : "Cambiar a español"}>{other.toUpperCase()}</a>;
}

export async function SiteNav({ current }: { current?: string }) {
  const lang = await getLang();
  return (
    <nav className="nav" aria-label={t(lang, "Principal", "Main")}>
      <span className="nav-progress" aria-hidden="true" />
      <Link className="brand" href="/">{CONTACT.brand}</Link>
      <div className="nav-links">
        {NAV[lang].map(([href, label]) => <Link key={href} href={href} aria-current={current === href ? "page" : undefined} className={current === href ? "active" : undefined}>{label}</Link>)}
        <a href={CONTACT.whatsapp} className="nav-wa">WhatsApp</a>
        <LangSwitch lang={lang} />
        <Link href="/contacto" className="btn">{t(lang, "Auditoría", "Audit")}</Link>
      </div>
    </nav>
  );
}

export async function SiteFooter() {
  const lang = await getLang();
  const en = lang === "en";
  return (
    <footer>
      <Effects />
      <Motion />
      <div className="col">
        <Link className="brand" href="/">{CONTACT.brand}</Link>
        <span>{t(lang, "Automatización con revisión humana para corredurías de seguros y asesorías en España.", "Automation with human review for insurance brokerages and accounting firms in Spain.")}</span>
        <span>{CONTACT.phone} · <a href={CONTACT.whatsapp}>WhatsApp</a> · <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></span>
      </div>
      <div className="col">
        <span className="eyebrow">{t(lang, "Producto", "Product")}</span>
        <Link href="/corredurias">{t(lang, "Corredurías", "Brokerages")}</Link>
        <Link href="/asesorias">{t(lang, "Asesorías", "Accounting firms")}</Link>
        <Link href="/como-funciona">{t(lang, "Cómo funciona", "How it works")}</Link>
        <Link href="/precios">{t(lang, "Precios", "Pricing")}</Link>
      </div>
      <div className="col">
        <span className="eyebrow">{t(lang, "Confianza", "Trust")}</span>
        <Link href="/seguridad">{t(lang, "Seguridad", "Security")}</Link>
        <Link href="/kit-cumplimiento">{t(lang, "Kit de cumplimiento", "Compliance kit")}</Link>
        <Link href="/estado">{t(lang, "Estado del sistema", "System status")}</Link>
        <Link href="/diseno">{t(lang, "Sistema de diseño", "Design system")}</Link>
      </div>
      <div className="col">
        <span className="eyebrow">Legal</span>
        <Link href="/legal/aviso">{t(lang, "Aviso legal", "Legal notice (Spanish)")}</Link>
        <Link href="/legal/privacidad">{t(lang, "Privacidad", "Privacy (Spanish)")}</Link>
        <Link href="/legal/encargo">{t(lang, "Contrato de encargo", "Processing agreement (Spanish)")}</Link>
        <Link href="/contacto">{t(lang, "Contacto", "Contact")}</Link>
      </div>
      <div className="legal"><span>{CONTACT.brand} · {CONTACT.founder} · {t(lang, "NIF pendiente", "Tax id pending")}</span><span>{en ? <><LangSwitch lang={lang} className="" /> · <strong>EN</strong></> : <><strong>ES</strong> · <LangSwitch lang={lang} className="" /></>}</span></div>
    </footer>
  );
}

/** The reconciled statement as the settlements screen draws it: status pill per line, tabular figures, the approve action only on the claim. */
export function SettlementMock({ compact = false }: { compact?: boolean }) {
  const rows: Array<[string, "ok" | "pending" | "err", string, string, string, string]> = [
    ["cuadra", "ok", "HG-55-220931", "82,50 €", "82,50 €", "—"],
    ["diferencia", "pending", "AU-2024-778812", "76,80 €", "70,40 €", "6,40 €"],
    ["no pagado", "pending", "SA-1", "12,00 €", "—", "12,00 €"],
    ["no esperado", "err", "VD-90-000123", "—", "15,00 €", "—"],
  ];
  return (
    <div className="settle" aria-label="Ejemplo de liquidación conciliada">
      <table>
        <thead><tr><th>Estado</th><th>Póliza</th>{!compact && <th className="num">Esperado</th>}{!compact && <th className="num">Liquidado</th>}<th className="num">Diferencia</th></tr></thead>
        <tbody>
          {rows.map(([label, pill, policy, exp, set, diff]) => (
            <tr key={policy}><td><span className={`pill ${pill}`}>{label}</span></td><td className="mono">{policy}</td>{!compact && <td className="num">{exp}</td>}{!compact && <td className="num">{set}</td>}<td className="num">{diff}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={compact ? 2 : 4} className="small muted">Aseguradora Ejemplo SA · agosto 2026 · 4 líneas, 2 reclamables</td><td className="num"><strong>18,40 €</strong></td></tr></tfoot>
      </table>
      <div className="bar"><span className="small muted">Carta a la aseguradora redactada por el sistema, pendiente de una persona.</span><span className="btn accent">Aprobar y enviar</span></div>
    </div>
  );
}

/** Five rows of the activity log, as stored: time, what, who, what it cost. */
export function AuditMock() {
  const rows: Array<[string, string, string, string]> = [
    ["12:04", "document.received", "sistema · WhatsApp", ""],
    ["12:04", "document.extracted", "modelo · claude", "$0,0041"],
    ["12:04", "document.validated · 2 elementos faltan", "sistema", ""],
    ["12:31", "field.corrected · fecha_siniestro", "marta@despacho.es", ""],
    ["12:32", "approval.approved · message.sent", "marta@despacho.es", ""],
  ];
  return (
    <div className="audit" aria-label="Ejemplo del registro de actividad">
      {rows.map(([t, a, w, c]) => <div key={t + a}><span className="t">{t}</span><span><span className="who">{a.split(" · ")[0]}</span>{a.includes(" · ") ? ` · ${a.split(" · ").slice(1).join(" · ")}` : ""} · {w}</span><span className="c">{c}</span></div>)}
    </div>
  );
}

/** The disclosure line exactly as withDisclosure() appends it. */
export function DisclosureLine({ firm = "Correduría Ejemplo" }: { firm?: string }) {
  return <div className="disclosure">{firm}<br />Este mensaje se ha preparado con ayuda de un sistema de inteligencia artificial y ha sido revisado por una persona antes de enviarse.</div>;
}

export async function StickyCta() {
  const lang = await getLang();
  return (
    <div className="sticky-cta" aria-hidden="true">
      <a className="btn" href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(t(lang, "Auditoría de 30 minutos", "30-minute audit"))}`}>{t(lang, "Pide una auditoría", "Book an audit")}</a>
      <a className="btn ghost" href={CONTACT.whatsapp}>WhatsApp</a>
    </div>
  );
}

export function Section({ id, eyebrow, title, lede, band = false, children }: { id?: string; eyebrow?: string; title: string; lede?: string; band?: boolean; children?: React.ReactNode }) {
  return (
    <section id={id} className={band ? "band" : undefined}>
      <div className="section-head">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {lede && <p className="muted">{lede}</p>}
      </div>
      {children}
    </section>
  );
}

export async function FinalCta({ title }: { title?: string }) {
  const lang = await getLang();
  const heading = title ?? t(lang, "Cuéntame tu flujo más lento. Te digo en 30 minutos si se puede automatizar y cuánto costaría.", "Tell me your slowest workflow. In 30 minutes I will tell you whether it can be automated and what it would cost.");
  return (
    <section>
      <div className="section-head"><h2>{heading}</h2></div>
      <div className="row">
        <a className="btn" href="/contacto">{t(lang, "Escribir", "Write to me")}</a>
        <a className="btn ghost" href={CONTACT.whatsapp}>{t(lang, "Abrir WhatsApp", "Open WhatsApp")}</a>
        <span className="small muted">{CONTACT.phone} · {t(lang, "respuesta el mismo día", "same-day reply")}</span>
      </div>
    </section>
  );
}

/** The review screen, drawn from the same CSS as the app. Variant by vertical. */
export function QueueMock({ variant = "siniestro" }: { variant?: "siniestro" | "factura" | "liquidacion" }) {
  if (variant === "factura") {
    return (
      <div className="queue queue-anim" aria-label="Ejemplo de la cola de revisión">
        <div className="queue-bar"><span>cola de revisión · 1 de 6</span><span>factura-0412.pdf · pág. 1</span></div>
        <div className="queue-body">
          <div className="queue-doc"><div className="page">
            FACTURA<br />Talleres Norte SL<br />CIF <mark>B-12345674</mark><br />Factura nº <mark>2026/0412</mark><br />Fecha: <mark>05/09/2026</mark><br />Cliente: Marta Ruiz Pardo<br />Base imponible <mark>820,00</mark><br />IVA <mark>21%</mark> · Cuota <mark>172,20</mark><br />TOTAL <mark>992,20 €</mark>
          </div></div>
          <div className="queue-fields">
            <div className="field"><span className="k">NIF emisor</span><span className="tag ok">leído</span><span className="v">B12345674</span><span className="src">“CIF B-12345674”, pág. 1 · comprobación de dígito correcta</span></div>
            <div className="field"><span className="k">Total</span><span className="tag ok">leído</span><span className="v">992,20 €</span><span className="src">base + cuota cuadran</span></div>
            <div className="field"><span className="k">NIF receptor</span><span className="tag missing">falta</span><span className="v">—</span><span className="src">obligatorio salvo factura simplificada · tarea creada</span></div>
            <div className="queue-actions"><span className="btn accent">Aprobar y contabilizar</span><span className="btn ghost">Corregir</span></div>
          </div>
          <div className="queue-audit">registro · 09:12 recibido por email · 09:12 leído · 09:12 validado: 1 elemento falta · pendiente de aprobación</div>
        </div>
      </div>
    );
  }
  if (variant === "liquidacion") {
    return (
      <div className="queue queue-anim" aria-label="Ejemplo de conciliación de liquidación">
        <div className="queue-bar"><span>liquidación · Aseguradora Ejemplo · agosto 2026</span><span>47 líneas · 3 con incidencia</span></div>
        <div className="queue-body">
          <div className="queue-doc"><div className="page">
            LIQUIDACIÓN DE COMISIONES<br />Mediador M-4471 · 01/08 a 31/08/2026<br /><br />HG-55-220931 · R-1 · Hogar · 412,50 · 20% · <mark>82,50</mark><br />AU-2024-778812 · R-2 · Autos · 640,00 · 12% · <mark>70,40</mark><br />VD-90-000123 · Vida · 300,00 · 5% · <mark>15,00</mark><br />…<br />Total comisiones <mark>1.937,30</mark>
          </div></div>
          <div className="queue-fields">
            <div className="field"><span className="k">HG-55-220931</span><span className="tag ok">cuadra</span><span className="v">82,50 €</span><span className="src">esperado 82,50 € · recibo R-1</span></div>
            <div className="field"><span className="k">AU-2024-778812</span><span className="tag missing">diferencia</span><span className="v">70,40 € de 76,80 €</span><span className="src">6,40 € menos de lo esperado · tarea: reclamar</span></div>
            <div className="field"><span className="k">SA-1</span><span className="tag missing">no liquidado</span><span className="v">12,00 €</span><span className="src">recibo esperado y no pagado · tarea: reclamar</span></div>
            <div className="queue-actions"><span className="btn accent">Aprobar reclamación</span><span className="btn ghost">Ver las 47 líneas</span></div>
          </div>
          <div className="queue-audit">registro · 18,40 € a reclamar en esta liquidación · 44 líneas cuadran · 0 líneas ilegibles</div>
        </div>
      </div>
    );
  }
  return (
    <div className="queue queue-anim" aria-label="Ejemplo de la cola de revisión">
      <div className="queue-bar"><span>cola de revisión · 1 de 4</span><span>parte-siniestro.pdf · pág. 1</span></div>
      <div className="queue-body">
        <div className="queue-doc"><div className="page">
          PARTE DE SINIESTRO<br />Póliza nº <mark>AU-2024-778812</mark><br />Asegurada: <mark>Marta Ruiz Pardo</mark><br />Fecha del siniestro: <mark>03/09/2026</mark><br />Lugar: Calle Alcalá 120, Madrid<br />Descripción: <mark>colisión por alcance en semáforo</mark><br />Otro vehículo implicado: sí<br />Adjuntos: fotos (4), parte amistoso
        </div></div>
        <div className="queue-fields">
          <div className="field"><span className="k">Póliza</span><span className="tag ok">leído</span><span className="v">AU-2024-778812</span><span className="src">“Póliza nº AU-2024-778812”, pág. 1</span></div>
          <div className="field"><span className="k">Fecha</span><span className="tag ok">leído</span><span className="v">2026-09-03</span><span className="src">“Fecha del siniestro: 03/09/2026”</span></div>
          <div className="field"><span className="k">Permiso de circulación</span><span className="tag missing">falta</span><span className="v">—</span><span className="src">tarea creada · pedir al cliente</span></div>
          <div className="field"><span className="k">Carné de conducir</span><span className="tag missing">falta</span><span className="v">—</span><span className="src">tarea creada · pedir al cliente</span></div>
          <div className="queue-actions"><span className="btn accent">Aprobar y enviar petición</span><span className="btn ghost">Corregir</span></div>
        </div>
        <div className="queue-audit">registro · 12:04 documento recibido (WhatsApp) · 12:04 leído · 12:04 validado: 2 elementos faltan · pendiente de aprobación</div>
      </div>
    </div>
  );
}

export function Faq({ items, open = 0 }: { items: Array<[string, string]>; open?: number }) {
  return (
    <div>
      {items.map(([q, a], i) => (
        <details key={q} open={i === open}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function faqJsonLd(items: Array<[string, string]>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

export const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: CONTACT.brand,
  description: "Automatización de operaciones con revisión humana para corredurías de seguros y asesorías en España: entrada de documentos, extracción con cita, validación, conciliación de liquidaciones de comisiones y registro de auditoría.",
  areaServed: "ES",
  availableLanguage: ["es"],
  telephone: CONTACT.phone,
  email: CONTACT.email,
  founder: { "@type": "Person", name: CONTACT.founder },
  makesOffer: [
    { "@type": "Offer", name: "Auditoría de flujos", priceSpecification: { "@type": "PriceSpecification", minPrice: 1500, maxPrice: 3000, priceCurrency: "EUR" } },
    { "@type": "Offer", name: "Sprint de automatización", priceSpecification: { "@type": "PriceSpecification", minPrice: 6000, maxPrice: 12000, priceCurrency: "EUR" } },
    { "@type": "Offer", name: "Operaciones gestionadas", priceSpecification: { "@type": "PriceSpecification", minPrice: 2000, maxPrice: 6000, priceCurrency: "EUR", unitText: "mes" } },
  ],
};
