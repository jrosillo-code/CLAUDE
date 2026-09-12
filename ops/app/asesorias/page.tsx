import Link from "next/link";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, QueueMock, Faq, JsonLd, faqJsonLd } from "@/components/site";

export const metadata = { title: "Para asesorías y gestorías", description: "Entrada y validación de facturas de clientes, reclamación de lo que falta y preparación para Verifactu 2027, con revisión humana e integración con Holded, A3, Sage, Anfix y Quipu." };

const FAQ: Array<[string, string]> = [
  ["¿Hacéis el registro Verifactu?", "No, y es a propósito. El registro, el hash y el envío a la AEAT los hace un motor certificado que ya tienes o que integramos. Nosotros hacemos lo que está antes: que la factura llegue completa, correcta y a tiempo, y que tu equipo no persiga a nadie a mano."],
  ["¿Cuándo es obligatorio Verifactu?", "1 de enero de 2027 para sociedades y 1 de julio de 2027 para autónomos, tras el aplazamiento del Real Decreto-ley 15/2025. La factura electrónica B2B de la Ley Crea y Crece llega después, con plazos que dependen de la orden ministerial. Lo que vendemos sirve igual si la fecha vuelve a moverse."],
  ["¿Qué pasa con los clientes que facturan en Excel?", "Son el caso principal. La auditoría identifica cuántos son, el sprint construye la entrada y validación para ellos, y las tareas les piden lo que falta con un mensaje que tú apruebas."],
];

export default function Asesorias() {
  return (
    <div className="wrap">
      <JsonLd data={faqJsonLd(FAQ)} />
      <SiteNav current="/asesorias" />
      <section className="page-hero">
        <div className="eyebrow">Asesorías y gestorías</div>
        <h1>Las facturas de tus clientes, completas y validadas antes de que alguien tenga que perseguirlas.</h1>
        <p className="lede">Desde 2027, Verifactu para todos. Tus clientes seguirán mandando lo que puedan, como puedan. El sistema recibe, lee con cita, comprueba NIF, importes y fechas, y pide lo que falta. Tu equipo aprueba y contabiliza.</p>
        <div className="ctas"><Link className="btn" href="/contacto?tipo=asesoria">Pide una auditoría de 30 minutos</Link><Link className="btn ghost" href="/precios">Ver precios</Link></div>
      </section>

      <Section eyebrow="El primer flujo" title="La factura entra por email. La tarea sale con lo que falta.">
        <div className="split">
          <div>
            <ul className="check">
              <li>Email, WhatsApp o carpeta compartida: cada archivo registrado con su origen y su huella.</li>
              <li>Lectura con cita: NIF emisor y receptor, número, fecha, base, tipo, cuota y total, cada uno con el texto del que se leyó.</li>
              <li>Validación determinista: dígito de control del NIF, cuota igual a base por tipo, total igual a base más cuota, fechas coherentes, requisitos de un registro Verifactu.</li>
              <li>Lo que falta se pide al cliente con un mensaje que tú apruebas y que lleva el aviso de IA.</li>
              <li>Lo aprobado se escribe en tu programa o se exporta para importar.</li>
            </ul>
          </div>
          <QueueMock variant="factura" />
        </div>
      </Section>

      <Section eyebrow="Después" title="Lo que sigue en una asesoría.">
        <div className="bento">
          <div className="tile"><h3>Migración de clientes en Excel</h3><p>Inventario de quién factura cómo, plan por cliente y plantillas de entrada para que lleguen en regla al 1 de enero de 2027.</p></div>
          <div className="tile"><h3>Requerimientos</h3><p>Lectura del requerimiento, lista de lo que hay que aportar, tareas y recordatorios al cliente.</p></div>
          <div className="tile"><h3>Conciliación bancaria</h3><p>Movimientos sin documento detectados y reclamados; no adivinamos, pedimos.</p></div>
          <div className="tile"><h3>Cierre de periodo</h3><p>Documentación pendiente por cliente, con un mensaje por cliente, aprobado en bloque.</p></div>
        </div>
      </Section>

      <Section eyebrow="Con qué trabajamos" title="Tu programa se queda.">
        <div className="two">
          <div><h3>Sistemas</h3><ul className="list-plain" style={{ marginTop: 8 }}><li>Holded</li><li>A3 (Wolters Kluwer)</li><li>Sage</li><li>Anfix</li><li>Quipu y Contasol por importación</li><li>Motor Verifactu certificado, nunca propio</li></ul></div>
          <div><h3>Marco</h3><ul className="list-plain" style={{ marginTop: 8 }}><li>Verifactu: 1 de enero de 2027 sociedades, 1 de julio de 2027 autónomos</li><li>Factura electrónica B2B (Crea y Crece): tras la orden ministerial</li><li>RGPD y contrato de encargo; datos en la UE</li><li>Reglamento Europeo de IA, art. 50</li></ul></div>
        </div>
      </Section>

      <Section eyebrow="Preguntas" title="Lo que preguntan las asesorías.">
        <Faq items={FAQ} />
      </Section>
      <FinalCta title="Mándame diez facturas de tus clientes más desordenados (anonimizadas) y te devuelvo qué falta en cada una." />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
