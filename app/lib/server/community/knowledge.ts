import type { SupabaseClient } from "@supabase/supabase-js";

import { getCommunityAccess, type CommunityActor } from "../../community-access.ts";

export type KnowledgeSource = {
  label: string;
  url: string;
  checkedAt: string;
  validForDays: number;
};

export type KnowledgePost = {
  id: string;
  authorId: string;
  authorName: string;
  state: "draft" | "published" | "under_review" | "hidden" | "locked" | "deleted";
  kind: "experience" | "fact" | "question";
  title: string;
  body: string;
  isResolved: boolean;
  acceptedCommentId: string | null;
  eventId: string | null;
  source: KnowledgeSource | null;
};

export type PromotedCommunityNote = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  sourcePostId: string;
  sourceAuthorId: string;
  sourceAuthorName: string;
  sourceUrl: string;
  sourceCheckedAt: string;
  promotedBy: string;
  promotedAt: string;
};

export type CommunityKnowledgeRepository = {
  getPost(id: string): Promise<KnowledgePost | null>;
  getComment(id: string): Promise<{
    id: string;
    postId: string;
    authorId: string;
    body: string;
  } | null>;
  acceptAnswer(commentId: string, acceptedAt: string): Promise<KnowledgePost>;
  linkEvent(postId: string, eventId: string, linkedAt: string): Promise<KnowledgePost>;
  promoteNote(note: PromotedCommunityNote): Promise<PromotedCommunityNote>;
};

export function getCommunitySourceFreshness({
  checkedAt,
  validForDays,
  now,
}: {
  checkedAt: string | null;
  validForDays: number;
  now: Date;
}): "fresh" | "stale" | "missing" {
  if (!checkedAt || validForDays < 1) return "missing";
  const checkedTime = Date.parse(`${checkedAt}T00:00:00Z`);
  if (Number.isNaN(checkedTime)) return "missing";
  return now.getTime() < checkedTime + validForDays * 86_400_000
    ? "fresh"
    : "stale";
}

export async function acceptCommunityAnswer(
  command: {
    actor: CommunityActor;
    userId: string;
    postId: string;
    commentId: string;
    now: Date;
  },
  dependencies: { repository: CommunityKnowledgeRepository },
) {
  const post = await dependencies.repository.getPost(command.postId);
  if (!post) return { ok: false, code: "not-found", message: "게시글을 찾을 수 없습니다." };
  if (
    !command.actor.authenticated ||
    command.actor.accountStatus !== "active" ||
    post.authorId !== command.userId
  ) {
    return { ok: false, code: "forbidden", message: "글 작성자만 답변을 채택할 수 있습니다." };
  }
  const comment = await dependencies.repository.getComment(command.commentId);
  if (
    post.kind !== "question" ||
    post.state !== "published" ||
    !comment ||
    comment.postId !== post.id
  ) {
    return { ok: false, code: "invalid-answer", message: "이 글의 공개 댓글만 채택할 수 있습니다." };
  }
  const updated = await dependencies.repository.acceptAnswer(
    comment.id,
    command.now.toISOString(),
  );
  return { ok: true, code: "accepted", post: updated };
}

export async function linkCommunityEvent(
  command: {
    actor: CommunityActor;
    userId: string;
    postId: string;
    eventId: string;
    now: Date;
  },
  dependencies: { repository: CommunityKnowledgeRepository },
) {
  if (
    !command.userId ||
    !command.actor.authenticated ||
    command.actor.accountStatus !== "active"
  ) {
    return { ok: false, code: "forbidden", message: "활성 회원만 행사를 연결할 수 있습니다." };
  }
  const post = await dependencies.repository.getPost(command.postId);
  if (!post) return { ok: false, code: "not-found", message: "게시글을 찾을 수 없습니다." };
  const isOperator = getCommunityAccess(command.actor).capabilities.includes("moderation:content");
  if (post.authorId !== command.userId && !isOperator) {
    return { ok: false, code: "forbidden", message: "행사 연결 권한이 없습니다." };
  }
  const eventId = command.eventId.trim();
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(eventId)) {
    return { ok: false, code: "invalid-input", message: "행사 식별값을 확인해 주세요." };
  }
  const updated = await dependencies.repository.linkEvent(
    post.id,
    eventId,
    command.now.toISOString(),
  );
  return { ok: true, code: "linked", post: updated };
}

