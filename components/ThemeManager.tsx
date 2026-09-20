"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { THEMES, type ThemeId } from "@/lib/themes";
import { autoThemeFor } from "@/lib/daynight";

// Applies the active theme to <html data-theme="..."> (and the accent choice to
// data-accent) so every page follows, and restores saved choices on first load.
export default function ThemeManager() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const accent = useStore((s) => s.accent);
  const setAccent = useStore((s) => s.setAccent);
  const autoTheme = useStore((s) => s.autoTheme);
  const setAutoTheme = useStore((s) => s.setAutoTheme);
  const applyAutoTheme = useStore((s) => s.applyAutoTheme);
  const userLocation = useStore((s) => s.userLocation);

  useEffect(() => {
    try {
      // Auto day/night is on unless it was switched off (a manual theme pick
      // switches it off). A saved theme only applies when auto is off.
      const auto = window.localStorage.getItem("wp-auto-theme") !== "0";
      if (auto !== autoTheme) setAutoTheme(auto);
      const saved = window.localStorage.getItem("wp-theme") as ThemeId | null;
      if (!auto && saved && saved !== theme && THEMES[saved]) setTheme(saved);
      const savedAccent = window.localStorage.getItem("wp-accent");
      if (savedAccent === "blue") setAccent("blue");
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the sun: re-checked every minute and whenever the location lands.
  useEffect(() => {
    if (!autoTheme) return;
    // Read the live flag at tick time: on first load the restore effect above
    // may have just switched auto OFF (a saved manual pick), and this effect
    // still holds the initial "on" — ticking then would flip a chosen
    // Daylight to Midnight at night.
    const tick = () => {
      if (!useStore.getState().autoTheme) return;
      applyAutoTheme(autoThemeFor(new Date(), userLocation));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [autoTheme, userLocation, applyAutoTheme]);

  useEffect(() => {
    document.documentElement.dataset.theme = THEMES[theme].darkUI ? "dark" : "light";
  }, [theme]);

  useEffect(() => {
    if (accent === "blue") document.documentElement.dataset.accent = "blue";
    else delete document.documentElement.dataset.accent;
  }, [accent]);

  return null;
}
