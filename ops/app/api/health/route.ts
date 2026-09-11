import { NextResponse } from "next/server";
import { getRuntime } from "@/lib/runtime";

export async function GET() {
  const rt = getRuntime();
  return NextResponse.json({ ok: true, mode: rt.mode });
}
