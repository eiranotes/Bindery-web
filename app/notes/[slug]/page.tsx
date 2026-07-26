import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { notes } from "../../lib/data";
import { getSiteUrl } from "../../lib/site.ts";

interface NotePageProps {
  params: Promise<{ slug: string }>;
}

function formatEditorialDate(value: string): string {
  return value.split("-").join(".");
}

function getNote(slug: string) {
  return notes.find((note) => note.slug === slug);
}

export function generateStaticParams() {
  return notes.map((note) => ({ slug: note.slug }));
}

export async function generateMetadata({
  params,
}: NotePageProps): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug);

  if (!note) {
    return { title: "노트를 찾을 수 없음 | 바인더리" };
  }

  return {
    title: `${note.title} | 바인더리`,
    description: note.summary,
  };
}

export default async function NoteDetailPage({ params }: NotePageProps) {
  const { slug } = await params;
  const note = getNote(slug);

  if (!note) {
    notFound();
  }

  const siteUrl = await getSiteUrl();
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: note.title,
    description: note.summary,
    datePublished: note.publishedAt,
    dateModified: note.updatedAt,
    inLanguage: "ko-KR",
    mainEntityOfPage: new URL(`/notes/${note.slug}`, siteUrl).toString(),
    articleBody: note.sections
      .flatMap((section) => section.paragraphs)
      .join("\n"),
  };

  return (
    <div className="page-shell content-page content-page--reading">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <nav className="breadcrumb" aria-label="현재 위치">
        <Link href="/notes">실무 노트</Link>
        <span aria-hidden="true">/</span>
        <span>{note.category}</span>
      </nav>

      <article className="note-sheet">
        <header className="page-intro note-header">
          <p className="eyebrow">{note.category}</p>
          <h1>{note.title}</h1>
          <p className="page-lede">{note.summary}</p>
          <dl className="note-dates">
            <div>
              <dt>처음 기록</dt>
              <dd>
                <time dateTime={note.publishedAt}>
                  {formatEditorialDate(note.publishedAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt>마지막 업데이트</dt>
              <dd>
                <time dateTime={note.updatedAt}>
                  {formatEditorialDate(note.updatedAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt>읽는 시간</dt>
              <dd>{note.readMinutes}분</dd>
            </div>
          </dl>
        </header>

        {note.isStale ? (
          <aside
            className="trust-notice trust-notice--warning"
            aria-label="업데이트 경고"
          >
            <p className="utility-text">UPDATE NEEDED</p>
            <p>
              마지막 업데이트{" "}
              <time dateTime={note.updatedAt}>
                {formatEditorialDate(note.updatedAt)}
              </time>
              . 비용과 운영 조건은 현재 기준과 다를 수 있습니다. 계산 틀만
              참고하고 실제 금액은 다시 확인하세요.
            </p>
          </aside>
        ) : null}

        {note.legalNotice ? (
          <aside className="trust-notice" aria-label="법률 및 세무 정보 안내">
            <p className="utility-text">INFORMATION BOUNDARY</p>
            <p>
              이 노트는 법률·세무 자문이 아닙니다. 신고 전에는 최신 국세청
              안내 또는 전문가에게 다시 확인하고, 확인한 날짜를 함께
              기록하세요.
            </p>
          </aside>
        ) : null}

        <div className="reading-column">
          {note.sections.map((section) => (
            <section className="note-section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}

          <section className="checklist-section" aria-labelledby="checklist-title">
            <div className="section-heading">
              <h2 id="checklist-title">확인 목록</h2>
              <p className="utility-text">BEFORE CLOSING</p>
            </div>
            <ul className="checklist">
              {note.checklist.map((item) => (
                <li key={item}>
                  <span className="check-mark" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      <nav className="page-return" aria-label="노트 탐색">
        <Link className="text-action" href="/notes">
          모든 실무 노트 보기
        </Link>
      </nav>
    </div>
  );
}
