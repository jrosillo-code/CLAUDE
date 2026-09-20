import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Preview builds are never indexed; production exposes the public pages
  // and keeps the API, the facilitator funnel and the reset screen out.
  if (process.env.NEXT_PUBLIC_PREVIEW === "1") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/funnel", "/reset", "/join/"] },
    sitemap: `${SITE_URL.replace(/\/$/, "")}/sitemap.xml`,
  };
}
