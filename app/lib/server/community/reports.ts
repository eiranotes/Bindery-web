import { getCommunityAccess, type CommunityActor } from "../../community-access.ts";
import type { CommunityOperationDependencies } from "./posts.ts";

const REPORT_REASONS = new Set([
  "spam",
  "harassment",
  "personal_information",
  "misinformation",
  "fraud",
  "other",
]);

export async function submitCommunityReport(
  command: {
    actor: CommunityActor;
    userId: string;
    postId: string;
    reasonCode: string;
    details?: string | null;
    now: Date;
  },
  dependencies: CommunityOperationDependencies,
) {
  const post = await dependencies.repository.getPost(command.postId);
  const capabilities = getCommunityAccess(command.actor).capabilities;
  const canRead = post?.boardId === "artists"
    ? capabilities.includes("artist:read")
    : capabilities.includes("general:read");
  const details = command.details?.trim() || null;
  if (
    !post ||
    post.state !== "published" ||
    !command.userId ||
    !command.actor.authenticated ||
    command.actor.accountStatus !== "active" ||
    !canRead
  ) {
    return { ok: false, code: "forbidden", message: "신고 권한이 없습니다." };
  }
  if (!REPORT_REASONS.has(command.reasonCode) || (details && details.length > 2_000)) {
    return { ok: false, code: "invalid-input", message: "신고 내용을 확인해 주세요." };
  }

  const report = await dependencies.repository.createReport({
    id: dependencies.ids?.report?.() ?? crypto.randomUUID(),
    reporterId: command.userId,
    postId: post.id,
    reasonCode: command.reasonCode,
    details,
    createdAt: command.now.toISOString(),
  });
  return {
    ok: true,
    code: report.existing ? "existing" : "created",
    reportId: report.id,
  };
}
