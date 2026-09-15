import type { Metadata } from "next";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://claude-tawny-tau.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: { default: "Operaciones con IA para corredurías y asesorías", template: "%s · Operaciones con IA" },
  description:
    "Entrada de documentos, extracción con cita, validación y conciliación de liquidaciones de comisiones, con cola de revisión humana y registro de auditoría. Para corredurías de seguros y asesorías en España.",
  openGraph: { type: "website", locale: "es_ES", siteName: "Operaciones con IA", title: "Tus operaciones, con IA y con control.", description: "Automatizamos documentos y liquidaciones en corredurías y asesorías. Cada resultado pasa por una persona y deja rastro de auditoría." },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
