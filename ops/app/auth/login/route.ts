import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/auth";

export async function POST(req: Request) {
  const client = await createUserClient();
  if (!client) return NextResponse.redirect(new URL("/app/demo/revisar", req.url), 303);
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim();
  if (!email) return NextResponse.redirect(new URL("/login?error=Falta+el+correo", req.url), 303);
  const origin = new URL(req.url).origin;
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url), 303);
  return NextResponse.redirect(new URL("/login?sent=1", req.url), 303);
}
