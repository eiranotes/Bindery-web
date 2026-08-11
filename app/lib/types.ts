export type EventStatus =
  | "upcoming"
  | "open"
  | "urgent"
  | "closed"
  | "unknown"
  | "soon"
  | "ongoing"
  | "ended";

export type EventGenre = "문구" | "일러스트" | "서브컬처" | "복합";
export type EventScale = "소형" | "중형" | "대형" | "확인 중";
export type ApplicationDeadlineKind = "final" | "early-bird" | "capacity";
export type ApplicationStatus = "scheduled" | "open" | "capacity" | "closed";
export type EventDataStatus =
  | "official"
  | "decision_ready"
  | "source_reachable"
  | "example";
export type EventFreshnessStatus = "fresh" | "stale" | "unknown";

export interface BoothOption {
  id: string;
  label: string;
  feeAmount: number | null;
  currency: string | null;
  size: string | null;
  vatIncluded: boolean | null;
  note: string | null;
  includes: string[];
}

export interface DecisionFieldCoverage {
  known: number;
  total: number;
  percent: number;
  missing: string[];
}

export interface EventHistory {
  id?: string;
  path?: string;
  edition: string;
  startDate?: string;
  endDate?: string;
  dates: string;
  venue: string | null;
  boothFee: number | null;
  boothFeeCurrency?: string | null;
  previousBoothFee?: number;
  booths: number | null;
  selection: string | null;
}

export interface EventEdition {
  id: string;
  masterId?: string;
  slug: string;
  edition: string;
  name: string;
  shortName: string;
  organizer: string;
  countryCode: string;
  countryName: string;
  city: string | null;
  timeZone: string;
  sourceLanguage: string;
  region: string;
  venue: string | null;
  address: string | null;
  startDate: string;
  endDate: string;
  applicationOpen: string | null;
  applicationDeadline: string | null;
  applicationDeadlineKind?: ApplicationDeadlineKind | null;
  applicationDeadlineLabel?: string | null;
  applicationStatus?: ApplicationStatus | null;
  boothFee: number | null;
  boothFeeCurrency: string | null;
  boothFeeIncludesVat?: boolean | null;
  boothSize: string | null;
  boothOptions?: BoothOption[];
  boothCount: number | null;
  selection: "선착순" | "추첨" | "심사" | null;
  businessRequired: boolean | null;
  genre: EventGenre;
  scale: EventScale;
  sourceUrl: string;
  sourceLabel: string;
  sourceCount?: number;
  evidenceCoverage?: number;
  decisionCoverage?: DecisionFieldCoverage;
  dataStatus?: EventDataStatus;
  sourceCheckedAt?: string | null;
  sourceRecheckDueAt?: string | null;
  reviewNeeded?: boolean;
  verifiedAt: string;
  summary: string;
  application: {
    documents: string[];
    resalePolicy: string | null;
    refundPolicy: string | null;
    note: string | null;
  };
  onsite: {
    loadIn: string | null;
    loadOut: string | null;
    electricity: string | null;
    wallUse: string | null;
    parking: string | null;
    logistics: string | null;
    fixtures: string | null;
  };
  history: EventHistory[];
  reviewCount: number;
  reviewAggregate?: {
    valueForFee: number;
    visitorDensity: number;
    returnIntent: number;
  };
}

export interface EventFilters {
  region: string;
  genre: string;
  scale: string;
  business: string;
  stage: "apply" | "upcoming" | "archived" | "all";
  data: "all" | "decision_ready" | "source_reachable";
  sort: "deadline" | "date";
}

export interface NoteSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  caution?: string;
}

export interface NoteFact {
  label: string;
  value: string;
  detail: string;
}

export interface NoteStep {
  marker: string;
  title: string;
  description: string;
}

export interface NoteSource {
  label: string;
  publisher: string;
  url: string;
  checkedAt: string;
  tier: "G1" | "G2";
  supports: string;
}

export interface Note {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
  publishedAt: string;
  updatedAt: string;
  readMinutes: number;
  isStale: boolean;
  legalNotice: boolean;
  guideType?: "official-guide";
  sourceCheckedAt?: string;
  reviewCadence?: string;
  audience?: string;
  facts?: NoteFact[];
  steps?: NoteStep[];
  warnings?: string[];
  sources?: NoteSource[];
  sections: NoteSection[];
  checklist: string[];
}

export interface Groupbuy {
  id: string;
  item: string;
  category: string;
  target: number;
  current: number;
  unit: string;
  estimatedPrice: string;
  deadline: string;
  status: "모집중" | "마감" | "발주완료" | "배송중" | "종료" | "무산";
  organizer: string;
  organizerHistory: {
    completed: number;
    failed: number;
  };
  settlement: string;
  delivery: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  category: string;
}
