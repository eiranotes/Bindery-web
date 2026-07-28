import type { Metadata } from "next";
import Link from "next/link";

import { ArtistApplicationForm } from "../../components/ArtistApplicationForm";
import { CommunityBoardNav } from "../../components/CommunityBoardNav";
import { PageIntro } from "../../components/PageIntro";
import { getCurrentCommunityMember } from "../../lib/server/community/session.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작가 인증 기준",
  description:
    "작가 인증 게시판의 자동 임시 승인, 운영자 검수, 공개 활동 URL과 개인정보 경계를 설명합니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CommunityVerificationPage() {
  const session = await getCurrentCommunityMember();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const artistStatus = session.member?.actor.artistStatus ?? "none";

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / VERIFICATION"
        title="작가 인증 기준"
        description="작가 전용 게시판의 접근 자격만 확인하기 위한 기준입니다. 작품의 품질, 판매 실적, 게시글의 사실성을 평가하는 제도가 아닙니다."
      />

      <CommunityBoardNav current="artists" />

      <section
        className="verification-sheet"
        aria-labelledby="verification-status-title"
      >
        <div className="section-line-heading">
          <h2 id="verification-status-title">현재 상태</h2>
          <span>MINIMUM DATA</span>
        </div>
        <div className="verification-status">
          {session.state === "unconfigured" ? (
            <>
              <p className="status-stamp">백엔드 미연결</p>
              <p>
                운영 Supabase와 자동 제출 방지 설정이 아직 연결되지 않았습니다.
                이 화면에서는 파일, 사업자번호, 계정 정보를 받지 않습니다.
              </p>
            </>
          ) : session.state === "signed_out" ? (
            <>
              <p className="status-stamp">로그인 필요</p>
              <div>
                <p>신청을 계정에 연결하기 위해 이메일 로그인이 필요합니다.</p>
                <Link className="button button--primary" href="/auth/sign-in?next=/community/verify">
                  커뮤니티 로그인
                </Link>
              </div>
            </>
          ) : session.state === "error" ? (
            <>
              <p className="status-stamp">확인 지연</p>
              <p>회원 상태를 확인하지 못해 신청을 열지 않았습니다.</p>
            </>
          ) : artistStatus === "provisional" ? (
            <>
              <p className="status-stamp">임시 승인 · 검수 대기</p>
              <p>
                작가 게시판 접근은 열렸고 운영자 검수를 기다리고 있습니다.
                검수 목표는 신청 후 7일 이내입니다.
              </p>
            </>
          ) : artistStatus === "verified" ? (
            <>
              <p className="status-stamp">검수 완료</p>
              <p>현재 계정은 작가 게시판 읽기·쓰기 자격을 갖고 있습니다.</p>
            </>
          ) : (
            <>
              <p className="status-stamp">신청 가능</p>
              <p>
                공개 활동명과 공개 활동 URL 한 곳만으로 임시 승인을 신청할 수
                있습니다.
              </p>
            </>
          )}
        </div>
      </section>

      {session.state === "signed_in" && artistStatus === "none" ? (
        <section className="community-write-sheet" aria-labelledby="artist-application-title">
          <div className="section-line-heading">
            <h2 id="artist-application-title">작가 신청</h2>
            <span>AUTO PROVISIONAL</span>
          </div>
          {siteKey ? (
            <ArtistApplicationForm siteKey={siteKey} />
          ) : (
            <div className="community-composer__boundary">
              <strong>자동 제출 방지 설정을 기다리고 있습니다.</strong>
              <p>
                서버 설정이 모두 갖춰지기 전에는 신청 내용을 전송하거나
                저장하지 않습니다.
              </p>
            </div>
          )}
        </section>
      ) : null}

      <section
        className="verification-options"
        aria-labelledby="verification-options-title"
      >
        <div className="section-line-heading">
          <h2 id="verification-options-title">확인 절차</h2>
          <span>PROVISIONAL → REVIEWED</span>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>공개 활동 URL 제출</h3>
              <p>
                공개 상점, 포트폴리오 또는 활동 채널 한 곳과 활동 분야만
                받습니다. 신분증과 사업자등록증은 받지 않습니다.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>자동 임시 승인</h3>
              <p>
                유효한 신청은 바로 `임시 승인 · 검수 대기`가 되어 작가
                게시판을 이용할 수 있습니다. 검수 전에는 24시간당 글 1건,
                댓글 5건 제한을 적용합니다.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>운영자 사후 검수</h3>
              <p>
                운영자가 7일 내 공개 활동 채널을 확인하고 완료·거절·정지·
                회수합니다. 모든 변경에는 담당자와 사유를 남깁니다.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <aside className="boundary-note">
        <p className="stamp">개인정보 경계</p>
        <div>
          <h2>사업자등록증을 기본 증빙으로 요구하지 않습니다.</h2>
          <p>
            주민등록번호, 주소, 계좌번호 같은 불필요한 개인정보를 수집하지
            않습니다. 작가 상태는 활동 자격이며 정보의 정확성 인증이 아닙니다.
          </p>
        </div>
      </aside>

      <div className="page-actions">
        <Link className="button button--primary" href="/community/artists">
          작가 게시판 확인
        </Link>
        <Link className="button" href="/community/general">
          모두의 게시판 보기
        </Link>
      </div>
    </div>
  );
}
