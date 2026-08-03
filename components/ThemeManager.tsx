"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { THEMES, type ThemeId } from "@/lib/themes";

// Applies the active theme to <html data-theme="..."> (and the accent choice to
// data-accent) so every page follows, and restores saved choices on first load.
export default function ThemeManager() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const accent = useStore((s) => s.accent);
  const setAccent = useStore((s) => s.setAccent);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("wp-theme") as ThemeId | null;
      if (saved && saved !== theme && THEMES[saved]) setTheme(saved);
      const savedAccent = window.localStorage.getItem("wp-accent");
      if (savedAccent === "warm") setAccent("warm");
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = THEMES[theme].darkUI ? "dark" : "light";
  }, [theme]);

  useEffect(() => {
    if (accent === "warm") document.documentElement.dataset.accent = "warm";
    else delete document.documentElement.dataset.accent;
  }, [accent]);

  return null;
}
