"use client";

import { useEffect, useState } from "react";
import { authLinkError, backendEnabled, supabase } from "@/lib/supabase";
import PasswordReset from "@/components/PasswordReset";
import WaypointLogo from "@/components/Logo";

// Where password-reset emails land.
//
// Being a ROUTE is the point. The first version of the reset flow sent links
// back to the site root and tried to recognise them there — from an auth
// event that fires before the store subscribes, and from a URL fragment that
// supabase-js strips during initialisation. Both are races. A page whose only
// job is resetting passwords doesn't need to recognise anything: if you are
// here, that is what you came to do.
//
// Three states, decided once on arrival:
//   · the link carried a valid token  → choose a new password
//   · it was expired / already used / bounced with an error → say so, and
//     offer to send a fresh one right here instead of routing the visitor
//     back through the sign-in screen
//   · still ingesting → a brief splash while supabase-js reads the fragment
export default function ResetPage() {
  const [phase, setPhase] = useState<"checking" | "form" | "request">("checking");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!backendEnabled) {
      // Demo mode has no passwords to reset.
      window.location.replace("/");
      return;
    }
    let cancelled = false;
    void (async () => {
      // A link that bounced with an error carries no usable token; skip
      // straight to offering a new one.
      if (authLinkError) {
        setPhase("request");
        return;
      }
      // PKCE-style landing (?code=). Best effort: this client runs the
      // implicit flow, but exchanging costs nothing to try.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        try {
          await supabase!.auth.exchangeCodeForSession(code);
        } catch {
          /* fall through to the polling below */
        }
      }
      // The implicit flow parks tokens in the URL fragment and supabase-js
      // ingests them asynchronously during init — poll briefly rather than
      // racing it.
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        try {
          const { data } = await supabase!.auth.getSession();
          if (data.session) {
            setPhase("form");
            return;
          }
        } catch {
          /* keep waiting */
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!cancelled) setPhase("request");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (err) {
        setError(
          /rate limit|too many/i.test(err.message)
            ? "Too many emails requested — Supabase's built-in sender allows only a few per hour. Wait a while and try again."
            : err.message
        );
      } else {
        setSent(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (phase === "form") {
    return <PasswordReset onDone={() => window.location.replace("/")} />;
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-5">
      <div className="w-full max-w-sm text-center">
        <div className={`flex justify-center drop-shadow-lg ${phase === "checking" ? "animate-pulse" : ""}`}>
          <WaypointLogo size={56} />
        </div>
        {phase === "checking" ? (
          <p className="mt-5 text-sm text-ink-3">Checking your reset link…</p>
        ) : sent ? (
          <>
            <p className="mt-5 font-display text-2xl">Check your inbox</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">
              We sent a reset link to <span className="text-ink-2">{email}</span>. It&apos;s
              single-use and expires quickly, so tap it soon. Nothing after a minute? Check spam.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-5 font-display text-2xl">Reset your password</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">
              {authLinkError ??
                "That link didn't carry a valid token — reset links are single-use and short-lived. Enter your email and we'll send a fresh one."}
            </p>
            <form onSubmit={requestLink} className="mt-6 space-y-3">
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-full bg-paper-2 px-5 py-3 text-[15px] outline-none ring-line placeholder:text-ink-3 focus:ring-2 focus:ring-ink/15"
              />
              <button
                type="submit"
                disabled={!email.includes("@") || busy}
                className="w-full rounded-full bg-accent py-3 text-[15px] font-semibold text-paper transition-opacity disabled:opacity-40"
              >
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <p className="mt-6">
          <a href="/" className="text-xs text-ink-3 underline-offset-2 hover:underline">
            Back to sign in
          </a>
        </p>
        {error && (
          <p className="mt-4 rounded-xl bg-accent/10 px-4 py-2.5 text-xs text-accent">{error}</p>
        )}
      </div>
    </div>
  );
}
