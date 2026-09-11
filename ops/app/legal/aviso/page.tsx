export const metadata = { title: "Aviso legal" };
export default function Aviso() {
  return (
    <article>
      <div className="eyebrow">Aviso legal</div>
      <h1 style={{ marginTop: 10 }}>Titular del sitio</h1>
      <p className="muted" style={{ marginTop: 12 }}>En cumplimiento de la Ley 34/2002 de servicios de la sociedad de la información, se informa de que el titular de este sitio es [razón social o nombre], con NIF [NIF], domicilio en [dirección] y correo [correo]. [Inscripción registral, si procede.]</p>
      <h2 style={{ marginTop: 24 }}>Objeto</h2>
      <p className="muted" style={{ marginTop: 8 }}>El sitio informa sobre servicios de automatización de operaciones para despachos profesionales. La contratación se formaliza por escrito en cada caso; nada en el sitio constituye una oferta vinculante.</p>
      <h2 style={{ marginTop: 24 }}>Propiedad intelectual</h2>
      <p className="muted" style={{ marginTop: 8 }}>Los contenidos del sitio y el software descrito son propiedad del titular o de sus licenciantes. Las marcas de terceros citadas (programas de gestión, aseguradoras, organismos) pertenecen a sus titulares y se mencionan solo con fines descriptivos.</p>
      <h2 style={{ marginTop: 24 }}>Responsabilidad</h2>
      <p className="muted" style={{ marginTop: 8 }}>El titular no responde de los daños derivados del uso del sitio ni de la información de terceros enlazada. Las obligaciones frente a los clientes son las pactadas en el contrato de servicios correspondiente.</p>
      <h2 style={{ marginTop: 24 }}>Ley aplicable</h2>
      <p className="muted" style={{ marginTop: 8 }}>Legislación española. Para cualquier controversia, los juzgados y tribunales de [ciudad], salvo norma imperativa en contrario.</p>
    </article>
  );
}
