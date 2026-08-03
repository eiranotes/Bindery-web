"use client";

import { useId } from "react";

import { SHELL_LOCALE_OPTIONS } from "../lib/i18n";
import { useShellLocale } from "./useShellLocale";

type LocaleControlProps = {
  className?: string;
};

export function LocaleControl({ className = "" }: LocaleControlProps) {
  const descriptionId = useId();
  const { locale, messages, selectLocale } = useShellLocale();

  return (
    <label className={`locale-control ${className}`.trim()} title={messages.localeScope}>
      <span>{messages.language}</span>
      <select
        aria-describedby={descriptionId}
        aria-label={messages.language}
        onChange={(event) => selectLocale(event.target.value)}
        value={locale}
      >
        {SHELL_LOCALE_OPTIONS.map((option) => (
          <option key={option.value} lang={option.lang} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="sr-only" id={descriptionId}>
        {messages.localeScope}
      </span>
    </label>
  );
}
