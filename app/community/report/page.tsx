import type { Metadata } from "next";
import Link from "next/link";

import { CommunityReportForm } from "../../components/CommunityReportForm";
import { PageIntro } from "../../components/PageIntro";
import { getCommunityPost } from "../../lib/community";
import {
  createSupabaseCommunityRepository,
  durableCommunityPostToView,
} from "../../lib/server/community/posts.ts";
import { getCurrentCommunityMember } from "../../lib/server/community/session.ts";
import { getSupabasePublicConfig } from "../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "커뮤니티 신고 안내",
  description:
    "커뮤니티 신고 대상과 현재 접수 경계를 확인하는 안내 화면입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

type CommunityReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommunityReportPage({
  searchParams,
}: CommunityReportPageProps) {
  const query = await searchParams;
  const postSlug = typeof query.post === "string" ? query.post : null;
  const config = getSupabasePublicConfig();
  const liveMode = config.status === "configured";
  const session = await getCurrentCommunityMember({ config });
  let post = !liveMode && postSlug ? getCommunityPost(postSlug) : null;

  if (liveMode && postSlug) {
    try {
      const client = await createSupabaseServerClient(config);
      const durablePost = await createSupabaseCommunityRepository(client!).getPost(postSlug);
      post = durablePost ? durableCommunityPostToView(durablePost) : null;
    } catch {
      post = null;
    }
  }

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / REPORT"
        title="신고 안내"
        description="개인정보 노출, 저작권 침해, 괴롭힘, 허위 사실, 반복 광고를 운영 검토 대상으로 분류합니다."
      />

      {!liveMode ? (
        <section className="community-lock" aria-labelledby="report-boundary-title">
          <p className="status-stamp">접수 전</p>
          <div>
            <h2 id="report-boundary-title">현재 신고를 전송하거나 저장하지 않습니다.</h2>
            <p>
              신고 접수는 대상 보존, 신고자 보호, 처리 이력, 운영자 알림이 함께
              있어야 합니다. 이 기반이 없는 상태에서 전송되는 것처럼 보이는
              빈 폼을 만들지 않았습니다.
            </p>
          </div>
        </section>
      ) : !post ? (
        <section className="community-lock" aria-labelledby="report-target-missing">
          <p className="status-stamp">대상 없음</p>
          <div>
            <h2 id="report-target-missing">신고할 공개 글을 찾을 수 없습니다.</h2>
            <p>삭제되었거나 현재 계정에서 읽을 수 없는 글은 이 화면에서 접수하지 않습니다.</p>
          </div>
        </section>
      ) : !session.member ? (
        <section className="community-lock" aria-labelledby="report-sign-in">
          <p className="status-stamp">로그인 필요</p>
          <div>
            <h2 id="report-sign-in">신고자 보호와 처리 안내를 위해 로그인해 주세요.</h2>
            <Link
              className="button button--primary"
              href={`/auth/sign-in?next=/community/report?post=${encodeURIComponent(post.slug)}`}
            >
              로그인
            </Link>
          </div>
        </section>
      ) : null}

      {post ? (
        <section className="report-target" aria-labelledby="report-target-title">
          <div className="section-line-heading">
            <h2 id="report-target-title">확인한 대상 글</h2>
            <span>EXAMPLE POST</span>
          </div>
          <p>{post.title}</p>
        </section>
      ) : null}

      {liveMode && post && session.member ? (
        <section className="community-write-sheet" aria-labelledby="report-form-title">
          <div className="section-line-heading">
            <h2 id="report-form-title">신고 접수</h2>
            <span>DURABLE INTAKE</span>
          </div>
          <CommunityReportForm postId={post.slug} />
        </section>
      ) : null}

      <section className="rules-ledger" aria-labelledby="report-reasons-title">
        <div className="section-line-heading">
          <h2 id="report-reasons-title">신고 사유</h2>
          <span>5 REASONS</span>
        </div>
        <ol>
          <li><strong>개인정보 노출</strong><p>연락처, 주소, 계좌, 주문 정보가 포함된 경우</p></li>
          <li><strong>저작권 침해</strong><p>도용 이미지나 무단 배포 자료가 포함된 경우</p></li>
          <li><strong>괴롭힘·혐오</strong><p>특정 개인이나 집단을 공격하거나 좌표를 찍는 경우</p></li>
          <li><strong>허위·기만 정보</strong><p>출처를 꾸미거나 사실과 경험을 고의로 섞는 경우</p></li>
          <li><strong>반복 광고·스팸</strong><p>정보 없이 홍보 링크를 반복 게시하는 경우</p></li>
        </ol>
      </section>

      <div className="page-actions">
        {post ? (
          <Link className="button button--primary" href={`/community/${post.boardId}/${post.slug}`}>
            대상 글로 돌아가기
          </Link>
        ) : (
          <Link className="button button--primary" href="/community/general">
            모두의 게시판으로
          </Link>
        )}
        <Link className="button" href="/community/rules">
          전체 운영 기준
        </Link>
      </div>
    </div>
  );
}
