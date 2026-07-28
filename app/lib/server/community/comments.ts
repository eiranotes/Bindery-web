import { getCommunityAccess, type CommunityActor } from "../../community-access.ts";
import type { CommunityOperationDependencies } from "./posts.ts";

export async function createCommunityComment(
  command: {
    actor: CommunityActor;
    userId: string;
    postId: string;
    body: string;
    now: Date;
  },
  dependencies: CommunityOperationDependencies,
) {
  const post = await dependencies.repository.getPost(command.postId);
  const capabilities = getCommunityAccess(command.actor).capabilities;
  const canWrite = post?.boardId === "artists"
    ? capabilities.includes("artist:write")
    : capabilities.includes("general:write");
  const body = command.body.trim();
  if (!post || post.state !== "published" || !command.userId || !canWrite) {
    return { ok: false, code: "forbidden", message: "댓글 작성 권한이 없습니다." };
  }
  if (body.length < 1 || body.length > 5_000) {
    return { ok: false, code: "invalid-input", message: "댓글 내용을 확인해 주세요." };
  }

  if (post.boardId === "artists" && command.actor.artistStatus === "provisional") {
    if (!dependencies.repository.checkProvisionalLimit) {
      return {
        ok: false,
        code: "rate-control-unavailable",
        message: "임시 승인 이용 제한을 확인하지 못했습니다.",
      };
    }
    const limit = await dependencies.repository.checkProvisionalLimit({
      action: "comment",
      now: command.now.toISOString(),
    });
    if (!limit.allowed) {
      return {
        ok: false,
        code: "rate-limited",
        message: "임시 승인 상태에서는 24시간에 댓글 5개까지 작성할 수 있습니다.",
        retryAfterSeconds: limit.retryAfterSeconds,
      };
    }
  }

  const comment = await dependencies.repository.createComment({
    id: dependencies.ids?.comment?.() ?? crypto.randomUUID(),
    postId: post.id,
    authorId: command.userId,
    body,
    createdAt: command.now.toISOString(),
  });
  return { ok: true, code: "created", comment };
}
