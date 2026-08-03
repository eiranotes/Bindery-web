import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contentDirectory,
  listJsonFiles,
  loadEditions,
  loadMasters,
  readJson,
} from "./lib.mjs";

const criticalEvidence = {
  dates: ["S1", "S2"],
  venue: ["S1", "S2"],
  address: ["S1", "S2"],
  applicationStatus: ["S1"],
  applicationMilestone: ["S1"],
  boothFee: ["S1"],
  selection: ["S1"],
  refundPolicy: ["S1"],
};

function assert(errors, condition, message) {
  if (!condition) errors.push(message);
}

export async function validateContent() {
  const errors = [];
  const registry = await readJson(path.join(contentDirectory, "config", "source-registry.json"));
  const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
  const recordFiles = await listJsonFiles(path.join(contentDirectory, "sources"));
  const records = await Promise.all(recordFiles.map((file) => readJson(file)));
  const recordById = new Map(records.map((record) => [record.id, record]));
  const masters = await loadMasters();
  const masterById = new Map(masters.map(({ value }) => [value.id, value]));
  const editions = await loadEditions();

  assert(errors, registry.version === 1, "source registry version must be 1");
  assert(errors, new Set(sourceById.keys()).size === registry.sources.length, "source IDs must be unique");
  assert(errors, new Set(masterById.keys()).size === masters.length, "event master IDs must be unique");
  assert(
    errors,
    new Set(editions.map(({ value }) => value.id)).size === editions.length,
    "event edition IDs must be unique",
  );

  for (const { value: master } of masters) {
    for (const sourceId of master.officialSourceIds ?? []) {
      assert(errors, sourceById.has(sourceId), `${master.id}: unknown official source ${sourceId}`);
    }
  }

  for (const { file, value: edition } of editions) {
    const label = path.relative(contentDirectory, file);
    assert(errors, masterById.has(edition.masterId), `${label}: unknown masterId ${edition.masterId}`);
    assert(errors, edition.contentStatus === "editor_checked", `${label}: only editor_checked editions can publish`);
    assert(errors, edition.startDate < edition.endDate, `${label}: startDate must precede endDate`);
    assert(errors, edition.application?.status, `${label}: application status is required`);
    assert(errors, edition.application?.deadline?.at, `${label}: application milestone date is required`);
    assert(errors, edition.application?.deadline?.label, `${label}: application milestone label is required`);
    assert(errors, edition.application?.boothOptions?.length > 0, `${label}: at least one booth option is required`);
    assert(errors, !Object.hasOwn(edition, "reviews"), `${label}: review material cannot enter publishable content`);
    assert(errors, edition.sourceIds?.includes(edition.primarySourceId), `${label}: primary source must be linked`);

    for (const option of edition.application?.boothOptions ?? []) {
      assert(errors, Number.isInteger(option.feeKrw) && option.feeKrw >= 0, `${label}: invalid booth fee ${option.id}`);
      assert(errors, typeof option.vatIncluded === "boolean", `${label}: VAT boundary missing for ${option.id}`);
    }

    for (const sourceId of edition.sourceIds ?? []) {
      const source = sourceById.get(sourceId);
      const record = recordById.get(sourceId);
      assert(errors, Boolean(source), `${label}: unknown source ${sourceId}`);
      assert(errors, Boolean(record), `${label}: source ${sourceId} has not been collected`);
      if (record) {
        assert(errors, record.availability === "accessible", `${label}: source ${sourceId} is ${record.availability}`);
        assert(errors, /^[a-f0-9]{64}$/.test(record.contentHash ?? ""), `${label}: source ${sourceId} has no SHA-256 hash`);
      }
    }

    for (const [field, allowedTiers] of Object.entries(criticalEvidence)) {
      const evidence = edition.fieldEvidence?.[field] ?? [];
      assert(errors, evidence.length > 0, `${label}: ${field} needs field evidence`);
      for (const item of evidence) {
        const source = sourceById.get(item.sourceId);
        assert(errors, edition.sourceIds?.includes(item.sourceId), `${label}: ${field} evidence is not linked`);
        assert(errors, source && allowedTiers.includes(source.tier), `${label}: ${field} cannot use ${source?.tier ?? "unknown"}`);
        assert(errors, typeof item.note === "string" && item.note.length >= 4, `${label}: ${field} evidence note is empty`);
      }
    }
  }

  return {
    errors,
    counts: {
      masters: masters.length,
      editions: editions.length,
      registeredSources: registry.sources.length,
      collectedSources: records.length,
    },
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  const result = await validateContent();
  if (result.errors.length) {
    for (const error of result.errors) console.error(`- ${error}`);
    console.error(`콘텐츠 검증 실패: ${result.errors.length}건`);
    process.exitCode = 1;
  } else {
    console.log(
      `콘텐츠 검증 통과: 행사 ${result.counts.editions}회차, 공식 출처 ${result.counts.collectedSources}건`,
    );
  }
}
