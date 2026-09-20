// Shared boot for the browser suites: a production server on a free port,
// a Chromium, and a tiny reporter. Each suite is a plain script — no test
// framework — so it reads top to bottom like the session it drives.
//
// Needs a production build in .next (scripts/e2e.sh makes one if missing)
// and a Chromium: PW_CHROMIUM, or Playwright's own install, or the sandbox
// path used during development.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import pw from "playwright-core";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function chromiumPath() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const dev = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  if (existsSync(dev)) return dev;
  return pw.chromium.executablePath();
}

export async function boot({ base = 3100 } = {}) {
  const PORT = base + (process.pid % 100);
  // Every suite runs the keyless demo: no Supabase, no Anthropic key.
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", ANTHROPIC_API_KEY: "" },
  });
  await new Promise((r) => {
    server.stdout.on("data", (d) => /Ready|started server|Local:/.test(String(d)) && r());
    setTimeout(r, 15000);
  });
  const B = `http://127.0.0.1:${PORT}`;
  // Warm the server: the first request after a build pays for chunk loading,
  // and a suite that starts on a cold server sees a map with nothing on it.
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${B}/`);
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const out = [];
  const ok = (name, pass, detail = "") => {
    const line = `${pass ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`;
    out.push(line);
    process.stderr.write(line + "\n");
  };
  const finish = async (browser) => {
    console.log(out.join("\n"));
    const failed = out.filter((l) => l.startsWith("FAIL")).length;
    console.log(`\n${failed} failed, ${out.length - failed} passed`);
    try { await browser?.close(); } catch { /* already gone */ }
    server.kill();
    process.exit(failed ? 1 : 0);
  };
  process.on("unhandledRejection", (e) => {
    console.log(out.join("\n"));
    console.log("UNHANDLED", String(e).slice(0, 400));
    server.kill();
    process.exit(1);
  });
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  return { B, PORT, server, browser, ok, out, finish, pw };
}
