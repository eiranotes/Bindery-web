"use client";

import { useEffect, useRef } from "react";

import {
  DEFAULT_THEME_ID,
  isThemeId,
  THEME_CATALOG,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "../lib/themes";

type ThemeControlProps = {
  className?: string;
};

const THEME_CHANGE_EVENT = "bindery:theme-change";

function applyTheme(themeId: ThemeId) {
  document.documentElement.dataset.theme = themeId;
}

function storedTheme(): ThemeId {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(value) ? value : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function ThemeControl({ className = "" }: ThemeControlProps) {
  const selectorRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const syncTheme = (nextTheme: ThemeId) => {
      applyTheme(nextTheme);
      if (selectorRef.current) {
        selectorRef.current.value = nextTheme;
      }
    };

    syncTheme(storedTheme());

    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const nextTheme = isThemeId(event.newValue)
        ? event.newValue
        : DEFAULT_THEME_ID;
      syncTheme(nextTheme);
    };

    const syncSelectedTheme = (event: Event) => {
      const nextTheme =
        event instanceof CustomEvent && isThemeId(event.detail)
          ? event.detail
          : DEFAULT_THEME_ID;
      syncTheme(nextTheme);
    };

    window.addEventListener("storage", syncStoredTheme);
    window.addEventListener(THEME_CHANGE_EVENT, syncSelectedTheme);
    return () => {
      window.removeEventListener("storage", syncStoredTheme);
      window.removeEventListener(THEME_CHANGE_EVENT, syncSelectedTheme);
    };
  }, []);

  const selectTheme = (nextTheme: string) => {
    const validTheme = isThemeId(nextTheme) ? nextTheme : DEFAULT_THEME_ID;
    applyTheme(validTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, validTheme);
    } catch {
      // The visual preference still applies for this page when storage is blocked.
    }

    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, { detail: validTheme }),
    );
  };

  return (
    <label className={`theme-control ${className}`.trim()}>
      <span>테마</span>
      <select
        aria-label="인쇄 테마"
        defaultValue={DEFAULT_THEME_ID}
        onChange={(event) => selectTheme(event.target.value)}
        ref={selectorRef}
      >
        {THEME_CATALOG.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.label}
          </option>
        ))}
      </select>
    </label>
  );
}
