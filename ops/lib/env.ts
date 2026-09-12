// Environment names with the fallbacks the deployment actually uses. The
// anon key is only used server-side (session cookies are read in route
// handlers), so a plain ANON_KEY works; the server URL falls back to the
// public one since they are the same project.
export function supabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}
export function supabaseAnonKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.ANON_KEY || undefined;
}
export function supabaseServiceKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || undefined;
}
