import type { Metadata } from "next";
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
