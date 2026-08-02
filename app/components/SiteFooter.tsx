import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>
          <strong>BINDERY</strong>
          <span>만드는 사람을 위한 행사와 준비 정보</span>
        </p>
        <nav aria-label="보조 탐색">
          <Link href="/events/calendar">일정 달력</Link>
          <Link href="/community/rules">커뮤니티 운영 기준</Link>
          <Link href="/rss.xml">RSS</Link>
        </nav>
        <p className="site-footer__note">
          예시 데이터입니다. 신청 전 공식 원문을 확인하세요.
        </p>
      </div>
    </footer>
  );
}
