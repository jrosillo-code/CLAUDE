import { SiteNav, SiteFooter, CONTACT } from "@/components/site";

export const metadata = { title: "Contacto", description: "Cuéntanos tu flujo más lento. Te decimos en 30 minutos si se puede automatizar y cuánto costaría." };
export const dynamic = "force-dynamic";

export default async function Contacto({ searchParams }: { searchParams: Promise<{ enviado?: string; error?: string; tipo?: string }> }) {
  const q = await searchParams;
  return (
    <div className="wrap">
      <SiteNav current="/contacto" />
      <section className="page-hero">
        <div className="eyebrow">Contacto</div>
        <h1>Cuéntame tu flujo más lento.</h1>
        <p className="lede">Te digo en 30 minutos si se puede automatizar y cuánto costaría. Respondo el mismo día laborable.</p>
      </section>
      <section>
        <div className="split" style={{ alignItems: "start" }}>
          {q.enviado ? (
            <div className="card"><h3>Recibido.</h3><p className="muted" style={{ marginTop: 8 }}>Te escribo hoy. Si prefieres, adelántate por <a href={CONTACT.whatsapp}>WhatsApp</a>.</p></div>
          ) : (
            <form action="/api/leads" method="post" className="form">
              {q.error && <div className="card" style={{ borderColor: "var(--bad)", margin: 0 }}>{q.error}</div>}
              <label htmlFor="name">Nombre<input id="name" name="name" required autoComplete="name" /></label>
              <label htmlFor="email">Correo<input id="email" name="email" type="email" required autoComplete="email" /></label>
              <label htmlFor="phone">Teléfono o WhatsApp (opcional)<input id="phone" name="phone" autoComplete="tel" /></label>
              <label htmlFor="firm">Despacho<input id="firm" name="firm" autoComplete="organization" /></label>
              <label htmlFor="kind">Tipo
                <select id="kind" name="kind" defaultValue={q.tipo === "asesoria" ? "asesoria" : q.tipo === "correduria" ? "correduria" : "otro"}>
                  <option value="correduria">Correduría de seguros</option>
                  <option value="asesoria">Asesoría o gestoría</option>
                  <option value="otro">Otro</option>
                </select>
              </label>
              <label htmlFor="message">El flujo que más tiempo os cuesta<textarea id="message" name="message" rows={6} required placeholder="Por ejemplo: cada mes abrimos 40 liquidaciones en PDF y las cruzamos a mano con la cartera; nos lleva tres días." /></label>
              <div className="hp" aria-hidden="true"><label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <input type="hidden" name="source" value="web-contacto" />
              <button type="submit" className="btn">Enviar</button>
              <p className="small muted">Al enviar aceptas la <a href="/legal/privacidad">política de privacidad</a>. Usamos tus datos solo para responderte.</p>
            </form>
          )}
          <div>
            <div className="card"><strong>Directo</strong><p className="muted" style={{ marginTop: 6 }}>{CONTACT.phone}<br /><a href={CONTACT.whatsapp}>WhatsApp</a><br /><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></p></div>
            <div className="card"><strong>Qué pasa después</strong><ol className="list-plain" style={{ marginTop: 6 }}><li>Llamada de 30 minutos sobre el flujo.</li><li>Si hay encaje, auditoría la semana siguiente.</li><li>Precio del sprint cerrado por escrito.</li></ol></div>
            <div className="card"><strong>Si tienes un documento a mano</strong><p className="muted" style={{ marginTop: 6 }}>Una liquidación o diez facturas, anonimizadas, y te devuelvo el resultado antes de la llamada.</p></div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
