export const THEME_STORAGE_KEY = "bindery:theme:v1";
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
  fontDisplay: '"Hahmlet"',
  fontBody: '"IBM Plex Sans KR"',
  fontUtility: '"Space Mono"',
} satisfies Pick<
  ThemeTokens,
  "fontDisplay" | "fontBody" | "fontUtility"
>;

export const THEME_CATALOG = [
  {
    id: "riso",
    label: "리소 원색",
    description: "파랑·분홍·노랑의 현재 바인더리 인쇄색",
    tokens: {
      stock: "#e7e6e0",
      stockDeep: "#dcdad2",
      sheet: "#f4f3ef",
      inkBlue: "#3d5588",
      inkPink: "#ff48b0",
      inkYellow: "#ffe800",
      overViolet: "#2e2a6b",
      overGreen: "#647224",
      text: "#1b1d2a",
      textSoft: "#5a5f72",
      textFaint: "#606577",
      rule: "#c9c7be",
      ruleInk: "rgb(61 85 136 / 28%)",
      ...sharedFonts,
    },
  },
  {
    id: "carbon-proof",
    label: "먹지 교정",
    description: "차분한 먹지색과 교정 표시를 위한 저채도 인쇄색",
    tokens: {
      stock: "#e6e9e7",
      stockDeep: "#d5d9d6",
      sheet: "#f6f7f4",
      inkBlue: "#263d55",
      inkPink: "#b33d55",
      inkYellow: "#c4d539",
      overViolet: "#3e365f",
      overGreen: "#556426",
      text: "#171b20",
      textSoft: "#4d5660",
      textFaint: "#59636b",
      rule: "#b9c0bc",
      ruleInk: "rgb(38 61 85 / 28%)",
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

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    THEME_CATALOG.some((theme) => theme.id === value)
  );
}

export function createThemeStylesheet(): string {
  return THEME_CATALOG.map((theme) => {
    const declarations = THEME_TOKEN_NAMES.map(
      (token) => `${cssVariableNames[token]}:${theme.tokens[token]};`,
    ).join("");
    return `:root[data-theme="${theme.id}"]{${declarations}}`;
  }).join("\n");
}

export function createThemeBootstrapScript(): string {
  const themeIds = JSON.stringify(THEME_CATALOG.map((theme) => theme.id));
  return `(function(){var fallback=${JSON.stringify(DEFAULT_THEME_ID)};try{var saved=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.dataset.theme=${themeIds}.includes(saved)?saved:fallback;}catch(error){document.documentElement.dataset.theme=fallback;}})();`;
}
