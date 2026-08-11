export const DEFAULT_THEME_ID = "riso";

export const THEME_TOKEN_NAMES = [
  "stock",
  "stockDeep",
  "sheet",
  "inkBlue",
  "inkPink",
  "inkYellow",
  "overViolet",
  "overGreen",
  "text",
  "textSoft",
  "textFaint",
  "rule",
  "ruleInk",
  "fontDisplay",
  "fontBody",
  "fontUtility",
] as const;

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];
export type ThemeId = (typeof THEME_CATALOG)[number]["id"];

type ThemeTokens = Record<ThemeTokenName, string>;

type ThemeDefinition = {
  id: string;
  label: string;
  description: string;
  tokens: ThemeTokens;
};

const sharedFonts = {
  fontDisplay: '"Hahmlet", "AppleMyungjo", "Batang", serif',
  fontBody: '"IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif',
  fontUtility: '"Space Mono", "SFMono-Regular", Menlo, monospace',
} satisfies Pick<
  ThemeTokens,
  "fontDisplay" | "fontBody" | "fontUtility"
>;

export const THEME_CATALOG = [
  {
    id: "riso",
    label: "Bindery 리소",
    description: "중성 용지와 파랑·분홍만 쓰는 절제된 행사 정보 팔레트",
    tokens: {
      stock: "#F4F3EF",
      stockDeep: "color-mix(in srgb, #1B1D2A 7%, #F4F3EF)",
      sheet: "#F4F3EF",
      inkBlue: "#3D5588",
      inkPink: "#FF48B0",
      inkYellow: "#FF48B0",
      overViolet: "color-mix(in srgb, #1B1D2A 18%, #3D5588)",
      overGreen: "#3D5588",
      text: "#1B1D2A",
      textSoft: "color-mix(in srgb, #1B1D2A 78%, #F4F3EF)",
      textFaint: "color-mix(in srgb, #1B1D2A 70%, #F4F3EF)",
      rule: "color-mix(in srgb, #1B1D2A 20%, #F4F3EF)",
      ruleInk: "color-mix(in srgb, #3D5588 36%, transparent)",
      ...sharedFonts,
    },
  },
] as const satisfies readonly ThemeDefinition[];

const cssVariableNames: Record<ThemeTokenName, string> = {
  stock: "--stock",
  stockDeep: "--stock-deep",
  sheet: "--sheet",
  inkBlue: "--ink-blue",
  inkPink: "--ink-pink",
  inkYellow: "--ink-yellow",
  overViolet: "--over-violet",
  overGreen: "--over-green",
  text: "--text",
  textSoft: "--text-soft",
  textFaint: "--text-faint",
  rule: "--rule",
  ruleInk: "--rule-ink",
  fontDisplay: "--font-display",
  fontBody: "--font-body",
  fontUtility: "--font-utility",
};

export function createThemeStylesheet(): string {
  return THEME_CATALOG.map((theme) => {
    const declarations = THEME_TOKEN_NAMES.map(
      (token) => `${cssVariableNames[token]}:${theme.tokens[token]};`,
    ).join("");
    return `:root[data-theme="${theme.id}"]{${declarations}}`;
  }).join("\n");
}
