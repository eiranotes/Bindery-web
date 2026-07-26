import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeControl } from "../../app/components/ThemeControl";
import {
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
} from "../../app/lib/themes";

describe("ThemeControl", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("applies and remembers a catalog selection", async () => {
    render(<ThemeControl />);

    const selector = screen.getByRole("combobox", { name: "인쇄 테마" });
    expect((selector as HTMLSelectElement).value).toBe(DEFAULT_THEME_ID);
    expect(screen.getByRole("option", { name: "리소 원색" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "먹지 교정" })).toBeTruthy();

    fireEvent.change(selector, { target: { value: "carbon-proof" } });

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("carbon-proof");
    });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("carbon-proof");
  });

  it("falls back safely when the stored id is not in the catalog", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "unknown-theme");

    render(<ThemeControl />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);
    });
    expect(
      (
        screen.getByRole("combobox", {
          name: "인쇄 테마",
        }) as HTMLSelectElement
      ).value,
    ).toBe(DEFAULT_THEME_ID);
  });

  it("restores a valid preference and follows cross-tab storage changes", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "carbon-proof");
    render(<ThemeControl />);

    const selector = screen.getByRole("combobox", {
      name: "인쇄 테마",
    }) as HTMLSelectElement;

    await waitFor(() => {
      expect(selector.value).toBe("carbon-proof");
      expect(document.documentElement.dataset.theme).toBe("carbon-proof");
    });

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: DEFAULT_THEME_ID,
      }),
    );
    await waitFor(() => {
      expect(selector.value).toBe(DEFAULT_THEME_ID);
    });

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: "carbon-proof",
      }),
    );
    await waitFor(() => {
      expect(selector.value).toBe("carbon-proof");
    });

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: null,
        newValue: null,
      }),
    );
    await waitFor(() => {
      expect(selector.value).toBe(DEFAULT_THEME_ID);
      expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);
    });
  });

  it("keeps desktop and mobile selectors synchronized in the same tab", async () => {
    render(
      <>
        <ThemeControl className="theme-control--desktop" />
        <ThemeControl className="theme-control--mobile" />
      </>,
    );

    const selectors = screen.getAllByRole("combobox", {
      name: "인쇄 테마",
    }) as HTMLSelectElement[];

    fireEvent.change(selectors[0], {
      target: { value: "carbon-proof" },
    });

    await waitFor(() => {
      expect(selectors.map((selector) => selector.value)).toEqual([
        "carbon-proof",
        "carbon-proof",
      ]);
    });
  });
});
