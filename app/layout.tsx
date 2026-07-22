import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waypoint — your friends' maps",
  description:
    "A social app where the world map is the interface. Friends appear as photo-pins on the places they've been.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Waypoint", statusBarStyle: "black-translucent" },
  openGraph: {
    title: "Waypoint",
    description: "Your friends' travels, on one living map.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f3ee",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
