import assert from "node:assert/strict";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  searchCommunityPosts,
  type CommunitySearchPost,
  type CommunitySearchRepository,
  type CommunitySearchRepositoryInput,
} from "../app/lib/server/community/search.ts";

const anonymous: CommunityActor = {
  authenticated: false,
  accountStatus: "anonymous",
  role: "none",
  artistStatus: "none",
};

const provisionalArtist: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "member",
  artistStatus: "provisional",
};

const revokedArtist: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "member",
  artistStatus: "revoked",
};

const rows: CommunitySearchPost[] = [
  {
    id: "general-fresh",
    boardId: "general",
    authorId: "member-1",
    authorName: "종이산책",
    categoryId: "production",
    kind: "question",
    state: "published",
    title: "스티커 교정 순서",
    body: "칼선과 흰색 인쇄의 교정 순서를 확인합니다.",
    isResolved: true,
    source: {
      label: "제작사 안내",
      url: "https://example.com/guide",
      checkedAt: "2026-07-20",
      validForDays: 90,
    },
    freshness: "fresh",
    rank: 0.8,
    publishedAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
    deletedAt: null,
  },
  {
    id: "artist-match",
    boardId: "artists",
    authorId: "artist-1",
    authorName: "바늘종이",
    categoryId: "production",
    kind: "experience",
    state: "published",
    title: "스티커 제작소 교정 경험",
    body: "작가끼리 공유하는 제작소 경험입니다.",
    isResolved: false,
    source: null,
    freshness: "missing",
    rank: 0.7,
    publishedAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    deletedAt: null,
  },
  {
    id: "hidden-match",
    boardId: "general",
    authorId: "member-2",
    authorName: "숨김회원",
    categoryId: "production",
    kind: "fact",
    state: "hidden",
    title: "스티커 교정 숨김 글",
    body: "검색 결과에 절대 나오면 안 됩니다.",
    isResolved: false,
    source: null,
    freshness: "missing",
    rank: 1,
    publishedAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
    deletedAt: null,
  },
];

class RecordingSearchRepository implements CommunitySearchRepository {
  calls: CommunitySearchRepositoryInput[] = [];
  private readonly returnedRows: CommunitySearchPost[];

  constructor(returnedRows = rows) {
    this.returnedRows = returnedRows;
  }

  async search(input: CommunitySearchRepositoryInput) {
    this.calls.push(input);
    return this.returnedRows;
  }
}

test("anonymous all-board search authorizes general before querying and never leaks protected or hidden rows", async () => {
  const repository = new RecordingSearchRepository();

  const result = await searchCommunityPosts(
    {
      actor: anonymous,
      input: { query: "스티커 교정", board: "all" },
      now: new Date("2026-07-28T12:00:00.000Z"),
    },
    { repository },
  );

  assert.deepEqual(repository.calls[0]?.boardIds, ["general"]);
  assert.deepEqual(result.posts.map((post) => post.id), ["general-fresh"]);
});

test("a provisional artist may include artist results while revocation removes them before the repository is called", async () => {
  const allowedRepository = new RecordingSearchRepository();
  const allowed = await searchCommunityPosts(
    {
      actor: provisionalArtist,
      input: { query: "교정", board: "artists" },
      now: new Date("2026-07-28T12:00:00.000Z"),
    },
    { repository: allowedRepository },
  );
  assert.deepEqual(allowedRepository.calls[0]?.boardIds, ["artists"]);
  assert.deepEqual(allowed.posts.map((post) => post.id), ["artist-match"]);

  const revokedRepository = new RecordingSearchRepository();
  const revoked = await searchCommunityPosts(
    {
      actor: revokedArtist,
      input: { query: "교정", board: "artists" },
      now: new Date("2026-07-28T12:00:00.000Z"),
    },
    { repository: revokedRepository },
  );
  assert.equal(revokedRepository.calls.length, 0);
  assert.deepEqual(revoked.posts, []);
});

test("normalizes category, resolution, freshness, limit, and query filters for the Postgres seam", async () => {
  const repository = new RecordingSearchRepository([]);
  const result = await searchCommunityPosts(
    {
      actor: anonymous,
      input: {
        query: `  ${"교정 ".repeat(80)}  `,
        board: "general",
        categoryId: "production",
        resolution: "resolved",
        freshness: "fresh",
        limit: 500,
      },
      now: new Date("2026-07-28T12:00:00.000Z"),
    },
    { repository },
  );

  assert.deepEqual(repository.calls[0], {
    query: `${"교정 ".repeat(80)}`.trim().slice(0, 200),
    boardIds: ["general"],
    categoryId: "production",
    isResolved: true,
    freshness: "fresh",
    now: "2026-07-28T12:00:00.000Z",
    limit: 100,
  });
  assert.equal(result.filters.resolution, "resolved");
  assert.equal(result.filters.freshness, "fresh");
});

test("keeps equal-rank results in stable updated-at then id order", async () => {
  const repository = new RecordingSearchRepository([
    { ...rows[0], id: "b", rank: 0.5, updatedAt: "2026-07-20T00:00:00.000Z" },
    { ...rows[0], id: "a", rank: 0.5, updatedAt: "2026-07-20T00:00:00.000Z" },
    { ...rows[0], id: "newer", rank: 0.5, updatedAt: "2026-07-21T00:00:00.000Z" },
  ]);

  const result = await searchCommunityPosts(
    {
      actor: anonymous,
      input: { board: "general" },
      now: new Date("2026-07-28T12:00:00.000Z"),
    },
    { repository },
  );

  assert.deepEqual(result.posts.map((post) => post.id), ["newer", "a", "b"]);
});
