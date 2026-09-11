import { supabaseAuthConfigured } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  if (!supabaseAuthConfigured()) redirect("/app/demo/revisar");
  const q = await searchParams;
  return (
    <main className="app-wrap" style={{ maxWidth: 480 }}>
      <div className="eyebrow">Acceso</div>
      <h1 style={{ marginTop: 10 }}>Entrar al despacho</h1>
      <p className="muted" style={{ marginTop: 10 }}>Te enviamos un enlace de acceso al correo con el que se te dio de alta. Sin contraseñas.</p>
      {q.sent && <div className="card"><strong>Enlace enviado.</strong> Revisa tu correo y abre el enlace desde este mismo dispositivo.</div>}
      {q.error && <div className="card" style={{ borderColor: "var(--bad)" }}>{q.error}</div>}
      <form action="/auth/login" method="post" className="card" style={{ display: "grid", gap: 10 }}>
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" name="email" type="email" required autoComplete="email" style={{ font: "inherit", padding: 10, border: "1px solid var(--rule)" }} />
        <button type="submit" className="btn">Enviar enlace de acceso</button>
      </form>
    </main>
  );
}
