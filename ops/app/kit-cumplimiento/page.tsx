import Link from "next/link";
import { MeshCanvas } from "@/components/mesh-canvas";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, AuditMock, DisclosureLine, JsonLd, ORG_JSONLD } from "@/components/site";

export const metadata = { title: "Kit de cumplimiento", description: "Los siete controles que lleva cada flujo desde el primer día: aviso de IA (art. 50 del Reglamento de IA), revisión humana, registro de actividad exportable, trazabilidad de cada dato, contrato de encargo y datos en la UE, facturación con motor certificado Verifactu, presupuesto de modelo con aviso." };

// The compliance kit as a page: the same seven items that ship with every
// build, in the order a data protection officer reads them, printable as the
// document that goes with the pilot agreement.

const ITEMS: Array<{ n: string; title: string; what: string; how: string; where: string }> = [
  { n: "01", title: "Aviso de IA", what: "Toda comunicación generada o asistida por IA lo indica, como exige el artículo 50 del Reglamento Europeo de IA, en vigor desde el 2 de agosto de 2026.", how: "El sistema añade el aviso al final de cada mensaje después de la revisión humana; el modelo no participa. Editar el borrador no lo elimina.", where: "Pie de email y de WhatsApp. Texto estándar, sin variaciones." },
  { n: "02", title: "Revisión humana", what: "Ningún envío al exterior ni escritura definitiva en el programa de gestión sin la aprobación de una persona con nombre.", how: "Una única función del código es la puerta de salida y exige una aprobación pendiente. Si el envío falla, la aprobación sigue pendiente y el fallo queda registrado.", where: "Cola de revisión: documento y propuesta en la misma pantalla; aprobar, corregir o rechazar." },
  { n: "03", title: "Registro de actividad", what: "Cada documento recibido, cada lectura, cada validación, cada borrador, cada corrección y cada aprobación quedan registrados con fecha, usuario, versión del modelo y coste.", how: "La tabla solo admite inserciones: sin actualizar ni borrar, ni siquiera por el despacho. Sobrevive al borrado de los documentos.", where: "Pantalla de actividad y exportación en CSV desde la aplicación." },
  { n: "04", title: "Trazabilidad", what: "Cada dato extraído enlaza con el documento y la página de origen. La IA nunca inventa un dato: si no está en el documento, se marca como ausente.", how: "Un valor sin texto de origen se trata como ausente por código. La evaluación automática cuenta como inventado cualquier valor cuyo texto no aparece en el documento.", where: "Cada campo de la cola muestra la cita y la página; las correcciones guardan quién y cuándo." },
  { n: "05", title: "Datos", what: "Contrato de encargo del tratamiento (artículo 28 RGPD). Datos de salud y de terceros dentro de la UE. Retención definida por el despacho. Sin uso de los datos para entrenar nada.", how: "Base de datos, ficheros y autenticación en región europea; proveedor de modelos sin retención para entrenamiento. La retención se configura en días y la aplica una tarea diaria que borra originales y datos leídos, nunca el registro.", where: "Contrato de encargo y lista de subencargados; ajuste de retención en la aplicación." },
  { n: "06", title: "Facturación", what: "Si el flujo emite facturas, se integra un motor certificado Verifactu. No se implementa el registro, el hash ni el envío a la AEAT por cuenta propia.", how: "Evita la responsabilidad de productor de software y la declaración responsable. El sistema prepara los datos; el motor certificado firma y envía.", where: "Solo en flujos de facturación; en corredurías no aplica." },
  { n: "07", title: "Coste y límites", what: "Presupuesto mensual de tokens por despacho, con aviso al 80 %, para saber lo que cuesta el mes antes de que llegue la factura.", how: "Ninguna llamada al modelo sin comprobar el presupuesto; al llegar al techo el sistema se detiene hasta el mes siguiente. El aviso se registra y se envía al correo que el despacho indique.", where: "Cada lectura registra tokens y coste; el informe mensual los suma." },
];

export default function Kit() {
  return (
    <div className="wrap">
      <JsonLd data={ORG_JSONLD} />
      <SiteNav current="/kit-cumplimiento" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">Kit de cumplimiento</div>
        <h1>Siete controles que lleva cada flujo desde el primer día.</h1>
        <p className="lede">No es un chatbot cualquiera: es un flujo auditable diseñado para despachos regulados en España. Esta página es el kit completo, tal como se entrega con cada sprint; imprímela para tu delegado de protección de datos.</p>
        <div className="ctas no-print"><Link className="btn" href="/contacto">Pedir el kit con el contrato de encargo</Link><Link className="btn ghost" href="/seguridad">Ver los controles técnicos</Link></div>
      </section>

      <Section band eyebrow="Los siete puntos" title="Qué garantiza cada uno, cómo lo hace el sistema y dónde se ve.">
        <div className="rows">
          {ITEMS.map((it) => (
            <div key={it.n}>
              <div>
                <h3>{it.title}</h3>
                <p>{it.what}</p>
                <p><strong style={{ color: "var(--ink)" }}>Cómo.</strong> {it.how}</p>
                <p><strong style={{ color: "var(--ink)" }}>Dónde.</strong> {it.where}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Tal cual se ve" title="El registro y el aviso.">
        <div className="two">
          <div><AuditMock /></div>
          <div><DisclosureLine /></div>
        </div>
      </Section>

      <Section eyebrow="Marco" title="Las normas detrás de cada punto.">
        <ul className="list-plain">
          <li>Reglamento (UE) 2024/1689 de Inteligencia Artificial, artículo 50: obligaciones de transparencia aplicables desde el 2 de agosto de 2026.</li>
          <li>RGPD, artículo 28: contrato de encargo del tratamiento; artículo 9: categorías especiales (salud) en vida, salud y decesos.</li>
          <li>Opinión de EIOPA sobre gobernanza y gestión de riesgos de IA en seguros (agosto de 2025) y prioridades de supervisión de la DGSFP 2026 a 2028.</li>
          <li>Verifactu (RD 1007/2023 y orden HAC/1177/2024): obligatorio para sociedades desde el 1 de enero de 2027 y para el resto desde el 1 de julio de 2027.</li>
        </ul>
        <p className="small muted" style={{ marginTop: 16 }}>Las fechas se revisan antes de cada entrega; si una norma cambia, cambia el kit. Documentos relacionados: <a href="/legal/encargo">contrato de encargo</a>, <a href="/legal/privacidad">política de privacidad</a>.</p>
      </Section>

      <FinalCta title="¿Tu DPO quiere ver el kit aplicado a tu flujo? Lo revisamos juntos en 30 minutos." />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
