import Link from "next/link";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, Faq, JsonLd, faqJsonLd, ORG_JSONLD } from "@/components/site";

export const metadata = { title: "Precios", description: "Auditoría de flujos de 1.500 a 3.000 €, sprint de automatización de 6.000 a 12.000 € en dos semanas, operaciones gestionadas de 2.000 a 6.000 € al mes. Precios públicos." };

const FAQ: Array<[string, string]> = [
  ["¿Por qué un rango y no un precio fijo?", "Porque el tamaño del despacho y el estado de sus sistemas cambian el trabajo. La auditoría cierra el precio exacto del sprint por escrito antes de empezar, y se descuenta íntegra."],
  ["¿Qué significa 'si no ahorramos horas, no seguimos'?", "En la auditoría medimos las horas actuales del flujo. Al final del sprint las volvemos a medir. Si no hay ahorro medible, no proponemos operaciones gestionadas y te quedas con lo construido."],
  ["¿Hay costes aparte?", "El uso del modelo de IA, que se factura por lo consumido y suele ser de céntimos por documento. Cada despacho tiene un presupuesto mensual con aviso al 80 %. No hay licencias por usuario."],
  ["¿Y las ayudas públicas?", "El Kit Digital cerró su última convocatoria en octubre de 2025; el Kit Consulting y el Ticket Innova siguen abiertos con importes menores. Te decimos qué aplica, pero no basamos la propuesta en una subvención."],
];

export default function Precios() {
  return (
    <div className="wrap">
      <JsonLd data={ORG_JSONLD} />
      <JsonLd data={faqJsonLd(FAQ)} />
      <SiteNav current="/precios" />
      <section className="page-hero">
        <div className="eyebrow">Precios</div>
        <h1>Precios públicos. Alcance cerrado por escrito. 50 % al inicio.</h1>
        <p className="lede">Vendemos alcance, no horas. Empezamos por el flujo que más tiempo te cuesta y medimos antes y después.</p>
      </section>

      <Section eyebrow="Tres formas de trabajar" title="Auditoría, sprint, operaciones.">
        <div className="offers">
          <div className="offer">
            <div className="time">Una semana</div><h3>Auditoría de flujos</h3><div className="price">1.500 a 3.000 €</div>
            <ul><li>Un día en el despacho o en remoto con quien hace el trabajo</li><li>Inventario de tareas, horas, sistemas y canales</li><li>5 a 10 flujos automatizables con horas estimadas y retorno</li><li>Prototipo funcionando del mejor, con tus documentos</li><li>Precio cerrado del sprint por escrito</li><li>Se descuenta íntegra si contratas el sprint</li></ul>
          </div>
          <div className="offer featured">
            <div className="time">Dos semanas</div><h3>Sprint de automatización</h3><div className="price">6.000 a 12.000 €</div>
            <ul><li>Un flujo en producción, integrado con tu programa de gestión</li><li>Kit de cumplimiento: aviso de IA, revisión humana, registro, contrato de encargo</li><li>Pruebas automáticas y documentación</li><li>Formación del equipo, media jornada</li><li>Una ronda de ajustes</li><li>Medición de horas al final</li></ul>
          </div>
          <div className="offer">
            <div className="time">Mensual</div><h3>Operaciones gestionadas</h3><div className="price">2.000 a 6.000 €/mes</div>
            <ul><li>Mantenimiento y guardia</li><li>Nuevos flujos cada trimestre</li><li>Informe mensual: horas ahorradas, euros recuperados, acierto por tipo de documento, coste del modelo</li><li>Presupuesto de tokens con aviso</li><li>Facturación anual con descuento</li></ul>
          </div>
        </div>
      </Section>

      <Section eyebrow="Qué no incluye" title="Para que no haya sorpresas.">
        <ul className="list-plain">
          <li>El motor de facturación Verifactu: se integra uno certificado, no lo escribimos nosotros (evitamos la responsabilidad de productor y la declaración responsable).</li>
          <li>Las licencias de tu programa de gestión, ni las de WhatsApp Business o correo.</li>
          <li>El consumo del modelo de IA, facturado por uso y visible en el registro.</li>
          <li>Trabajo fuera del flujo acordado: se presupuesta aparte o entra en el siguiente trimestre de operaciones.</li>
        </ul>
      </Section>

      <Section eyebrow="Precio de fundador" title="Tres primeros despachos.">
        <p>Los tres primeros despachos que firmen un sprint tienen el precio de auditoría descontado aunque no continúen, y el primer trimestre de operaciones al precio mínimo del rango, a cambio de un caso de estudio con cifras reales y anonimizadas.</p>
      </Section>

      <Section eyebrow="Preguntas" title="Sobre el precio.">
        <Faq items={FAQ} />
      </Section>
      <FinalCta title="Cuéntame el flujo y te digo en qué rango cae antes de la llamada." />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
