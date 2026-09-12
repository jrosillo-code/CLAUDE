import Link from "next/link";

// Header shared by the app screens: firm, session, mode and the section tabs.
// Same restraint as the site: text, hairlines, one active underline.

export function AppNav({ slug, firmName, userLabel, mode, active, logout }: {
  slug: string; firmName: string; userLabel: string; mode: { model: string; store: string }; active: "revisar" | "liquidaciones"; logout: boolean;
}) {
  const tabs: { key: "revisar" | "liquidaciones"; label: string }[] = [
    { key: "revisar", label: "Cola de revisión" },
    { key: "liquidaciones", label: "Liquidaciones" },
  ];
  return (
    <header className="app-head">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="eyebrow">{firmName} · {userLabel} · modelo {mode.model} · datos {mode.store}</div>
        {logout && <form action="/logout" method="post"><button className="secondary" type="submit">Salir</button></form>}
      </div>
      <nav className="app-tabs" aria-label="Secciones">
        {tabs.map((t) => <Link key={t.key} href={`/app/${slug}/${t.key}`} className={t.key === active ? "active" : undefined} aria-current={t.key === active ? "page" : undefined}>{t.label}</Link>)}
      </nav>
    </header>
  );
}
