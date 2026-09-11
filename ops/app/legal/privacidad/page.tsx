export const metadata = { title: "Política de privacidad" };
export default function Privacidad() {
  const H = ({ t }: { t: string }) => <h2 style={{ marginTop: 24 }}>{t}</h2>;
  const P = ({ c }: { c: string }) => <p className="muted" style={{ marginTop: 8 }}>{c}</p>;
  return (
    <article>
      <div className="eyebrow">Política de privacidad</div>
      <h1 style={{ marginTop: 10 }}>Cómo tratamos los datos</h1>
      <P c="Esta política se refiere a los datos de las personas que visitan el sitio o contactan con nosotros. Los datos que un despacho cliente nos confía para prestar el servicio (documentos de sus clientes, pólizas, facturas) se tratan por cuenta del despacho, que es el responsable, conforme al contrato de encargo del tratamiento." />
      <H t="Responsable" />
      <P c="[Razón social o nombre], NIF [NIF], [dirección], [correo de contacto para protección de datos]." />
      <H t="Datos que tratamos y para qué" />
      <P c="Datos de contacto (nombre, correo, teléfono, despacho) que nos facilitas al escribirnos, pedir una auditoría o entrar a la plataforma; los usamos para responder, prestar el servicio y gestionar la relación. Datos de acceso (correo y sesión) para autenticarte en la plataforma. Registros técnicos de la plataforma (acciones, fechas, usuario) necesarios para la trazabilidad y la seguridad del servicio." />
      <H t="Base jurídica" />
      <P c="Ejecución del contrato o de medidas precontractuales a tu solicitud; interés legítimo en la seguridad del servicio; consentimiento cuando lo pidamos expresamente." />
      <H t="Dónde se tratan" />
      <P c="Los datos se alojan y procesan en la Unión Europea. Los proveedores de infraestructura y de modelos de inteligencia artificial que utilizamos se detallan en el contrato de encargo; no se usan los datos de los clientes para entrenar modelos." />
      <H t="Conservación" />
      <P c="Datos de contacto: mientras dure la relación y los plazos legales posteriores. Datos de la plataforma: según el periodo de retención definido por cada despacho en su contrato." />
      <H t="Destinatarios" />
      <P c="Proveedores que prestan servicios por nuestra cuenta con contrato de encargo (alojamiento, base de datos, envío de correo, mensajería, modelos de IA), y las autoridades cuando la ley lo exija. No vendemos datos." />
      <H t="Tus derechos" />
      <P c="Acceso, rectificación, supresión, oposición, limitación y portabilidad, escribiendo a [correo]. También puedes reclamar ante la Agencia Española de Protección de Datos." />
      <H t="Uso de inteligencia artificial" />
      <P c="La plataforma utiliza sistemas de inteligencia artificial para leer documentos y proponer textos. Ninguna decisión con efectos sobre una persona se toma de forma automatizada: una persona del despacho revisa y aprueba antes de cualquier envío o apunte. Los mensajes preparados con ayuda de IA lo indican, conforme al artículo 50 del Reglamento Europeo de Inteligencia Artificial." />
      <H t="Cookies" />
      <P c="El sitio no usa cookies de seguimiento. La plataforma usa cookies técnicas necesarias para mantener la sesión iniciada." />
    </article>
  );
}
