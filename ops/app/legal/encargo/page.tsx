export const metadata = { title: "Contrato de encargo del tratamiento" };
export default function Encargo() {
  const H = ({ t }: { t: string }) => <h2 style={{ marginTop: 24 }}>{t}</h2>;
  const P = ({ c }: { c: string }) => <p className="muted" style={{ marginTop: 8 }}>{c}</p>;
  return (
    <article>
      <div className="eyebrow">Contrato de encargo del tratamiento</div>
      <h1 style={{ marginTop: 10 }}>Modelo, artículo 28 del RGPD</h1>
      <P c="Entre [despacho], como responsable del tratamiento, y [razón social], como encargado, para la prestación del servicio de automatización de operaciones descrito en el contrato principal." />
      <H t="1. Objeto y duración" />
      <P c="El encargado trata por cuenta del responsable los documentos y datos que este le confía (pólizas, recibos, siniestros, facturas, comunicaciones con clientes) con la única finalidad de prestar el servicio, durante la vigencia del contrato principal." />
      <H t="2. Naturaleza de los datos" />
      <P c="Datos identificativos y de contacto, datos económicos y de seguros de los clientes del responsable, y, cuando el servicio lo requiera, categorías especiales (datos de salud en pólizas de vida, salud o decesos), que se tratarán únicamente con las medidas reforzadas del apartado 5." />
      <H t="3. Obligaciones del encargado" />
      <P c="Tratar los datos solo siguiendo instrucciones documentadas del responsable. No usarlos para fines propios ni para entrenar modelos. Garantizar la confidencialidad del personal. Mantener un registro de las categorías de tratamientos. Asistir al responsable en la atención de derechos y en las evaluaciones de impacto. Notificar las violaciones de seguridad sin dilación indebida y, en todo caso, en 48 horas desde que las conozca. Devolver o destruir los datos al terminar el contrato, según indique el responsable." />
      <H t="4. Subencargados" />
      <P c="El responsable autoriza a los subencargados listados en el anexo (alojamiento y base de datos, almacenamiento de documentos, envío de correo, mensajería, proveedor de modelos de inteligencia artificial), todos con tratamiento en la Unión Europea o con garantías equivalentes. El encargado comunicará cualquier cambio con 30 días de antelación y el responsable podrá oponerse." />
      <H t="5. Medidas de seguridad" />
      <P c="Cifrado en tránsito y en reposo; control de acceso por despacho mediante políticas en la base de datos; registro inmutable de actividad; revisión humana obligatoria antes de cualquier envío o escritura en el sistema del responsable; presupuesto y registro de cada llamada a modelos de IA; retención configurable; procesamiento en la UE; no reutilización de datos para entrenamiento." />
      <H t="6. Derechos de los interesados" />
      <P c="El encargado remitirá al responsable sin dilación cualquier solicitud de derechos que reciba y le prestará asistencia para atenderla." />
      <H t="7. Auditoría" />
      <P c="El encargado pondrá a disposición del responsable la información necesaria para demostrar el cumplimiento de este contrato y permitirá auditorías razonables, con preaviso." />
      <H t="8. Fin del tratamiento" />
      <P c="A la terminación, el encargado devolverá los datos en un formato reutilizable y destruirá las copias, salvo obligación legal de conservación, certificándolo por escrito." />
      <H t="Anexo: subencargados" />
      <P c="[Proveedor de base de datos y autenticación, región UE] · [Proveedor de alojamiento de la aplicación, región UE] · [Proveedor de correo] · [Proveedor de mensajería WhatsApp] · [Proveedor de modelos de IA, con retención de datos limitada y sin entrenamiento]." />
    </article>
  );
}
