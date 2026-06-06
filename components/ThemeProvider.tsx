"use client";

// Owns the light/dark theme state for the app. The class on <html> is the
// single source of truth: a pre-hydration script in layout.tsx sets it before
// first paint (stored preference, else system), and this provider reads it,
// exposes it via context, and keeps localStorage + the theme-color meta in
// sync when the user toggles. ~30 lines of state beats a dependency here.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { MAP_BG } from "@/lib/mapStyle";

export const THEME_STORAGE_KEY = "findsnus:theme";

type ThemeContextValue = {
  /** Whether dark mode is active right now. */
  dark: boolean;
  /** Flip the theme and persist the choice. */
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  dark: false,
  toggle: () => {},
});

// Applies a theme to the document: html class + the theme-color meta (so the
// iOS status bar / Android chrome strip matches the basemap land colour).
function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? MAP_BG.dark : MAP_BG.light);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy init reads the class the pre-hydration script already set, so
  // client-only consumers (the map) get the right theme on first render.
  // Server render falls back to light; no SSR'd markup branches on this value
  // (ThemeToggle is CSS-driven), so there is no hydration mismatch.
  const [dark, setDark] = useState(
    () =>
      typeof window !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    applyTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    setDark(next);
  }, []);

  // Track system theme changes live, but only while the user hasn't made an
  // explicit choice — once they toggle, their preference wins.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (window.localStorage.getItem(THEME_STORAGE_KEY) !== null) return;
      applyTheme(e.matches);
      setDark(e.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
