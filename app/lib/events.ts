import type {
  EventEdition,
  EventFilters,
  EventFreshnessStatus,
  EventStatus,
} from "./types";

const day = 24 * 60 * 60 * 1000;

const timeZoneOffsets: Record<string, string> = {
  "Asia/Seoul": "+09:00",
  "Asia/Tokyo": "+09:00",
  "Asia/Taipei": "+08:00",
  "Asia/Shanghai": "+08:00",
};

export function eventTime(
  value: string | null,
  endOfDay = false,
  timeZone = "Asia/Seoul",
): number | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const offset = timeZoneOffsets[timeZone] ?? "+00:00";
    return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}${offset}`).getTime();
  }
  return new Date(value).getTime();
}

export function deriveEventStatus(
  event: EventEdition,
  now = new Date(),
): EventStatus {
  const current = now.getTime();
  const applicationOpen = eventTime(event.applicationOpen, false, event.timeZone);
  const deadline = eventTime(event.applicationDeadline, true, event.timeZone);
  const start = eventTime(event.startDate, false, event.timeZone) as number;
  const end = eventTime(event.endDate, true, event.timeZone) as number;
  const deadlineIsFinal = (event.applicationDeadlineKind ?? "final") === "final";

  if (current > end) return "ended";
  if (current >= start) return "ongoing";
  if (event.applicationStatus === "closed") {
    return start - current <= 14 * day ? "soon" : "closed";
  }
  if (deadlineIsFinal && deadline !== null && current > deadline && start - current <= 14 * day) {
    return "soon";
  }
  if (deadlineIsFinal && deadline !== null && current > deadline) return "closed";
  if (applicationOpen !== null && current < applicationOpen) return "upcoming";
  if (deadline !== null && current <= deadline && deadline - current <= 14 * day) return "urgent";
  if (event.applicationStatus === "scheduled") return "upcoming";
  if (event.applicationStatus === "open" || event.applicationStatus === "capacity") return "open";
  return "unknown";
}

export function daysUntilDeadline(
  event: EventEdition,
  now = new Date(),
): number | null {
  const deadline = eventTime(event.applicationDeadline, true, event.timeZone);
  if (deadline === null) return null;
  if (deadline < now.getTime()) return null;
  return Math.ceil((deadline - now.getTime()) / day);
}

export type EventMilestone = {
  date: string;
  days: number | null;
  label: string;
  kind: "application" | "event";
  state: "future" | "current" | "past";
};

export function nextEventMilestone(
  event: EventEdition,
  now = new Date(),
): EventMilestone {
  const deadline = eventTime(event.applicationDeadline, true, event.timeZone);
  if (deadline !== null && event.applicationDeadline && deadline >= now.getTime()) {
    return {
      date: event.applicationDeadline,
      days: daysUntilDeadline(event, now) ?? 0,
      label: event.applicationDeadlineLabel ?? "접수 마감",
      kind: "application" as const,
      state: "future",
    };
  }
  const start = eventTime(event.startDate, false, event.timeZone) as number;
  if (start >= now.getTime()) {
    return {
      date: event.startDate,
      days: daysUntilEvent(event, now),
      label: "행사 시작",
      kind: "event" as const,
      state: "future",
    };
  }
  const end = eventTime(event.endDate, true, event.timeZone) as number;
  if (end >= now.getTime()) {
    return {
      date: event.endDate,
      days: Math.ceil((end - now.getTime()) / day),
      label: "행사 종료",
      kind: "event" as const,
      state: "current",
    };
  }
  return {
    date: event.endDate,
    days: null,
    label: "행사 종료",
    kind: "event" as const,
    state: "past",
  };
}

export function daysUntilEvent(
  event: EventEdition,
  now = new Date(),
): number {
  const start = eventTime(event.startDate, false, event.timeZone) as number;
  return Math.max(
    0,
    Math.ceil((start - now.getTime()) / day),
  );
}

export function filterEvents(
  source: EventEdition[],
  filters: EventFilters,
  now = new Date(),
): EventEdition[] {
  const filtered = source.filter((event) => {
    const status = deriveEventStatus(event, now);
    const stage =
      status === "ended"
        ? "archived"
        : status === "open" || status === "urgent" || status === "upcoming"
          ? "apply"
          : "upcoming";
    if (filters.stage !== "all" && filters.stage !== stage) return false;
    if (
      filters.data === "decision_ready" &&
      (!isDecisionReady(event, now) || isEventDataStale(event, now))
    ) {
      return false;
    }
    if (
      filters.data === "source_reachable" &&
      isDecisionReady(event, now) &&
      !isEventDataStale(event, now)
    ) {
      return false;
    }
    if (filters.region !== "전체" && event.region !== filters.region) {
      return false;
    }
    if (filters.genre !== "전체" && event.genre !== filters.genre) {
      return false;
    }
    if (filters.scale !== "전체" && event.scale !== filters.scale) {
      return false;
    }
    if (
      filters.business !== "전체" &&
      String(event.businessRequired) !== filters.business
    ) {
      return false;
    }
    return true;
  });

  return filtered.toSorted((left, right) => {
    if (filters.sort === "date") {
      return (
        new Date(left.startDate).getTime() -
        new Date(right.startDate).getTime()
      );
    }

    const leftStatus = deriveEventStatus(left, now);
    const rightStatus = deriveEventStatus(right, now);
    const leftIsPast = leftStatus === "ended" ? 1 : 0;
    const rightIsPast = rightStatus === "ended" ? 1 : 0;

    if (leftIsPast !== rightIsPast) return leftIsPast - rightIsPast;
    return (
      (eventTime(nextEventMilestone(left, now).date, true, left.timeZone) as number) -
      (eventTime(nextEventMilestone(right, now).date, true, right.timeZone) as number)
    );
  });
}

export function getEventByPath(
  slug: string,
  edition: string,
  source: EventEdition[] = [],
): EventEdition | undefined {
  const candidates = source.length
    ? source
    : // Imported lazily by callers in normal app code; tests pass the canonical
      // collection through the default module import below.
      defaultEvents;
  return candidates.find(
    (event) => event.slug === slug && event.edition === edition,
  );
}

import { events as defaultEvents } from "./data.ts";

export function formatDate(
  value: string | null,
  options: Intl.DateTimeFormatOptions = {
    month: "2-digit",
    day: "2-digit",
  },
  timeZone = "Asia/Seoul",
): string {
  if (!value) return "정보 없음";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    ...options,
  }).format(date);
}

export function formatDateRange(event: EventEdition): string {
  const start = formatDate(event.startDate, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }, event.timeZone);
  const end = formatDate(event.endDate, {
    month: "2-digit",
    day: "2-digit",
  }, event.timeZone);
  return `${start} – ${end}`;
}

export function eventDateParts(value: string, timeZone: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, date] = value.split("-").map(Number);
    return { year, month, date };
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), date: part("day") };
}

export function getEventFreshness(
  event: EventEdition,
  now = new Date(),
): EventFreshnessStatus {
  if (!event.sourceRecheckDueAt) return "unknown";
  return new Date(event.sourceRecheckDueAt).getTime() < now.getTime()
    ? "stale"
    : "fresh";
}

export function isEventDataStale(event: EventEdition, now = new Date()) {
  return getEventFreshness(event, now) === "stale";
}

export function isDecisionReady(event: EventEdition, now = new Date()) {
  return (event.decisionCoverage?.percent ?? 0) >= 80 && !isEventDataStale(event, now);
}

export function eventDataLabel(event: EventEdition, now = new Date()) {
  if (isEventDataStale(event, now)) return "재확인 필요";
  if (event.dataStatus === "official") {
    return isDecisionReady(event, now)
      ? "편집 검수된 공식 정보 · 참가 판단 가능"
      : "편집 검수된 공식 정보";
  }
  if (isDecisionReady(event, now)) return "참가 판단 가능";
  return "공식 일정 확인";
}

export function formatCurrency(value: number | null, currency = "KRW"): string {
  if (value === null) return "정보 없음";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export const statusLabels: Record<EventStatus, string> = {
  upcoming: "접수 예정",
  open: "접수 중",
  urgent: "마감 임박",
  closed: "접수 마감",
  unknown: "접수 정보 없음",
  soon: "개최 임박",
  ongoing: "진행 중",
  ended: "종료",
};

export function eventPath(event: EventEdition): string {
  return `/events/${event.slug}/${event.edition}`;
}
