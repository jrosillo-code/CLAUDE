import Link from "next/link";
import { MeshCanvas } from "@/components/mesh-canvas";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, QueueMock, SettlementMock, Faq, JsonLd, faqJsonLd } from "@/components/site";

export const metadata = { title: "Para corredurías de seguros", description: "Conciliación de liquidaciones de comisiones, documentación de siniestros y renovaciones con revisión humana, integrado con ebroker, segElevia, Avant2, Mediator y ficheros EIAC." };

const FAQ: Array<[string, string]> = [
  ["¿Necesito cambiar de programa de gestión?", "No. Escribimos en el que ya usas: ebroker por sus servicios web, segElevia y Avant2 por sus integraciones, Mediator por ficheros de importación, y leemos ficheros EIAC cuando la aseguradora los envía. Lo que no llega por EIAC (PDF, Excel, portal) es exactamente lo que automatizamos."],
  ["¿Qué pasa con los datos de salud de las pólizas de vida?", "Se tratan como categoría especial: dentro de la UE, con contrato de encargo, sin uso para entrenar modelos, y con retención definida por ti. El flujo de liquidaciones no toca datos de salud."],
  ["¿Cuánto tarda una liquidación?", "Una liquidación de 40 a 60 líneas se lee y concilia en menos de dos minutos. La revisión humana de las incidencias es lo que marca el tiempo total, y son pocas: lo que cuadra no requiere ningún clic."],
];

export default function Corredurias() {
  return (
    <div className="wrap">
      <JsonLd data={faqJsonLd(FAQ)} />
      <SiteNav current="/corredurias" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">Corredurías de seguros</div>
        <h1>Cerramos las liquidaciones del mes en horas, no en días. Y te decimos qué comisiones no te han pagado.</h1>
        <p className="lede">Cada aseguradora liquida en un formato distinto. Alguien las abre una a una y las cruza con la cartera. Ese trabajo, y las comisiones que se pierden por el camino, es el primer flujo que automatizamos en una correduría.</p>
        <div className="ctas"><Link className="btn" href="/contacto?tipo=correduria">Pide una auditoría de 30 minutos</Link><Link className="btn ghost" href="/precios">Ver precios</Link></div>
      </section>

      <Section band eyebrow="El primer flujo" title="La liquidación entra. Las incidencias salen con su importe.">
        <div className="split">
          <div>
            <ul className="check">
              <li>Leemos la liquidación en PDF, Excel o exportación del portal, línea a línea, con cita de cada importe.</li>
              <li>La cruzamos con los recibos que esperabas cobrar, exportados de tu programa de gestión o leídos del fichero EIAC.</li>
              <li>Cada recibo no liquidado o pagado de menos se convierte en una tarea con su importe y su aseguradora.</li>
              <li>Tú apruebas la reclamación. Nada se envía a la aseguradora sin tu clic.</li>
              <li>Cada mes ves un número: euros detectados, líneas conciliadas, tiempo empleado.</li>
            </ul>
          </div>
          <QueueMock variant="liquidacion" />
        </div>
        <div style={{ marginTop: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Así queda la liquidación conciliada</div>
          <SettlementMock />
          <p className="small muted" style={{ marginTop: 10 }}>Cada línea con su estado; las reclamables suman su importe. La carta a la aseguradora la redacta el sistema con esas líneas, y solo sale cuando alguien del despacho la aprueba.</p>
        </div>
      </Section>

      <Section eyebrow="Después" title="Los siguientes flujos, en el orden en que suelen doler.">
        <div className="bento">
          <div className="tile"><h3>Documentación de siniestros</h3><p>El cliente manda fotos y el parte por WhatsApp; el sistema comprueba la lista por tipo de siniestro y redacta la petición de lo que falta. Tú la apruebas.</p></div>
          <div className="tile"><h3>Renovaciones</h3><p>Pólizas que vencen en 45 días, con la comparativa y la propuesta preparadas. La cartera crece un 5 % y la nueva producción cae: defenderla es ingreso, no solo ahorro.</p></div>
          <div className="tile"><h3>Recibos devueltos</h3><p>Aviso, seguimiento y mensaje al cliente, con registro de cada intento.</p></div>
          <div className="tile"><h3>Consultas sobre condicionados</h3><p>Un asistente privado sobre tus condicionados y tu cartera que cita cláusula y página. Lo que hoy saben dos veteranos, disponible para todo el equipo.</p></div>
          <div className="tile"><h3>Bandeja compartida</h3><p>WhatsApp y email del despacho en una sola cola, con cada documento registrado con su origen.</p></div>
          <div className="tile"><h3>DEC y documentación regulatoria</h3><p>Los datos que la DGSFP pide cada año, recogidos durante el año y no la semana antes.</p></div>
        </div>
      </Section>

      <Section eyebrow="Con qué trabajamos" title="Tu programa de gestión se queda. Nosotros escribimos en él.">
        <div className="two">
          <div>
            <h3>Sistemas</h3>
            <ul className="list-plain" style={{ marginTop: 8 }}>
              <li>ebroker (servicios web y API)</li><li>MPM segElevia</li><li>Codeoscopic Avant2 y Tesis</li><li>Mediator (ficheros de importación)</li><li>Ficheros EIAC de pólizas, recibos, siniestros y liquidaciones</li>
            </ul>
          </div>
          <div>
            <h3>Marco</h3>
            <ul className="list-plain" style={{ marginTop: 8 }}>
              <li>RGPD y contrato de encargo; datos en la UE</li><li>Reglamento Europeo de IA, art. 50: aviso en cada mensaje</li><li>Opinión de EIOPA sobre gobernanza de IA en mediación: supervisión humana, registros, proporcionalidad</li><li>Prioridades de supervisión de la DGSFP 2026 a 2028: trazabilidad y explicabilidad</li><li>DORA no aplica a corredurías micro y pequeñas; te lo explicamos si te lo preguntan</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section eyebrow="Preguntas" title="Lo que preguntan las corredurías.">
        <Faq items={FAQ} />
      </Section>
      <FinalCta title="Mándame una liquidación de este mes (anonimizada) y te devuelvo la conciliación hecha. Sin compromiso." />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
