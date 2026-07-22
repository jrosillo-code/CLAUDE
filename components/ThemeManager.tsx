"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { THEMES, type ThemeId } from "@/lib/themes";

// Applies the active theme to <html data-theme="..."> so every page (map,
// profiles) follows, and restores the saved choice on first load.
export default function ThemeManager() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("wp-theme") as ThemeId | null;
      if (saved && saved !== theme && THEMES[saved]) setTheme(saved);
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = THEMES[theme].darkUI ? "dark" : "light";
  }, [theme]);

  return null;
}
