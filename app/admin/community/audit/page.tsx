import type { Metadata } from "next";
import Link from "next/link";

import { PageIntro } from "../../../components/PageIntro";
import { createSupabaseModerationRepository } from "../../../lib/server/community/moderation.ts";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "커뮤니티 감사 이력", robots: { index: false, follow: false } };

export default async function CommunityAuditPage() {
  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  const isAdmin = session.member?.actor.role === "admin";
  let entries: Record<string, unknown>[] = [];
  let loadError = false;
  if (isAdmin && config.status === "configured") {
    try { const client = await createSupabaseServerClient(config); entries = await createSupabaseModerationRepository(client!).listAudit(); }
    catch { loadError = true; }
  }
  return <div className="page-shell community-page"><PageIntro eyebrow="ADMIN / AUDIT" title="커뮤니티 감사 이력" description="운영 조치와 권한 변경의 추가 전용 이력을 최근 순서로 확인합니다." />
    {!isAdmin ? <section className="community-lock" aria-labelledby="audit-lock"><p className="status-stamp">관리자 전용</p><div><h2 id="audit-lock">감사 이력을 볼 권한이 없습니다.</h2><p>운영 사유와 대상 정보는 응답에 포함하지 않았습니다.</p><Link className="button" href="/community">커뮤니티 홈</Link></div></section>
    : loadError ? <p className="inline-notice">감사 이력을 불러오지 못했습니다.</p>
    : <section className="access-ledger" aria-labelledby="audit-title"><div className="section-line-heading"><h2 id="audit-title">최근 이력</h2><span>{entries.length} ITEMS</span></div><dl>{entries.map((entry, index) => <div key={String(entry.id ?? index)}><dt>{String(entry.action ?? entry.action_type ?? "change")}</dt><dd>{String(entry.reason ?? "사유 없음")} · {new Date(String(entry.created_at)).toLocaleString("ko-KR")}</dd></div>)}</dl></section>}
  </div>;
}
