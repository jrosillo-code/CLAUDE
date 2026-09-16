import { cookies } from "next/headers";

// The public site speaks Spanish by default and English on request. The
// choice lives in a cookie set by /lang/{code}; server components read it
// and pick their copy. The product (the app screens) stays in Spanish: it
// is built for Spanish firms. Legal texts are Spanish and say so in English.

export type Lang = "es" | "en";
export const LANGS: Lang[] = ["es", "en"];
export const COOKIE = "lang";

export async function getLang(): Promise<Lang> {
  try {
    const v = (await cookies()).get(COOKIE)?.value;
    return v === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

/** Pick the copy for a language from a pair. */
export function t<T>(lang: Lang, es: T, en: T): T {
  return lang === "en" ? en : es;
}
