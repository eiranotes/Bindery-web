import type { Metadata } from "next";
import Link from "next/link";

import {
  createSupabaseCommunityNotificationRepository,
  listCommunityNotifications,
  type CommunityNotification,
} from "../../lib/server/community/notifications.ts";
import { getCurrentCommunityMember } from "../../lib/server/community/session.ts";
import { getSupabasePublicConfig } from "../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "커뮤니티 알림",
  description: "답글과 커뮤니티 처리 결과를 확인합니다.",
};

const KIND_LABELS: Record<CommunityNotification["kind"], string> = {
  reply: "새 답글",
  answer_accepted: "답변 채택",
  verification_decision: "작가 인증 결과",
  moderation_outcome: "운영 처리 결과",
  appeal_outcome: "이의제기 결과",
};

function textPayload(notification: CommunityNotification, key: string) {
  const value = notification.payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function notificationSummary(notification: CommunityNotification) {
  const title = textPayload(notification, "post_title");
  const status = textPayload(notification, "status");
  const reason = textPayload(notification, "reason");
  if (notification.kind === "verification_decision") {
    return [status ? `상태: ${status}` : "작가 인증 상태가 변경되었습니다.", reason]
      .filter(Boolean)
      .join(" · ");
  }
  return [title, reason].filter(Boolean).join(" · ") || "커뮤니티에서 새 소식이 도착했습니다.";
}

function notificationHref(notification: CommunityNotification) {
  const postId = textPayload(notification, "post_id");
  if (!postId) return null;
  const boardId = textPayload(notification, "board_id");
  return boardId === "artists"
    ? `/community/artists/${encodeURIComponent(postId)}`
    : `/community/general/${encodeURIComponent(postId)}`;
}

function notificationAppealHref(
  notification: CommunityNotification,
  memberId: string,
) {
  if (notification.kind !== "moderation_outcome") return null;
  const reportId = textPayload(notification, "report_id");
  const affectedUserId = textPayload(notification, "affected_user_id");
  const deadline = textPayload(notification, "appeal_deadline_at");
  if (
    !reportId
    || affectedUserId !== memberId
    || !deadline
  ) return null;
  return `/community/appeals/${encodeURIComponent(reportId)}`;
}

export default async function CommunityNotificationsPage() {
  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  let notifications: CommunityNotification[] = [];
  let loadFailed = false;

  if (config.status === "configured" && session.member) {
    try {
      const client = await createSupabaseServerClient(config);
      if (client) {
        const result = await listCommunityNotifications(
          { actor: session.member.actor, limit: 50 },
          {
            repository: createSupabaseCommunityNotificationRepository(
              client,
              session.member.id,
            ),
          },
        );
        notifications = [...result.notifications];
      }
    } catch {
      loadFailed = true;
    }
  }

  return (
    <div className="page-shell community-page">
      <header className="page-intro">
        <p className="eyebrow">COMMUNITY / NOTIFICATIONS</p>
        <h1>커뮤니티 알림</h1>
        <p className="page-lede">
          답글, 답변 채택, 작가 인증과 운영 처리 결과를 계정 안에서만 확인합니다.
        </p>
      </header>

      {config.status !== "configured" ? (
        <section className="community-lock" aria-labelledby="notification-config-title">
          <p className="status-stamp">READ ONLY</p>
          <div>
            <h2 id="notification-config-title">알림 저장소가 아직 연결되지 않았습니다.</h2>
            <p>공개 커뮤니티는 계속 둘러볼 수 있으며, 연결 전에는 알림을 저장한 것처럼 표시하지 않습니다.</p>
            <Link className="button" href="/community">커뮤니티 홈</Link>
          </div>
        </section>
      ) : !session.member ? (
        <section className="community-lock" aria-labelledby="notification-sign-in-title">
          <p className="status-stamp">MEMBER ONLY</p>
          <div>
            <h2 id="notification-sign-in-title">내 알림을 보려면 로그인해 주세요.</h2>
            <p>알림은 수신자 계정에만 보이며 이메일로 발송하지 않습니다.</p>
            <Link className="button" href="/auth/sign-in?next=/me/notifications">로그인</Link>
          </div>
        </section>
      ) : loadFailed ? (
        <p className="inline-notice" role="status">알림을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>
      ) : notifications.length === 0 ? (
        <section className="binder-empty" aria-labelledby="notification-empty-title">
          <div>
            <h2 id="notification-empty-title">아직 도착한 알림이 없습니다.</h2>
            <p>새 답글이나 처리 결과가 생기면 이곳에 표시됩니다.</p>
            <Link href="/community">커뮤니티 둘러보기</Link>
          </div>
        </section>
      ) : (
        <section className="admin-community-list" aria-labelledby="notification-list-title">
          <div className="section-line-heading">
            <h2 id="notification-list-title">받은 알림</h2>
            <span>{notifications.filter((item) => !item.readAt).length} UNREAD</span>
          </div>
          {notifications.map((notification) => {
            const href = notificationHref(notification);
            const appealHref = notificationAppealHref(notification, session.member!.id);
            return (
              <article key={notification.id}>
                <div>
                  <p className="status-stamp">
                    {notification.readAt ? "READ" : "NEW"} / {KIND_LABELS[notification.kind]}
                  </p>
                  <h3>{KIND_LABELS[notification.kind]}</h3>
                  <p>{notificationSummary(notification)}</p>
                  <p>{new Date(notification.createdAt).toLocaleString("ko-KR")}</p>
                </div>
                <div>
                  {href ? <Link className="text-action" href={href}>관련 내용 보기</Link> : null}
                  {appealHref ? <Link className="text-action" href={appealHref}>이 조치에 이의제기</Link> : null}
                  {!notification.readAt ? (
                    <form method="post" action={`/api/community/notifications/${notification.id}/read`}>
                      <button className="text-action" type="submit">읽음으로 표시</button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
