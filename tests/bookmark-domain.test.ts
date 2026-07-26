import assert from "node:assert/strict";
import test from "node:test";

import {
  addBookmark,
  BOOKMARK_STORAGE_KEY,
  parseBookmarkRecord,
  readBookmarkRecord,
  removeBookmark,
  serializeBookmarkRecord,
  writeBookmarkRecord,
} from "../app/lib/bookmarks.ts";

const knownEventIds = [
  "illustar-2026-winter",
  "seoul-illustration-2026-v20",
] as const;

test("uses one versioned, deterministic device-local record", () => {
  assert.equal(BOOKMARK_STORAGE_KEY, "bindery.bookmarks.v1");

  const parsed = parseBookmarkRecord(
    JSON.stringify({
      version: 1,
      eventIds: [
        "seoul-illustration-2026-v20",
        "illustar-2026-winter",
        "seoul-illustration-2026-v20",
      ],
    }),
    knownEventIds,
  );

  assert.deepEqual(parsed, {
    version: 1,
    eventIds: [
      "seoul-illustration-2026-v20",
      "illustar-2026-winter",
    ],
  });
  assert.equal(
    serializeBookmarkRecord(parsed),
    '{"version":1,"eventIds":["seoul-illustration-2026-v20","illustar-2026-winter"]}',
  );
});

test("fails closed for malformed, old-version, and unknown stored values", () => {
  assert.deepEqual(parseBookmarkRecord(null, knownEventIds), {
    version: 1,
    eventIds: [],
  });
  assert.deepEqual(parseBookmarkRecord("{broken", knownEventIds), {
    version: 1,
    eventIds: [],
  });
  assert.deepEqual(
    parseBookmarkRecord(
      JSON.stringify({
        version: 2,
        eventIds: ["illustar-2026-winter"],
      }),
      knownEventIds,
    ),
    { version: 1, eventIds: [] },
  );
  assert.deepEqual(
    parseBookmarkRecord(
      JSON.stringify({
        version: 1,
        eventIds: ["not-a-real-event", 7, "", "illustar-2026-winter"],
      }),
      knownEventIds,
    ),
    { version: 1, eventIds: ["illustar-2026-winter"] },
  );
});

test("adding is idempotent and removal preserves the other saved events", () => {
  const empty = parseBookmarkRecord(null, knownEventIds);
  const once = addBookmark(
    empty,
    "illustar-2026-winter",
    knownEventIds,
  );
  const twice = addBookmark(
    once,
    "illustar-2026-winter",
    knownEventIds,
  );
  const withSecond = addBookmark(
    twice,
    "seoul-illustration-2026-v20",
    knownEventIds,
  );

  assert.deepEqual(twice, once);
  assert.deepEqual(
    removeBookmark(withSecond, "illustar-2026-winter", knownEventIds),
    {
      version: 1,
      eventIds: ["seoul-illustration-2026-v20"],
    },
  );
});

test("fails closed when the browser blocks local storage", () => {
  const blockedStorage = {
    getItem() {
      throw new Error("storage blocked");
    },
    setItem() {
      throw new Error("storage blocked");
    },
  };

  assert.deepEqual(readBookmarkRecord(blockedStorage, knownEventIds), {
    version: 1,
    eventIds: [],
  });
  assert.equal(
    writeBookmarkRecord(blockedStorage, {
      version: 1,
      eventIds: ["illustar-2026-winter"],
    }),
    false,
  );
});
