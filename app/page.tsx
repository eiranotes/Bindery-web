import type { Metadata } from "next";
import Link from "next/link";
import { DDay } from "./components/DDay";
import { events } from "./lib/data.ts";
import { daysUntilDeadline } from "./lib/events.ts";

export const metadata: Metadata = {
  title: "만드는 사람의 다음 일정을, 한 장에",
  description:
    "가장 가까운 행사 마감과 창작 준비 정보를 조용한 한 장의 플래너로 확인하세요.",
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
      copy: "신청 마감과 지난 회차를 비교해요.",
    },
    {
      number: "02",
      href: "/notes",
      title: "노트",
      copy: "기록하고 싶은 준비 정보를 모았어요.",
    },
    {
      number: "03",
      href: "/groupbuy",
      title: "공동구매",
      copy: "함께 쓰면 좋은 물건의 현황을 살펴요.",
    },
    {
      number: "04",
      href: "/news",
      title: "소식",
      copy: "새로운 공지와 변화를 원문으로 전해요.",
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
          <p>
            문구·일러스트 굿즈를 혼자 만들고 파는 사람을 위한 정보
            바인더입니다. 지금 필요한 일정과 준비 기준만 간결하게 모았습니다.
          </p>
          <div className="intro-actions">
            <Link className="button button--primary" href="/events">
              행사 전체 보기
            </Link>
            <a className="button" href="/events/calendar.ics">
              캘린더 구독하기
            </a>
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
            마감일은 주최측 공지 기준입니다. 신청 전 공식 페이지를 확인하세요.
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

      <div className="home-binder-link">
        <Link className="text-action" href="/me">
          내 바인더 열기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
