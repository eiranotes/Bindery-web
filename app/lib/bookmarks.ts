export const BOOKMARK_STORAGE_KEY = "bindery.bookmarks.v1";
export const BOOKMARKS_CHANGED_EVENT = "bindery:bookmarks-changed";

export interface BookmarkRecord {
  version: 1;
  eventIds: string[];
}

export interface BookmarkStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function emptyBookmarkRecord(): BookmarkRecord {
  return { version: 1, eventIds: [] };
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
    };
  } catch {
    return emptyBookmarkRecord();
  }
}

export function serializeBookmarkRecord(record: BookmarkRecord): string {
  return JSON.stringify({
    version: 1,
    eventIds: normalizeEventIds(record.eventIds),
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
