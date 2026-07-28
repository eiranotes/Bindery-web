import assert from "node:assert/strict";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  createCommunityPost,
  setCommunityBookmark,
  softDeleteCommunityPost,
  type CommunityOperationsRepository,
  type DurableCommunityPost,
} from "../app/lib/server/community/posts.ts";
import { createCommunityComment } from "../app/lib/server/community/comments.ts";
import { submitCommunityReport } from "../app/lib/server/community/reports.ts";

const anonymous: CommunityActor = {
  authenticated: false,
  accountStatus: "anonymous",
  role: "none",
  artistStatus: "none",
};

const member: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "member",
  artistStatus: "none",
};

class MemoryCommunityRepository implements CommunityOperationsRepository {
  posts: DurableCommunityPost[] = [];
  comments: Array<{ id: string; postId: string; authorId: string; body: string }> = [];
  bookmarks = new Set<string>();
  reports = new Map<string, string>();

  async createPost(post: DurableCommunityPost) {
    this.posts.push(post);
    return post;
  }

  async getPost(id: string) {
    return this.posts.find((post) => post.id === id) ?? null;
  }

  async softDeletePost({ postId, deletedAt }: { postId: string; actorId: string; reason: string; deletedAt: string }) {
    const post = await this.getPost(postId);
    if (!post) throw new Error("post not found");
    post.state = "deleted";
    post.deletedAt = deletedAt;
    return post;
  }

  async createComment(comment: { id: string; postId: string; authorId: string; body: string; createdAt: string }) {
    this.comments.push(comment);
    return { ...comment, state: "published" as const };
  }

  async setBookmark({ userId, postId, saved }: { userId: string; postId: string; saved: boolean }) {
    const key = `${userId}:${postId}`;
    if (saved) this.bookmarks.add(key);
    else this.bookmarks.delete(key);
    return saved;
  }

  async createReport(input: { id: string; reporterId: string; postId: string; reasonCode: string; details: string | null; createdAt: string }) {
    const key = `${input.reporterId}:${input.postId}:${input.reasonCode}`;
    const existing = this.reports.get(key);
    if (existing) return { id: existing, existing: true };
    this.reports.set(key, input.id);
    return { id: input.id, existing: false };
  }
}

const validPost = {
  boardId: "general" as const,
  categoryId: "production" as const,
  kind: "question" as const,
  title: "소량 제작 교정 순서를 확인하고 싶어요",
  body: "칼선과 흰색 인쇄를 어떤 순서로 확인하는지 경험을 나눠 주세요.",
  source: {
    label: "제작사 공식 안내",
    url: "https://example.com/guide?utm_source=test",
    checkedAt: "2026-07-28",
  },
};

test("denies anonymous posting and creates a sourced general post for an active member", async () => {
  const repository = new MemoryCommunityRepository();
  const denied = await createCommunityPost(
    { actor: anonymous, userId: "", input: validPost, now: new Date() },
    { repository },
  );
  assert.equal(denied.code, "forbidden");

  const created = await createCommunityPost(
    {
      actor: member,
      userId: "member-1",
      input: validPost,
      now: new Date("2026-07-28T12:00:00+09:00"),
    },
    { repository, ids: { post: () => "post-1" } },
  );
  assert.equal(created.ok, true);
  assert.equal(created.post?.state, "published");
  assert.equal(created.post?.source?.url, "https://example.com/guide");
});

test("rejects unsafe source URLs before storage", async () => {
  const repository = new MemoryCommunityRepository();
  const result = await createCommunityPost(
    {
      actor: member,
      userId: "member-1",
      input: {
        ...validPost,
        source: { ...validPost.source, url: "http://127.0.0.1/private" },
      },
      now: new Date(),
    },
    { repository },
  );
  assert.equal(result.code, "invalid-input");
  assert.equal(repository.posts.length, 0);
});

test("persists comments and idempotent bookmarks and reports for readable posts", async () => {
  const repository = new MemoryCommunityRepository();
  await createCommunityPost(
    { actor: member, userId: "member-1", input: validPost, now: new Date() },
    { repository, ids: { post: () => "post-1" } },
  );

  const comment = await createCommunityComment(
    {
      actor: member,
      userId: "member-2",
      postId: "post-1",
      body: "교정 PDF와 실물 샘플을 따로 확인하는 편이 안전했습니다.",
      now: new Date(),
    },
    { repository, ids: { comment: () => "comment-1" } },
  );
  assert.equal(comment.ok, true);

  assert.equal(
    (await setCommunityBookmark(
      { actor: member, userId: "member-2", postId: "post-1", saved: true },
      { repository },
    )).saved,
    true,
  );
  assert.equal(repository.bookmarks.size, 1);

  const firstReport = await submitCommunityReport(
    {
      actor: member,
      userId: "member-2",
      postId: "post-1",
      reasonCode: "misinformation",
      details: "공식 안내와 다른 부분을 확인해 주세요.",
      now: new Date(),
    },
    { repository, ids: { report: () => "report-1" } },
  );
  const repeatedReport = await submitCommunityReport(
    {
      actor: member,
      userId: "member-2",
      postId: "post-1",
      reasonCode: "misinformation",
      details: "같은 신고",
      now: new Date(),
    },
    { repository, ids: { report: () => "report-2" } },
  );
  assert.equal(firstReport.code, "created");
  assert.equal(repeatedReport.code, "existing");
});

test("only the author or an operator can soft-delete a post with a reason", async () => {
  const repository = new MemoryCommunityRepository();
  await createCommunityPost(
    { actor: member, userId: "member-1", input: validPost, now: new Date() },
    { repository, ids: { post: () => "post-1" } },
  );

  const denied = await softDeleteCommunityPost(
    {
      actor: member,
      userId: "member-2",
      postId: "post-1",
      reason: "다른 사람 글",
      now: new Date(),
    },
    { repository },
  );
  assert.equal(denied.code, "forbidden");

  const deleted = await softDeleteCommunityPost(
    {
      actor: member,
      userId: "member-1",
      postId: "post-1",
      reason: "내용을 다시 정리해 올릴 예정",
      now: new Date(),
    },
    { repository },
  );
  assert.equal(deleted.post?.state, "deleted");
});
