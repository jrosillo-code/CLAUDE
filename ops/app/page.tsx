import Link from "next/link";

// Landing page. Built on the September 2026 design research
// (docs/website-design-research-2026-09.md): lead with the review screen,
// publish price bands and timelines, use the Spanish regulatory vocabulary,
// say what happens when the AI is wrong, and stay editorial and restrained.
// All contact details are placeholders until the company entity exists.

const CONTACT = {
  email: "hola@example.com",
  whatsapp: "https://wa.me/34600000000",
  phone: "+34 600 000 000",
  founder: "Guillermo Rosillo",
};

export default function Home() {
  return (
    <>
      <div className="wrap">
        <nav className="nav">
          <a className="brand" href="#">Operaciones con IA</a>
          <div className="nav-links">
            <a href="#que">Qué hacemos</a>
            <a href="#como">Cómo funciona</a>
            <a href="#confianza">Confianza</a>
            <a href="#precios">Precios</a>
            <a href="#faq">Preguntas</a>
            <a href={CONTACT.whatsapp}>WhatsApp</a>
          </div>
        </nav>

        <section className="hero">
          <div>
            <div className="eyebrow">Corredurías de seguros · Asesorías y gestorías · España</div>
            <h1 style={{ marginTop: 14 }}>Tus operaciones, con IA y con control.</h1>
            <p className="lede">
              Automatizamos la entrada de documentos, la extracción de datos, la validación y la
              conciliación de liquidaciones de comisiones. Cada resultado pasa por una cola de
              revisión humana y deja rastro de auditoría.
            </p>
            <div className="ctas">
              <a className="btn" href={`mailto:${CONTACT.email}?subject=Auditoría de 30 minutos`}>Pide una auditoría de 30 minutos</a>
              <Link className="btn ghost" href="/revisar">Ver la cola de revisión</Link>
            </div>
            <div className="contact">{CONTACT.phone} · <a href={CONTACT.whatsapp}>WhatsApp</a> · respuesta el mismo día</div>
          </div>

          <div className="queue" aria-label="Ejemplo de la cola de revisión">
            <div className="queue-bar"><span>cola de revisión · 1 de 4</span><span>parte-siniestro.pdf · pág. 1</span></div>
            <div className="queue-body">
              <div className="queue-doc">
                <div className="page">
                  PARTE DE SINIESTRO<br />
                  Póliza nº <mark>AU-2024-778812</mark><br />
                  Asegurada: <mark>Marta Ruiz Pardo</mark><br />
                  Fecha del siniestro: <mark>03/09/2026</mark><br />
                  Lugar: Calle Alcalá 120, Madrid<br />
                  Descripción: <mark>colisión por alcance en semáforo</mark><br />
                  Otro vehículo implicado: sí<br />
                  Adjuntos: fotos (4), parte amistoso
                </div>
              </div>
              <div className="queue-fields">
                <div className="field"><span className="k">Póliza</span><span className="tag ok">leído</span><span className="v">AU-2024-778812</span><span className="src">“Póliza nº AU-2024-778812”, pág. 1</span></div>
                <div className="field"><span className="k">Fecha</span><span className="tag ok">leído</span><span className="v">2026-09-03</span><span className="src">“Fecha del siniestro: 03/09/2026”</span></div>
                <div className="field"><span className="k">Permiso de circulación</span><span className="tag missing">falta</span><span className="v">—</span><span className="src">tarea creada · pedir al cliente</span></div>
                <div className="field"><span className="k">Carné de conducir</span><span className="tag missing">falta</span><span className="v">—</span><span className="src">tarea creada · pedir al cliente</span></div>
                <div className="queue-actions">
                  <span className="btn accent">Aprobar y enviar petición</span>
                  <span className="btn ghost">Corregir</span>
                </div>
              </div>
              <div className="queue-audit">registro · 12:04 documento recibido (WhatsApp) · 12:04 leído por claude-opus-5 · 12:04 validado: 2 elementos faltan · pendiente de aprobación</div>
            </div>
          </div>
        </section>

        <section id="que">
          <div className="section-head">
            <div className="eyebrow">Qué hacemos</div>
            <h2>Cinco pasos que hoy hace tu equipo a mano.</h2>
          </div>
          <div className="bento">
            <div className="tile"><h3>Entrada de documentos</h3><p>Por email, WhatsApp o subida directa. Cada archivo queda registrado con su huella y su origen.</p></div>
            <div className="tile"><h3>Extracción con cita</h3><p>Pólizas, recibos, partes de siniestro, facturas. Cada dato lleva el texto exacto y la página de la que se leyó. Lo que no consta, se marca como ausente.</p></div>
            <div className="tile"><h3>Validación</h3><p>NIF y CIF comprobados, importes que cuadran, fechas coherentes, checklist de documentos por tipo de siniestro, requisitos de Verifactu en facturas.</p></div>
            <div className="tile wide"><h3>Conciliación de liquidaciones de comisiones</h3><p>La liquidación de la aseguradora, en el formato que sea, contra los recibos que esperabas cobrar. Salida: qué comisiones no se han pagado y cuánto suman, en euros, con una tarea por cada una.</p></div>
            <div className="tile"><h3>Aprobación humana y auditoría</h3><p>Nada se envía ni se escribe en tu programa de gestión sin un clic de tu equipo. Quién, cuándo, con qué modelo y qué coste: todo queda registrado y se puede exportar.</p></div>
          </div>
        </section>

        <section id="como">
          <div className="section-head">
            <div className="eyebrow">Cómo funciona</div>
            <h2>Llega el documento. La IA propone. Tu equipo aprueba.</h2>
          </div>
          <div className="steps">
            <div className="step"><h3>Llega</h3><p>Un cliente manda fotos y el parte por WhatsApp. Una aseguradora envía la liquidación del mes en PDF. Un cliente de la asesoría manda sus facturas por email.</p></div>
            <div className="step"><h3>Se propone</h3><p>El sistema lee, valida, detecta qué falta, crea las tareas y redacta la petición. Cada dato enlaza con su origen; cada mensaje lleva el aviso de IA.</p></div>
            <div className="step"><h3>Se aprueba</h3><p>Una persona ve el documento y la propuesta en la misma pantalla y decide. Solo entonces se envía el mensaje o se escribe en el programa de gestión.</p></div>
          </div>
        </section>

        <section>
          <div className="section-head">
            <div className="eyebrow">Con qué trabajamos</div>
            <h2>Se integra con lo que ya usas.</h2>
          </div>
          <div className="two">
            <div>
              <h3>Corredurías</h3>
              <ul>
                <li>Liquidaciones de comisiones, recibos, siniestros, condicionados</li>
                <li>ebroker, segElevia, Avant2, Mediator, y ficheros EIAC</li>
                <li>Bandeja de WhatsApp y email compartida con el equipo</li>
              </ul>
            </div>
            <div>
              <h3>Asesorías y gestorías</h3>
              <ul>
                <li>Facturas y documentos de clientes, requerimientos, conciliación</li>
                <li>Holded, A3, Sage, Anfix, Quipu; motor Verifactu certificado, nunca propio</li>
                <li>Migración de clientes que facturan en Excel o sistemas antiguos</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="confianza">
          <div className="section-head">
            <div className="eyebrow">Seguridad y cumplimiento</div>
            <h2>Datos en la UE. Trazabilidad por defecto.</h2>
          </div>
          <div className="trust">
            <div><strong>RGPD y encargado del tratamiento</strong>Contrato de encargo por escrito. Los datos de salud y de terceros no salen de la UE.</div>
            <div><strong>Sin entrenar modelos con tus datos</strong>Tus documentos se usan para tu despacho y para nada más. Retención definida por ti.</div>
            <div><strong>Aviso de IA en cada mensaje</strong>Reglamento Europeo de IA, artículo 50, en vigor desde el 2 de agosto de 2026. Lo añade el sistema, no depende de nadie.</div>
            <div><strong>Supervisión humana obligatoria</strong>Ningún envío ni escritura sin aprobación. Alineado con la supervisión humana del Reglamento de IA y con la opinión de EIOPA sobre gobernanza de IA en mediación.</div>
            <div><strong>Registro de auditoría exportable</strong>Cada documento, extracción, validación, borrador y aprobación con fecha, usuario, modelo y coste.</div>
            <div><strong>Preparado para Verifactu y SII</strong>En los flujos de facturación integramos un motor certificado. No implementamos el registro ni el envío a la AEAT por nuestra cuenta.</div>
          </div>
        </section>

        <section id="precios">
          <div className="section-head">
            <div className="eyebrow">Cómo trabajamos</div>
            <h2>Empezamos por el flujo que más tiempo te cuesta.</h2>
            <p className="muted">Precios públicos. Si en el sprint no ahorramos horas medibles, no seguimos.</p>
          </div>
          <div className="offers">
            <div className="offer">
              <div className="time">Una semana</div>
              <h3>Auditoría de flujos</h3>
              <div className="price">1.500 a 3.000 €</div>
              <ul>
                <li>Mapa del despacho: tareas, horas, sistemas</li>
                <li>5 a 10 flujos automatizables con retorno estimado</li>
                <li>Prototipo funcionando del mejor</li>
                <li>Se descuenta íntegra del sprint</li>
              </ul>
            </div>
            <div className="offer featured">
              <div className="time">Dos semanas</div>
              <h3>Sprint de automatización</h3>
              <div className="price">6.000 a 12.000 €</div>
              <ul>
                <li>Un flujo en producción, integrado con tu programa de gestión</li>
                <li>Pruebas, documentación y formación del equipo</li>
                <li>Kit de cumplimiento incluido</li>
                <li>Una ronda de ajustes; 50 % al inicio</li>
              </ul>
            </div>
            <div className="offer">
              <div className="time">Mensual</div>
              <h3>Operaciones gestionadas</h3>
              <div className="price">2.000 a 6.000 €/mes</div>
              <ul>
                <li>Mantenimiento, medición y ampliación</li>
                <li>Nuevos flujos cada trimestre</li>
                <li>Informe de horas ahorradas y euros recuperados</li>
                <li>Facturación anual con descuento</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <div className="section-head">
            <div className="eyebrow">Resultados</div>
            <h2>Lo que medimos, y con qué lo medimos.</h2>
            <p className="muted">Sin clientes que enseñar todavía, enseñamos el método. Los tres primeros despachos tienen precio de fundador y un caso de estudio con cifras.</p>
          </div>
          <div className="proof">
            <div className="stat"><div className="n mono">h/sem</div><div className="l">Horas semanales en el flujo, antes y después de la semana 6 del piloto</div></div>
            <div className="stat"><div className="n mono">€</div><div className="l">Comisiones no pagadas detectadas en cada liquidación conciliada</div></div>
            <div className="stat"><div className="n mono">%</div><div className="l">Campos aprobados sin corrección, por tipo de documento</div></div>
          </div>
        </section>

        <section>
          <div className="section-head">
            <div className="eyebrow">Quién está detrás</div>
            <h2>Una persona con nombre, no un formulario.</h2>
          </div>
          <div className="founder">
            <div className="photo" aria-hidden="true" />
            <div>
              <h3>{CONTACT.founder}</h3>
              <p className="muted" style={{ marginTop: 8 }}>
                Construyo software en producción dirigiendo agentes de IA, con base de datos, permisos
                por fila probados por decenas de comprobaciones automáticas y una capa de IA que nunca
                inventa un dato. Crecí en una correduría familiar: sé qué es una liquidación que no
                cuadra y un siniestro que se atasca por un documento.
              </p>
              <p className="small muted" style={{ marginTop: 10 }}>Caso de estudio y demostración de tres minutos disponibles.</p>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="section-head">
            <div className="eyebrow">Preguntas frecuentes</div>
            <h2>Qué pasa cuando la IA se equivoca, y otras.</h2>
          </div>
          <details open>
            <summary>¿Qué pasa cuando la IA se equivoca?</summary>
            <p>Se ve. Cada dato extraído muestra el texto del que se leyó; si no hay texto, el campo aparece como ausente y nunca como un valor. Una persona aprueba, corrige o rechaza antes de que nada salga del despacho. Las correcciones quedan registradas y sirven para medir el porcentaje de acierto por tipo de documento.</p>
          </details>
          <details>
            <summary>¿Quién es el responsable del tratamiento?</summary>
            <p>Tu despacho. Nosotros actuamos como encargado del tratamiento con contrato de encargo por escrito, datos en la UE y sin uso para entrenar modelos.</p>
          </details>
          <details>
            <summary>¿Funciona con mi programa de gestión?</summary>
            <p>Escribimos en tu sistema a través de su API o, si no la tiene, mediante ficheros de importación revisables. ebroker, segElevia, Avant2, Mediator, Holded, A3, Sage y ficheros EIAC. Si usas otro, lo vemos en la auditoría.</p>
          </details>
          <details>
            <summary>¿Cuánto tarda?</summary>
            <p>La auditoría, una semana. El sprint, dos semanas para un flujo en producción. La conciliación de liquidaciones suele ser el primer flujo en una correduría; la entrada y validación de facturas, en una asesoría.</p>
          </details>
          <details>
            <summary>¿Cuánto cuesta el modelo de IA cada mes?</summary>
            <p>Cada despacho tiene un presupuesto mensual de tokens con aviso al 80 %. Un documento típico cuesta céntimos; una liquidación larga, algo más. El registro de actividad muestra el coste de cada lectura.</p>
          </details>
        </section>

        <section>
          <div className="section-head">
            <h2>Cuéntame tu flujo más lento. Te digo en 30 minutos si se puede automatizar y cuánto costaría.</h2>
          </div>
          <div className="ctas" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a className="btn" href={`mailto:${CONTACT.email}?subject=Mi flujo más lento`}>Escribir a {CONTACT.email}</a>
            <a className="btn ghost" href={CONTACT.whatsapp}>Abrir WhatsApp</a>
          </div>
        </section>

        <footer>
          <span>Operaciones con IA · {CONTACT.founder} · NIF pendiente · Aviso legal · Privacidad · Contrato de encargo</span>
          <span>ES · EN próximamente</span>
        </footer>
      </div>
    </>
  );
}
