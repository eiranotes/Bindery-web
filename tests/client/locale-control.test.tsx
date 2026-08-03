import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { LocaleControl } from "../../app/components/LocaleControl";
import {
  DEFAULT_SHELL_LOCALE,
  SHELL_LOCALE_STORAGE_KEY,
} from "../../app/lib/i18n";

function asSelect(element: HTMLElement) {
  return element as unknown as HTMLSelectElement;
}

describe("LocaleControl", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.shellLocale;
  });

  it("uses self-named language options and synchronizes the global shell", async () => {
    render(
      <>
        <LocaleControl className="locale-control--desktop" />
        <LocaleControl className="locale-control--mobile" />
      </>,
    );

    const selectors = screen
      .getAllByRole("combobox", { name: "언어" })
      .map(asSelect);
    expect(selectors.map((selector) => selector.value)).toEqual(["ko", "ko"]);
    expect(screen.getAllByRole("option", { name: "English" })).toHaveLength(2);
    expect(
      screen.getAllByRole("option", { name: "日本語" })[0].getAttribute("lang"),
    ).toBe("ja");
    expect(
      screen.getAllByRole("option", { name: "中文" })[0].getAttribute("lang"),
    ).toBe("zh-Hans");

    fireEvent.change(selectors[0], { target: { value: "en" } });

    await waitFor(() => {
      expect(document.documentElement.dataset.shellLocale).toBe("en");
      expect(
        screen
          .getAllByRole("combobox", { name: "Language" })
          .map(asSelect)
          .map((selector) => selector.value),
      ).toEqual(["en", "en"]);
    });
    expect(localStorage.getItem(SHELL_LOCALE_STORAGE_KEY)).toBe("en");
  });

  it("falls back safely for an unsupported stored locale", async () => {
    localStorage.setItem(SHELL_LOCALE_STORAGE_KEY, "fr");
    render(<LocaleControl />);

    await waitFor(() => {
      expect(document.documentElement.dataset.shellLocale).toBe(DEFAULT_SHELL_LOCALE);
    });
    expect(asSelect(screen.getByRole("combobox", { name: "언어" })).value).toBe("ko");
  });

  it("follows valid cross-tab storage changes without changing page language", async () => {
    render(<LocaleControl />);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SHELL_LOCALE_STORAGE_KEY,
        newValue: "ja",
      }),
    );

    await waitFor(() => {
      expect(asSelect(screen.getByRole("combobox", { name: "言語" })).value).toBe("ja");
    });
    expect(document.documentElement.lang).not.toBe("ja");
  });
});
