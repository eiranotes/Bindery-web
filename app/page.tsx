import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "./components/AdSlot";
import { DDay } from "./components/DDay";
import { events } from "./lib/data.ts";
import { daysUntilDeadline } from "./lib/events.ts";

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
  const upcoming = [...events]
    .filter((event) => new Date(event.applicationDeadline) >= now)
    .sort(
      (left, right) =>
        new Date(left.applicationDeadline).getTime() -
        new Date(right.applicationDeadline).getTime(),
    );
  const deadlines = (upcoming.length >= 3 ? upcoming : events).slice(0, 3);
  const indexes = [
    {
      number: "01",
      href: "/events",
      title: "행사",
      copy: "마감·비용·회차",
    },
    {
      number: "02",
      href: "/notes",
      title: "노트",
      copy: "준비 기준",
    },
    {
      number: "03",
      href: "/groupbuy",
      title: "공동구매",
      copy: "진행 현황",
    },
    {
      number: "04",
      href: "/news",
      title: "소식",
      copy: "공식 공지",
    },
    {
      number: "05",
      href: "/community",
      title: "커뮤니티",
      copy: "질문·경험",
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
          <h2 id="deadline-title">신청 마감 임박</h2>
          <ol className="deadline-list">
            {deadlines.map((event) => (
              <li key={event.id}>
                <DDay days={daysUntilDeadline(event, now)} />
                <Link href={`/events/${event.slug}/${event.edition}`}>
                  <strong>{event.shortName}</strong>
                  <span>
                    {event.region} {event.venue} · {event.selection}
                  </span>
                </Link>
              </li>
            ))}
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

      <AdSlot placement="home-lower" />

      <div className="home-binder-link">
        <Link className="text-action" href="/me">
          내 바인더 열기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
