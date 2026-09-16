import { NextResponse } from "next/server";
import { safeBack } from "@/lib/runtime";
import { COOKIE, LANGS, type Lang } from "@/lib/i18n";

/** GET /lang/en or /lang/es: remember the language for a year and go back to the page. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const lang: Lang = LANGS.includes(code as Lang) ? (code as Lang) : "es";
  const res = NextResponse.redirect(safeBack(req, "/"), 303);
  res.cookies.set(COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
