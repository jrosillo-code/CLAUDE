"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

// Sign-in. Demo-mode: each provider button creates a local session for the
// seeded account. When the Supabase backend is wired, these call
// supabase.auth.signInWithOAuth({ provider: 'apple' | 'google' }) and
// signInWithOtp({ email }) — the UI is already shaped for it.
export default function LoginScreen() {
  const signIn = useStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);

  function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setLinkSent(true);
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-paper px-5">
      {/* Soft horizon glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-30%] h-[70%] rounded-[100%] opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--color-accent-2) 0%, transparent 70%)",
          opacity: 0.14,
        }}
      />

      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-ink shadow-float">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#f6f3ee" strokeWidth="1.6" />
              <path d="m15.5 8.5-2.2 5.3-5.3 2.2 2.2-5.3z" fill="#c65d3b" />
            </svg>
          </div>
          <h1 className="mt-5 font-display text-4xl">Waypoint</h1>
          <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-ink-3">
            Your friends&apos; travels, on one living map.
          </p>
        </div>

        {/* Providers */}
        <div className="mt-9 space-y-2.5">
          <button
            onClick={() => signIn("apple")}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ink py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90"
          >
            <AppleLogo />
            Continue with Apple
          </button>
          <button
            onClick={() => signIn("google")}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-paper py-3 text-[15px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-paper-2"
          >
            <GoogleLogo />
            Continue with Google
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs uppercase tracking-wider text-ink-3">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Email magic link */}
        {linkSent ? (
          <div className="rounded-2xl border border-line bg-paper-2/60 p-5 text-center">
            <div className="text-2xl">✉️</div>
            <p className="mt-2 font-display text-lg">Check your inbox</p>
            <p className="mt-1 text-sm text-ink-3">
              We sent a sign-in link to <span className="text-ink-2">{email}</span>.
            </p>
            <button
              onClick={() => signIn("email")}
              className="mt-4 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-paper"
            >
              Open the link (demo)
            </button>
          </div>
        ) : (
          <form onSubmit={submitEmail} className="space-y-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-full bg-paper-2 px-5 py-3 text-[15px] outline-none ring-line placeholder:text-ink-3 focus:ring-2 focus:ring-ink/15"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-accent py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
              disabled={!email.includes("@")}
            >
              Continue with email
            </button>
          </form>
        )}

        <p className="mt-7 text-center text-xs leading-relaxed text-ink-3">
          Demo build — every option signs you into the sample account.
          <br />
          By continuing you agree to keep exploring.
        </p>
      </div>
    </div>
  );
}

function AppleLogo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 12.54c-.03-2.62 2.14-3.88 2.24-3.94-1.22-1.79-3.12-2.03-3.8-2.06-1.6-.16-3.14.95-3.96.95-.82 0-2.08-.93-3.43-.9-1.76.03-3.39 1.02-4.3 2.6-1.83 3.18-.47 7.88 1.32 10.46.87 1.26 1.91 2.68 3.27 2.63 1.31-.05 1.81-.85 3.4-.85 1.58 0 2.03.85 3.42.82 1.42-.02 2.31-1.28 3.18-2.55 1-1.46 1.41-2.87 1.44-2.94-.03-.02-2.76-1.06-2.78-4.22zM14.44 4.85c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.29.69-3.03 1.56-.67.77-1.25 2-1.09 3.18 1.15.09 2.33-.58 3.05-1.45z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.44 1.14-4.07 1.14-3.13 0-5.78-2.11-6.72-4.95H1.29v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.99-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.99 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  );
}
