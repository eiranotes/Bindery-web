import type { Metadata } from "next";
import Link from "next/link";

import { AdminArtistInviteForm } from "../../../components/AdminArtistInviteForm";
import { AdminArtistInviteRevokeForm } from "../../../components/AdminArtistInviteRevokeForm";
import { PageIntro } from "../../../components/PageIntro";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import { createSupabaseVerificationRepository } from "../../../lib/server/community/verification.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작가 초대 관리",
  robots: { index: false, follow: false },
};

export default async function ArtistInvitationsAdminPage() {
  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  const isAdmin = session.access.capabilities.includes("admin:invite");
  let invites: Awaited<
    ReturnType<ReturnType<typeof createSupabaseVerificationRepository>["listInvites"]>
  > = [];
  let loadError = false;

  if (isAdmin && config.status === "configured") {
    try {
      const client = await createSupabaseServerClient(config);
      invites = await createSupabaseVerificationRepository(client!).listInvites();
    } catch {
      loadError = true;
    }
  }

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="ADMIN / COMMUNITY"
        title="작가 초대 관리"
        description="운영자가 활동 사실을 이미 확인한 작가에게 7일짜리 일회용 초대를 발급합니다."
      />

      {!isAdmin ? (
        <section className="community-lock" aria-labelledby="admin-invite-lock">
          <p className="status-stamp">관리자 전용</p>
          <div>
            <h2 id="admin-invite-lock">초대를 발급할 권한이 없습니다.</h2>
            <p>초대 대상과 발급 이력은 화면에 포함하지 않았습니다.</p>
            <Link className="button" href="/community">커뮤니티 홈</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="community-write-sheet" aria-labelledby="invite-form-title">
            <div className="section-line-heading">
              <h2 id="invite-form-title">새 초대</h2>
              <span>SINGLE USE / 7 DAYS</span>
            </div>
            <AdminArtistInviteForm />
          </section>
          <section className="access-ledger" aria-labelledby="invite-history-title">
            <div className="section-line-heading">
              <h2 id="invite-history-title">최근 초대</h2>
              <span>{invites.length} ITEMS</span>
            </div>
            {loadError ? (
              <p className="inline-notice">초대 이력을 불러오지 못했습니다.</p>
            ) : invites.length === 0 ? (
              <p className="inline-notice">발급한 초대가 없습니다.</p>
            ) : (
              <dl>
                {invites.map((invite) => (
                  <div key={invite.id}>
                    <dt>{invite.email}</dt>
                    <dd>
                      <p>
                        {invite.state} · {new Date(invite.expiresAt).toLocaleDateString("ko-KR")}
                      </p>
                      {invite.state === "pending" ? (
                        <AdminArtistInviteRevokeForm inviteId={invite.id} />
                      ) : null}
                      {invite.revocationReason ? (
                        <small>취소 사유: {invite.revocationReason}</small>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </>
      )}

      {isAdmin ? (
        <div className="page-actions">
          <Link className="button" href="/admin/community/verifications">검수 대기열</Link>
        </div>
      ) : null}
    </div>
  );
}
