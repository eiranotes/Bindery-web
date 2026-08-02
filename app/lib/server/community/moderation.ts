import type { SupabaseClient } from "@supabase/supabase-js";

import { getCommunityAccess, type CommunityActor } from "../../community-access.ts";

export type ModerationAction =
  | "triage"
  | "dismiss"
  | "hide"
  | "lock"
  | "restore"
  | "suspend_account"
  | "resolve_appeal"
  | "reject_appeal";

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

export type CommunityAppealContext = {
  reportId: string;
  postId: string;
  postTitle: string;
  affectedUserId: string;
  reportState: ModerationReport["state"];
  action: "hide" | "lock" | "suspend_account";
  actionAt: string;
  deadlineAt: string;
  appealedAt: string | null;
  appealReason: string | null;
};

export function isCommunityAppealExpired(
  deadlineAt: string,
  now: Date = new Date(),
) {
  const deadline = Date.parse(deadlineAt);
  return Number.isFinite(deadline) && deadline < now.getTime();
}

export type CommunityModerationRepository = {
  getReport(id: string): Promise<ModerationReport | null>;
  applyAction(input: {
    reportId: string;
    action: ModerationAction;
    reason: string;
  }): Promise<ModerationReport>;
  getAppealContext(reportId: string): Promise<CommunityAppealContext | null>;
  submitAppeal(input: {
    reportId: string;
    reason: string;
  }): Promise<CommunityAppealContext>;
};

const ADMIN_ONLY_ACTIONS = new Set<ModerationAction>([
  "suspend_account",
  "resolve_appeal",
  "reject_appeal",
]);

const ALLOWED_STATES: Record<ModerationAction, ModerationReport["state"][]> = {
  triage: ["open"],
  dismiss: ["open", "triaged"],
  hide: ["open", "triaged"],
  lock: ["open", "triaged"],
  restore: ["actioned"],
  suspend_account: ["open", "triaged"],
  resolve_appeal: ["appealed"],
  reject_appeal: ["appealed"],
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
  });
  return { ok: true, code: "updated", report: updated };
}

function canAppeal(actor: CommunityActor, userId: string) {
  return Boolean(
    userId
      && actor.authenticated
      && actor.accountStatus !== "deleted"
  );
}

export async function getCommunityAppealContext(
  command: { actor: CommunityActor; userId: string; reportId: string },
  dependencies: { repository: CommunityModerationRepository },
) {
  if (!canAppeal(command.actor, command.userId)) {
    return { ok: false, code: "forbidden", appeal: null } as const;
  }
  const appeal = await dependencies.repository.getAppealContext(command.reportId);
  if (!appeal) {
    return { ok: false, code: "not-found", appeal: null } as const;
  }
  if (appeal.affectedUserId !== command.userId) {
    return { ok: false, code: "forbidden", appeal: null } as const;
  }
  return { ok: true, code: "found", appeal } as const;
}

export async function submitCommunityAppeal(
  command: {
    actor: CommunityActor;
    userId: string;
    reportId: string;
    reason: string;
    now: Date;
  },
  dependencies: { repository: CommunityModerationRepository },
) {
  if (!canAppeal(command.actor, command.userId)) {
    return { ok: false, code: "forbidden", message: "이의제기 권한이 없습니다." } as const;
  }
  const reason = command.reason.trim();
  if (reason.length < 10 || reason.length > 2_000) {
    return { ok: false, code: "invalid-input", message: "이의제기 사유를 10자 이상 입력해 주세요." } as const;
  }
  const context = await dependencies.repository.getAppealContext(command.reportId);
  if (!context || context.affectedUserId !== command.userId) {
    return { ok: false, code: "forbidden", message: "이의제기 권한이 없습니다." } as const;
  }
  if (context.reportState !== "actioned") {
    return { ok: false, code: "invalid-transition", message: "현재 상태에서는 이의제기할 수 없습니다." } as const;
  }
  if (
    Number.isNaN(command.now.getTime())
    || Number.isNaN(Date.parse(context.deadlineAt))
    || command.now.getTime() > Date.parse(context.deadlineAt)
  ) {
    return { ok: false, code: "deadline-expired", message: "운영 조치 후 14일의 이의제기 기한이 지났습니다." } as const;
  }

  const appeal = await dependencies.repository.submitAppeal({
    reportId: context.reportId,
    reason,
  });
  return { ok: true, code: "appealed", appeal } as const;
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

function appealFromRow(row: Record<string, unknown>): CommunityAppealContext {
  return {
    reportId: String(row.report_id),
    postId: String(row.post_id),
    postTitle: String(row.post_title),
    affectedUserId: String(row.affected_user_id),
    reportState: row.report_state as CommunityAppealContext["reportState"],
    action: row.action_type as CommunityAppealContext["action"],
    actionAt: String(row.action_at),
    deadlineAt: String(row.deadline_at),
    appealedAt: typeof row.appealed_at === "string" ? row.appealed_at : null,
    appealReason: typeof row.appeal_reason === "string" ? row.appeal_reason : null,
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
    async applyAction({ reportId, action, reason }) {
      const { data, error } = await client
        .rpc("moderate_community_report", {
          p_report_id: reportId,
          p_action: action,
          p_reason: reason,
        })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Expected moderated report");
      const response = data as Record<string, unknown>;
      const refreshed = await this.getReport(String(response.id));
      if (!refreshed) throw new Error("Expected refreshed report");
      return refreshed;
    },
    async getAppealContext(reportId) {
      const { data, error } = await client
        .rpc("get_community_appeal_context", { p_report_id: reportId })
        .maybeSingle();
      if (error) throw error;
      return data ? appealFromRow(data as Record<string, unknown>) : null;
    },
    async submitAppeal({ reportId, reason }) {
      const { data, error } = await client
        .rpc("submit_community_appeal", {
          p_report_id: reportId,
          p_reason: reason,
        })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Expected submitted appeal");
      return appealFromRow(data as Record<string, unknown>);
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
