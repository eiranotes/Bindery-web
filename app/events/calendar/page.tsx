import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "../../components/PageIntro";
import { events } from "../../lib/data.ts";
import { eventDateParts, eventPath } from "../../lib/events.ts";

export const metadata: Metadata = {
  title: "행사 달력",
  description: "행사 신청 일정과 개최일을 월별로 확인합니다.",
};

type CalendarPageProps = {
  searchParams: Promise<{ month?: string }>;
};

function parseMonth(raw: string | undefined, now = new Date()) {
  const match = raw?.match(/^(\d{4})-(\d{2})$/);
  const current = eventDateParts(now.toISOString(), "Asia/Seoul");
  const year = match ? Number(match[1]) : current.year;
  const monthIndex = match ? Number(match[2]) - 1 : current.month - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return { year: current.year, monthIndex: current.month - 1 };
  }
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
  const weeks = Array.from({ length: 6 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const title = `${year}. ${String(monthIndex + 1).padStart(2, "0")}`;

  const entriesFor = (day: number) =>
    events.flatMap((event) => {
      const deadline = event.applicationDeadline
        ? eventDateParts(event.applicationDeadline, event.timeZone)
        : null;
      const start = eventDateParts(event.startDate, event.timeZone);
      const entries: { kind: "deadline" | "event"; label: string; href: string }[] =
        [];
      if (
        deadline &&
        deadline.year === year &&
        deadline.month === monthIndex + 1 &&
        deadline.date === day
      ) {
        entries.push({
          kind: "deadline",
          label: `${event.shortName} ${event.applicationDeadlineLabel ?? "신청 마감"}`,
          href: eventPath(event),
        });
      }
      if (
        start.year === year &&
        start.month === monthIndex + 1 &&
        start.date === day
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
        <div className="table-scroll calendar-scroll" role="region" aria-label={`${title} 달력 표`} tabIndex={0}>
          <table className="calendar-grid">
            <caption className="sr-only">{title} 신청 마감과 행사 시작 일정</caption>
            <thead>
              <tr>
                {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
                  <th className="calendar-weekday" scope="col" key={weekday}>{weekday}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, weekIndex) => (
                <tr key={`week-${weekIndex}`}>
                  {week.map((day, dayIndex) => (
                    <td
                      className={`calendar-day${day ? "" : " calendar-day--empty"}`}
                      key={`${day ?? "empty"}-${dayIndex}`}
                    >
                      {day ? (
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
                      ) : <span className="sr-only">해당 월 아님</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
