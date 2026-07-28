import assert from "node:assert/strict";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import { createCommunityComment } from "../app/lib/server/community/comments.ts";
import {
  createCommunityPost,
  type CommunityOperationsRepository,
  type DurableCommunityPost,
} from "../app/lib/server/community/posts.ts";

const provisional: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "member",
  artistStatus: "provisional",
};

const verified: CommunityActor = {
  ...provisional,
  artistStatus: "verified",
};

const member: CommunityActor = {
  ...provisional,
  artistStatus: "none",
};

class ArtistRepository implements CommunityOperationsRepository {
  posts: DurableCommunityPost[] = [];
  allowed = true;
  limitCalls: string[] = [];

  async checkProvisionalLimit(input: { action: "post" | "comment" }) {
    this.limitCalls.push(input.action);
    return { allowed: this.allowed, retryAfterSeconds: this.allowed ? 0 : 3600 };
  }

  async createPost(post: DurableCommunityPost) {
    this.posts.push(post);
    return post;
  }

  async getPost(id: string) {
    return this.posts.find((post) => post.id === id) ?? null;
  }

  async softDeletePost() {
    throw new Error("not used");
  }

  async createComment(input: { id: string; postId: string; authorId: string; body: string; createdAt: string }) {
    return { ...input, state: "published" as const };
  }

  async setBookmark() {
    return true;
  }

  async createReport() {
    return { id: "report", existing: false };
  }
}

const artistPost = {
  boardId: "artists" as const,
  categoryId: "production" as const,
  kind: "experience" as const,
  title: "행사 제작 실무 경험을 나눕니다",
  body: "작가 전용 게시판에서 확인할 제작 일정과 현장 경험을 정리합니다.",
  source: null,
};

test("denies artist-board writes without an active artist status", async () => {
  const repository = new ArtistRepository();
  const result = await createCommunityPost(
    { actor: member, userId: "member-1", input: artistPost, now: new Date() },
    { repository },
  );
  assert.equal(result.code, "forbidden");
  assert.equal(repository.posts.length, 0);
});

test("checks provisional post and comment limits and fails closed when exhausted", async () => {
  const repository = new ArtistRepository();
  repository.allowed = false;
  const blockedPost = await createCommunityPost(
    {
      actor: provisional,
      userId: "artist-1",
      input: artistPost,
      now: new Date(),
    },
    { repository },
  );
  assert.equal(blockedPost.code, "rate-limited");
  assert.equal(blockedPost.retryAfterSeconds, 3600);

  repository.allowed = true;
  const created = await createCommunityPost(
    {
      actor: provisional,
      userId: "artist-1",
      input: artistPost,
      now: new Date(),
    },
    { repository, ids: { post: () => "artist-post-1" } },
  );
  assert.equal(created.ok, true);

  repository.allowed = false;
  const blockedComment = await createCommunityComment(
    {
      actor: provisional,
      userId: "artist-1",
      postId: "artist-post-1",
      body: "임시 승인 댓글 제한을 확인합니다.",
      now: new Date(),
    },
    { repository },
  );
  assert.equal(blockedComment.code, "rate-limited");
  assert.deepEqual(repository.limitCalls, ["post", "post", "comment"]);
});

test("verified artists write without provisional rate checks", async () => {
  const repository = new ArtistRepository();
  repository.allowed = false;
  const result = await createCommunityPost(
    {
      actor: verified,
      userId: "artist-2",
      input: artistPost,
      now: new Date(),
    },
    { repository },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(repository.limitCalls, []);
});
