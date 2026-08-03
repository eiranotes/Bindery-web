import type {
  EventEdition,
  EventFilters,
  EventStatus,
} from "./types";

const day = 24 * 60 * 60 * 1000;

function eventTime(value: string, endOfDay = false): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+09:00`).getTime();
  }
  return new Date(value).getTime();
}

export function deriveEventStatus(
  event: EventEdition,
  now = new Date(),
): EventStatus {
  const current = now.getTime();
  const applicationOpen = eventTime(event.applicationOpen);
  const deadline = eventTime(event.applicationDeadline, true);
  const start = eventTime(event.startDate);
  const end = eventTime(event.endDate, true);
  const deadlineIsFinal = (event.applicationDeadlineKind ?? "final") === "final";

  if (current > end) return "ended";
  if (current >= start) return "ongoing";
  if (event.applicationStatus === "closed") {
    return start - current <= 14 * day ? "soon" : "closed";
  }
  if (deadlineIsFinal && current > deadline && start - current <= 14 * day) {
    return "soon";
  }
  if (deadlineIsFinal && current > deadline) return "closed";
  if (current < applicationOpen) return "upcoming";
  if (current <= deadline && deadline - current <= 14 * day) return "urgent";
  return "open";
}

export function daysUntilDeadline(
  event: EventEdition,
  now = new Date(),
): number {
  return Math.max(
    0,
    Math.ceil(
      (eventTime(event.applicationDeadline, true) - now.getTime()) / day,
    ),
  );
}

export function nextEventMilestone(event: EventEdition, now = new Date()) {
  const deadline = eventTime(event.applicationDeadline, true);
  if (deadline >= now.getTime()) {
    return {
      date: event.applicationDeadline,
      days: daysUntilDeadline(event, now),
      label: event.applicationDeadlineLabel ?? "접수 마감",
      kind: "application" as const,
    };
  }
  return {
    date: event.startDate,
    days: daysUntilEvent(event, now),
    label: "행사 시작",
    kind: "event" as const,
  };
}

export function daysUntilEvent(
  event: EventEdition,
  now = new Date(),
): number {
  return Math.max(
    0,
    Math.ceil((eventTime(event.startDate) - now.getTime()) / day),
  );
}

export function filterEvents(
  source: EventEdition[],
  filters: EventFilters,
  now = new Date(),
): EventEdition[] {
  const filtered = source.filter((event) => {
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
    return eventTime(nextEventMilestone(left, now).date, true) - eventTime(nextEventMilestone(right, now).date, true);
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
  value: string,
  options: Intl.DateTimeFormatOptions = {
    month: "2-digit",
    day: "2-digit",
  },
): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...options,
  }).format(new Date(value));
}

export function formatDateRange(event: EventEdition): string {
  const start = formatDate(event.startDate, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const end = formatDate(event.endDate, {
    month: "2-digit",
    day: "2-digit",
  });
  return `${start} – ${end}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export const statusLabels: Record<EventStatus, string> = {
  upcoming: "접수 예정",
  open: "접수 중",
  urgent: "마감 임박",
  closed: "접수 마감",
  soon: "개최 임박",
  ongoing: "진행 중",
  ended: "종료",
};

export function eventPath(event: EventEdition): string {
  return `/events/${event.slug}/${event.edition}`;
}
