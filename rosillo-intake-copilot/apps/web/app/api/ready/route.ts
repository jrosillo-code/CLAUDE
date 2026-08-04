import { NextResponse } from 'next/server';
import { getDb, listUsers } from '@rosillo/database';

/**
 * Readiness probe: database reachable + migrated + seeded, and the configured
 * AI provider is constructible. Reports degraded mode instead of failing hard
 * when only the AI provider is unavailable (the case workspace still works).
 */
export async function GET() {
  const checks: Record<string, string> = {};
  let ready = true;

  try {
    const users = listUsers(getDb());
    checks['database'] = users.length > 0 ? 'ok' : 'empty — run npm run db:seed';
    if (users.length === 0) ready = false;
  } catch (err) {
    checks['database'] = err instanceof Error ? err.message.slice(0, 200) : 'error';
    ready = false;
  }

  const providerKind = process.env.AI_PROVIDER ?? 'mock';
  if (providerKind === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    checks['aiProvider'] = 'degraded — anthropic configured without ANTHROPIC_API_KEY; analyses will fail safe';
  } else {
    checks['aiProvider'] = `ok (${providerKind})`;
  }

  return NextResponse.json(
    { status: ready ? 'ready' : 'not-ready', synthetic: true, checks },
    { status: ready ? 200 : 503 },
  );
}
