import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, AuditMock, DisclosureLine } from "@/components/site";
import { MeshCanvas } from "@/components/mesh-canvas";

export const metadata = { title: "Seguridad y cumplimiento", description: "Controles técnicos y contractuales: RGPD y encargo del tratamiento, datos en la UE, sin entrenamiento, seguridad por filas, registro de actividad inmutable, revisión humana, aviso de IA, presupuesto de modelo." };

const CONTROLS: Array<[string, string, string]> = [
  ["Aislamiento por despacho", "Seguridad por filas en la base de datos: cada fila lleva el despacho, y una persona solo ve las de los despachos a los que pertenece. Lo aplica la base de datos, no la aplicación.", "Comprobado por 32 aserciones automáticas contra la migración real en cada cambio."],
  ["Registro inmutable", "Documento recibido, lectura, validación, borrador, aprobación, envío, escritura, corrección: con fecha, usuario, modelo y coste. Se puede añadir, no editar ni borrar.", "Política de base de datos: inserción permitida, actualización y borrado denegados incluso a miembros."],
  ["Revisión humana", "Enviar un mensaje o escribir en el programa de gestión solo ocurre tras una aprobación con nombre. Si el envío falla, la aprobación sigue pendiente.", "Una única función en el código es la puerta de salida; las pruebas comprueban que nada sale antes."],
  ["Trazabilidad de cada dato", "Cada valor extraído guarda el texto exacto y la página. Un valor sin texto de origen se trata como ausente.", "Evaluación automática: cualquier valor cuyo texto no aparece en el documento cuenta como inventado y bloquea la entrega."],
  ["Aviso de IA", "Todo mensaje generado lleva el aviso del artículo 50 del Reglamento Europeo de IA. Lo añade el código al final del texto, no el modelo.", "Editar un borrador conserva el aviso."],
  ["Datos en la UE", "Base de datos, ficheros y autenticación en región europea. Proveedor de modelos con retención limitada y sin uso para entrenar.", "Los subencargados se listan en el contrato de encargo."],
  ["Presupuesto de modelo", "Cada despacho tiene un techo mensual de tokens con aviso al 80 %. Ninguna llamada al modelo sin comprobarlo.", "Cada lectura registra tokens y coste estimado."],
  ["Acceso a documentos", "Los originales están en un almacén privado; se sirven solo a miembros del despacho a través de la aplicación.", "Sin enlaces públicos."],
  ["Autenticación", "Acceso por enlace único al correo, sin contraseñas que robar. Sesiones en cookies seguras.", "Alta de usuarios solo por el propietario del despacho."],
  ["Límites y abuso", "Límites por despacho en la entrada de documentos y en las comprobaciones públicas; webhooks firmados (WhatsApp) o con secreto (correo).", "Idempotencia por identificador del mensaje: un envío repetido no crea dos documentos."],
];

export default function Seguridad() {
  return (
    <div className="wrap">
      <SiteNav current="/seguridad" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">Seguridad y cumplimiento</div>
        <h1>Sin sellos que no tenemos. Con los controles, uno por uno.</h1>
        <p className="lede">No tenemos todavía una ISO 27001; tenemos un sistema diseñado para despachos regulados en España y la lista de lo que hace cada control. Cuando la certificación llegue, se añadirá aquí.</p>
      </section>

      <Section band eyebrow="Controles" title="Qué hace el sistema, y cómo se comprueba.">
        <table>
          <thead><tr><th>Control</th><th>Qué hace</th><th>Cómo se comprueba</th></tr></thead>
          <tbody>{CONTROLS.map(([c, w, h]) => <tr key={c}><td><strong>{c}</strong></td><td className="muted">{w}</td><td className="muted">{h}</td></tr>)}</tbody>
        </table>
      </Section>

      <Section eyebrow="Cómo se ve" title="El registro y el aviso, tal como los verá tu DPO.">
        <div className="two">
          <div><AuditMock /><p className="small muted" style={{ marginTop: 10 }}>Registro de actividad: solo se añade, nunca se edita. Exportable en CSV desde la aplicación.</p></div>
          <div><DisclosureLine /><p className="small muted" style={{ marginTop: 10 }}>Aviso del artículo 50 del Reglamento de IA, añadido por el sistema a cada mensaje aprobado.</p></div>
        </div>
      </Section>

      <Section eyebrow="Marco" title="Lo que aplica a tu despacho.">
        <div className="two">
          <div>
            <h3>Corredurías</h3>
            <ul className="list-plain" style={{ marginTop: 8 }}>
              <li>RGPD; datos de salud en vida, salud y decesos como categoría especial</li>
              <li>Reglamento de IA: transparencia (art. 50) desde el 2 de agosto de 2026; alto riesgo en tarificación es cosa de la aseguradora, no del corredor</li>
              <li>Opinión de EIOPA sobre gobernanza de IA (agosto de 2025)</li>
              <li>Prioridades de supervisión DGSFP 2026 a 2028</li>
              <li>DORA: excluidas las corredurías micro, pequeñas y medianas</li>
            </ul>
          </div>
          <div>
            <h3>Asesorías</h3>
            <ul className="list-plain" style={{ marginTop: 8 }}>
              <li>Verifactu: 1 de enero de 2027 y 1 de julio de 2027</li>
              <li>Factura electrónica B2B (Crea y Crece), tras la orden ministerial</li>
              <li>RGPD y contrato de encargo por cada cliente final cuando proceda</li>
              <li>Reglamento de IA: transparencia en mensajes a clientes</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section eyebrow="Documentos" title="Para tu delegado de protección de datos.">
        <ul className="list-plain">
          <li><a href="/legal/encargo">Contrato de encargo del tratamiento</a> (modelo, artículo 28 RGPD)</li>
          <li><a href="/legal/privacidad">Política de privacidad</a></li>
          <li>Lista de subencargados y regiones, en el anexo del contrato</li>
          <li>Registro de actividad exportable por despacho, en CSV, desde la aplicación</li>
          <li><a href="/kit-cumplimiento">Kit de cumplimiento</a>, imprimible</li>
        </ul>
      </Section>

      <FinalCta title="¿Tu DPO tiene preguntas? Que me escriba directamente." />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
