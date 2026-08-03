import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "./components/AdSlot";
import { DDay } from "./components/DDay";
import { events } from "./lib/data.ts";
import { nextEventMilestone } from "./lib/events.ts";

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
  const deadlines = [...events]
    .sort(
      (left, right) =>
        new Date(nextEventMilestone(left, now).date).getTime() -
        new Date(nextEventMilestone(right, now).date).getTime(),
    )
    .slice(0, 3);
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
      copy: "신청·현장 기준",
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
            신청 마감을 놓치면
            <br />
            <em>1년을 기다립니다.</em>
          </h1>
          <p>창작자 행사의 회차·부스비·신청 조건을 쌓는 아카이브.</p>
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
          <h2 id="deadline-title">다가오는 신청·행사 일정</h2>
          <ol className="deadline-list">
            {deadlines.map((event) => {
              const milestone = nextEventMilestone(event, now);
              return <li key={event.id}>
                <DDay days={milestone.days} label={`${event.shortName} ${milestone.label}`} />
                <Link href={`/events/${event.slug}/${event.edition}`}>
                  <strong>{event.shortName}</strong>
                  <span>
                    {milestone.label} · {event.region} {event.venue}
                  </span>
                </Link>
              </li>;
            })}
          </ol>
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
        <Link href="/news">공식 소식</Link>
        <Link href="/events/calendar">일정 달력</Link>
        <Link href="/community">커뮤니티 참고</Link>
      </nav>

      <AdSlot placement="home-lower" />

      <div className="home-binder-link">
        <Link className="text-action" href="/me">
          내 바인더 열기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
