import Link from "next/link";
import { SettlementMock, AuditMock, DisclosureLine } from "@/components/site";

export const metadata = { title: "Sistema de diseño" };

// A catalog of the system rendered from the real CSS, so DESIGN.md, the
// stylesheet and the pages can be compared at a glance.
const COLORS: Array<[string, string, string]> = [
  ["ground", "#f7f6f2", "fondo de página"], ["surface", "#ffffff", "tarjetas y tablas"], ["doc-paper", "#fbfaf7", "documento en la cola"],
  ["ink", "#15191f", "texto y botón primario"], ["ink-2", "#4a525c", "texto secundario"], ["ink-3", "#7c8590", "etiquetas y fuentes"],
  ["rule", "#e2e0d9", "líneas"], ["accent", "#1e6b4a", "aprobar y leído"], ["accent-soft", "#e6f1eb", "fondo de leído"],
  ["warn", "#a86a12", "falta y pendiente"], ["warn-soft", "#f8efdc", "fondo de falta"], ["bad", "#a83a3a", "error y rechazado"], ["bad-soft", "#f6e3e3", "fondo de error"],
];

export default function Diseno() {
  return (
    <main className="app-wrap">
      <div className="eyebrow">Sistema de diseño · DESIGN.md</div>
      <h1 style={{ marginTop: 10 }}>Lo que ve una persona, en una página.</h1>
      <p className="muted" style={{ marginTop: 10 }}>Renderizado con la misma hoja de estilos que el sitio y la cola de revisión. Si algo aquí no coincide con <code>DESIGN.md</code>, uno de los dos está mal.</p>

      <h2 style={{ marginTop: 32 }}>Color</h2>
      <div className="bento" style={{ marginTop: 12 }}>
        {COLORS.map(([name, hex, role]) => (
          <div key={name} className="tile" style={{ padding: 12 }}>
            <div style={{ height: 44, background: hex, border: "1px solid var(--rule)" }} />
            <div className="mono small" style={{ marginTop: 6 }}>{name} · {hex}</div>
            <div className="small muted">{role}</div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 32 }}>Tipografía</h2>
      <div className="card" style={{ display: "grid", gap: 14 }}>
        <div><div className="eyebrow">Eyebrow · Plex Mono 12 · 0.08em</div></div>
        <h1 style={{ fontSize: 48 }}>H1 Newsreader 500. Una frase con punto.</h1>
        <h2>H2 Newsreader 500. Una afirmación, no una etiqueta.</h2>
        <h3>H3 Newsreader 500, 22px</h3>
        <p style={{ fontSize: 19 }} className="muted">Lede · Plex Sans 19 · ink-2. Bajo el H1 solamente.</p>
        <p>Cuerpo · Plex Sans 17 / 1.55 · máximo 62 caracteres por línea. Cada dato lleva el texto exacto y la página de la que se leyó.</p>
        <p className="small muted">Small · Plex Sans 14 · líneas de fuente y pies.</p>
        <div className="stat" style={{ maxWidth: 280 }}><div className="n mono">90,9%</div><div className="l">Cifra · Newsreader 44 · la unidad va al mismo tamaño</div></div>
      </div>

      <h2 style={{ marginTop: 32 }}>Botones y estados</h2>
      <div className="card">
        <div className="row">
          <span className="btn">Primario</span>
          <span className="btn accent">Aprobar y enviar</span>
          <span className="btn ghost">Secundario</span>
          <button className="secondary" style={{ padding: "4px 8px", fontSize: 13 }}>Guardar</button>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="pill ok">leído</span><span className="pill ok">válido</span><span className="pill ok">corregido</span>
          <span className="pill pending">falta</span><span className="pill pending">pendiente</span>
          <span className="pill err">error</span><span className="pill err">rechazado</span>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>El acento verde solo aparece donde una persona aprueba o donde un dato se ha leído con su fuente.</p>
      </div>

      <h2 style={{ marginTop: 32 }}>Fila de campo (componente propio)</h2>
      <div className="card" style={{ maxWidth: 520 }}>
        <div className="field"><span className="k">Nº póliza</span><span className="tag ok">leído</span><span className="v">AU-2024-778812</span><span className="src">“Póliza nº AU-2024-778812”, pág. 1</span>
          <div className="row" style={{ gridColumn: "1 / -1", gap: 6 }}><input placeholder="Corregir…" aria-label="Corregir" style={{ font: "inherit", fontSize: 13, padding: "4px 6px", border: "1px solid var(--rule)", flex: 1, minWidth: 0 }} /><button className="secondary" style={{ padding: "4px 8px", fontSize: 13 }}>Guardar</button></div>
        </div>
        <div className="field"><span className="k">Permiso de circulación</span><span className="tag missing">falta</span><span className="v">—</span><span className="src">no consta en el documento</span></div>
        <div className="field"><span className="k">NIF receptor</span><span className="tag ok">corregido</span><span className="v">12345678Z</span><span className="src">corregido por ana@despacho.es</span></div>
      </div>

      <h2 style={{ marginTop: 32 }}>Tabla</h2>
      <table><thead><tr><th>Aseguradora</th><th>Periodo</th><th>No pagado</th><th>Diferencias</th></tr></thead><tbody>
        <tr><td>Aseguradora Ejemplo SA</td><td className="mono">2026-08</td><td className="mono">12,00 €</td><td className="mono">6,40 €</td></tr>
        <tr><td>Otra Aseguradora</td><td className="mono">2026-08</td><td className="mono">0,00 €</td><td className="mono">0,00 €</td></tr>
      </tbody></table>

      <h2 style={{ marginTop: 32 }}>Tarjetas</h2>
      <div className="offers">
        <div className="offer"><div className="time">Una semana</div><h3>Auditoría</h3><div className="price">1.500 €</div><ul><li>Borde de línea, esquinas rectas</li><li>Sin sombra</li></ul></div>
        <div className="offer featured"><div className="time">Dos semanas</div><h3>Sprint</h3><div className="price">6.000 €</div><ul><li>La destacada usa borde de acento</li><li>No un relleno</li></ul></div>
        <div className="offer"><div className="time">Mensual</div><h3>Operaciones</h3><div className="price">2.000 €</div><ul><li>Misma altura por contenido</li><li>Mismo padding</li></ul></div>
      </div>

      <h2 style={{ marginTop: 32 }}>Tabla comparativa</h2>
      <table className="compare"><thead><tr><th></th><th>Auditoría</th><th className="featured">Sprint</th><th>Operaciones</th></tr></thead><tbody>
        <tr><td>Precio</td><td className="num">1.500 €</td><td className="featured num">6.000 €</td><td className="num">2.000 €/mes</td></tr>
        <tr><td>Kit de cumplimiento</td><td className="muted">—</td><td className="featured yes">Incluido</td><td className="yes">Incluido</td></tr>
      </tbody></table>

      <h2 style={{ marginTop: 32 }}>Filas numeradas</h2>
      <div className="rows">
        <div><div><h3>Recibe</h3><p>Contador mono, título sans 600, párrafo ink-2, línea fina entre filas.</p></div></div>
        <div><div><h3>Lee con cita</h3><p>Se usa cuando el orden importa; sustituye a la rejilla de pasos.</p></div></div>
      </div>

      <h2 style={{ marginTop: 32 }}>Imágenes reales del producto</h2>
      <div className="two">
        <SettlementMock />
        <div style={{ display: "grid", gap: 12 }}><AuditMock /><DisclosureLine /></div>
      </div>

      <p className="small muted" style={{ marginTop: 32 }}><Link href="/">Inicio</Link> · <code>ops/DESIGN.md</code> · referencias en <code>ops/design/references/</code></p>
    </main>
  );
}
