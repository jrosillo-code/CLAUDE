import { NextResponse } from "next/server";
import { getRuntime } from "@/lib/runtime";
import { runJobs } from "@/lib/jobs";

export const maxDuration = 300;

/** Drains due jobs. Bearer OPS_API_KEY or CRON_SECRET; open on localhost in demo mode. */
export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const keys = [process.env.OPS_API_KEY, process.env.CRON_SECRET].filter(Boolean);
  const host = req.headers.get("host") ?? "";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && keys.length === 0;
  if (!local && !keys.some((k) => header === `Bearer ${k}`)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limit = Math.min(50, Number(new URL(req.url).searchParams.get("limit") ?? 10) || 10);
  const rt = getRuntime();
  const summary = await runJobs(rt, limit);
  return NextResponse.json(summary);
}

export const GET = POST;
