import type { Metadata } from "next";
import Link from "next/link";

import { CommunityAppealForm } from "../../../components/CommunityAppealForm.tsx";
import {
  createSupabaseModerationRepository,
  getCommunityAppealContext,
  isCommunityAppealExpired,
  type CommunityAppealContext,
} from "../../../lib/server/community/moderation.ts";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "커뮤니티 이의제기",
  description: "내 콘텐츠에 적용된 운영 조치의 재검토를 요청합니다.",
  robots: { index: false, follow: false },
};

const actionLabels: Record<CommunityAppealContext["action"], string> = {
  hide: "글 숨김",
  lock: "글 잠금",
  suspend_account: "계정 정지",
};

export default async function CommunityAppealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  let appeal: CommunityAppealContext | null = null;
  let loadFailed = false;

  if (config.status === "configured" && session.member) {
    try {
      const client = await createSupabaseServerClient(config);
      const result = await getCommunityAppealContext(
        { actor: session.member.actor, userId: session.member.id, reportId: id },
        { repository: createSupabaseModerationRepository(client!) },
      );
      appeal = result.appeal;
    } catch {
      loadFailed = true;
    }
  }

  return (
    <div className="page-shell community-page">
      <header className="page-intro">
        <p className="eyebrow">COMMUNITY / APPEAL</p>
        <h1>운영 조치 이의제기</h1>
        <p className="page-lede">
          내 글이나 계정에 적용된 조치가 사실과 다르다면 조치일로부터 14일 안에 재검토를 요청할 수 있습니다.
        </p>
      </header>

      {config.status !== "configured" ? (
        <section className="community-lock" aria-labelledby="appeal-config-title">
          <p className="status-stamp">READ ONLY</p>
          <div>
            <h2 id="appeal-config-title">이의제기 저장소가 아직 연결되지 않았습니다.</h2>
            <p>연결 전에는 제출된 것처럼 표시하거나 사유를 임시 저장하지 않습니다.</p>
            <Link className="button" href="/community">커뮤니티 홈</Link>
          </div>
        </section>
      ) : !session.member ? (
        <section className="community-lock" aria-labelledby="appeal-sign-in-title">
          <p className="status-stamp">MEMBER ONLY</p>
          <div>
            <h2 id="appeal-sign-in-title">영향을 받은 계정으로 로그인해 주세요.</h2>
            <Link className="button button--primary" href={`/auth/sign-in?next=/community/appeals/${encodeURIComponent(id)}`}>
              로그인
            </Link>
          </div>
        </section>
      ) : loadFailed ? (
        <p className="inline-notice" role="status">이의제기 상태를 불러오지 못했습니다.</p>
      ) : !appeal ? (
        <section className="community-lock" aria-labelledby="appeal-unavailable-title">
          <p className="status-stamp">NOT AVAILABLE</p>
          <div>
            <h2 id="appeal-unavailable-title">이 계정에서 이의제기할 조치를 찾을 수 없습니다.</h2>
            <p>조치 대상 계정만 제출할 수 있으며, 신고자나 다른 회원에게는 대상 정보가 공개되지 않습니다.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="report-target" aria-labelledby="appeal-target-title">
            <div className="section-line-heading">
              <h2 id="appeal-target-title">재검토 대상</h2>
              <span>{actionLabels[appeal.action]}</span>
            </div>
            <p>{appeal.postTitle}</p>
            <p>제출 기한 {new Date(appeal.deadlineAt).toLocaleString("ko-KR")}</p>
          </section>

          {appeal.reportState === "appealed" ? (
            <p className="inline-notice" role="status">이의제기가 접수되어 관리자 검토를 기다리고 있습니다.</p>
          ) : appeal.reportState === "closed" ? (
            <p className="inline-notice" role="status">이의제기 검토가 종료되었습니다. 결과는 알림에서 확인해 주세요.</p>
          ) : isCommunityAppealExpired(appeal.deadlineAt) ? (
            <p className="inline-notice" role="status">
              이의제기 제출 기한이 지났습니다. 운영자 연락 경로에서 별도 검토 가능 여부를 확인해 주세요.
            </p>
          ) : (
            <section className="community-write-sheet" aria-labelledby="appeal-form-title">
              <div className="section-line-heading">
                <h2 id="appeal-form-title">재검토 요청</h2>
                <span>14-DAY WINDOW</span>
              </div>
              <CommunityAppealForm reportId={appeal.reportId} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
