/**
 * Environment validation — fails loudly at startup with actionable messages
 * instead of failing obscurely at request time. Called from instrumentation.ts.
 */

export function validateEnvironment(): void {
  const problems: string[] = [];

  const classification = process.env.DATA_CLASSIFICATION ?? 'SYNTHETIC';
  if (classification !== 'SYNTHETIC') {
    problems.push(
      `DATA_CLASSIFICATION="${classification}" — this prototype only runs against SYNTHETIC data. Set DATA_CLASSIFICATION=SYNTHETIC.`,
    );
  }

  const provider = process.env.AI_PROVIDER ?? 'mock';
  if (!['mock', 'anthropic'].includes(provider)) {
    problems.push(`AI_PROVIDER="${provider}" is not supported. Use "mock" or "anthropic".`);
  }
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    problems.push('AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY (server-side only, never NEXT_PUBLIC_*).');
  }

  for (const key of Object.keys(process.env)) {
    if (key.startsWith('NEXT_PUBLIC_') && /KEY|SECRET|TOKEN|PASSWORD/i.test(key)) {
      problems.push(`${key} would expose a secret to the browser. Remove the NEXT_PUBLIC_ prefix.`);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.AUTH_SECRET ?? '';
    if (secret.length < 16 || secret === 'change-me-in-dev') {
      problems.push('AUTH_SECRET must be set to a random string of at least 16 characters in production.');
    }
  }

  // On serverless hosts the filesystem is ephemeral: the embedded PGlite
  // database would silently reset on every cold start. Require Postgres.
  if (process.env.VERCEL && !process.env.DATABASE_URL) {
    problems.push('Deployments on Vercel require DATABASE_URL (e.g. the Supabase transaction-pooler connection string).');
  }
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (dbUrl && !/^postgres(ql)?:\/\//.test(dbUrl)) {
    problems.push('DATABASE_URL must be a postgres:// connection string.');
  }

  if (problems.length > 0) {
    const message = ['Environment validation failed:', ...problems.map((p) => `  - ${p}`)].join('\n');
    throw new Error(message);
  }
}
