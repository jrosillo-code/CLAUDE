/**
 * Structured JSON logging to stdout. Never logs email bodies, attachment
 * content, or drafts unless LOG_CONTENT=1 is explicitly set for development
 * debugging (spec section 13: no raw document bodies in standard logs).
 */

type Level = 'info' | 'warn' | 'error';

const CONTENT_KEYS = new Set(['body', 'bodyText', 'draft', 'text', 'subject', 'quote']);

function redact(fields: Record<string, unknown>): Record<string, unknown> {
  if (process.env.LOG_CONTENT === '1') return fields;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = CONTENT_KEYS.has(k) ? '[redacted]' : v;
  }
  return out;
}

function emit(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...redact(fields),
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};
