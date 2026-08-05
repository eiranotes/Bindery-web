import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  contentDirectory,
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
const sourceById = new Map(
  [...normalizedSources, ...registry.sources].map((source) => [source.id, source]),
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
const evidenceFieldCount = 9;

function dateLabel(startDate, endDate) {
  const start = startDate.slice(5, 10).replace("-", ".");
  const end = endDate.slice(5, 10).replace("-", ".");
  return `${start}–${end}`;
}

const generatedEvents = editionEntries
  .map(({ value: edition }) => {
      const master = masterById.get(edition.masterId);
      const primarySource = sourceById.get(edition.primarySourceId);
    const boothOptions = [...edition.application.boothOptions]
      .filter((option) => Number.isInteger(option.feeAmount ?? option.feeKrw))
      .sort(
        (left, right) =>
          (left.feeAmount ?? left.feeKrw) - (right.feeAmount ?? right.feeKrw),
      );
    const minimumBooth = boothOptions[0] ?? null;
    const evidenceCoverage = Math.round(
      (Object.keys(edition.fieldEvidence ?? {}).length / evidenceFieldCount) * 100,
    );
    return {
      id: edition.id,
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
      boothFee: minimumBooth?.feeAmount ?? minimumBooth?.feeKrw ?? null,
      boothFeeCurrency: minimumBooth?.currency ?? (minimumBooth ? "KRW" : null),
      boothFeeIncludesVat: minimumBooth?.vatIncluded ?? null,
      boothSize: minimumBooth?.size ?? null,
      boothCount: edition.boothCount,
      selection: edition.application.selection ?? null,
      businessRequired: edition.application.businessRequired,
      genre: edition.genre,
      scale: edition.scale,
      sourceUrl: primarySource.url,
      sourceLabel: `${master.canonicalName} 공식 원문 (${primarySource.publisher})`,
      sourceCount: edition.sourceIds.length,
      evidenceCoverage,
      dataStatus: edition.contentStatus === "editor_checked" ? "official" : "source_checked",
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
      history: [
        {
          edition: edition.name,
          dates: dateLabel(edition.startDate, edition.endDate),
          venue: edition.venue ?? null,
          boothFee: minimumBooth?.feeAmount ?? minimumBooth?.feeKrw ?? null,
          boothFeeCurrency: minimumBooth?.currency ?? (minimumBooth ? "KRW" : null),
          booths: edition.boothCount,
          selection: edition.application.selection ?? null,
        },
      ],
      reviewCount: 0,
    };
  })
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
