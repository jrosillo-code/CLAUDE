import Link from "next/link";
import { MeshCanvas } from "@/components/mesh-canvas";
import { SiteNav, SiteFooter, StickyCta, Section, FinalCta, QueueMock, AuditMock, DisclosureLine } from "@/components/site";

export const metadata = { title: "Cómo funciona", description: "El recorrido de un documento: entrada, extracción con cita, validación determinista, tareas, borrador con aviso de IA, aprobación humana, escritura en el sistema de gestión y registro de auditoría." };

export default function ComoFunciona() {
  return (
    <div className="wrap">
      <SiteNav current="/como-funciona" />
      <section className="page-hero">
        <MeshCanvas intensity={0.7} />
        <div className="eyebrow">Cómo funciona</div>
        <h1>Un documento, siete pasos, un clic humano.</h1>
        <p className="lede">Esto no es un chatbot. Es una cadena en la que la IA lee y propone, el código comprueba, y una persona decide. Así es el recorrido de cada documento, y así se ve en pantalla.</p>
      </section>

      <Section eyebrow="Paso a paso" title="Del correo o el WhatsApp al programa de gestión.">
        <div className="rows">
          <div><div><h3>Recibe</h3><p>Email, WhatsApp o subida. El archivo se guarda con su huella, su origen y la hora. Si llega dos veces, se reconoce.</p></div></div>
          <div><div><h3>Lee con cita</h3><p>El modelo rellena un esquema fijo por tipo de documento. Cada valor lleva el texto exacto y la página. Si no está escrito, el campo queda vacío: la instrucción es no deducir.</p></div></div>
          <div><div><h3>Valida</h3><p>Reglas, no IA: dígito de control de NIF y CIF, sumas que cuadran, fechas coherentes, lista de documentos por tipo de siniestro. Un valor sin cita se trata como ausente.</p></div></div>
          <div><div><h3>Crea tareas</h3><p>Cada elemento que falta es una tarea para el cliente; cada error de fondo, una tarea para el despacho.</p></div></div>
          <div><div><h3>Redacta</h3><p>Un mensaje breve que solo puede mencionar lo que la validación decidió. El aviso de IA lo añade el código, no el modelo.</p></div></div>
          <div><div><h3>Espera</h3><p>Aquí se detiene. Una persona ve el documento y la propuesta en la misma pantalla, corrige lo que haga falta, y aprueba o rechaza.</p></div></div>
          <div><div><h3>Ejecuta y registra</h3><p>Solo tras la aprobación se envía el mensaje o se escribe en el programa de gestión. Quién, cuándo, con qué modelo y qué costó quedan en el registro.</p></div></div>
        </div>
      </Section>

      <Section eyebrow="El registro" title="Lo que queda escrito, tal cual se guarda.">
        <div className="two">
          <div>
            <AuditMock />
            <p className="small muted" style={{ marginTop: 10 }}>Cinco filas reales del registro de un parte de siniestro: llega, se lee, se valida, una persona corrige una fecha, aprueba y se envía. Cada fila lleva actor, hora y coste del modelo.</p>
          </div>
          <div>
            <DisclosureLine />
            <p className="small muted" style={{ marginTop: 10 }}>El aviso que cierra cada mensaje. Lo añade el código al final del texto, después de la revisión; editar el borrador no lo quita.</p>
          </div>
        </div>
      </Section>

      <Section band eyebrow="La pantalla" title="Lo que ve tu equipo.">
        <div className="frame"><div className="frame-bar"><i /><i /><i /><span className="url">app / correduría demo / cola de revisión</span></div><QueueMock variant="siniestro" /></div>
        <p className="muted small" style={{ marginTop: 12 }}>La misma pantalla, con datos de ejemplo. Cada campo muestra de dónde salió; las correcciones quedan marcadas con quién las hizo y se cuentan para medir el acierto.</p>
      </Section>

      <Section eyebrow="Kit de cumplimiento" title="Lo que lleva cada flujo desde el primer día.">
        <div className="trust">
          <div><strong>Aviso de IA</strong>En todo mensaje generado o asistido (Reglamento Europeo de IA, art. 50). Lo añade el sistema.</div>
          <div><strong>Revisión humana</strong>Ningún envío ni escritura sin aprobación. La cola de aprobación es parte del producto, no una opción.</div>
          <div><strong>Registro de actividad</strong>Documento recibido, lectura, validación, borrador, aprobación: fecha, usuario, modelo y coste. Exportable.</div>
          <div><strong>Trazabilidad</strong>Cada dato enlaza con su documento y página. La IA nunca inventa un dato: si no está, se marca ausente.</div>
          <div><strong>Datos</strong>Contrato de encargo (RGPD). Datos de salud y de terceros dentro de la UE. Retención definida por ti. Sin entrenamiento.</div>
          <div><strong>Coste</strong>Presupuesto mensual de tokens por despacho con aviso al 80 %; el registro muestra lo que costó cada lectura.</div>
        </div>
        <p style={{ marginTop: 20 }}><Link href="/kit-cumplimiento">El kit, punto por punto, para tu DPO →</Link> · <Link href="/seguridad">Los controles técnicos →</Link></p>
      </Section>

      <Section eyebrow="Cuándo se equivoca" title="Qué pasa cuando la IA se equivoca.">
        <div className="two">
          <div>
            <p>Tres mecanismos, en este orden. Primero, la cita: un valor sin texto de origen no existe para el sistema. Segundo, las reglas: lo que no cuadra se marca antes de que nadie lo vea como correcto. Tercero, la persona: corrige, aprueba o rechaza, y su corrección queda registrada con su nombre.</p>
          </div>
          <div>
            <p>Las correcciones alimentan la métrica que enseñamos cada mes: campos aprobados sin corrección, por tipo de documento. Si un tipo de documento baja del umbral que acordemos, se revisa el esquema, no se sigue enviando.</p>
          </div>
        </div>
      </Section>

      <FinalCta />
      <SiteFooter />
      <StickyCta />
    </div>
  );
}
