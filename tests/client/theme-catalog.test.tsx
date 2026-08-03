import { describe, expect, it } from "vitest";

import {
  createThemeStylesheet,
  DEFAULT_THEME_ID,
  THEME_CATALOG,
  THEME_TOKEN_NAMES,
} from "../../app/lib/themes";

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return (
    0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
  );
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe("theme catalog", () => {
  it("keeps one restrained four-role palette in a complete catalog", () => {
    expect(DEFAULT_THEME_ID).toBe("riso");
    expect(THEME_CATALOG.map((theme) => theme.id)).toEqual(["riso"]);

    for (const theme of THEME_CATALOG) {
      expect(Object.keys(theme.tokens).toSorted()).toEqual(
        [...THEME_TOKEN_NAMES].toSorted(),
      );
    }

    const tokens = THEME_CATALOG[0].tokens;
    expect(tokens.sheet).toBe(tokens.stock);
    expect(tokens.inkYellow).toBe(tokens.inkPink);
    expect(tokens.overGreen).toBe(tokens.inkBlue);
    expect(
      new Set([tokens.stock, tokens.text, tokens.inkBlue, tokens.inkPink]).size,
    ).toBe(4);
  });

  it("generates selectors and readable base color pairs", () => {
    const stylesheet = createThemeStylesheet();

    for (const theme of THEME_CATALOG) {
      expect(stylesheet).toContain(`:root[data-theme="${theme.id}"]`);
      expect(stylesheet).toContain(`--stock:${theme.tokens.stock}`);
      expect(contrast(theme.tokens.text, theme.tokens.stock)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrast(theme.tokens.text, theme.tokens.sheet)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrast(theme.tokens.inkBlue, theme.tokens.stock),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
