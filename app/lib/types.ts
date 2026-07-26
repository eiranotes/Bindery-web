export type EventStatus =
  | "upcoming"
  | "open"
  | "urgent"
  | "closed"
  | "soon"
  | "ended";

export type EventGenre = "문구" | "일러스트" | "서브컬처" | "복합";
export type EventScale = "소형" | "중형" | "대형";

export interface EventHistory {
  edition: string;
  dates: string;
  venue: string;
  boothFee: number;
  previousBoothFee?: number;
  booths: number;
  selection: string;
}

export interface EventEdition {
  id: string;
  slug: string;
  edition: string;
  name: string;
  shortName: string;
  organizer: string;
  region: string;
  venue: string;
  address: string;
  startDate: string;
  endDate: string;
  applicationOpen: string;
  applicationDeadline: string;
  boothFee: number;
  boothSize: string;
  boothCount: number;
  selection: "선착순" | "추첨" | "심사";
  businessRequired: boolean;
  genre: EventGenre;
  scale: EventScale;
  sourceUrl: string;
  sourceLabel: string;
  verifiedAt: string;
  summary: string;
  application: {
    documents: string[];
    resalePolicy: string;
    refundPolicy: string;
    note: string;
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
  sort: "deadline" | "date";
}

export interface NoteSection {
  heading: string;
  paragraphs: string[];
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

export type CommunityRecordKind = "준비 질문" | "현장 팁" | "후기 집계";

export interface CommunityRecord {
  id: string;
  eventId: string;
  kind: CommunityRecordKind;
  title: string;
  summary: string;
  answer: string;
  updatedAt: string;
  tags: string[];
  moderation: "운영자 검수";
}
