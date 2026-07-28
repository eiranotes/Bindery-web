import type { Metadata } from "next";
import Link from "next/link";

import { CommunityBoardNav } from "../../components/CommunityBoardNav";
import { CommunityComposer } from "../../components/CommunityComposer";
import { PageIntro } from "../../components/PageIntro";
import { getCurrentCommunityMember } from "../../lib/server/community/session.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "커뮤니티 글 작성",
  description:
    "모두의 게시판 글을 이 기기에 임시저장하는 게시글 작성 화면입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

type CommunityWritePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommunityWritePage({
  searchParams,
}: CommunityWritePageProps) {
  const query = await searchParams;
  const selectedBoard = query.board === "artists" ? "artists" : "general";
  const session = await getCurrentCommunityMember();
  const canWriteArtistDraft = session.access.capabilities.includes("artist:write");
  const liveBoard = session.member
    ? selectedBoard === "artists"
      ? canWriteArtistDraft
        ? "artists"
        : undefined
      : "general"
    : undefined;

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / WRITE"
        title={selectedBoard === "artists" ? "작가 게시판 글 작성" : "모두의 게시판 글 작성"}
        description={
          liveBoard
            ? "정보 분류와 출처 맥락을 먼저 적고 서버 권한을 다시 확인한 뒤 게시합니다."
            : "정보 분류와 출처 맥락을 먼저 적는 글쓰기 화면입니다. 로그인·백엔드 연결 전에는 기기 임시저장만 제공합니다."
        }
      />

      <CommunityBoardNav current={selectedBoard} />

      {selectedBoard === "artists" && !canWriteArtistDraft ? (
        <section className="community-lock" aria-labelledby="artist-write-lock">
          <p className="status-stamp">작성 잠금</p>
          <div>
            <h2 id="artist-write-lock">
              {session.state === "signed_out"
                ? "로그인한 뒤 작가 상태를 확인합니다."
                : "작가 인증 세션이 있어야 작성할 수 있습니다."}
            </h2>
            <p>
              브라우저 값이나 URL만으로 인증을 흉내 내지 않습니다. 서버가
              활성 임시 승인 또는 검수 완료 상태를 확인하기 전에는 작가
              게시판 작성 폼도 열지 않습니다.
            </p>
            <div className="intro-actions">
              <Link
                className="button button--primary"
                href={session.state === "signed_out" ? "/auth/sign-in" : "/community/verify"}
              >
                {session.state === "signed_out" ? "커뮤니티 로그인" : "작가 인증 기준 확인"}
              </Link>
              <Link className="button" href="/community/write?board=general">
                모두의 게시판 글 작성
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section
          className="community-write-sheet"
          aria-labelledby="community-write-title"
        >
          <div className="section-line-heading">
            <h2 id="community-write-title">글 내용</h2>
            <span>
              {selectedBoard === "artists" && canWriteArtistDraft
                ? "ARTIST ACCESS / LOCAL DRAFT"
                : "DEVICE-LOCAL DRAFT"}
            </span>
          </div>
          {selectedBoard === "artists" && canWriteArtistDraft ? (
            <div className="community-composer__boundary">
              <strong>
                {session.access.artistAccess === "provisional"
                  ? "임시 승인 · 검수 대기 상태를 확인했습니다."
                  : "작가 게시판 접근을 확인했습니다."}
              </strong>
              <p>
                실제 게시 저장은 아직 연결하지 않았습니다. 이 단계에서는
                보호 게시판 권한을 확인한 뒤에도 초안을 이 기기에만 저장합니다.
              </p>
            </div>
          ) : null}
          <CommunityComposer liveBoard={liveBoard} />
        </section>
      )}
    </div>
  );
}
