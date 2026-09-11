import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Operaciones con IA para corredurías y asesorías",
  description:
    "Entrada de documentos, extracción, validación y conciliación de liquidaciones, con cola de revisión humana y registro de auditoría. Para corredurías de seguros y asesorías en España.",
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
