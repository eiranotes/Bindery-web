import Link from "next/link";
import { ThemeControl } from "./ThemeControl";

const navigation = [
  { href: "/events", label: "행사" },
  { href: "/notes", label: "노트" },
  { href: "/groupbuy", label: "공동구매" },
  { href: "/news", label: "소식" },
  { href: "/community", label: "커뮤니티" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="colorbar" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label="BINDERY 홈">
          <span aria-hidden="true">◎</span>
          바인더리
        </Link>

        <nav className="desktop-nav" aria-label="주요 탐색">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link className="binder-link" href="/me">
            내 바인더
          </Link>
          <ThemeControl className="theme-control--desktop" />
        </nav>

        <details className="mobile-nav">
          <summary>메뉴</summary>
          <nav aria-label="모바일 주요 탐색">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link href="/me">내 바인더</Link>
            <div className="mobile-nav__theme">
              <ThemeControl className="theme-control--mobile" />
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}
