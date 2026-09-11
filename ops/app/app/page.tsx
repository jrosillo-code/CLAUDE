import Link from "next/link";
import { redirect } from "next/navigation";
import { getRuntime, DEMO_SLUG } from "@/lib/runtime";
import { getSessionUser, supabaseAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppIndex() {
  if (!supabaseAuthConfigured()) redirect(`/app/${DEMO_SLUG}/revisar`);
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const firms = await getRuntime().store.memberships.firmsFor(user.id);
  if (firms.length === 1) redirect(`/app/${firms[0].id}/revisar`);
  return (
    <main className="app-wrap">
      <div className="eyebrow">{user.email}</div>
      <h1 style={{ marginTop: 10 }}>Tus despachos</h1>
      {firms.length === 0 && <p className="muted" style={{ marginTop: 10 }}>Tu usuario no pertenece a ningún despacho todavía. Pide a quien te dio de alta que te añada.</p>}
      {firms.map((f) => <div className="card" key={f.id}><Link href={`/app/${f.id}/revisar`}>{f.name}</Link> <span className="muted">· {f.kind === "correduria" ? "correduría" : "asesoría"}</span></div>)}
      <form action="/logout" method="post" style={{ marginTop: 20 }}><button className="secondary" type="submit">Salir</button></form>
    </main>
  );
}
