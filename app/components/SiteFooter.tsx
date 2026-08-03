"use client";

import Link from "next/link";
import { useShellLocale } from "./useShellLocale";

export function SiteFooter() {
  const { messages } = useShellLocale();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p>
          <strong>Bindery</strong>
          <span>{messages.tagline}</span>
        </p>
        <nav aria-label={messages.supportingNavigation}>
          <Link href="/events/calendar">{messages.calendar}</Link>
          <Link href="/news">{messages.news}</Link>
          <Link href="/community">{messages.community}</Link>
          <Link href="/rss.xml">{messages.rss}</Link>
        </nav>
        <p className="site-footer__note">
          {messages.sourceNote}
        </p>
        <p className="site-footer__locale-note">
          {messages.localeScope}
        </p>
      </div>
    </footer>
  );
}
