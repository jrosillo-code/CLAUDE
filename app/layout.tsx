import type { Metadata, Viewport } from "next";
import ThemeManager from "@/components/ThemeManager";
import PreviewBanner from "@/components/PreviewBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waypoint — your friends' maps",
  description:
    "A social app where the world map is the interface. Friends appear as photo-pins on the places they've been.",
  // Preview deployments must never be indexed — the flag is baked at build
  // time from the preview env var.
  robots:
    process.env.NEXT_PUBLIC_PREVIEW === "1"
      ? { index: false, follow: false, nocache: true }
      : undefined,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Waypoint", statusBarStyle: "black-translucent" },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Waypoint",
    description: "Your friends' travels, on one living map.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f3f5f8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Lets env(safe-area-inset-*) report real values on notched phones.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme's chrome before first paint — prevents the
            light-mode flash when the user prefers Midnight. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("wp-theme")==="midnight"?"dark":"light";if(localStorage.getItem("wp-accent")==="blue")document.documentElement.dataset.accent="blue"}catch(e){}`,
          }}
        />
      </head>
      <body>
        <ThemeManager />
        {children}
        <PreviewBanner />
      </body>
    </html>
  );
}
