import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const client = await createUserClient();
  if (!client || !code) return NextResponse.redirect(new URL("/login?error=Enlace+no+v%C3%A1lido", req.url), 303);
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url), 303);
  return NextResponse.redirect(new URL("/app", req.url), 303);
}
