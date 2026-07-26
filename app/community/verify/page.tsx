import type { Metadata } from "next";
import Link from "next/link";

import { CommunityBoardNav } from "../../components/CommunityBoardNav";
import { PageIntro } from "../../components/PageIntro";

export const metadata: Metadata = {
  title: "작가 인증 기준",
  description:
    "작가 인증 게시판의 접근 목적, 검토 중인 증빙 방식, 개인정보 경계를 설명합니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CommunityVerificationPage() {
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
          <span>DESIGN REVIEW</span>
        </div>
        <div className="verification-status">
          <p className="status-stamp">접수 전</p>
          <p>
            인증 자료 업로드와 운영자 검수 도구가 아직 연결되지 않았습니다.
            이 화면에서는 파일, 사업자번호, 계정 정보를 받지 않습니다.
          </p>
        </div>
      </section>

      <section
        className="verification-options"
        aria-labelledby="verification-options-title"
      >
        <div className="section-line-heading">
          <h2 id="verification-options-title">검토 중인 확인 방법</h2>
          <span>MINIMUM DATA</span>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>행사 참가 이력</h3>
              <p>
                참가 확정 메일이나 부스번호처럼 실제 참가를 확인할 수 있는
                최소 자료를 검토합니다.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>운영 중인 작가 채널</h3>
              <p>
                최근 창작 활동을 확인할 수 있는 공개 상점이나 포트폴리오
                주소를 대안으로 검토합니다.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>운영자 수동 검수</h3>
              <p>
                자동 배지 발급 없이 이의 제기와 삭제 요청을 처리할 수 있는
                초기 수동 절차를 둡니다.
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
            않는 방식이 우선입니다. 최종 기준은 개인정보 처리방침과 삭제
            요청 절차를 함께 정한 뒤 확정합니다.
          </p>
        </div>
      </aside>

      <div className="page-actions">
        <Link className="button button--primary" href="/community/artists">
          작가 게시판 잠금 화면
        </Link>
        <Link className="button" href="/community/general">
          모두의 게시판 보기
        </Link>
      </div>
    </div>
  );
}
