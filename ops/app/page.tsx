import Link from "next/link";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, QueueMock, SettlementMock, AuditMock, Faq, JsonLd, faqJsonLd, ORG_JSONLD, CONTACT } from "@/components/site";

const FAQ: Array<[string, string]> = [
  ["¿Qué pasa cuando la IA se equivoca?", "Se ve. Cada dato extraído muestra el texto del que se leyó; si no hay texto, el campo aparece como ausente y nunca como un valor. Una persona aprueba, corrige o rechaza antes de que nada salga del despacho. Las correcciones quedan registradas y miden el acierto por tipo de documento."],
  ["¿Quién es el responsable del tratamiento?", "Tu despacho. Actuamos como encargado del tratamiento con contrato de encargo por escrito, datos en la UE y sin uso para entrenar modelos."],
  ["¿Funciona con mi programa de gestión?", "Escribimos en tu sistema a través de su API o, si no la tiene, mediante ficheros de importación revisables: ebroker, segElevia, Avant2, Mediator, Holded, A3, Sage y ficheros EIAC. Si usas otro, lo vemos en la auditoría."],
  ["¿Cuánto tarda?", "La auditoría, una semana. El sprint, dos semanas para un flujo en producción. En una correduría el primer flujo suele ser la conciliación de liquidaciones; en una asesoría, la entrada y validación de facturas."],
  ["¿Cuánto cuesta el modelo de IA cada mes?", "Cada despacho tiene un presupuesto mensual de tokens con aviso al 80 %. Un documento típico cuesta céntimos; una liquidación larga, algo más. El registro de actividad muestra el coste de cada lectura."],
];

