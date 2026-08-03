"use client";

import { useSyncExternalStore } from "react";

import {
  DEFAULT_SHELL_LOCALE,
  isShellLocale,
  SHELL_LOCALE_STORAGE_KEY,
  shellMessages,
  type ShellLocale,
} from "../lib/i18n";

const SHELL_LOCALE_CHANGE_EVENT = "bindery:shell-locale-change";

function storedLocale(): ShellLocale {
  try {
    const value = localStorage.getItem(SHELL_LOCALE_STORAGE_KEY);
    return isShellLocale(value) ? value : DEFAULT_SHELL_LOCALE;
  } catch {
    return DEFAULT_SHELL_LOCALE;
  }
}

function currentLocale(): ShellLocale {
  const applied = document.documentElement.dataset.shellLocale;
  if (isShellLocale(applied)) return applied;
  const nextLocale = storedLocale();
  document.documentElement.dataset.shellLocale = nextLocale;
  return nextLocale;
}

function subscribeToLocale(notify: () => void) {
  const syncStoredLocale = (event: StorageEvent) => {
    if (event.key !== SHELL_LOCALE_STORAGE_KEY && event.key !== null) return;
    document.documentElement.dataset.shellLocale = isShellLocale(event.newValue)
      ? event.newValue
      : DEFAULT_SHELL_LOCALE;
    notify();
  };
  const syncSelectedLocale = () => notify();

  window.addEventListener("storage", syncStoredLocale);
  window.addEventListener(SHELL_LOCALE_CHANGE_EVENT, syncSelectedLocale);
  return () => {
    window.removeEventListener("storage", syncStoredLocale);
    window.removeEventListener(SHELL_LOCALE_CHANGE_EVENT, syncSelectedLocale);
  };
}

export function useShellLocale() {
  const locale = useSyncExternalStore<ShellLocale>(
    subscribeToLocale,
    currentLocale,
    () => DEFAULT_SHELL_LOCALE,
  );

  const selectLocale = (value: string) => {
    const nextLocale = isShellLocale(value) ? value : DEFAULT_SHELL_LOCALE;
    document.documentElement.dataset.shellLocale = nextLocale;

    try {
      localStorage.setItem(SHELL_LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // The current page can still use the selected shell language.
    }

    window.dispatchEvent(
      new CustomEvent(SHELL_LOCALE_CHANGE_EVENT, { detail: nextLocale }),
    );
  };

  return {
    locale,
    messages: shellMessages(locale),
    selectLocale,
  };
}
