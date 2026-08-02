import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  communityCorrectionHttpStatus,
  correctCommunityPost,
  type CommunityOperationsRepository,
  type DurableCommunityPost,
} from "../app/lib/server/community/posts.ts";
import {
  communitySearchPageHref,
  decodeCommunitySearchCursor,
  searchCommunityPosts,
  type CommunitySearchPost,
  type CommunitySearchRepository,
  type CommunitySearchRepositoryInput,
} from "../app/lib/server/community/search.ts";

const member: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "member",
  artistStatus: "none",
};

const operator: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "moderator",
  artistStatus: "none",
};

function post(overrides: Partial<DurableCommunityPost> = {}): DurableCommunityPost {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    boardId: "general",
    authorId: "author-1",
    authorName: "종이산책",
    categoryId: "production",
    kind: "fact",
    state: "published",
    title: "수정 전 제작 안내",
    body: "수정하기 전 제작 안내 본문입니다.",
    isResolved: false,
    source: {
      label: "이전 제작사 안내",
      url: "https://example.com/old",
      checkedAt: "2026-01-01",
    },
    publishedAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

class CorrectionRepository implements CommunityOperationsRepository {
  stored = post();
  corrections: Array<Record<string, unknown>> = [];
  getPostCalls = 0;

  async createPost(value: DurableCommunityPost) {
    this.stored = value;
    return value;
  }

  async getPost(id: string) {
    this.getPostCalls += 1;
    return id === this.stored.id ? this.stored : null;
  }

  async correctPost(input: {
    postId: string;
    title: string;
    body: string;
    reason: string;
    source: { label: string; url: string; checkedAt: string } | null;
  }) {
    this.corrections.push(input);
    this.stored = {
      ...this.stored,
      title: input.title,
      body: input.body,
      source: input.source ?? this.stored.source,
      updatedAt: "2026-07-28T03:00:00.000Z",
    };
    return this.stored;
  }

  async softDeletePost() {
    return this.stored;
  }

  async createComment(input: {
    id: string;
    postId: string;
    authorId: string;
    body: string;
    createdAt: string;
  }) {
    return { ...input, state: "published" as const };
  }

  async setBookmark({ saved }: { saved: boolean }) {
    return saved;
  }

  async createReport(input: { id: string }) {
    return { id: input.id, existing: false };
  }
}

test("authors edit title and body while non-authors are denied", async () => {
  const repository = new CorrectionRepository();
  const denied = await correctCommunityPost(
    {
      actor: member,
      userId: "reader-1",
      postId: repository.stored.id,
      title: "다른 회원의 수정",
      body: "다른 회원이 이 본문을 바꾸면 안 됩니다.",
      reason: "임의 수정 시도",
      source: null,
    },
    { repository },
  );
  assert.equal(denied.code, "forbidden");

  const edited = await correctCommunityPost(
    {
      actor: member,
      userId: "author-1",
      postId: repository.stored.id,
      title: "  수정한 제작 안내  ",
      body: "수정한 제작 안내 본문을 충분한 길이로 기록합니다.",
      reason: "제작 단계 표현을 바로잡았습니다.",
      source: null,
    },
    { repository },
  );
  assert.equal(edited.code, "corrected");
  assert.equal(edited.post?.title, "수정한 제작 안내");
  assert.equal(repository.corrections.length, 1);
});

test("only an operator can append a complete normalized source recheck", async () => {
  const repository = new CorrectionRepository();
  const authorDenied = await correctCommunityPost(
    {
      actor: member,
      userId: "author-1",
      postId: repository.stored.id,
      title: repository.stored.title,
      body: repository.stored.body,
      reason: "출처만 임의로 교체하려는 시도입니다.",
      source: {
        label: "새 안내",
        url: "https://example.com/new",
        checkedAt: "2026-07-28",
      },
    },
    { repository },
  );
  assert.equal(authorDenied.code, "operator-required");

  const corrected = await correctCommunityPost(
    {
      actor: operator,
      userId: "operator-1",
      postId: repository.stored.id,
      title: repository.stored.title,
      body: repository.stored.body,
      reason: "공식 안내 원문을 다시 확인했습니다.",
      source: {
        label: "  새 제작사 공식 안내  ",
        url: "HTTPS://Example.com/new/?utm_source=community#guide",
        checkedAt: "2026-07-28",
      },
    },
    { repository },
  );
  assert.equal(corrected.code, "corrected");
  assert.deepEqual(repository.corrections[0]?.source, {
    label: "새 제작사 공식 안내",
    url: "https://example.com/new",
    checkedAt: "2026-07-28",
  });
});

test("rejects a non-HTTPS source with a stable API status before repository access", async () => {
  const repository = new CorrectionRepository();
  const result = await correctCommunityPost(
    {
      actor: operator,
      userId: "operator-1",
      postId: repository.stored.id,
      title: repository.stored.title,
      body: repository.stored.body,
      reason: "공식 안내 원문을 다시 확인했습니다.",
      source: {
        label: "암호화되지 않은 안내",
        url: "http://example.com/recheck",
        checkedAt: "2026-07-28",
      },
    },
    { repository },
  );

  assert.equal(result.code, "invalid-source");
  assert.equal(result.message, "출처 이름, HTTPS 원문 URL과 확인 날짜를 모두 입력해 주세요.");
  assert.equal(communityCorrectionHttpStatus(result), 400);
  assert.equal(repository.getPostCalls, 0);
  assert.equal(repository.corrections.length, 0);

  const route = await readFile(
    new URL("../app/api/community/posts/[id]/route.ts", import.meta.url),
    "utf8",
  );
  const validationIndex = route.indexOf("validateCommunityCorrectionSource(");
  const clientIndex = route.indexOf(
    "createSupabaseServerClient(config)",
    validationIndex,
  );
  assert.ok(validationIndex > 0, "API route must validate correction sources");
  assert.ok(
    clientIndex > validationIndex,
    "API route must reject invalid sources before creating the repository client",
  );
});

function searchRow(
  id: string,
  rank: number,
  updatedAt: string,
): CommunitySearchPost {
  return {
    ...post({ id, updatedAt }),
    freshness: "fresh",
    rank,
    source: {
      label: "공식 안내",
      url: "https://example.com/guide",
      checkedAt: "2026-07-20",
      validForDays: 90,
    },
  };
}

class SearchRepository implements CommunitySearchRepository {
  calls: CommunitySearchRepositoryInput[] = [];
  private readonly rows: CommunitySearchPost[];

  constructor(rows: CommunitySearchPost[]) {
    this.rows = rows;
  }

  async search(input: CommunitySearchRepositoryInput) {
    this.calls.push(input);
    return this.rows;
  }
}

test("search over-fetches one row and returns a stable rank/updated/id cursor", async () => {
  const first = searchRow(
    "20000000-0000-4000-8000-000000000001",
    0.8,
    "2026-07-28T00:00:00.000Z",
  );
  const second = searchRow(
    "20000000-0000-4000-8000-000000000002",
    0.7,
    "2026-07-27T00:00:00.000Z",
  );
  const extra = searchRow(
    "20000000-0000-4000-8000-000000000003",
    0.6,
    "2026-07-26T00:00:00.000Z",
  );
  const repository = new SearchRepository([first, second, extra]);

  const result = await searchCommunityPosts(
    {
      actor: member,
      input: { board: "general", limit: 2 },
      now: new Date("2026-07-28T12:00:00.000Z"),
    },
    { repository },
  );

  assert.deepEqual(result.posts.map((item) => item.id), [first.id, second.id]);
  assert.equal(repository.calls[0]?.limit, 2);
  assert.deepEqual(decodeCommunitySearchCursor(result.nextCursor), {
    rank: second.rank,
    updatedAt: second.updatedAt,
    id: second.id,
  });

  const nextRepository = new SearchRepository([]);
  await searchCommunityPosts(
    {
      actor: member,
      input: { board: "general", limit: 2, cursor: result.nextCursor },
      now: new Date("2026-07-28T12:00:00.000Z"),
    },
    { repository: nextRepository },
  );
  assert.deepEqual(nextRepository.calls[0]?.cursor, {
    rank: second.rank,
    updatedAt: second.updatedAt,
    id: second.id,
  });
  assert.match(
    communitySearchPageHref(
      "/community/general",
      {
        q: "제작 교정",
        category: "production",
        resolution: "resolved",
        freshness: "fresh",
      },
      result.nextCursor!,
    ),
    /^\/community\/general\?q=.*&category=production&resolution=resolved&freshness=fresh&cursor=/,
  );
});
