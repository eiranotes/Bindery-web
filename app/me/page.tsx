import type { Metadata } from "next";
import Link from "next/link";

import { BinderClient } from "../components/BinderClient";
import { events } from "../lib/data.ts";
import {
  createSupabaseBinderSyncRepository,
  listAccountBinderCommunityPosts,
  listAccountBinderEventIds,
  type AccountCommunityBookmark,
} from "../lib/server/community/binder-sync.ts";
import { getCurrentCommunityMember } from "../lib/server/community/session.ts";
import { getSupabasePublicConfig } from "../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Binder",
  description:
    "관심 있는 행사 페이지를 이 기기에 모으고, 로그인하면 계정 Binder와 직접 합칠 수 있습니다.",
  robots: { index: false, follow: false },
};

export default async function MyBinderPage() {
  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  const canUseAccountBinder = session.access.capabilities.includes("general:bookmark");
  let accountEventIds: string[] = [];
  let accountCommunityPosts: AccountCommunityBookmark[] = [];

  if (config.status === "configured" && session.member && canUseAccountBinder) {
    try {
      const client = await createSupabaseServerClient(config);
      if (client) {
        const dependencies = {
            repository: createSupabaseBinderSyncRepository(client),
            supportedEventIds: new Set(events.map((event) => event.id)),
          };
        [accountEventIds, accountCommunityPosts] = await Promise.all([
          listAccountBinderEventIds(
            { actor: session.member.actor, userId: session.member.id },
            dependencies,
          ),
          listAccountBinderCommunityPosts(
            { actor: session.member.actor, userId: session.member.id },
            dependencies,
          ),
        ]);
      }
    } catch {
      accountEventIds = [];
    }
  }

  return (
    <div className="page-shell binder-page">
      <header className="page-intro binder-intro">
        <p className="eyebrow">
          {canUseAccountBinder
            ? "MY BINDER / ACCOUNT + DEVICE"
            : "MY BINDER / DEVICE 01"}
        </p>
        <h1>My Binder</h1>
        <p className="page-lede">
          {canUseAccountBinder
            ? "이 기기와 계정에 저장한 항목을 함께 확인합니다."
            : "이 기기에 저장한 행사와 공개 커뮤니티 글을 확인합니다."}
        </p>
      </header>

      <aside className="trust-notice binder-privacy" aria-label="저장 방식 안내">
        <p className="utility-text">
          {canUseAccountBinder ? "ACCOUNT + DEVICE" : "DEVICE LOCAL"}
        </p>
        {canUseAccountBinder ? (
          <p>
            계정 저장과 이 기기의 저장을 함께 보여 줍니다. 기기 저장은 아래의
            명시적인 합치기 버튼을 누를 때만 계정으로 복사됩니다.
          </p>
        ) : session.state === "signed_in" ? (
          <p>
            현재 계정 상태에서는 계정 Binder를 읽거나 합칠 수 없습니다. 이
            화면에는 기기에 저장한 항목만 표시합니다.
          </p>
        ) : (
          <p>
            저장한 행사와 공개 커뮤니티 글은 계정 없이 이 기기의 브라우저에만 남습니다. 브라우저
            데이터를 지우거나 다른 기기를 사용하면 이 목록은 이어지지 않습니다.
          </p>
        )}
      </aside>

      <BinderClient
        accountEventIds={accountEventIds}
        accountCommunityPosts={accountCommunityPosts}
        syncState={
          canUseAccountBinder
            ? "signed_in"
            : session.state === "signed_in"
              ? "error"
              : session.state
        }
      />

      <div className="page-actions">
        <Link className="button" href="/me/notifications">
          커뮤니티 알림 확인
        </Link>
      </div>

      <noscript>
        <section className="binder-empty">
          <div>
            <h2>바인더를 펼치려면 JavaScript가 필요합니다.</h2>
            <p>
              기기 안에 저장된 페이지를 읽고 바로 빼는 기능에만 JavaScript를
              사용합니다.
            </p>
            <Link href="/events">행사 찾아보기</Link>
          </div>
        </section>
      </noscript>
    </div>
  );
}
