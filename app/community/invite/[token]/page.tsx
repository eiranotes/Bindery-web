import type { Metadata } from "next";
import Link from "next/link";

import { ArtistInviteAcceptForm } from "../../../components/ArtistInviteAcceptForm";
import { PageIntro } from "../../../components/PageIntro";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import {
  CURRENT_COMMUNITY_POLICY_VERSION,
} from "../../../lib/server/community/verification.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작가 초대 수락",
  robots: { index: false, follow: false },
};

export default async function ArtistInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getCurrentCommunityMember();

  return (
    <div className="page-shell community-page">
      <PageIntro
        eyebrow="COMMUNITY / INVITATION"
        title="작가 초대 수락"
        description="운영자가 발급한 일회용 초대를 현재 로그인 계정에 연결합니다."
      />

      {session.state === "signed_in" && session.member?.actor.accountStatus === "active" ? (
        <ArtistInviteAcceptForm
          token={token}
          currentPolicyVersion={CURRENT_COMMUNITY_POLICY_VERSION}
        />
      ) : session.state === "signed_out" ? (
        <section className="community-lock" aria-labelledby="invite-sign-in">
          <p className="status-stamp">로그인 필요</p>
          <div>
            <h2 id="invite-sign-in">초대받은 이메일로 먼저 로그인하세요.</h2>
            <p>로그인 뒤 같은 초대 주소로 돌아와 수락할 수 있습니다.</p>
            <Link
              className="button button--primary"
              href={`/auth/sign-in?next=${encodeURIComponent(`/community/invite/${token}`)}`}
            >
              커뮤니티 로그인
            </Link>
          </div>
        </section>
      ) : (
        <section className="community-lock" aria-labelledby="invite-unavailable">
          <p className="status-stamp">수락 불가</p>
          <div>
            <h2 id="invite-unavailable">현재 초대를 확인할 수 없습니다.</h2>
            <p>백엔드 설정 또는 회원 상태를 확인한 뒤 다시 시도해 주세요.</p>
          </div>
        </section>
      )}
    </div>
  );
}
