"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (theme: ThemePreference) => void;
};

const STORAGE_KEY = "helix-theme-preference";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Convert Light / Dark / System into the theme
 * that should actually be displayed.
 */
function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return preference;
}

/**
 * Apply the resolved theme to the root <html> element.
 */
function applyTheme(
  preference: ThemePreference,
  resolvedTheme: ResolvedTheme
) {
  const root = document.documentElement;

  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  /**
   * Public landing page:
   * always follows the device/system theme.
   *
   * It does NOT use or overwrite the user's
   * saved Admin / Investor / Employee preference.
   */
  const systemOnly = pathname === "/";

  /**
   * Light remains the default for the authenticated app
   * when no preference has previously been saved.
   */
  const [preference, setPreferenceState] =
    useState<ThemePreference>("light");

  const [resolvedTheme, setResolvedTheme] =
    useState<ResolvedTheme>("light");

  /**
   * Resolve and apply a theme preference.
   */
  const updateTheme = useCallback(
    (nextPreference: ThemePreference) => {
      const nextResolved = resolveTheme(nextPreference);

      setPreferenceState(nextPreference);
      setResolvedTheme(nextResolved);

      applyTheme(nextPreference, nextResolved);
    },
    []
  );

  /**
   * Called by ThemeSwitcher.
   *
   * The landing page is system-only, so it cannot
   * modify the stored application preference.
   */
  const setPreference = useCallback(
    (nextPreference: ThemePreference) => {
      if (systemOnly) {
        return;
      }

      localStorage.setItem(STORAGE_KEY, nextPreference);
      updateTheme(nextPreference);
    },
    [systemOnly, updateTheme]
  );

  /**
   * Load the correct preference whenever the route changes.
   *
   * Landing page:
   *   Always System.
   *
   * Authenticated application:
   *   Saved preference if one exists.
   *   Otherwise Light.
   */
  useEffect(() => {
    if (systemOnly) {
      updateTheme("system");
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);

    const initialPreference: ThemePreference =
      stored === "light" ||
      stored === "dark" ||
      stored === "system"
        ? stored
        : "light";

    updateTheme(initialPreference);
  }, [systemOnly, updateTheme]);

  /**
   * Listen for macOS / Windows / iOS / Android
   * appearance changes.
   *
   * This listener is active when:
   * - the landing page is open, OR
   * - the authenticated user selected System.
   */
  useEffect(() => {
    const media = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const handleSystemThemeChange = () => {
      if (!systemOnly && preference !== "system") {
        return;
      }

      const nextResolved: ResolvedTheme = media.matches
        ? "dark"
        : "light";

      setResolvedTheme(nextResolved);

      applyTheme(
        systemOnly ? "system" : preference,
        nextResolved
      );
    };

    media.addEventListener(
      "change",
      handleSystemThemeChange
    );

    return () => {
      media.removeEventListener(
        "change",
        handleSystemThemeChange
      );
    };
  }, [preference, systemOnly]);

  return (
    <ThemeContext.Provider
      value={{
        preference,
        resolvedTheme,
        setPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}