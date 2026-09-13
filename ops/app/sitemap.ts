import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://claude-tawny-tau.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["", "/corredurias", "/asesorias", "/como-funciona", "/precios", "/seguridad", "/kit-cumplimiento", "/contacto", "/legal/aviso", "/legal/privacidad", "/legal/encargo"].map((p) => ({
    url: `${BASE}${p}`, lastModified: now, changeFrequency: p === "" ? "weekly" : "monthly", priority: p === "" ? 1 : p.startsWith("/legal") ? 0.3 : 0.8,
  }));
}
