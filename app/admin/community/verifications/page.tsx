import type { Metadata } from "next";
import Link from "next/link";

import { AdminArtistReviewForm } from "../../../components/AdminArtistReviewForm";
import { PageIntro } from "../../../components/PageIntro";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import { createSupabaseVerificationRepository } from "../../../lib/server/community/verification.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작가 검수 대기열",
  robots: { index: false, follow: false },
};

export default async function ArtistVerificationAdminPage() {
  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  const isAdmin = session.access.capabilities.includes("admin:artist-review");
  let applications: Awaited<
    ReturnType<ReturnType<typeof createSupabaseVerificationRepository>["listApplications"]>
  > = [];
  let loadError = false;

  if (isAdmin && config.status === "configured") {
    try {
      const client = await createSupabaseServerClient(config);
      applications = await createSupabaseVerificationRepository(
        client!,
      ).listApplications(["provisional", "suspended"]);
    } catch {
      loadError = true;
    }
  }

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="ADMIN / COMMUNITY"
        title="작가 검수 대기열"
        description="임시 승인 신청을 확인하고 처리 사유와 함께 상태를 변경합니다."
      />

      {!isAdmin ? (
        <section className="community-lock" aria-labelledby="admin-verification-lock">
          <p className="status-stamp">관리자 전용</p>
          <div>
            <h2 id="admin-verification-lock">검수 대기열을 볼 권한이 없습니다.</h2>
            <p>보호된 신청 정보는 HTML에도 포함하지 않았습니다.</p>
            <Link className="button" href="/community">커뮤니티 홈</Link>
          </div>
        </section>
      ) : loadError ? (
        <p className="inline-notice">검수 대기열을 불러오지 못했습니다.</p>
      ) : (
        <section className="admin-community-list" aria-labelledby="pending-applications">
          <div className="section-line-heading">
            <h2 id="pending-applications">검수할 신청</h2>
            <span>{applications.length} ITEMS</span>
          </div>
          {applications.length === 0 ? (
            <p className="inline-notice">현재 검수 대기 신청이 없습니다.</p>
          ) : (
            applications.map((application) => (
              <article key={application.id}>
                <div>
                  <p className="status-stamp">
                    {application.status === "provisional" ? "임시 승인" : "일시 정지"}
                  </p>
                  <h3>{application.activityName}</h3>
                  <p>{application.primaryField}</p>
                  <a href={application.proofUrlNormalized} rel="noreferrer" target="_blank">
                    공개 활동 주소 확인
                  </a>
                  <p>신청: {new Date(application.submittedAt).toLocaleString("ko-KR")}</p>
                </div>
                <AdminArtistReviewForm applicationId={application.id} />
              </article>
            ))
          )}
        </section>
      )}

      {isAdmin ? (
        <div className="page-actions">
          <Link className="button" href="/admin/community/invitations">작가 초대 관리</Link>
        </div>
      ) : null}
    </div>
  );
}
