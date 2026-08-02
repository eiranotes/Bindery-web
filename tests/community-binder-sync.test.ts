import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  listAccountBinderEventIds,
  listAccountBinderCommunityPosts,
  mergeBinderBookmarks,
  type BinderSyncRepository,
  type BinderSyncSave,
} from "../app/lib/server/community/binder-sync.ts";

const member: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "member",
  artistStatus: "none",
};

const signedOut: CommunityActor = {
  authenticated: false,
  accountStatus: "anonymous",
  role: "none",
  artistStatus: "none",
};

class MemoryBinderSyncRepository implements BinderSyncRepository {
  eventBookmarks = new Set<string>();
  communityBookmarks = new Set<string>();
  readablePosts = new Set(["00000000-0000-4000-8000-000000000001"]);
  calls = 0;

  async listEventBookmarkIds(userId: string) {
    this.calls += 1;
    return [...this.eventBookmarks]
      .filter((key) => key.startsWith(`${userId}:`))
      .map((key) => key.slice(userId.length + 1));
  }

  async listCommunityBookmarks(userId: string) {
    return [...this.communityBookmarks]
      .filter((key) => key.startsWith(`${userId}:`))
      .map((key) => ({ id: key.slice(userId.length + 1), title: "저장한 글", boardId: "general" as const }));
  }

  async saveEventBookmark(input: BinderSyncSave) {
    this.calls += 1;
    const key = `${input.userId}:${input.itemId}`;
    const existing = this.eventBookmarks.has(key);
    this.eventBookmarks.add(key);
    return existing ? "existing" as const : "created" as const;
  }

  async canReadCommunityPost(postId: string) {
    this.calls += 1;
    return this.readablePosts.has(postId);
  }

  async saveCommunityBookmark(input: BinderSyncSave) {
    this.calls += 1;
    const key = `${input.userId}:${input.itemId}`;
    const existing = this.communityBookmarks.has(key);
    this.communityBookmarks.add(key);
    return existing ? "existing" as const : "created" as const;
  }
}

const supportedEventIds = new Set([
  "illustar-2026-winter",
  "seoul-illustration-2026-v20",
]);

test("retries merge one normalized account bookmark", async () => {
  const repository = new MemoryBinderSyncRepository();
  const command = {
    actor: member,
    userId: "member-1",
    items: [
      { kind: "event", id: " illustar-2026-winter " },
      { kind: "event", id: "illustar-2026-winter" },
    ],
  };

  const first = await mergeBinderBookmarks(command, {
    repository,
    supportedEventIds,
  });
  const retried = await mergeBinderBookmarks(command, {
    repository,
    supportedEventIds,
  });

  assert.equal(first.code, "merged");
  assert.equal(retried.code, "merged");
  assert.equal(repository.eventBookmarks.size, 1);
  assert.deepEqual(first.merged, [
    { kind: "event", id: "illustar-2026-winter" },
  ]);
  assert.deepEqual(retried.merged, []);
  assert.deepEqual(retried.conflicts, [
    { kind: "event", id: "illustar-2026-winter" },
  ]);
});

test("merges a local event and readable community post together", async () => {
  const repository = new MemoryBinderSyncRepository();
  const postId = "00000000-0000-4000-8000-000000000001";

  const result = await mergeBinderBookmarks(
    {
      actor: member,
      userId: "member-1",
      items: [
        { kind: "event", id: "illustar-2026-winter" },
        { kind: "community_post", id: postId },
      ],
    },
    { repository, supportedEventIds },
  );

  assert.equal(result.code, "merged");
  assert.deepEqual(result.rejected, []);
  assert.equal(repository.eventBookmarks.has("member-1:illustar-2026-winter"), true);
  assert.equal(repository.communityBookmarks.has(`member-1:${postId}`), true);
});

test("returns a partial result when one server item is rejected", async () => {
  const repository = new MemoryBinderSyncRepository();
  const rejectedPostId = "00000000-0000-4000-8000-000000000099";

  const result = await mergeBinderBookmarks(
    {
      actor: member,
      userId: "member-1",
      items: [
        { kind: "event", id: "illustar-2026-winter" },
        { kind: "community_post", id: rejectedPostId },
      ],
    },
    { repository, supportedEventIds },
  );

  assert.equal(result.code, "partial");
  assert.deepEqual(result.merged, [
    { kind: "event", id: "illustar-2026-winter" },
  ]);
  assert.deepEqual(result.rejected, [
    {
      item: { kind: "community_post", id: rejectedPostId },
      code: "not-readable",
      message: "저장할 수 없는 커뮤니티 글입니다.",
    },
  ]);
});