export default function Home() {
  return (
    <div className="wrap">
      <JsonLd data={ORG_JSONLD} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <SiteNav current="/" />

      <section className="hero">
        <div>
          <div className="eyebrow">Corredurías de seguros · Asesorías y gestorías · España</div>
          <h1 style={{ marginTop: 14 }}>Tus operaciones, con IA y con control.</h1>
          <p className="lede">Automatizamos la entrada de documentos, la extracción de datos, la validación y la conciliación de liquidaciones de comisiones. Cada resultado pasa por una cola de revisión humana y deja rastro de auditoría.</p>
          <div className="ctas">
            <Link className="btn" href="/contacto">Pide una auditoría de 30 minutos</Link>
            <Link className="btn ghost" href="/como-funciona">Ver cómo funciona</Link>
          </div>
          <div className="contact">{CONTACT.phone} · <a href={CONTACT.whatsapp}>WhatsApp</a> · respuesta el mismo día</div>
        </div>
        <QueueMock variant="siniestro" />
      </section>

      <Section id="que" eyebrow="Qué hacemos" title="Cinco pasos que hoy hace tu equipo a mano.">
        <div className="bento">
          <div className="tile"><h3>Entrada de documentos</h3><p>Por email, WhatsApp o subida directa. Cada archivo queda registrado con su huella y su origen.</p></div>
          <div className="tile"><h3>Extracción con cita</h3><p>Pólizas, recibos, partes de siniestro, facturas. Cada dato lleva el texto exacto y la página de la que se leyó. Lo que no consta, se marca como ausente.</p></div>
          <div className="tile"><h3>Validación</h3><p>NIF y CIF comprobados, importes que cuadran, fechas coherentes, checklist de documentos por tipo de siniestro, requisitos de Verifactu en facturas.</p></div>
          <div className="tile wide"><h3>Conciliación de liquidaciones de comisiones</h3><p>La liquidación de la aseguradora, en el formato que sea, contra los recibos que esperabas cobrar. Salida: qué comisiones no se han pagado y cuánto suman, en euros, con una tarea por cada una.</p><SettlementMock compact /></div>
          <div className="tile"><h3>Aprobación humana y auditoría</h3><p>Nada se envía ni se escribe en tu programa de gestión sin un clic de tu equipo. Quién, cuándo, con qué modelo y qué coste: todo queda registrado y se puede exportar.</p><AuditMock /></div>
        </div>
      </Section>

      <Section eyebrow="Para quién" title="Dos tipos de despacho, el mismo problema: papeles que entran y decisiones que esperan.">
        <div className="two">
          <div className="card">
            <h3>Corredurías de seguros</h3>
            <p className="muted" style={{ marginTop: 8 }}>Liquidaciones de comisiones que llegan en 40 formatos, siniestros que se atascan por un documento, renovaciones que se pierden. Empezamos por la liquidación del mes.</p>
            <p style={{ marginTop: 12 }}><Link href="/corredurias">Ver el flujo de una correduría →</Link></p>
          </div>
          <div className="card">
            <h3>Asesorías y gestorías</h3>
            <p className="muted" style={{ marginTop: 8 }}>Facturas de clientes que llegan como pueden, requerimientos, y desde 2027 Verifactu para todos. Empezamos por la entrada y validación de facturas.</p>
            <p style={{ marginTop: 12 }}><Link href="/asesorias">Ver el flujo de una asesoría →</Link></p>
          </div>
        </div>
      </Section>

      <Section id="como" eyebrow="Cómo funciona" title="Llega el documento. La IA propone. Tu equipo aprueba.">
        <div className="steps">
          <div className="step"><h3>Llega</h3><p>Un cliente manda fotos y el parte por WhatsApp. Una aseguradora envía la liquidación del mes en PDF. Un cliente de la asesoría manda sus facturas por email.</p></div>
          <div className="step"><h3>Se propone</h3><p>El sistema lee, valida, detecta qué falta, crea las tareas y redacta la petición. Cada dato enlaza con su origen; cada mensaje lleva el aviso de IA.</p></div>
          <div className="step"><h3>Se aprueba</h3><p>Una persona ve el documento y la propuesta en la misma pantalla y decide. Solo entonces se envía el mensaje o se escribe en el programa de gestión.</p></div>
        </div>
        <p style={{ marginTop: 20 }}><Link href="/como-funciona">Todo el recorrido →</Link> · <Link href="/kit-cumplimiento">El kit de cumplimiento, punto por punto →</Link></p>
      </Section>

      <Section id="precios" eyebrow="Cómo trabajamos" title="Empezamos por el flujo que más tiempo te cuesta." lede="Precios públicos. Si en el sprint no ahorramos horas medibles, no seguimos.">
        <div className="offers">
          <div className="offer"><div className="time">Una semana</div><h3>Auditoría de flujos</h3><div className="price">1.500 a 3.000 €</div><ul><li>Mapa del despacho: tareas, horas, sistemas</li><li>5 a 10 flujos con retorno estimado</li><li>Prototipo funcionando del mejor</li><li>Se descuenta íntegra del sprint</li></ul></div>
          <div className="offer featured"><div className="time">Dos semanas</div><h3>Sprint de automatización</h3><div className="price">6.000 a 12.000 €</div><ul><li>Un flujo en producción, integrado con tu programa de gestión</li><li>Pruebas, documentación y formación</li><li><Link href="/kit-cumplimiento">Kit de cumplimiento</Link> incluido</li><li>Una ronda de ajustes; 50 % al inicio</li></ul></div>
          <div className="offer"><div className="time">Mensual</div><h3>Operaciones gestionadas</h3><div className="price">2.000 a 6.000 €/mes</div><ul><li>Mantenimiento, medición y ampliación</li><li>Nuevos flujos cada trimestre</li><li>Informe de horas ahorradas y euros recuperados</li><li>Facturación anual con descuento</li></ul></div>
        </div>
        <p style={{ marginTop: 20 }}><Link href="/precios">Qué incluye cada uno y qué no →</Link></p>
      </Section>

      <Section eyebrow="Seguridad y cumplimiento" title="Datos en la UE. Trazabilidad por defecto.">
        <div className="trust">
          <div><strong>RGPD y encargado del tratamiento</strong>Contrato de encargo por escrito. Los datos de salud y de terceros no salen de la UE.</div>
          <div><strong>Sin entrenar modelos con tus datos</strong>Tus documentos se usan para tu despacho y para nada más. Retención definida por ti.</div>
          <div><strong>Aviso de IA en cada mensaje</strong>Reglamento Europeo de IA, artículo 50, en vigor desde el 2 de agosto de 2026. Lo añade el sistema, no depende de nadie.</div>
          <div><strong>Supervisión humana obligatoria</strong>Ningún envío ni escritura sin aprobación. Alineado con la supervisión humana del Reglamento de IA y con la opinión de EIOPA sobre gobernanza de IA en mediación.</div>
        </div>
        <p style={{ marginTop: 20 }}><Link href="/seguridad">Todos los controles, uno por uno →</Link></p>
      </Section>

      <Section eyebrow="Resultados" title="Lo que medimos, y con qué lo medimos." lede="Sin clientes que enseñar todavía, enseñamos el método. Los tres primeros despachos tienen precio de fundador y un caso de estudio con cifras.">
        <div className="proof">
          <div className="stat"><div className="n mono">h/sem</div><div className="l">Horas semanales en el flujo, antes y después de la semana 6 del piloto</div></div>
          <div className="stat"><div className="n mono">€</div><div className="l">Comisiones no pagadas detectadas en cada liquidación conciliada</div></div>
          <div className="stat"><div className="n mono">%</div><div className="l">Campos aprobados sin corrección, por tipo de documento</div></div>
        </div>
      </Section>

      <Section eyebrow="Quién está detrás" title="Una persona con nombre, no un formulario.">
        <div className="founder">
          <div className="photo" aria-hidden="true" />
          <div>
            <h3>{CONTACT.founder}</h3>
            <p className="muted" style={{ marginTop: 8 }}>Construyo software en producción dirigiendo agentes de IA, con base de datos, permisos por fila probados por decenas de comprobaciones automáticas y una capa de IA que nunca inventa un dato. Crecí en una correduría familiar: sé qué es una liquidación que no cuadra y un siniestro que se atasca por un documento.</p>
          </div>
        </div>
      </Section>

      <Section id="faq" eyebrow="Preguntas frecuentes" title="Qué pasa cuando la IA se equivoca, y otras.">
        <Faq items={FAQ} />
      </Section>

      <FinalCta />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
