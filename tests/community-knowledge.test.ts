import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  acceptCommunityAnswer,
  getCommunitySourceFreshness,
  linkCommunityEvent,
  promoteCommunityNote,
  type CommunityKnowledgeRepository,
  type KnowledgePost,
  type PromotedCommunityNote,
} from "../app/lib/server/community/knowledge.ts";

const member: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "member",
  artistStatus: "none",
};
const moderator: CommunityActor = { ...member, role: "moderator" };

class MemoryKnowledgeRepository implements CommunityKnowledgeRepository {
  post: KnowledgePost = {
    id: "post-1",
    authorId: "author-1",
    authorName: "종이작가",
    state: "published",
    kind: "question",
    title: "행사 준비 질문",
    body: "행사 준비 순서를 묻습니다.",
    isResolved: false,
    acceptedCommentId: null,
    eventId: null,
    source: {
      label: "공식 안내",
      url: "https://example.com/official",
      checkedAt: "2026-07-01",
      validForDays: 30,
    },
  };
  notes: PromotedCommunityNote[] = [];

  async getPost(id: string) { return id === this.post.id ? this.post : null; }
  async getComment(id: string) {
    return id === "comment-1"
      ? { id, postId: "post-1", authorId: "answerer-1", body: "공식 공지를 확인했습니다." }
      : null;
  }
  async acceptAnswer(commentId: string) {
    this.post.acceptedCommentId = commentId;
    this.post.isResolved = true;
    return this.post;
  }
  async linkEvent(_postId: string, eventId: string) { this.post.eventId = eventId; return this.post; }
  async promoteNote(note: PromotedCommunityNote) { this.notes.push(note); return note; }
}

test("computes source freshness from the checked date and explicit window", () => {
  assert.equal(getCommunitySourceFreshness({ checkedAt: "2026-07-01", validForDays: 30, now: new Date("2026-07-20T00:00:00Z") }), "fresh");
  assert.equal(getCommunitySourceFreshness({ checkedAt: "2026-07-01", validForDays: 30, now: new Date("2026-08-01T00:00:00Z") }), "stale");
  assert.equal(getCommunitySourceFreshness({ checkedAt: null, validForDays: 30, now: new Date() }), "missing");
});

test("only the post author accepts an answer belonging to a published question", async () => {
  const repository = new MemoryKnowledgeRepository();
  const denied = await acceptCommunityAnswer({ actor: member, userId: "other", postId: "post-1", commentId: "comment-1", now: new Date() }, { repository });
  assert.equal(denied.code, "forbidden");
  const accepted = await acceptCommunityAnswer({ actor: member, userId: "author-1", postId: "post-1", commentId: "comment-1", now: new Date() }, { repository });
  assert.equal(accepted.post?.isResolved, true);
  assert.equal(accepted.post?.acceptedCommentId, "comment-1");

  repository.post.state = "locked";
  const locked = await acceptCommunityAnswer({ actor: member, userId: "author-1", postId: "post-1", commentId: "comment-1", now: new Date() }, { repository });
  assert.equal(locked.code, "invalid-answer");
});

test("links a maintained event id without granting unrelated members edit access", async () => {
  const repository = new MemoryKnowledgeRepository();
  assert.equal((await linkCommunityEvent({ actor: member, userId: "other", postId: "post-1", eventId: "illustar-2026-winter", now: new Date() }, { repository })).code, "forbidden");
  assert.equal((await linkCommunityEvent({ actor: member, userId: "author-1", postId: "post-1", eventId: "illustar-2026-winter", now: new Date() }, { repository })).post?.eventId, "illustar-2026-winter");

  for (const actor of [
    { ...member, accountStatus: "suspended" as const },
    { ...moderator, accountStatus: "deleted" as const },
  ]) {
    const denied = await linkCommunityEvent(
      { actor, userId: "author-1", postId: "post-1", eventId: "seoul-illustration-2026-v20", now: new Date() },
      { repository },
    );
    assert.equal(denied.code, "forbidden");
  }
  assert.equal(repository.post.eventId, "illustar-2026-winter");
});

test("hides event-link management for an inactive post author", async () => {
  const page = await readFile(
    new URL("../app/community/general/[slug]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    page,
    /canManage=\{[\s\S]*?accountStatus\s*===\s*"active"[\s\S]*?session\.member\.id\s*===\s*liveAuthorId[\s\S]*?\}/,
  );
});

test("promotes only resolved visible sourced posts and preserves provenance", async () => {
  const repository = new MemoryKnowledgeRepository();
  assert.equal((await promoteCommunityNote({ actor: moderator, operatorId: "mod-1", postId: "post-1", slug: "event-prep-answer", summary: "행사 준비 답변을 정리했습니다.", now: new Date() }, { repository, ids: { note: () => "note-1" } })).code, "not-resolved");
  repository.post.isResolved = true;
  repository.post.acceptedCommentId = "comment-1";
  const promoted = await promoteCommunityNote({ actor: moderator, operatorId: "mod-1", postId: "post-1", slug: "event-prep-answer", summary: "행사 준비 답변을 정리했습니다.", now: new Date("2026-07-28T12:00:00+09:00") }, { repository, ids: { note: () => "note-1" } });
  assert.equal(promoted.note?.sourcePostId, "post-1");
  assert.equal(promoted.note?.sourceAuthorId, "author-1");
  assert.equal(promoted.note?.sourceUrl, "https://example.com/official");

  repository.post.state = "hidden";
  assert.equal((await promoteCommunityNote({ actor: moderator, operatorId: "mod-1", postId: "post-1", slug: "hidden-note", summary: "숨김 글", now: new Date() }, { repository },)).code, "not-promotable");
});
