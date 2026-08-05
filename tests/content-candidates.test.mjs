import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { validateCandidateBundle } from "../scripts/content/validate-candidates.mjs";

test("keeps the Pro research bundle structurally valid and quarantined", async () => {
  const result = await validateCandidateBundle();

  assert.deepEqual(result.errors, []);
  assert.equal(result.counts.masters, 63);
  assert.equal(result.counts.editions, 76);
  assert.equal(result.counts.sources, 116);
  assert.equal(result.counts.verifiedExisting, 53);
  assert.equal(result.counts.needsSource, 9);
  assert.equal(result.counts.existingOverlap, 1);
  assert.equal(result.counts.publishReady, 0);
  assert.equal(result.counts.requiresEditorialWork, 76);
  assert.ok(result.records.editions.every((edition) => edition.contentStatus === "research_candidate"));
  assert.ok(
    result.records.editions.every(
      (edition) => result.indexes.masterById.get(edition.masterId)?.researchStatus !== "needs_source",
    ),
  );
});

test("keeps the international stationery batch official-source-only and hash verified", async () => {
  const result = await validateCandidateBundle(
    path.resolve(
      import.meta.dirname,
      "../content/research/2026-08-05-international-stationery",
    ),
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.counts.masters, 10);
  assert.equal(result.counts.editions, 15);
  assert.equal(result.counts.sources, 16);
  assert.equal(result.counts.verifiedExisting, 10);
  assert.ok(result.records.sources.every((source) => ["S1", "S2"].includes(source.tier)));
  assert.deepEqual(
    [...new Set(result.records.editions.map((edition) => edition.countryCode))].sort(),
    ["CN", "JP", "TW"],
  );
});
