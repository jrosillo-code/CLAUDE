import { NextResponse } from "next/server";
import { runSelfCheck } from "@/lib/selfcheck";
import { allow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!allow(`selfcheck:${ip}`, 10, 10)) return NextResponse.json({ error: "Demasiadas comprobaciones; espera un minuto" }, { status: 429 });
  const result = await runSelfCheck();
  return NextResponse.json(result, { status: result.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
