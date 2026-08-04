/** Next.js startup hook — validates the environment before serving traffic. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('./lib/env');
    validateEnvironment();
  }
}
