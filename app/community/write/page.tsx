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
    "커뮤니티 글을 작성하고, 백엔드 미구성 상태에서는 이 기기에 임시저장하는 화면입니다.",
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
  const canWriteGeneral = session.access.capabilities.includes("general:write");
  const canWriteArtistDraft = session.access.capabilities.includes("artist:write");
  const canWriteSelected =
    selectedBoard === "artists" ? canWriteArtistDraft : canWriteGeneral;
  const liveBoard = canWriteSelected ? selectedBoard : undefined;
  const showLocalGeneralDraft =
    selectedBoard === "general" && session.state === "unconfigured";
  const showComposer = Boolean(liveBoard) || showLocalGeneralDraft;

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / WRITE"
        title={selectedBoard === "artists" ? "작가 게시판 글 작성" : "모두의 게시판 글 작성"}
        description={
          liveBoard
            ? "분류와 출처를 적고 게시합니다."
            : "작성 내용은 이 기기에만 임시저장됩니다."
        }
      />

      <CommunityBoardNav current={selectedBoard} />

      {!showComposer ? (
        <section className="community-lock" aria-labelledby="artist-write-lock">
          <p className="status-stamp">작성 잠금</p>
          <div>
            <h2 id="artist-write-lock">
              {session.state === "unconfigured"
                ? "백엔드 연결 후 작가 인증 상태를 확인합니다."
                : session.state === "signed_out"
                  ? "로그인한 뒤 작성 권한을 확인합니다."
                  : session.state === "error"
                    ? "회원 권한을 확인하지 못했습니다."
                    : session.member?.actor.accountStatus !== "active"
                      ? "현재 계정 상태에서는 글을 작성할 수 없습니다."
                      : "작가 인증 세션이 있어야 작성할 수 있습니다."}
            </h2>
            <p>
              {session.state === "unconfigured"
                ? "작가 게시판 글은 백엔드 연결 전 저장하지 않습니다."
                : "서버에서 쓰기 권한을 확인한 뒤 작성 폼을 엽니다."}
            </p>
            <div className="intro-actions">
              <Link
                className="button button--primary"
                href={
                  session.state === "unconfigured"
                    ? "/community/verify"
                    : session.state === "signed_out"
                      ? "/auth/sign-in"
                      : "/community/rules"
                }
              >
                {session.state === "unconfigured"
                  ? "작가 인증 기준 확인"
                  : session.state === "signed_out"
                    ? "커뮤니티 로그인"
                    : "운영 기준 확인"}
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
              {liveBoard
                ? selectedBoard === "artists"
                  ? "ARTIST ACCESS / LIVE PUBLISH"
                  : "MEMBER / LIVE PUBLISH"
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
                게시 요청 때 서버와 데이터베이스가 권한을 다시 확인합니다.
                임시 승인 작가는 24시간 기준 글 1건·댓글 5건 제한을 적용받습니다.
              </p>
            </div>
          ) : null}
          <CommunityComposer liveBoard={liveBoard} />
        </section>
      )}
    </div>
  );
}
