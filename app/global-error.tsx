"use client";

// The root layout itself failed: no theme, no fonts, just a way out.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f1ece2", color: "#1c1a17", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <div style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>Waypoint hit a wall</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.8 }}>
            The app could not draw itself. Nothing you saved is lost. Reloading usually fixes it.
          </p>
          {error.digest && <p style={{ fontSize: 11, opacity: 0.6 }}>Reference {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 16, borderRadius: 999, border: 0, background: "#c65d3b", color: "#fff", padding: "10px 20px", fontWeight: 600 }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
