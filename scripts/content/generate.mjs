import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  contentDirectory,
  listJsonFiles,
  loadEditions,
  loadMasters,
  pathExists,
  readJson,
  rootDirectory,
  writeJson,
  writeText,
} from "./lib.mjs";
import { validateContent } from "./validate.mjs";

const validation = await validateContent();
if (validation.errors.length) {
  for (const error of validation.errors) console.error(`- ${error}`);
  throw new Error("content generation stopped because validation failed");
}

const registry = await readJson(path.join(contentDirectory, "config", "source-registry.json"));
const normalizedSources = await readJson(path.join(contentDirectory, "catalog", "source-records.json"));
const collectedSourceFiles = await listJsonFiles(path.join(contentDirectory, "sources"));
const collectedSources = await Promise.all(
  collectedSourceFiles.map((file) => readJson(file)),
);
const sourceById = new Map(
  [...normalizedSources, ...registry.sources, ...collectedSources].map((source) => [source.id, source]),
);
const masters = await loadMasters();
const normalizedMasters = await readJson(path.join(contentDirectory, "catalog", "event-masters.json"));
const masterById = new Map(
  [...normalizedMasters, ...masters.map(({ value }) => value)].map((master) => [master.id, master]),
);
const normalizedEditions = await readJson(path.join(contentDirectory, "catalog", "event-editions.json"));
const editionEntries = [
  ...(await loadEditions()),
  ...normalizedEditions
    .filter((edition) => edition.publicationStatus === "public")
    .map((value) => ({ file: path.join(contentDirectory, "catalog", "event-editions.json"), value })),
];
const evidenceFieldCount = 16;
const decisionFieldLabels = [
  "신청 마감",
  "부스 옵션",
  "선정 방식",
  "사업자 요건",
  "제출 자료",
  "환불 규정",
];

function dateLabel(startDate, endDate) {
  const start = startDate.slice(5, 10).replace("-", ".");
  const end = endDate.slice(5, 10).replace("-", ".");
  return `${start}–${end}`;
}

