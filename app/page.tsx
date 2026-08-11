import type { Metadata } from "next";
import Link from "next/link";
import { DDay } from "./components/DDay";
import { events } from "./lib/data.ts";
import {
  deriveEventStatus,
  eventDataLabel,
  eventTime,
  nextEventMilestone,
} from "./lib/events.ts";

export const metadata: Metadata = {
  title: "창작자 행사 마감·회차 아카이브",
  description:
    "한국 독립 창작자 행사의 신청 마감, 참가 조건과 회차별 변화를 비교하세요.",
};

export default function Home() {
  const now = new Date();
  const today = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
  const todayIso = now.toLocaleDateString("sv-SE", {
    timeZone: "Asia/Seoul",
  });
  const allDeadlines = [...events]
    .filter((event) => {
      const deadline = eventTime(event.applicationDeadline, true, event.timeZone);
      return (
        deriveEventStatus(event, now) !== "ended" &&
        deadline !== null &&
        deadline >= now.getTime()
      );
    })
    .sort(
      (left, right) =>
        (eventTime(left.applicationDeadline, true, left.timeZone) as number) -
        (eventTime(right.applicationDeadline, true, right.timeZone) as number),
    );
  const deadlines = allDeadlines.slice(0, 3);
  const finalDeadlineCount = allDeadlines.filter(
    (event) => (event.applicationDeadlineKind ?? "final") === "final",
  ).length;
  const indexes = [
    {
      number: "01",
      href: "/events",
      title: "행사 찾기",
      copy: "마감·비용·조건",
    },
    {
      number: "02",
      href: "/events/compare",
      title: "행사 비교",
      copy: "조건 나란히 보기",
    },
    {
      number: "03",
      href: "/events/archive",
      title: "회차 아카이브",
      copy: "지난 회차 변화",
    },
    {
      number: "04",
      href: "/notes",
      title: "준비 노트",
      copy: "세금·발주·통관",
    },
  ];

  return (
    <div className="page-shell home-page">
      <section className="mockup-hero" aria-labelledby="home-title">
        <div className="mockup-hero__copy">
          <p className="eyebrow">
            오늘 · <time dateTime={todayIso}>{today}</time>
          </p>
          <h1 id="home-title">
            지금 지원할 수 있는
            <br />
            <em>창작 행사를 찾습니다.</em>
          </h1>
          <p>
            부스 유형·비용·자격·최종 마감과 지난 회차 변경점을 공식
            원문까지 추적하는 참가 기회 레지스트리.
          </p>
          <p className="home-opportunity-summary">
            현재 확인된 지원 일정 {allDeadlines.length}건 · 최종 마감 {finalDeadlineCount}건 ·{" "}
            <time dateTime={todayIso}>{todayIso} 기준</time>
          </p>
          <div className="intro-actions">
            <Link className="button button--primary" href="/events/compare">
              행사 비교하기
            </Link>
            <Link className="button" href="/events/archive">
              회차 아카이브 보기
            </Link>
          </div>
        </div>

        <aside className="mockup-deadline" aria-labelledby="deadline-title">
          <h2 id="deadline-title">다가오는 지원 일정</h2>
          <ol className="deadline-list">
            {deadlines.map((event) => {
              const milestone = nextEventMilestone(event, now);
              return <li key={event.id}>
                <DDay days={milestone.days ?? 0} label={`${event.shortName} ${milestone.label}`} />
                <Link href={`/events/${event.slug}/${event.edition}`}>
                  <strong>{event.shortName}</strong>
                  <span>
                    {milestone.label} · {eventDataLabel(event, now)}
                  </span>
                </Link>
              </li>;
            })}
          </ol>
          {deadlines.length === 0 ? (
            <p className="empty-state">현재 확인된 미래 신청 일정이 없습니다.</p>
          ) : null}
          <p className="mockup-deadline__note">
            신청 전 공식 공지를 확인하세요.
          </p>
        </aside>
      </section>

      <nav className="home-index" aria-label="정보 모음">
        {indexes.map((item) => (
          <Link key={item.href} href={item.href}>
            <span className="list-number">{item.number}</span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.copy}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>

      <nav className="home-support" aria-label="보조 정보">
        <span>SUPPORTING</span>
        <Link href="/news">행사 변경 기록</Link>
        <Link href="/events/calendar">일정 달력</Link>
        <Link href="/community">커뮤니티 참고</Link>
      </nav>

      <div className="home-binder-link">
        <Link className="text-action" href="/me">
          내 바인더 열기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