export async function promoteCommunityNote(
  command: {
    actor: CommunityActor;
    operatorId: string;
    postId: string;
    slug: string;
    summary: string;
    now: Date;
  },
  dependencies: {
    repository: CommunityKnowledgeRepository;
    ids?: { note(): string };
  },
) {
  if (!getCommunityAccess(command.actor).capabilities.includes("moderation:content")) {
    return { ok: false, code: "forbidden", message: "운영자 권한이 필요합니다." };
  }
  const post = await dependencies.repository.getPost(command.postId);
  if (!post || post.state !== "published") {
    return { ok: false, code: "not-promotable", message: "공개 중인 글만 노트로 승격할 수 있습니다." };
  }
  if (!post.isResolved || !post.acceptedCommentId) {
    return { ok: false, code: "not-resolved", message: "채택 답변이 있는 해결된 질문만 승격할 수 있습니다." };
  }
  if (!post.source) {
    return { ok: false, code: "source-required", message: "확인 가능한 출처가 필요합니다." };
  }
  const slug = command.slug.trim().toLowerCase();
  const summary = command.summary.trim().replace(/\s+/g, " ");
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug) || summary.length < 10 || summary.length > 240) {
    return { ok: false, code: "invalid-input", message: "노트 주소와 요약을 확인해 주세요." };
  }
  const answer = await dependencies.repository.getComment(post.acceptedCommentId);
  if (!answer || answer.postId !== post.id) {
    return { ok: false, code: "invalid-answer", message: "채택 답변을 찾을 수 없습니다." };
  }
  const promotedAt = command.now.toISOString();
  const note: PromotedCommunityNote = {
    id: dependencies.ids?.note() ?? crypto.randomUUID(),
    slug,
    title: post.title,
    summary,
    body: `${post.body}\n\n채택 답변\n${answer.body}`,
    sourcePostId: post.id,
    sourceAuthorId: post.authorId,
    sourceAuthorName: post.authorName,
    sourceUrl: post.source.url,
    sourceCheckedAt: post.source.checkedAt,
    promotedBy: command.operatorId,
    promotedAt,
  };
  return {
    ok: true,
    code: "promoted",
    note: await dependencies.repository.promoteNote(note),
  };
}

function postFromRow(row: Record<string, unknown>): KnowledgePost {
  const profiles = row.profiles as { display_name?: unknown } | null;
  const sources = Array.isArray(row.post_sources)
    ? (row.post_sources as Record<string, unknown>[])
    : [];
  const source = sources.sort((left, right) => {
    const checkedOrder = String(right.checked_at).localeCompare(
      String(left.checked_at),
    );
    if (checkedOrder !== 0) return checkedOrder;
    const createdOrder = String(right.created_at).localeCompare(
      String(left.created_at),
    );
    return createdOrder || String(left.id).localeCompare(String(right.id));
  })[0];
  return {
    id: String(row.id),
    authorId: String(row.author_id),
    authorName: typeof profiles?.display_name === "string" ? profiles.display_name : "회원",
    state: row.state as KnowledgePost["state"],
    kind: row.kind as KnowledgePost["kind"],
    title: String(row.title),
    body: String(row.body),
    isResolved: row.is_resolved === true,
    acceptedCommentId: typeof row.accepted_comment_id === "string" ? row.accepted_comment_id : null,
    eventId: typeof row.event_id === "string" ? row.event_id : null,
    source: source
      ? {
          label: String(source.label),
          url: String(source.url),
          checkedAt: String(source.checked_at),
          validForDays: Number(source.valid_for_days),
        }
      : null,
  };
}

function noteFromRow(row: Record<string, unknown>): PromotedCommunityNote {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary),
    body: String(row.body),
    sourcePostId: String(row.source_post_id),
    sourceAuthorId: String(row.source_author_id),
    sourceAuthorName: String(row.source_author_name),
    sourceUrl: String(row.source_url),
    sourceCheckedAt: String(row.source_checked_at),
    promotedBy: String(row.promoted_by),
    promotedAt: String(row.promoted_at),
  };
}

export function createSupabaseKnowledgeRepository(client: SupabaseClient) {
  return {
    async getPost(id: string) {
      const { data, error } = await client
        .from("posts")
        .select("*, profiles!posts_author_id_fkey(display_name), post_sources(id,label,url,checked_at,valid_for_days,created_at)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? postFromRow(data) : null;
    },
    async getComment(id: string) {
      const { data, error } = await client
        .from("comments")
        .select("id,post_id,author_id,body")
        .eq("id", id)
        .eq("state", "published")
        .maybeSingle();
      if (error) throw error;
      return data
        ? { id: String(data.id), postId: String(data.post_id), authorId: String(data.author_id), body: String(data.body) }
        : null;
    },
    async acceptAnswer(commentId: string, acceptedAt: string) {
      const { data, error } = await client
        .rpc("accept_community_answer", { p_comment_id: commentId, p_accepted_at: acceptedAt })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Expected accepted post");
      return postFromRow(data as Record<string, unknown>);
    },
    async linkEvent(postId: string, eventId: string, linkedAt: string) {
      const { data, error } = await client
        .rpc("link_community_event", { p_post_id: postId, p_event_id: eventId, p_linked_at: linkedAt })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Expected linked post");
      return postFromRow(data as Record<string, unknown>);
    },
    async promoteNote(note: PromotedCommunityNote) {
      const { data, error } = await client
        .rpc("promote_community_note", {
          p_id: note.id,
          p_source_post_id: note.sourcePostId,
          p_slug: note.slug,
          p_summary: note.summary,
        })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Expected promoted note");
      return noteFromRow(data as Record<string, unknown>);
    },
    async listPromotedNotes() {
      const { data, error } = await client
        .from("community_note_promotions")
        .select("*")
        .order("promoted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(noteFromRow);
    },
    async getPromotedNote(slug: string) {
      const { data, error } = await client
        .from("community_note_promotions")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data ? noteFromRow(data) : null;
    },
  } satisfies CommunityKnowledgeRepository & {
    listPromotedNotes(): Promise<PromotedCommunityNote[]>;
    getPromotedNote(slug: string): Promise<PromotedCommunityNote | null>;
  };
}