test("signed-out use rejects without sending items to the repository", async () => {
  const repository = new MemoryBinderSyncRepository();

  const result = await mergeBinderBookmarks(
    {
      actor: signedOut,
      userId: "",
      items: [{ kind: "event", id: "illustar-2026-winter" }],
    },
    { repository, supportedEventIds },
  );

  assert.equal(result.code, "forbidden");
  assert.equal(repository.calls, 0);
  assert.equal(repository.eventBookmarks.size, 0);
});

test("rejects an oversized merge without silently dropping or saving items", async () => {
  const repository = new MemoryBinderSyncRepository();
  const result = await mergeBinderBookmarks(
    {
      actor: member,
      userId: "member-1",
      items: Array.from({ length: 101 }, (_, index) => ({
        kind: "event",
        id: index === 0 ? "illustar-2026-winter" : `unsupported-${index}`,
      })),
    },
    { repository, supportedEventIds },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "rejected");
  assert.equal(result.message, "한 번에 100개 이하의 저장 항목만 합칠 수 있습니다.");
  assert.equal(repository.calls, 0);
  assert.equal(repository.eventBookmarks.size, 0);
});

test("event bookmark storage is account-scoped and active-member guarded by RLS", async () => {
  const [foundationSql, lifecycleSql, repositorySql] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260728205000_binder_event_bookmarks.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260728270000_lifecycle_integrity.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/server/community/binder-sync.ts", import.meta.url), "utf8"),
  ]);

  assert.match(foundationSql, /primary key \(user_id, event_id\)/i);
  assert.match(foundationSql, /alter table public\.event_bookmarks enable row level security/i);
  assert.match(foundationSql, /using \(user_id = auth\.uid\(\)\)/i);
  assert.match(
    foundationSql,
    /with check \(\s*user_id = auth\.uid\(\)\s*and public\.is_active_member\(\)\s*\)/i,
  );
  assert.match(lifecycleSql, /foreign key \(event_id\)\s*references public\.community_event_allowlist/i);
  assert.match(lifecycleSql, /revoke insert on public\.event_bookmarks from authenticated/i);
  assert.match(lifecycleSql, /create or replace function public\.merge_event_bookmark/i);
  assert.match(lifecycleSql, /bookmark_count\s*>=\s*100/i);
  assert.match(lifecycleSql, /not valid/i);
  assert.match(lifecycleSql, /validate constraint event_bookmarks_event_id_allowlisted/i);
  assert.match(lifecycleSql, /legacy_sources text\[\]/i);
  assert.match(lifecycleSql, /from public\.posts[\s\S]*union all[\s\S]*from public\.event_bookmarks/i);
  assert.match(lifecycleSql, /allowed\.is_catalog/i);
  assert.match(repositorySql, /\.rpc\("merge_event_bookmark"/i);
  assert.doesNotMatch(repositorySql, /\.from\("event_bookmarks"\)\s*\.upsert/i);
});

test("account event saves load across devices and unsupported rows stay hidden", async () => {
  const repository = new MemoryBinderSyncRepository();
  repository.eventBookmarks.add("member-1:illustar-2026-winter");
  repository.eventBookmarks.add("member-1:retired-event");
  repository.eventBookmarks.add("member-2:seoul-illustration-2026-v20");

  const eventIds = await listAccountBinderEventIds(
    { actor: member, userId: "member-1" },
    { repository, supportedEventIds },
  );

  assert.deepEqual(eventIds, ["illustar-2026-winter"]);
});

test("account community saves load with title and board metadata", async () => {
  const repository = new MemoryBinderSyncRepository();
  repository.communityBookmarks.add("member-1:00000000-0000-4000-8000-000000000001");
  const posts = await listAccountBinderCommunityPosts(
    { actor: member, userId: "member-1" },
    { repository, supportedEventIds },
  );
  assert.deepEqual(posts, [{
    id: "00000000-0000-4000-8000-000000000001",
    title: "저장한 글",
    boardId: "general",
  }]);
});
