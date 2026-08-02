export const BOOKMARK_STORAGE_KEY = "bindery.bookmarks.v1";
export const BOOKMARKS_CHANGED_EVENT = "bindery:bookmarks-changed";

export interface BookmarkRecord {
  version: 1;
  eventIds: string[];
  communityPosts: CommunityPostBookmark[];
}

export interface CommunityPostBookmark {
  id: string;
  title: string;
  boardId: "general" | "artists";
}

export interface BookmarkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function emptyBookmarkRecord(): BookmarkRecord {
  return { version: 1, eventIds: [], communityPosts: [] };
}

function normalizeCommunityPosts(value: unknown): CommunityPostBookmark[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const post = candidate as Record<string, unknown>;
    const id = typeof post.id === "string" ? post.id.trim() : "";
    const title = typeof post.title === "string" ? post.title.trim() : "";
    const boardId = post.boardId;
    if (!id || !title || title.length > 300 || (boardId !== "general" && boardId !== "artists") || seen.has(id)) return [];
    seen.add(id);
    return [{ id, title, boardId }];
  });
}

function normalizeEventIds(
  value: unknown,
  knownEventIds?: readonly string[],
): string[] {
  if (!Array.isArray(value)) return [];

  const known = knownEventIds ? new Set(knownEventIds) : null;
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const candidate of value) {
    if (
      typeof candidate !== "string" ||
      candidate.length === 0 ||
      seen.has(candidate) ||
      (known && !known.has(candidate))
    ) {
      continue;
    }

    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

export function parseBookmarkRecord(
  raw: string | null,
  knownEventIds?: readonly string[],
): BookmarkRecord {
  if (!raw) return emptyBookmarkRecord();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("eventIds" in parsed)
    ) {
      return emptyBookmarkRecord();
    }

    return {
      version: 1,
      eventIds: normalizeEventIds(parsed.eventIds, knownEventIds),
      communityPosts: normalizeCommunityPosts(
        "communityPosts" in parsed ? parsed.communityPosts : [],
      ),
    };
  } catch {
    return emptyBookmarkRecord();
  }
}

export function serializeBookmarkRecord(record: BookmarkRecord): string {
  return JSON.stringify({
    version: 1,
    eventIds: normalizeEventIds(record.eventIds),
    communityPosts: normalizeCommunityPosts(record.communityPosts),
  });
}

export function addBookmark(
  record: BookmarkRecord,
  eventId: string,
  knownEventIds?: readonly string[],
): BookmarkRecord {
  return {
    version: 1,
    eventIds: normalizeEventIds(
      [...record.eventIds, eventId],
      knownEventIds,
    ),
    communityPosts: record.communityPosts,
  };
}

export function removeBookmark(
  record: BookmarkRecord,
  eventId: string,
  knownEventIds?: readonly string[],
): BookmarkRecord {
  return {
    version: 1,
    eventIds: normalizeEventIds(
      record.eventIds.filter((candidate) => candidate !== eventId),
      knownEventIds,
    ),
    communityPosts: record.communityPosts,
  };
}

export function addCommunityPostBookmark(
  record: BookmarkRecord,
  post: CommunityPostBookmark,
): BookmarkRecord {
  return {
    version: 1,
    eventIds: record.eventIds,
    communityPosts: normalizeCommunityPosts([...record.communityPosts, post]),
  };
}

export function removeCommunityPostBookmark(
  record: BookmarkRecord,
  postId: string,
): BookmarkRecord {
  return {
    version: 1,
    eventIds: record.eventIds,
    communityPosts: record.communityPosts.filter((post) => post.id !== postId),
  };
}

export function readBookmarkRecord(
  storage: BookmarkStorage,
  knownEventIds?: readonly string[],
): BookmarkRecord {
  try {
    return parseBookmarkRecord(
      storage.getItem(BOOKMARK_STORAGE_KEY),
      knownEventIds,
    );
  } catch {
    return emptyBookmarkRecord();
  }
}

export function writeBookmarkRecord(
  storage: BookmarkStorage,
  record: BookmarkRecord,
): boolean {
  try {
    storage.setItem(BOOKMARK_STORAGE_KEY, serializeBookmarkRecord(record));
    return true;
  } catch {
    return false;
  }
}
