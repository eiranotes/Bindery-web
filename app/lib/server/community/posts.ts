import type { SupabaseClient } from "@supabase/supabase-js";

import { getCommunityAccess, type CommunityActor } from "../../community-access.ts";
import {
  COMMUNITY_CATEGORY_CATALOG,
  type CommunityPost,
  type CommunityCategoryId,
} from "../../community.ts";
import { normalizePublicProofUrl } from "./verification.ts";

export type DurableCommunityPostState =
  | "draft"
  | "published"
  | "under_review"
  | "hidden"
  | "locked"
  | "deleted";

export type DurableCommunitySource = {
  label: string;
  url: string;
  checkedAt: string;
};

export type DurableCommunityPost = {
  id: string;
  boardId: "general" | "artists";
  authorId: string;
  authorName: string | null;
  categoryId: CommunityCategoryId;
  kind: "experience" | "fact" | "question";
  state: DurableCommunityPostState;
  title: string;
  body: string;
  isResolved: boolean;
  source: DurableCommunitySource | null;
  publishedAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type DurableCommunityComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
};

export function durableCommunityPostToView(
  post: DurableCommunityPost,
): CommunityPost {
  const paragraphs = post.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const status = post.isResolved
    ? "해결"
    : post.kind === "question"
      ? "답변 대기"
      : post.kind === "fact"
        ? "최신 확인 필요"
        : "경험 공유";

  return {
    slug: post.id,
    boardId: post.boardId,
    categoryId: post.categoryId,
    title: post.title,
    excerpt: paragraphs[0]?.slice(0, 180) ?? post.body.slice(0, 180),
    body: paragraphs.length > 0 ? paragraphs : [post.body],
    author: post.authorName ?? "회원",
    authorLabel: "방문자 역할",
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    status,
    commentCount: 0,
    usefulCount: 0,
    tags: [],
    source: post.source
      ? {
          label: post.source.label,
          url: post.source.url,
          checkedAt: post.source.checkedAt,
        }
      : undefined,
  };
}

export type CommunityOperationsRepository = {
  checkProvisionalLimit?(input: {
    action: "post" | "comment";
    now: string;
  }): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  createPost(post: DurableCommunityPost): Promise<DurableCommunityPost>;
  getPost(id: string): Promise<DurableCommunityPost | null>;
  softDeletePost(input: {
    postId: string;
    actorId: string;
    reason: string;
    deletedAt: string;
  }): Promise<DurableCommunityPost>;
  createComment(input: {
    id: string;
    postId: string;
    authorId: string;
    body: string;
    createdAt: string;
  }): Promise<{
    id: string;
    postId: string;
    authorId: string;
    body: string;
    state: "published";
    createdAt: string;
  }>;
  setBookmark(input: {
    userId: string;
    postId: string;
    saved: boolean;
  }): Promise<boolean>;
  createReport(input: {
    id: string;
    reporterId: string;
    postId: string;
    reasonCode: string;
    details: string | null;
    createdAt: string;
  }): Promise<{ id: string; existing: boolean }>;
};

export type CommunityOperationDependencies = {
  repository: CommunityOperationsRepository;
  ids?: {
    post?(): string;
    comment?(): string;
    report?(): string;
  };
};

type OperationResult = {
  ok: boolean;
  code: string;
  message?: string;
  post?: DurableCommunityPost;
  saved?: boolean;
  retryAfterSeconds?: number;
};

const CATEGORY_IDS = new Set<string>(
  COMMUNITY_CATEGORY_CATALOG.map((category) => category.id),
);

function cleanInlineText(value: string, maximum: number) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= maximum ? cleaned : null;
}

