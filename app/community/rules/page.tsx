import type { Metadata } from "next";
import Link from "next/link";

import { CommunityBoardNav } from "../../components/CommunityBoardNav";
import { PageIntro } from "../../components/PageIntro";

export const metadata: Metadata = {
  title: "커뮤니티 운영 기준",
  description:
    "문구작가 커뮤니티의 정보 분류, 금지 항목, 신고와 운영자 조치 기준을 설명합니다.",
};

export default function CommunityRulesPage() {
  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / RULES"
        title="운영·신고 기준"
        description="자유게시판의 대화량보다 다시 찾을 수 있는 정보와 안전한 운영을 우선합니다. 실제 접수 전에 적용할 기준을 화면으로 먼저 고정합니다."
      />

      <CommunityBoardNav />

      <section className="rules-ledger" aria-labelledby="community-rules-title">
        <div className="section-line-heading">
          <h2 id="community-rules-title">게시 기준</h2>
          <span>COMMUNITY RULES</span>
        </div>
        <ol>
          <li>
            <strong>정보와 경험을 구분합니다.</strong>
            <p>
              공식 조건은 원문과 확인 날짜를 적고, 개인 경험은 보편적인
              사실처럼 단정하지 않습니다.
            </p>
          </li>
          <li>
            <strong>개인정보와 거래를 올리지 않습니다.</strong>
            <p>
              연락처, 계좌번호, 주문자 정보, 신분증, 미공개 계약 자료는
              게시하지 않습니다. DM·결제·정산 기능도 제공하지 않습니다.
            </p>
          </li>
          <li>
            <strong>창작자 권리와 안전을 지킵니다.</strong>
            <p>
              도용, 혐오, 괴롭힘, 좌표 찍기, 허위 사실, 광고성 반복 게시,
              저작권 침해 자료는 운영 검토 대상입니다.
            </p>
          </li>
        </ol>
      </section>

      <section className="moderation-flow" aria-labelledby="moderation-title">
        <div className="section-line-heading">
          <h2 id="moderation-title">운영자 조치 흐름</h2>
          <span>FUTURE BACKEND</span>
        </div>
        <ol>
          <li>
            <span>01</span>
            <p>신고 사유와 대상 글을 접수합니다.</p>
          </li>
          <li>
            <span>02</span>
            <p>검토 중 상태에서는 민감한 글을 임시로 숨길 수 있습니다.</p>
          </li>
          <li>
            <span>03</span>
            <p>복원, 잠금, 삭제와 그 이유를 작성자에게 알립니다.</p>
          </li>
          <li>
            <span>04</span>
            <p>이의 제기와 개인정보 삭제 요청을 별도로 처리합니다.</p>
          </li>
        </ol>
      </section>

      <aside className="source-notice">
        <strong>접수 경계</strong>
        <p>
          현재는 운영 기준만 공개합니다. 신고 접수와 운영자 조치는 서버
          계정, 저장소, 알림, 처리 이력 기능이 연결된 뒤 시작합니다.
        </p>
      </aside>

      <div className="page-actions">
        <Link className="button button--primary" href="/community/general">
          모두의 게시판으로
        </Link>
        <Link className="button" href="/community/report">
          신고 화면의 현재 범위
        </Link>
      </div>
    </div>
  );
}
