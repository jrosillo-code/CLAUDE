import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://claude-tawny-tau.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/api/", "/estado", "/login", "/auth/"] }], sitemap: `${BASE}/sitemap.xml` };
}
