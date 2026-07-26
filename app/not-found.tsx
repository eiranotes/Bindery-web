import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell not-found-page">
      <p className="eyebrow">404 / EMPTY INDEX</p>
      <h1>이 기록을 찾을 수 없습니다.</h1>
      <p>
        주소가 바뀌었거나 예시 기록이 정리됐을 수 있습니다. 아래 실제
        화면에서 다시 찾아보세요.
      </p>
      <div className="page-actions">
        <Link className="button button--primary" href="/community">
          커뮤니티 보기
        </Link>
        <Link className="button" href="/events">
          행사 정보 보기
        </Link>
        <Link className="text-action" href="/">
          홈으로
        </Link>
      </div>
    </div>
  );
}
