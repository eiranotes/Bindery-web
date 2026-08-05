import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "../../components/PageIntro";
import { events } from "../../lib/data.ts";
import { eventPath } from "../../lib/events.ts";

export const metadata: Metadata = {
  title: "행사 달력",
  description: "행사 신청 일정과 개최일을 월별로 확인합니다.",
};

type CalendarPageProps = {
  searchParams: Promise<{ month?: string }>;
};

function parseMonth(raw?: string) {
  const match = raw?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : 2026;
  const monthIndex = match ? Number(match[2]) - 1 : 7;
  if (monthIndex < 0 || monthIndex > 11) return { year: 2026, monthIndex: 7 };
  return { year, monthIndex };
}

function monthHref(year: number, monthIndex: number) {
  const value = new Date(year, monthIndex, 1);
  return `/events/calendar?month=${value.getFullYear()}-${String(
    value.getMonth() + 1,
  ).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const query = await searchParams;
  const { year, monthIndex } = parseMonth(query.month);
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const title = `${year}. ${String(monthIndex + 1).padStart(2, "0")}`;

  const entriesFor = (day: number) =>
    events.flatMap((event) => {
      const deadline = event.applicationDeadline
        ? new Date(event.applicationDeadline)
        : null;
      const start = new Date(event.startDate);
      const entries: { kind: "deadline" | "event"; label: string; href: string }[] =
        [];
      if (
        deadline &&
        deadline.getFullYear() === year &&
        deadline.getMonth() === monthIndex &&
        deadline.getDate() === day
      ) {
        entries.push({
          kind: "deadline",
          label: `${event.shortName} ${event.applicationDeadlineLabel ?? "신청 마감"}`,
          href: eventPath(event),
        });
      }
      if (
        start.getFullYear() === year &&
        start.getMonth() === monthIndex &&
        start.getDate() === day
      ) {
        entries.push({
          kind: "event",
          label: `${event.shortName} 시작`,
          href: eventPath(event),
        });
      }
      return entries;
    });

  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="EVENTS / CALENDAR"
        title="일정 달력"
        description="신청 일정과 개최일을 함께 봅니다."
      >
        <div className="intro-actions">
          <a className="button button--primary" href="/events/calendar.ics">
            ICS 일정 받기
          </a>
          <Link className="button" href="/events">
            목록으로 보기
          </Link>
        </div>
      </PageIntro>

      <section className="calendar-sheet" aria-labelledby="calendar-title">
        <div className="calendar-toolbar">
          <Link href={monthHref(year, monthIndex - 1)}>← 이전 달</Link>
          <h2 id="calendar-title">{title}</h2>
          <Link href={monthHref(year, monthIndex + 1)}>다음 달 →</Link>
        </div>
        <div className="calendar-legend" aria-label="일정 범례">
          <span className="calendar-legend__deadline">신청 일정</span>
          <span className="calendar-legend__event">행사 시작</span>
        </div>
        <div className="calendar-grid" role="group" aria-label={`${title} 달력`}>
          {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
            <div className="calendar-weekday" aria-hidden="true" key={weekday}>
              {weekday}
            </div>
          ))}
          {cells.map((day, index) => (
            <div
              className={`calendar-day${day ? "" : " calendar-day--empty"}`}
              aria-label={day ? `${monthIndex + 1}월 ${day}일` : undefined}
              aria-hidden={day ? undefined : true}
              key={`${day ?? "empty"}-${index}`}
            >
              {day && (
                <>
                  <span className="calendar-day__number">{day}</span>
                  <div className="calendar-day__entries">
                    {entriesFor(day).map((entry) => (
                      <Link
                        className={`calendar-entry calendar-entry--${entry.kind}`}
                        href={entry.href}
                        key={`${entry.kind}-${entry.href}`}
                      >
                        {entry.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
