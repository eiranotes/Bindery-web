export const SHELL_LOCALE_STORAGE_KEY = "bindery:shell-locale:v1";
export const DEFAULT_SHELL_LOCALE = "ko";

export const SHELL_LOCALES = ["ko", "en", "ja", "zh"] as const;

export type ShellLocale = (typeof SHELL_LOCALES)[number];

export const SHELL_LOCALE_OPTIONS = [
  { value: "ko", label: "한국어", lang: "ko" },
  { value: "en", label: "English", lang: "en" },
  { value: "ja", label: "日本語", lang: "ja" },
  { value: "zh", label: "中文", lang: "zh-Hans" },
] as const satisfies readonly {
  value: ShellLocale;
  label: string;
  lang: string;
}[];

export const SHELL_MESSAGES = {
  ko: {
    home: "Bindery 홈",
    primaryNavigation: "행사 주요 탐색",
    mobileNavigation: "모바일 탐색",
    supportingNavigation: "보조 탐색",
    events: "행사",
    compare: "비교",
    archive: "회차",
    notes: "준비 노트",
    news: "공식 소식",
    community: "커뮤니티 참고",
    binder: "내 바인더",
    calendar: "일정 달력",
    rss: "RSS",
    menu: "메뉴",
    language: "언어",
    tagline: "만드는 사람을 위한 행사와 준비 정보",
    localeScope: "언어 선택은 전역 탐색에 먼저 적용됩니다. 행사 본문은 현재 한국어입니다.",
    sourceNote: "행사 정보는 공식 원문과 확인 날짜를 함께 제공합니다. 신청 전 원문을 다시 확인하세요.",
  },
  en: {
    home: "Bindery home",
    primaryNavigation: "Primary event navigation",
    mobileNavigation: "Mobile navigation",
    supportingNavigation: "Supporting navigation",
    events: "Events",
    compare: "Compare",
    archive: "Editions",
    notes: "Prep notes",
    news: "Official news",
    community: "Community reference",
    binder: "My Binder",
    calendar: "Calendar",
    rss: "RSS",
    menu: "Menu",
    language: "Language",
    tagline: "Event and preparation information for independent creators",
    localeScope: "Language selection currently applies to global navigation. Event content remains in Korean.",
    sourceNote: "Event information includes official sources and verification dates. Recheck the original notice before applying.",
  },
  ja: {
    home: "Bindery ホーム",
    primaryNavigation: "イベント主要ナビゲーション",
    mobileNavigation: "モバイルナビゲーション",
    supportingNavigation: "補助ナビゲーション",
    events: "イベント",
    compare: "比較",
    archive: "開催履歴",
    notes: "準備ノート",
    news: "公式ニュース",
    community: "コミュニティ参考",
    binder: "マイバインダー",
    calendar: "予定表",
    rss: "RSS",
    menu: "メニュー",
    language: "言語",
    tagline: "クリエイター向けのイベントと準備情報",
    localeScope: "言語選択は現在グローバルナビゲーションに適用されます。イベント本文は韓国語です。",
    sourceNote: "イベント情報には公式ソースと確認日を表示します。申込前に原文を再確認してください。",
  },
  zh: {
    home: "Bindery 首页",
    primaryNavigation: "活动主导航",
    mobileNavigation: "移动端导航",
    supportingNavigation: "辅助导航",
    events: "活动",
    compare: "比较",
    archive: "往届档案",
    notes: "准备笔记",
    news: "官方资讯",
    community: "社区参考",
    binder: "我的收藏",
    calendar: "活动日历",
    rss: "RSS",
    menu: "菜单",
    language: "语言",
    tagline: "面向独立创作者的活动与准备信息",
    localeScope: "语言选择目前仅适用于全局导航。活动正文仍为韩语。",
    sourceNote: "活动信息会标注官方来源和核验日期。申请前请再次查看原始公告。",
  },
} as const;

export function isShellLocale(value: unknown): value is ShellLocale {
  return typeof value === "string" && SHELL_LOCALES.includes(value as ShellLocale);
}

export function shellMessages(locale: ShellLocale) {
  return SHELL_MESSAGES[locale];
}
