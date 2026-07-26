import type { Metadata } from "next";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { getSiteUrl, SITE_DESCRIPTION } from "./lib/site.ts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const metadataBase = await getSiteUrl();

  return {
    metadataBase,
    title: {
      default: "BINDERY — 만드는 사람의 다음 일정",
      template: "%s — BINDERY",
    },
    description: SITE_DESCRIPTION,
    openGraph: {
      title: "BINDERY — 만드는 사람의 다음 일정",
      description:
        "행사 마감부터 현장 준비까지, 만드는 사람에게 필요한 정보를 한 장씩.",
      type: "website",
      locale: "ko_KR",
      url: metadataBase,
      images: ["/og.png"],
    },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
