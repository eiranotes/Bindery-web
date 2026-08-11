import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("generated public events contain official-source evidence boundaries only", async () => {
  const events = JSON.parse(
    await readFile(path.join(root, "content/generated/events.json"), "utf8"),
  );

  assert.equal(events.length, 70);
  assert.equal(events.filter((event) => event.dataStatus === "official").length, 3);
  assert.equal(events.filter((event) => event.dataStatus === "decision_ready").length, 2);
  assert.equal(events.filter((event) => event.dataStatus === "source_reachable").length, 65);
  for (const event of events) {
    assert.equal(event.reviewCount, 0);
    assert.equal(Object.hasOwn(event, "reviewAggregate"), false);
    assert.equal(event.sourceUrl.startsWith("https://"), true);
    assert.ok(event.sourceCount >= 1);
    assert.ok(event.evidenceCoverage > 0 && event.evidenceCoverage <= 100);
    assert.ok(event.masterId);
    assert.ok(Array.isArray(event.boothOptions));
    assert.equal(event.decisionCoverage.total, 6);
    assert.ok(event.decisionCoverage.percent >= 0 && event.decisionCoverage.percent <= 100);
    assert.ok(event.history.length >= 1);
    assert.ok(event.history.every((history) => history.path.startsWith("/events/")));
    assert.match(event.countryCode, /^[A-Z]{2}$/);
    assert.ok(event.countryName);
    assert.ok(event.timeZone);
    assert.ok(event.sourceLanguage);
    if (event.dataStatus === "official") {
      assert.equal(event.reviewNeeded, false);
      assert.ok(event.sourceCount >= 3);
      assert.ok(event.decisionCoverage.percent >= 80);
    } else {
      assert.equal(event.reviewNeeded, true);
    }
  }
});

test("normalizes every candidate while holding unsafe editions out of public generation", async () => {
  const masters = JSON.parse(
    await readFile(path.join(root, "content/catalog/event-masters.json"), "utf8"),
  );
  const editions = JSON.parse(
    await readFile(path.join(root, "content/catalog/event-editions.json"), "utf8"),
  );
  const sources = JSON.parse(
    await readFile(path.join(root, "content/catalog/source-records.json"), "utf8"),
  );

  assert.equal(masters.length, 73);
  assert.equal(editions.length, 91);
  assert.equal(sources.length, 132);
  assert.equal(editions.filter((edition) => edition.publicationStatus === "public").length, 67);
  assert.equal(editions.filter((edition) => edition.publicationStatus === "held").length, 24);
  assert.equal(sources.filter((source) => source.availability === "accessible").length, 120);
  assert.equal(sources.filter((source) => source.recheckDueAt).length, 132);
  assert.equal(sources.filter((source) => Object.hasOwn(source, "changeStatus")).length, 132);

  const agf = editions.find((edition) => edition.id === "agf-korea-2026");
  assert.ok(agf);
  assert.equal(agf.publicationStatus, "public");
  assert.equal(agf.application.deadline.at, null);
  assert.equal(agf.application.selection, null);
  assert.equal(agf.application.boothOptions.length, 0);

  const asyaaf = editions.find((edition) => edition.id === "asyaaf-2026");
  assert.ok(asyaaf);
  assert.equal(asyaaf.publicationStatus, "held");
  assert.ok(asyaaf.reviewReasons.includes("source:src-asyaaf-2026-artist-call"));

  const international = editions.filter((edition) => edition.countryCode !== "KR");
  assert.equal(international.length, 15);
  assert.equal(international.filter((edition) => edition.countryCode === "JP").length, 9);
  assert.equal(international.filter((edition) => edition.countryCode === "TW").length, 4);
  assert.equal(international.filter((edition) => edition.countryCode === "CN").length, 2);
  assert.ok(international.every((edition) => edition.publicationStatus === "public"));

  const paperworld = editions.find((edition) => edition.id === "paperworld-china-2026");
  assert.ok(paperworld);
  assert.equal(paperworld.timeZone, "Asia/Shanghai");
  assert.equal(paperworld.application.boothOptions[0].feeAmount, 990);
  assert.equal(paperworld.application.boothOptions[0].currency, "CNY");

  const designFesta = editions.find((edition) => edition.id === "design-festa-2026-64");
  assert.ok(designFesta);
  assert.equal(designFesta.boothCount, 6500);
  assert.equal(designFesta.application.status, "closed");
  assert.equal(designFesta.application.selection, "추첨");
  assert.equal(designFesta.application.boothOptions[0].feeAmount, 17000);
  assert.equal(designFesta.application.boothOptions[0].currency, "JPY");
});

test("account Binder allowlist covers every generated public event", async () => {
  const events = JSON.parse(
    await readFile(path.join(root, "content/generated/events.json"), "utf8"),
  );
  const migrationDirectory = path.join(root, "supabase/migrations");
  const migrationFiles = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql"));
  const migrations = (
    await Promise.all(
      migrationFiles.map((file) => readFile(path.join(migrationDirectory, file), "utf8")),
    )
  ).join("\n");
  for (const event of events) assert.match(migrations, new RegExp(`'${event.id}'`));
});

test("expired source checks become an explicit operator recheck queue", async () => {
  const queue = (
    await readFile(path.join(root, "content/queues/recheck.jsonl"), "utf8")
  )
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  assert.equal(queue.length, 14);
  assert.ok(queue.every((item) => item.status === "needs_review"));
  assert.ok(queue.every((item) => item.reason.startsWith("source-")));
  assert.equal(new Set(queue.map((item) => item.sourceId)).size, queue.length);
});

test("first collection has eleven hashed accessible official records", async () => {
  const directory = path.join(root, "content/sources/2026");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
  const records = await Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(path.join(directory, file), "utf8")),
    ),
  );

  assert.equal(records.length, 11);
  for (const record of records) {
    assert.equal(record.availability, "accessible");
    assert.match(record.contentHash, /^[a-f0-9]{64}$/);
    assert.match(record.url, /^https:\/\//);
    assert.match(record.tier, /^S[12]$/);
  }
});

test("twscrape stays manual, local-only, and version pinned", async () => {
  const config = JSON.parse(
    await readFile(path.join(root, "content/config/review-sources.json"), "utf8"),
  );
  const collector = config.collectors.find((item) => item.provider === "twscrape");
  const requirements = await readFile(
    path.join(root, "tools/review-collectors/twscrape/requirements.txt"),
    "utf8",
  );
  const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");

  assert.ok(collector);
  assert.equal(collector.enabled, false);
  assert.equal(collector.manualOnly, true);
  assert.match(collector.database, /^content-local\/reviews\//);
  assert.equal(config.publicOutput, false);
  assert.equal(requirements.trim(), "twscrape==0.19.2");
  assert.match(gitignore, /^\/content-local\/$/m);
});
