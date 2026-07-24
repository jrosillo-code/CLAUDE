"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { backendEnabled, supabase } from "@/lib/supabase";
import { checkHandleAvailable } from "@/lib/backend";
import WaypointLogo from "./Logo";

// Sign-in. Live mode: create an account (username + email + password) or
// sign in with an existing one; a magic-link fallback covers forgotten
// passwords. Demo mode: every option opens the seeded sample account.
export default function LoginScreen() {
  const signIn = useStore((s) => s.signIn);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState<false | "otp" | "confirm">(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Live mode shows an OAuth button only when that provider is actually
  // configured in Supabase (set NEXT_PUBLIC_OAUTH_PROVIDERS="google,apple"
  // once credentials are added). A disabled provider can't be caught in JS:
  // the authorize endpoint navigates the whole page to a raw JSON 400.
  const oauthProviders = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  const showApple = !backendEnabled || oauthProviders.includes("apple");
  const showGoogle = !backendEnabled || oauthProviders.includes("google");

  async function oauth(provider: "apple" | "google") {
    if (!backendEnabled) return signIn(provider);
    setAuthError(null);
    const { error } = await supabase!.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(`${provider === "apple" ? "Apple" : "Google"} sign-in isn't configured yet — use email below.`);
  }

  const emailOk = email.includes("@");
  const cleanHandle = handle.trim().toLowerCase().replace(/^@/, "");
  const handleOk = /^[a-z0-9_]{2,30}$/.test(cleanHandle);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!backendEnabled) return signIn("email"); // demo: straight in
    setAuthError(null);

    if (mode === "signup") {
      if (!handleOk) {
        setAuthError("Usernames are 2–30 characters: letters, numbers, underscores.");
        return;
      }
      if (password.length < 6) {
        setAuthError("Password needs at least 6 characters.");
        return;
      }
      setBusy(true);
      try {
        if (!(await checkHandleAvailable(cleanHandle))) {
          setAuthError(`@${cleanHandle} is taken — try another username.`);
          return;
        }
        // The handle waits here until the session exists (hydrateSession
        // claims it) — this also survives the email-confirmation detour.
        try {
          window.localStorage.setItem("wp-pending-handle", cleanHandle);
        } catch {
          /* private mode */
        }
        const { data, error } = await supabase!.auth.signUp({ email, password });
        if (error) setAuthError(error.message);
        else if (!data.session) setLinkSent("confirm"); // confirm-email is on
        // else: SIGNED_IN fires and the app takes over.
      } finally {
        setBusy(false);
      }
      return;
    }

    // Sign in
    setBusy(true);
    try {
      const { error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error)
        setAuthError(
          /confirm/i.test(error.message)
            ? "Confirm your email first — check your inbox."
            : "Wrong email or password."
        );
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!emailOk) {
      setAuthError("Enter your email above first.");
      return;
    }
    if (!backendEnabled) {
      setLinkSent("otp");
      return;
    }
    setAuthError(null);
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
    else setLinkSent("otp");
  }

  const inputCls =
    "w-full rounded-full bg-paper-2 px-5 py-3 text-[15px] outline-none ring-line placeholder:text-ink-3 focus:ring-2 focus:ring-ink/15";

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
          <div className="drop-shadow-lg">
            <WaypointLogo size={72} />
          </div>
          <h1 className="mt-5 font-display text-4xl">Waypoint</h1>
          <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-ink-3">
            Your friends&apos; travels, on one living map.
          </p>
        </div>

        {linkSent ? (
          <div className="mt-9 rounded-2xl border border-line bg-paper-2/60 p-5 text-center">
            <div className="text-2xl">✉️</div>
            <p className="mt-2 font-display text-lg">Check your inbox</p>
            <p className="mt-1 text-sm text-ink-3">
              {linkSent === "confirm"
                ? "Tap the confirmation link we sent to "
                : "We sent a sign-in link to "}
              <span className="text-ink-2">{email}</span>.
            </p>
            {!backendEnabled && (
              <button
                onClick={() => signIn("email")}
                className="mt-4 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-paper"
              >
                Open the link (demo)
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Providers */}
            {(showApple || showGoogle) && (
              <>
                <div className="mt-9 space-y-2.5">
                  {showApple && (
                    <button
                      onClick={() => oauth("apple")}
                      className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ink py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90"
                    >
                      <AppleLogo />
                      Continue with Apple
                    </button>
                  )}
                  {showGoogle && (
                    <button
                      onClick={() => oauth("google")}
                      className="flex w-full items-center justify-center gap-2.5 rounded-full bg-paper py-3 text-[15px] font-semibold text-ink ring-1 ring-line transition-colors hover:bg-paper-2"
                    >
                      <GoogleLogo />
                      Continue with Google
                    </button>
                  )}
                </div>
                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-xs uppercase tracking-wider text-ink-3">or</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              </>
            )}
            {!(showApple || showGoogle) && <div className="mt-9" />}

            <form onSubmit={submit} className="space-y-2.5">
              {mode === "signup" && (
                <div className="relative">
                  <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[15px] text-ink-3">
                    @
                  </span>
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className={inputCls}
              />
              <button
                type="submit"
                className="w-full rounded-full bg-accent py-3 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
                disabled={busy || !emailOk || (backendEnabled && password.length < 6)}
              >
                {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            {/* Mode switch + magic-link fallback */}
            <div className="mt-4 space-y-1.5 text-center text-sm text-ink-3">
              {mode === "signup" ? (
                <p>
                  Already have an account?{" "}
                  <button onClick={() => { setMode("signin"); setAuthError(null); }} className="font-semibold text-ink underline-offset-2 hover:underline">
                    Sign in
                  </button>
                </p>
              ) : (
                <>
                  <p>
                    New here?{" "}
                    <button onClick={() => { setMode("signup"); setAuthError(null); }} className="font-semibold text-ink underline-offset-2 hover:underline">
                      Create an account
                    </button>
                  </p>
                  <p>
                    <button onClick={sendMagicLink} className="text-xs underline-offset-2 hover:underline">
                      Forgot password? Email me a sign-in link
                    </button>
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {authError && (
          <p className="mt-4 rounded-xl bg-accent/10 px-4 py-2.5 text-center text-xs text-accent">
            {authError}
          </p>
        )}

        <p className="mt-7 text-center text-xs leading-relaxed text-ink-3">
          {backendEnabled ? (
            <>Your username is how friends find you. Sign in to see their maps — and let them see yours.</>
          ) : (
            <>
              Demo build — every option signs you into the sample account.
              <br />
              By continuing you agree to keep exploring.
            </>
          )}
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
