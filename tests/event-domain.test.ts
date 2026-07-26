import assert from "node:assert/strict";
import test from "node:test";

import { events } from "../app/lib/data.ts";
import {
  daysUntilDeadline,
  deriveEventStatus,
  filterEvents,
  getEventByPath,
} from "../app/lib/events.ts";

const referenceNow = new Date("2026-07-26T12:00:00+09:00");
const illustar = events.find((event) => event.id === "illustar-2026-winter");

test("derives event status and D-day from dates", () => {
  assert.ok(illustar);
  assert.equal(deriveEventStatus(illustar, referenceNow), "urgent");
  assert.equal(daysUntilDeadline(illustar, referenceNow), 12);

  assert.equal(
    deriveEventStatus(illustar, new Date("2026-07-01T12:00:00+09:00")),
    "upcoming",
  );
  assert.equal(
    deriveEventStatus(illustar, new Date("2026-08-20T12:00:00+09:00")),
    "closed",
  );
  assert.equal(
    deriveEventStatus(illustar, new Date("2026-11-10T12:00:00+09:00")),
    "soon",
  );
  assert.equal(
    deriveEventStatus(illustar, new Date("2026-11-17T12:00:00+09:00")),
    "ended",
  );
});

test("filters and sorts using shareable query values", () => {
  const filtered = filterEvents(
    events,
    {
      region: "부산",
      genre: "전체",
      scale: "전체",
      business: "전체",
      sort: "deadline",
    },
    referenceNow,
  );

  assert.deepEqual(
    filtered.map((event) => event.region),
    ["부산"],
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
    new Date(upcoming[0].applicationDeadline).getTime() <=
      new Date(upcoming[1].applicationDeadline).getTime(),
  );
});

test("resolves stable event paths and preserves missing information", () => {
  assert.equal(
    getEventByPath("illustar-fair", "2026-winter")?.id,
    "illustar-2026-winter",
  );
  assert.equal(
    getEventByPath("illustar-fair", "2026-winter")?.onsite.wallUse,
    null,
  );
});
