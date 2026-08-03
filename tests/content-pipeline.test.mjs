import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("generated public events contain official evidence boundaries only", async () => {
  const events = JSON.parse(
    await readFile(path.join(root, "content/generated/events.json"), "utf8"),
  );

  assert.equal(events.length, 3);
  for (const event of events) {
    assert.equal(event.dataStatus, "official");
    assert.equal(event.reviewCount, 0);
    assert.equal(Object.hasOwn(event, "reviewAggregate"), false);
    assert.equal(event.sourceUrl.startsWith("https://"), true);
    assert.ok(event.sourceCount >= 3);
    assert.ok(event.evidenceCoverage >= 80);
  }
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
