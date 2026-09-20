import type { MetadataRoute } from "next";
import { coveredCountries } from "@/lib/fieldbrief/rules";
import { LIST_IDS } from "@/lib/lists/schema";
import { SITE_URL } from "@/lib/site";

// Every public page, so search engines do not have to discover a hundred
// country pages and ten world lists by crawling links alone.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL.replace(/\/$/, "");
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/fly`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...coveredCountries().map((c) => ({
      url: `${base}/fly/${c.countryCode.toLowerCase()}`,
      lastModified: new Date(c.lastVerifiedOn),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/world`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...LIST_IDS.map((id) => ({
      url: `${base}/world/${id}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
