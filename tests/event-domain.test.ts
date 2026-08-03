import assert from "node:assert/strict";
import test from "node:test";

import { events } from "../app/lib/data.ts";
import {
  daysUntilDeadline,
  deriveEventStatus,
  filterEvents,
  getEventByPath,
  nextEventMilestone,
} from "../app/lib/events.ts";

const referenceNow = new Date("2026-08-20T12:00:00+09:00");
const incheon = events.find(
  (event) => event.id === "illustration-korea-2026-incheon",
);

test("derives event status and D-day from dates", () => {
  assert.ok(incheon);
  assert.equal(deriveEventStatus(incheon, referenceNow), "urgent");
  assert.equal(daysUntilDeadline(incheon, referenceNow), 11);

  assert.equal(
    deriveEventStatus(incheon, new Date("2026-08-01T12:00:00+09:00")),
    "open",
  );
  assert.equal(
    deriveEventStatus(incheon, new Date("2026-09-01T12:00:00+09:00")),
    "open",
  );
  assert.equal(
    deriveEventStatus(incheon, new Date("2026-10-30T12:00:00+09:00")),
    "ongoing",
  );
  assert.equal(
    deriveEventStatus(incheon, new Date("2026-11-02T12:00:00+09:00")),
    "ended",
  );
});

test("filters and sorts using shareable query values", () => {
  const filtered = filterEvents(
    events,
    {
      region: "인천",
      genre: "전체",
      scale: "전체",
      business: "전체",
      sort: "deadline",
    },
    referenceNow,
  );

  assert.deepEqual(
    filtered.map((event) => event.region),
    ["인천"],
  );

  const upcoming = filterEvents(
    events,
    {
      region: "전체",
      genre: "전체",
      scale: "전체",
      business: "전체",
      sort: "deadline",
    },
    referenceNow,
  );

  assert.ok(
    new Date(nextEventMilestone(upcoming[0], referenceNow).date).getTime() <=
      new Date(nextEventMilestone(upcoming[1], referenceNow).date).getTime(),
  );
});

test("resolves stable event paths and preserves missing information", () => {
  assert.equal(
    getEventByPath("illustration-korea", "2026-incheon")?.id,
    "illustration-korea-2026-incheon",
  );
  assert.equal(
    getEventByPath("illustration-korea", "2026-incheon")?.onsite.wallUse,
    null,
  );
  assert.equal(incheon?.boothCount, null);
  assert.equal(incheon?.businessRequired, null);
});
