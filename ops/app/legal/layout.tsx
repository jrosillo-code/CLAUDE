export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-wrap" style={{ maxWidth: 760 }}>
      <div className="card" style={{ borderColor: "var(--warn)", marginBottom: 20 }}>
        <strong>Borrador.</strong> Texto preparado como punto de partida; debe revisarlo un abogado y completarse con los datos de la entidad antes de publicarse.
      </div>
      {children}
      <p className="small muted" style={{ marginTop: 32 }}><a href="/">Inicio</a> · <a href="/legal/aviso">Aviso legal</a> · <a href="/legal/privacidad">Privacidad</a> · <a href="/legal/encargo">Contrato de encargo</a></p>
    </main>
  );
}
