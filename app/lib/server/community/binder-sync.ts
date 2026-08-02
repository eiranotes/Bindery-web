import type { SupabaseClient } from "@supabase/supabase-js";

import type { CommunityActor } from "../../community-access.ts";

export type BinderSyncItem = {
  kind: "event" | "community_post";
  id: string;
};

export type BinderSyncSave = {
  userId: string;
  itemId: string;
};

export type AccountCommunityBookmark = {
  id: string;
  title: string;
  boardId: "general" | "artists";
};

export type BinderSyncRejection = {
  item: BinderSyncItem;
  code: "not-readable" | "unsupported" | "service-error";
  message: string;
};

export type BinderSyncResult = {
  ok: boolean;
  code: "merged" | "partial" | "rejected" | "forbidden";
  merged: BinderSyncItem[];
  conflicts: BinderSyncItem[];
  rejected: BinderSyncRejection[];
  message?: string;
};

export type BinderSyncRepository = {
  listEventBookmarkIds(userId: string): Promise<string[]>;
  listCommunityBookmarks(userId: string): Promise<AccountCommunityBookmark[]>;
  saveEventBookmark(input: BinderSyncSave): Promise<"created" | "existing">;
  canReadCommunityPost(postId: string): Promise<boolean>;
  saveCommunityBookmark(input: BinderSyncSave): Promise<"created" | "existing">;
};

export async function listAccountBinderEventIds(
  command: { actor: CommunityActor; userId: string },
  dependencies: BinderSyncDependencies,
) {
  if (
    !command.userId ||
    !command.actor.authenticated ||
    command.actor.accountStatus !== "active"
  ) {
    return [];
  }

  const ids = await dependencies.repository.listEventBookmarkIds(
    command.userId,
  );
  return [...new Set(ids)].filter((id) =>
    dependencies.supportedEventIds.has(id),
  );
}

export async function listAccountBinderCommunityPosts(
  command: { actor: CommunityActor; userId: string },
  dependencies: BinderSyncDependencies,
) {
  if (!command.userId || !command.actor.authenticated || command.actor.accountStatus !== "active") {
    return [];
  }
  return dependencies.repository.listCommunityBookmarks(command.userId);
}

type BinderSyncDependencies = {
  repository: BinderSyncRepository;
  supportedEventIds: ReadonlySet<string>;
};

const MAX_ITEMS_PER_MERGE = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeItems(
  value: unknown,
  supportedEventIds: ReadonlySet<string>,
) {
  if (!Array.isArray(value)) {
    return {
      items: [] as BinderSyncItem[],
      rejected: [] as BinderSyncRejection[],
      oversized: false,
    };
  }

  if (value.length > MAX_ITEMS_PER_MERGE) {
    return {
      items: [] as BinderSyncItem[],
      rejected: [] as BinderSyncRejection[],
      oversized: true,
    };
  }

  const items: BinderSyncItem[] = [];
  const rejected: BinderSyncRejection[] = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue;
    }

    const record = candidate as Record<string, unknown>;
    const kind = record.kind;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if ((kind !== "event" && kind !== "community_post") || id.length === 0) {
      continue;
    }

    const item: BinderSyncItem = { kind, id };
    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const supported =
      kind === "event"
        ? supportedEventIds.has(id)
        : id.length <= 36 && UUID_PATTERN.test(id);
    if (!supported) {
      rejected.push({
        item,
        code: "unsupported",
        message: "지원하지 않는 저장 항목입니다.",
      });
      continue;
    }
    items.push(item);
  }

  return { items, rejected, oversized: false };
}

export async function mergeBinderBookmarks(
  command: {
    actor: CommunityActor;
    userId: string;
    items: unknown;
  },
  dependencies: BinderSyncDependencies,
): Promise<BinderSyncResult> {
  if (
    !command.userId ||
    !command.actor.authenticated ||
    command.actor.accountStatus !== "active"
  ) {
    return {
      ok: false,
      code: "forbidden",
      merged: [],
      conflicts: [],
      rejected: [],
      message: "로그인한 활성 회원만 계정 Binder와 합칠 수 있습니다.",
    };
  }

  const normalized = normalizeItems(
    command.items,
    dependencies.supportedEventIds,
  );
  if (normalized.oversized) {
    return {
      ok: false,
      code: "rejected",
      merged: [],
      conflicts: [],
      rejected: [],
      message: "한 번에 100개 이하의 저장 항목만 합칠 수 있습니다.",
    };
  }
  const merged: BinderSyncItem[] = [];
  const conflicts: BinderSyncItem[] = [];
  const rejected = [...normalized.rejected];

  for (const item of normalized.items) {
    try {
      if (item.kind === "event") {
        const outcome = await dependencies.repository.saveEventBookmark({
          userId: command.userId,
          itemId: item.id,
        });
        (outcome === "existing" ? conflicts : merged).push(item);
        continue;
      }

      if (!(await dependencies.repository.canReadCommunityPost(item.id))) {
        rejected.push({
          item,
          code: "not-readable",
          message: "저장할 수 없는 커뮤니티 글입니다.",
        });
        continue;
      }

      const outcome = await dependencies.repository.saveCommunityBookmark({
        userId: command.userId,
        itemId: item.id,
      });
      (outcome === "existing" ? conflicts : merged).push(item);
    } catch {
      rejected.push({
        item,
        code: "service-error",
        message: "이 항목을 계정 Binder에 저장하지 못했습니다.",
      });
    }
  }

  if (rejected.length === 0) {
    return { ok: true, code: "merged", merged, conflicts, rejected };
  }
  if (merged.length > 0 || conflicts.length > 0) {
    return { ok: true, code: "partial", merged, conflicts, rejected };
  }
  return {
    ok: false,
    code: "rejected",
    merged,
    conflicts,
    rejected,
    message: "계정 Binder에 합칠 수 있는 항목이 없습니다.",
  };
}

export function createSupabaseBinderSyncRepository(
  client: SupabaseClient,
): BinderSyncRepository {
  return {
    async listEventBookmarkIds(userId) {
      const { data, error } = await client
        .from("event_bookmarks")
        .select("event_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => String(row.event_id));
    },
    async saveEventBookmark({ userId, itemId }) {
      void userId;
      const { data, error } = await client
        .rpc("merge_event_bookmark", { p_event_id: itemId });
      if (error) throw error;
      return data === true ? "created" : "existing";
    },
    async listCommunityBookmarks(userId) {
      const { data, error } = await client
        .from("bookmarks")
        .select("post_id, posts!inner(id, title, board_id)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        const joined = Array.isArray(row.posts) ? row.posts[0] : row.posts;
        if (!joined || (joined.board_id !== "general" && joined.board_id !== "artists")) return [];
        return [{ id: String(row.post_id), title: String(joined.title), boardId: joined.board_id }];
      });
    },
    async canReadCommunityPost(postId) {
      const { data, error } = await client
        .from("posts")
        .select("id")
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    async saveCommunityBookmark({ userId, itemId }) {
      void userId;
      const { data, error } = await client.rpc("merge_community_bookmark", {
        p_post_id: itemId,
      });
      if (error) throw error;
      return data === true ? "created" : "existing";
    },
  };
}
