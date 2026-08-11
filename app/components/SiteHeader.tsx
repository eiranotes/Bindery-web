"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LocaleControl } from "./LocaleControl";
import { useShellLocale } from "./useShellLocale";

export function SiteHeader() {
  const pathname = usePathname();
  const { messages } = useShellLocale();
  const primaryNavigation = [
    { href: "/events", label: messages.events },
    { href: "/events/compare", label: messages.compare },
    { href: "/events/archive", label: messages.archive },
    { href: "/notes", label: messages.notes },
  ];
  const supportingNavigation = [
    { href: "/news", label: messages.news },
    { href: "/community", label: messages.community },
  ];
  const isCurrent = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <header className="site-header">
      <div className="colorbar" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label={messages.home}>
          <span aria-hidden="true">◎</span>
          Bindery
        </Link>

        <nav className="desktop-nav" aria-label={messages.primaryNavigation}>
          {primaryNavigation.map((item) => (
            <Link aria-current={isCurrent(item.href) ? "page" : undefined} key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link aria-current={isCurrent("/me") ? "page" : undefined} className="binder-link" href="/me">
            {messages.binder}
          </Link>
          <LocaleControl className="locale-control--desktop" />
        </nav>

        <details className="mobile-nav">
          <summary>{messages.menu}</summary>
          <nav aria-label={messages.mobileNavigation}>
            {primaryNavigation.map((item) => (
              <Link aria-current={isCurrent(item.href) ? "page" : undefined} key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <div className="mobile-nav__support">
              {supportingNavigation.map((item) => (
                <Link aria-current={isCurrent(item.href) ? "page" : undefined} key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
            <Link aria-current={isCurrent("/me") ? "page" : undefined} href="/me">{messages.binder}</Link>
            <div className="mobile-nav__locale">
              <LocaleControl className="locale-control--mobile" />
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}
