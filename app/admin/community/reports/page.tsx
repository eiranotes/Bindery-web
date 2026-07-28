import type { Metadata } from "next";
import Link from "next/link";

import { AdminModerationForm } from "../../../components/AdminModerationForm";
import { PageIntro } from "../../../components/PageIntro";
import { createSupabaseModerationRepository, type ModerationReport } from "../../../lib/server/community/moderation.ts";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "커뮤니티 신고 대기열", robots: { index: false, follow: false } };

export default async function CommunityReportsAdminPage() {
  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  const isOperator = session.access.capabilities.includes("moderation:reports");
  let reports: ModerationReport[] = [];
  let loadError = false;
  if (isOperator && config.status === "configured") {
    try {
      const client = await createSupabaseServerClient(config);
      reports = await createSupabaseModerationRepository(client!).listReports();
    } catch { loadError = true; }
  }

  return <div className="page-shell community-page">
    <PageIntro eyebrow="ADMIN / COMMUNITY" title="신고 대기열" description="신고와 대상 상태를 확인하고 사유가 남는 운영 조치를 적용합니다." />
    {!isOperator ? <section className="community-lock" aria-labelledby="report-admin-lock"><p className="status-stamp">운영자 전용</p><div><h2 id="report-admin-lock">신고 대기열을 볼 권한이 없습니다.</h2><p>신고자와 대상 정보는 응답에 포함하지 않았습니다.</p><Link className="button" href="/community">커뮤니티 홈</Link></div></section>
    : loadError ? <p className="inline-notice">신고 대기열을 불러오지 못했습니다.</p>
    : <section className="admin-community-list" aria-labelledby="reports-title"><div className="section-line-heading"><h2 id="reports-title">처리할 신고</h2><span>{reports.length} ITEMS</span></div>{reports.length === 0 ? <p className="inline-notice">처리할 신고가 없습니다.</p> : reports.map((report) => <article key={report.id}><div><p className="status-stamp">{report.state}</p><h3>{report.postTitle}</h3><p>{report.reasonCode}</p><p>{report.details}</p><p>접수 {new Date(report.createdAt).toLocaleString("ko-KR")}</p></div><AdminModerationForm reportId={report.id} isAdmin={session.member?.actor.role === "admin"} /></article>)}</section>}
    {isOperator ? <div className="page-actions"><Link className="button" href="/admin/community/audit">감사 이력</Link></div> : null}
  </div>;
}