function sourceFreshness(edition) {
  const sources = edition.sourceIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter(Boolean);
  const checkedAt = sources
    .map((source) => source.checkedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const recheckDueAt = sources
    .map((source) => source.recheckDueAt)
    .filter(Boolean)
    .sort()
    .at(0) ?? null;
  return { checkedAt, recheckDueAt };
}

function decisionCoverage(edition, boothOptions) {
  const knownStates = [
    edition.application.deadline.at !== null,
    boothOptions.some((option) => Number.isInteger(option.feeAmount)),
    edition.application.selection !== null,
    edition.application.businessRequired !== null,
    edition.application.documents.length > 0,
    edition.application.refundPolicy !== null,
  ];
  const missing = decisionFieldLabels.filter((_, index) => !knownStates[index]);
  const known = decisionFieldLabels.length - missing.length;
  return {
    known,
    total: decisionFieldLabels.length,
    percent: Math.round((known / decisionFieldLabels.length) * 100),
    missing,
  };
}

const baseEvents = editionEntries
  .map(({ value: edition }) => {
    const master = masterById.get(edition.masterId);
    const primarySource = sourceById.get(edition.primarySourceId);
    const boothOptions = [...edition.application.boothOptions].map((option) => ({
      id: option.id,
      label: option.label,
      feeAmount: option.feeAmount ?? option.feeKrw ?? null,
      currency: option.currency ?? (Number.isInteger(option.feeKrw) ? "KRW" : null),
      size: option.size ?? null,
      vatIncluded: option.vatIncluded ?? null,
      note: option.note ?? null,
      includes: option.includes ?? [],
    }));
    const pricedBoothOptions = boothOptions
      .filter((option) => Number.isInteger(option.feeAmount))
      .sort(
        (left, right) =>
          left.feeAmount - right.feeAmount,
      );
    const minimumBooth = pricedBoothOptions[0] ?? null;
    const coverage = decisionCoverage(edition, boothOptions);
    const freshness = sourceFreshness(edition);
    const evidenceCoverage = Math.min(100, Math.round(
      (Object.keys(edition.fieldEvidence ?? {}).length / evidenceFieldCount) * 100,
    ));
    return {
      id: edition.id,
      masterId: edition.masterId,
      slug: edition.slug,
      edition: edition.edition,
      name: edition.name,
      shortName: edition.shortName,
      organizer: master.organizerName,
      countryCode: edition.countryCode ?? master.countryCode ?? "KR",
      countryName: edition.countryName ?? master.countryName ?? "대한민국",
      city: edition.city ?? null,
      timeZone: edition.timeZone ?? "Asia/Seoul",
      sourceLanguage: edition.sourceLanguage ?? "ko",
      region: edition.region,
      venue: edition.venue ?? null,
      address: edition.address ?? null,
      startDate: edition.startDate,
      endDate: edition.endDate,
      applicationOpen: edition.application.openConfirmedAt ?? null,
      applicationDeadline: edition.application.deadline.at ?? null,
      applicationDeadlineKind: edition.application.deadline.kind ?? null,
      applicationDeadlineLabel: edition.application.deadline.label ?? null,
      applicationStatus: edition.application.status ?? null,
      boothFee: minimumBooth?.feeAmount ?? null,
      boothFeeCurrency: minimumBooth?.currency ?? null,
      boothFeeIncludesVat: minimumBooth?.vatIncluded ?? null,
      boothSize: minimumBooth?.size ?? null,
      boothOptions,
      boothCount: edition.boothCount,
      selection: edition.application.selection ?? null,
      businessRequired: edition.application.businessRequired,
      genre: edition.genre,
      scale: edition.scale,
      sourceUrl: primarySource.url,
      sourceLabel: `${master.canonicalName} 공식 원문 (${primarySource.publisher})`,
      sourceCount: edition.sourceIds.length,
      evidenceCoverage,
      decisionCoverage: coverage,
      dataStatus:
        edition.contentStatus === "editor_checked"
          ? "official"
          : coverage.percent >= 80
            ? "decision_ready"
            : "source_reachable",
      sourceCheckedAt: freshness.checkedAt,
      sourceRecheckDueAt: freshness.recheckDueAt,
      reviewNeeded: edition.contentStatus !== "editor_checked",
      verifiedAt: edition.verifiedAt,
      summary: edition.summary,
      application: {
        documents: edition.application.documents,
        resalePolicy: edition.application.resalePolicy,
        refundPolicy: edition.application.refundPolicy,
        note: edition.application.note,
      },
      onsite: edition.onsite,
      history: [],
      reviewCount: 0,
    };
  });

const historiesByMaster = new Map();
for (const event of baseEvents) {
  const history = historiesByMaster.get(event.masterId) ?? [];
  history.push({
    id: event.id,
    path: `/events/${event.slug}/${event.edition}`,
    edition: event.name,
    startDate: event.startDate,
    endDate: event.endDate,
    dates: dateLabel(event.startDate, event.endDate),
    venue: event.venue,
    boothFee: event.boothFee,
    boothFeeCurrency: event.boothFeeCurrency,
    booths: event.boothCount,
    selection: event.selection,
  });
  historiesByMaster.set(event.masterId, history);
}

for (const history of historiesByMaster.values()) {
  history.sort(
    (left, right) =>
      new Date(right.startDate).getTime() - new Date(left.startDate).getTime(),
  );
}

const generatedEvents = baseEvents
  .map((event) => ({ ...event, history: historiesByMaster.get(event.masterId) ?? [] }))
  .sort(
    (left, right) =>
      new Date(left.applicationDeadline ?? left.startDate).getTime() -
      new Date(right.applicationDeadline ?? right.startDate).getTime(),
  );

const generatedJsonPath = path.join(contentDirectory, "generated", "events.json");
const generatedTypeScriptPath = path.join(rootDirectory, "app", "lib", "generated", "events.ts");
const generatedJson = `${JSON.stringify(generatedEvents, null, 2)}\n`;
const generatedTypeScript =
  `/* This file is generated by npm run content:generate. Do not edit by hand. */\n` +
  `import type { EventEdition } from "../types.ts";\n\n` +
  `export const generatedEvents: EventEdition[] = ${JSON.stringify(generatedEvents, null, 2)};\n`;

if (process.argv.includes("--check")) {
  const checks = [
    [generatedJsonPath, generatedJson],
    [generatedTypeScriptPath, generatedTypeScript],
  ];
  const stale = [];
  for (const [file, expected] of checks) {
    const actual = (await pathExists(file)) ? await readFile(file, "utf8") : null;
    if (actual !== expected) stale.push(path.relative(rootDirectory, file));
  }
  if (stale.length) {
    throw new Error(`생성 파일이 최신이 아닙니다: ${stale.join(", ")} (npm run content:generate 실행)`);
  }
  console.log(`생성 파일 최신 상태 확인: 행사 ${generatedEvents.length}건`);
} else {
  await writeJson(generatedJsonPath, generatedEvents);
  await writeText(generatedTypeScriptPath, generatedTypeScript);
  console.log(`사이트 행사 데이터 ${generatedEvents.length}건 생성`);
}
