import { NextResponse } from 'next/server';

/** Liveness probe: the process is up. No dependencies touched, no auth needed. */
export function GET() {
  return NextResponse.json({ status: 'ok', service: 'rosillo-intake-copilot', synthetic: true });
}