function cleanBody(value: string, minimum: number, maximum: number) {
  const cleaned = value.trim().replace(/\r\n/g, "\n");
  return cleaned.length >= minimum && cleaned.length <= maximum ? cleaned : null;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function canReadPost(actor: CommunityActor, post: DurableCommunityPost) {
  const access = getCommunityAccess(actor);
  return post.boardId === "general"
    ? access.capabilities.includes("general:read")
    : access.capabilities.includes("artist:read");
}

function canWriteBoard(actor: CommunityActor, boardId: DurableCommunityPost["boardId"]) {
  const access = getCommunityAccess(actor);
  return boardId === "general"
    ? access.capabilities.includes("general:write")
    : access.capabilities.includes("artist:write");
}

export async function createCommunityPost(
  command: {
    actor: CommunityActor;
    userId: string;
    input: {
      boardId: DurableCommunityPost["boardId"];
      categoryId: CommunityCategoryId;
      kind: DurableCommunityPost["kind"];
      title: string;
      body: string;
      source?: DurableCommunitySource | null;
    };
    now: Date;
  },
  dependencies: CommunityOperationDependencies,
): Promise<OperationResult> {
  if (!command.userId || !canWriteBoard(command.actor, command.input.boardId)) {
    return { ok: false, code: "forbidden", message: "게시 권한이 없습니다." };
  }

  if (
    command.input.boardId === "artists" &&
    command.actor.artistStatus === "provisional"
  ) {
    if (!dependencies.repository.checkProvisionalLimit) {
      return {
        ok: false,
        code: "rate-control-unavailable",
        message: "임시 승인 이용 제한을 확인하지 못했습니다.",
      };
    }
    const limit = await dependencies.repository.checkProvisionalLimit({
      action: "post",
      now: command.now.toISOString(),
    });
    if (!limit.allowed) {
      return {
        ok: false,
        code: "rate-limited",
        message: "임시 승인 상태에서는 24시간에 글 1개까지 작성할 수 있습니다.",
        retryAfterSeconds: limit.retryAfterSeconds,
      };
    }
  }

  const title = cleanInlineText(command.input.title, 120);
  const body = cleanBody(command.input.body, 10, 20_000);
  const categoryId = CATEGORY_IDS.has(command.input.categoryId)
    ? command.input.categoryId
    : null;
  const kind = ["experience", "fact", "question"].includes(command.input.kind)
    ? command.input.kind
    : null;
  let source: DurableCommunitySource | null = null;

  if (command.input.source) {
    const label = cleanInlineText(command.input.source.label, 120);
    const url = normalizePublicProofUrl(command.input.source.url);
    if (!label || !url || !isIsoDate(command.input.source.checkedAt)) {
      return { ok: false, code: "invalid-input", message: "출처 정보를 확인해 주세요." };
    }
    source = { label, url, checkedAt: command.input.source.checkedAt };
  }

  if (!title || !body || !categoryId || !kind) {
    return { ok: false, code: "invalid-input", message: "게시글 내용을 확인해 주세요." };
  }

  const timestamp = command.now.toISOString();
  const post: DurableCommunityPost = {
    id: dependencies.ids?.post?.() ?? crypto.randomUUID(),
    boardId: command.input.boardId,
    authorId: command.userId,
    authorName: null,
    categoryId,
    kind,
    state: "published",
    title,
    body,
    isResolved: false,
    source,
    publishedAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };

  return {
    ok: true,
    code: "created",
    post: await dependencies.repository.createPost(post),
  };
}

export async function setCommunityBookmark(
  command: {
    actor: CommunityActor;
    userId: string;
    postId: string;
    saved: boolean;
  },
  dependencies: Pick<CommunityOperationDependencies, "repository">,
): Promise<OperationResult> {
  const post = await dependencies.repository.getPost(command.postId);
  if (
    !post ||
    !command.userId ||
    !command.actor.authenticated ||
    command.actor.accountStatus !== "active" ||
    !canReadPost(command.actor, post)
  ) {
    return { ok: false, code: "forbidden", message: "저장 권한이 없습니다." };
  }

  const saved = await dependencies.repository.setBookmark({
    userId: command.userId,
    postId: post.id,
    saved: command.saved,
  });
  return { ok: true, code: saved ? "saved" : "removed", saved };
}

export async function softDeleteCommunityPost(
  command: {
    actor: CommunityActor;
    userId: string;
    postId: string;
    reason: string;
    now: Date;
  },
  dependencies: Pick<CommunityOperationDependencies, "repository">,
): Promise<OperationResult> {
  const post = await dependencies.repository.getPost(command.postId);
  if (!post) {
    return { ok: false, code: "not-found", message: "게시글을 찾을 수 없습니다." };
  }
  const isOperator = command.actor.role === "moderator" || command.actor.role === "admin";
  if (post.authorId !== command.userId && !isOperator) {
    return { ok: false, code: "forbidden", message: "삭제 권한이 없습니다." };
  }
  const reason = cleanInlineText(command.reason, 500);
  if (!reason) {
    return { ok: false, code: "invalid-input", message: "삭제 사유가 필요합니다." };
  }

  const deleted = await dependencies.repository.softDeletePost({
    postId: post.id,
    actorId: command.userId,
    reason,
    deletedAt: command.now.toISOString(),
  });
  return { ok: true, code: "deleted", post: deleted };
}

function postFromRow(row: Record<string, unknown>): DurableCommunityPost {
  const profiles = row.profiles as { display_name?: unknown } | null | undefined;
  const sources = Array.isArray(row.post_sources)
    ? (row.post_sources as Record<string, unknown>[])
    : [];
  const sourceRow = sources[0];
  return {
    id: String(row.id),
    boardId: row.board_id as DurableCommunityPost["boardId"],
    authorId: String(row.author_id),
    authorName:
      typeof profiles?.display_name === "string" ? profiles.display_name : null,
    categoryId: row.category_id as CommunityCategoryId,
    kind: row.kind as DurableCommunityPost["kind"],
    state: row.state as DurableCommunityPostState,
    title: String(row.title),
    body: String(row.body),
    isResolved: row.is_resolved === true,
    source: sourceRow
      ? {
          label: String(sourceRow.label),
          url: String(sourceRow.url),
          checkedAt: String(sourceRow.checked_at),
        }
      : null,
    publishedAt: String(row.published_at),
    updatedAt: String(row.updated_at),
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
  };
}

const POST_SELECT =
  "*, profiles!posts_author_id_fkey(display_name), post_sources(label,url,checked_at)";

export function createSupabaseCommunityRepository(
  client: SupabaseClient,
): CommunityOperationsRepository & {
  listPosts(input: {
    boardId: "general" | "artists";
    categoryId?: CommunityCategoryId;
    limit?: number;
  }): Promise<DurableCommunityPost[]>;
  listComments(postId: string): Promise<DurableCommunityComment[]>;
  isBookmarked(userId: string, postId: string): Promise<boolean>;
} {
  return {
    async checkProvisionalLimit({ action, now }) {
      const { data, error } = await client
        .rpc("check_provisional_artist_content_limit", {
          p_action: action,
          p_now: now,
        })
        .maybeSingle();
      if (error) throw error;
      return {
        allowed: data?.allowed === true,
        retryAfterSeconds:
          typeof data?.retry_after_seconds === "number"
            ? data.retry_after_seconds
            : 24 * 60 * 60,
      };
    },
    async createPost(post) {
      const { data, error } = await client
        .rpc("create_community_post", {
          p_id: post.id,
          p_board_id: post.boardId,
          p_category_id: post.categoryId,
          p_kind: post.kind,
          p_title: post.title,
          p_body: post.body,
          p_source_label: post.source?.label ?? null,
          p_source_url: post.source?.url ?? null,
          p_source_checked_at: post.source?.checkedAt ?? null,
          p_published_at: post.publishedAt,
        })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Expected created post");
      return { ...postFromRow(data), source: post.source };
    },
    async getPost(id) {
      const { data, error } = await client
        .from("posts")
        .select(POST_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? postFromRow(data) : null;
    },
    async softDeletePost({ postId, reason, deletedAt }) {
      const { data, error } = await client
        .rpc("soft_delete_community_post", {
          p_post_id: postId,
          p_reason: reason,
          p_deleted_at: deletedAt,
        })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Expected deleted post");
      return postFromRow(data);
    },
    async createComment(input) {
      const { data, error } = await client
        .from("comments")
        .insert({
          id: input.id,
          post_id: input.postId,
          author_id: input.authorId,
          body: input.body,
          state: "published",
          created_at: input.createdAt,
        })
        .select("*")
        .single();
      if (error) throw error;
      return {
        id: String(data.id),
        postId: String(data.post_id),
        authorId: String(data.author_id),
        body: String(data.body),
        state: "published",
        createdAt: String(data.created_at),
      };
    },
    async setBookmark({ userId, postId, saved }) {
      const query = saved
        ? client.from("bookmarks").upsert({ user_id: userId, post_id: postId })
        : client.from("bookmarks").delete().eq("user_id", userId).eq("post_id", postId);
      const { error } = await query;
      if (error) throw error;
      return saved;
    },
    async createReport(input) {
      const { data: existing, error: findError } = await client
        .from("reports")
        .select("id")
        .eq("reporter_id", input.reporterId)
        .eq("post_id", input.postId)
        .eq("reason_code", input.reasonCode)
        .not("state", "in", "(dismissed,closed)")
        .maybeSingle();
      if (findError) throw findError;
      if (existing) return { id: String(existing.id), existing: true };

      const { data, error } = await client
        .from("reports")
        .insert({
          id: input.id,
          reporter_id: input.reporterId,
          post_id: input.postId,
          reason_code: input.reasonCode,
          details: input.details,
          created_at: input.createdAt,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { id: String(data.id), existing: false };
    },
    async listPosts({ boardId, categoryId, limit = 50 }) {
      let query = client
        .from("posts")
        .select(POST_SELECT)
        .eq("board_id", boardId)
        .eq("state", "published")
        .order("updated_at", { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 100));
      if (categoryId) query = query.eq("category_id", categoryId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(postFromRow);
    },
    async listComments(postId) {
      const { data, error } = await client
        .from("comments")
        .select("*, profiles!comments_author_id_fkey(display_name)")
        .eq("post_id", postId)
        .eq("state", "published")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const profiles = row.profiles as
          | { display_name?: unknown }
          | null
          | undefined;
        return {
          id: String(row.id),
          postId: String(row.post_id),
          authorId: String(row.author_id),
          authorName:
            typeof profiles?.display_name === "string"
              ? profiles.display_name
              : null,
          body: String(row.body),
          createdAt: String(row.created_at),
        };
      });
    },
    async isBookmarked(userId, postId) {
      const { data, error } = await client
        .from("bookmarks")
        .select("post_id")
        .eq("user_id", userId)
        .eq("post_id", postId)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
  };
}
