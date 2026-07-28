import type { SupabaseClient } from "@supabase/supabase-js";

import { getCommunityAccess, type CommunityActor } from "../../community-access.ts";

export type ModerationAction =
  | "triage"
  | "dismiss"
  | "hide"
  | "lock"
  | "restore"
  | "suspend_account"
  | "resolve_appeal";

export type ModerationReport = {
  id: string;
  reporterId: string;
  postId: string;
  postAuthorId: string;
  postTitle: string;
  postState: "published" | "under_review" | "hidden" | "locked" | "deleted" | "draft";
  reasonCode: string;
  details: string | null;
  state: "open" | "triaged" | "actioned" | "dismissed" | "appealed" | "closed";
  createdAt: string;
};

export type CommunityModerationRepository = {
  getReport(id: string): Promise<ModerationReport | null>;
  applyAction(input: {
    reportId: string;
    action: ModerationAction;
    reason: string;
    actedAt: string;
  }): Promise<ModerationReport>;
};

const ADMIN_ONLY_ACTIONS = new Set<ModerationAction>([
  "suspend_account",
  "resolve_appeal",
]);

const ALLOWED_STATES: Record<ModerationAction, ModerationReport["state"][]> = {
  triage: ["open"],
  dismiss: ["open", "triaged"],
  hide: ["open", "triaged"],
  lock: ["open", "triaged"],
  restore: ["actioned", "dismissed"],
  suspend_account: ["open", "triaged"],
  resolve_appeal: ["appealed"],
};

export async function moderateCommunityReport(
  command: {
    actor: CommunityActor;
    actorId: string;
    reportId: string;
    action: ModerationAction;
    reason: string;
    now: Date;
  },
  dependencies: { repository: CommunityModerationRepository },
) {
  const capabilities = getCommunityAccess(command.actor).capabilities;
  if (
    !command.actorId ||
    !capabilities.includes("moderation:reports") ||
    !capabilities.includes("moderation:content")
  ) {
    return { ok: false, code: "forbidden", message: "운영 권한이 필요합니다." };
  }
  if (ADMIN_ONLY_ACTIONS.has(command.action) && command.actor.role !== "admin") {
    return { ok: false, code: "admin-required", message: "관리자 권한이 필요합니다." };
  }
  const reason = command.reason.trim();
  if (reason.length < 1 || reason.length > 2_000) {
    return { ok: false, code: "invalid-input", message: "처리 사유가 필요합니다." };
  }

  const report = await dependencies.repository.getReport(command.reportId);
  if (!report) {
    return { ok: false, code: "not-found", message: "신고를 찾을 수 없습니다." };
  }
  if (!ALLOWED_STATES[command.action].includes(report.state)) {
    return { ok: false, code: "invalid-transition", message: "현재 신고 상태에서 실행할 수 없는 조치입니다." };
  }

  const updated = await dependencies.repository.applyAction({
    reportId: report.id,
    action: command.action,
    reason,
    actedAt: command.now.toISOString(),
  });
  return { ok: true, code: "updated", report: updated };
}

function reportFromRow(row: Record<string, unknown>): ModerationReport {
  const post = row.posts as Record<string, unknown> | null | undefined;
  return {
    id: String(row.id),
    reporterId: String(row.reporter_id),
    postId: String(row.post_id),
    postAuthorId: String(post?.author_id),
    postTitle: String(post?.title),
    postState: post?.state as ModerationReport["postState"],
    reasonCode: String(row.reason_code),
    details: typeof row.details === "string" ? row.details : null,
    state: row.state as ModerationReport["state"],
    createdAt: String(row.created_at),
  };
}

const REPORT_SELECT = "*, posts!reports_post_id_fkey(id,author_id,title,state)";

export function createSupabaseModerationRepository(
  client: SupabaseClient,
): CommunityModerationRepository & {
  listReports(): Promise<ModerationReport[]>;
  listAudit(): Promise<Record<string, unknown>[]>;
} {
  return {
    async getReport(id) {
      const { data, error } = await client
        .from("reports")
        .select(REPORT_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? reportFromRow(data) : null;
    },
    async applyAction({ reportId, action, reason, actedAt }) {
      const { data, error } = await client
        .rpc("moderate_community_report", {
          p_report_id: reportId,
          p_action: action,
          p_reason: reason,
          p_acted_at: actedAt,
        })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Expected moderated report");
      const refreshed = await this.getReport(String(data.id));
      if (!refreshed) throw new Error("Expected refreshed report");
      return refreshed;
    },
    async listReports() {
      const { data, error } = await client
        .from("reports")
        .select(REPORT_SELECT)
        .in("state", ["open", "triaged", "actioned", "appealed"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(reportFromRow);
    },
    async listAudit() {
      const [{ data: actions, error: actionError }, { data: audits, error: auditError }] =
        await Promise.all([
          client.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(100),
          client.from("audit_events").select("*").order("created_at", { ascending: false }).limit(100),
        ]);
      if (actionError) throw actionError;
      if (auditError) throw auditError;
      return [...(actions ?? []), ...(audits ?? [])].sort((left, right) =>
        String(right.created_at).localeCompare(String(left.created_at)),
      );
    },
  };
}
