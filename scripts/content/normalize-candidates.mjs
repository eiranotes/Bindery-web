import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  contentDirectory,
  pathExists,
  readJson,
  writeJson,
  writeText,
} from "./lib.mjs";
import { validateCandidateBundle } from "./validate-candidates.mjs";

const batchRegistryPath = path.join(contentDirectory, "config", "candidate-batches.json");
const catalogDirectory = path.join(contentDirectory, "catalog");
const outputPaths = {
  masters: path.join(catalogDirectory, "event-masters.json"),
  editions: path.join(catalogDirectory, "event-editions.json"),
  sources: path.join(catalogDirectory, "source-records.json"),
  review: path.join(contentDirectory, "reports", "candidate-review.md"),
  internationalReview: path.join(
    contentDirectory,
    "reports",
    "international-stationery-review.md",
  ),
};

const statusMap = new Map([
  ["행사 종료", "closed"],
  ["모집 종료", "closed"],
  ["접수 종료", "closed"],
  ["출품 접수 종료", "closed"],
  ["연계 프로그램 모집 종료", "closed"],
  ["모집 중", "open"],
  ["신규 신청 가능", "open"],
  ["출전사 모집 중", "open"],
  ["대기 접수", "capacity"],
  ["접수 예정", "scheduled"],
  ["예정 회차 확인", "scheduled"],
]);

function normalizeSelection(value) {
  if (typeof value !== "string") return null;
  if (value.includes("선착순")) return "선착순";
  if (value.includes("추첨")) return "추첨";
  if (value.includes("심사")) return "심사";
  return null;
}

function normalizeDeadlineKind(kind, at) {
  if (!at) return null;
  if (kind === "fixed") return "final";
  if (["final", "early-bird", "capacity"].includes(kind)) return kind;
  return null;
}

function normalizeBoothOption(option, index) {
  const note = typeof option.note === "string" ? option.note : null;
  const vatIncluded = note?.includes("부가세 포함")
    ? true
    : note?.includes("부가세 별도")
      ? false
      : null;
  const currency =
    typeof option.currency === "string" && /^[A-Z]{3}$/.test(option.currency)
      ? option.currency
      : Number.isInteger(option.feeKrw)
        ? "KRW"
        : null;
  const feeAmount = Number.isInteger(option.fee)
    ? option.fee
    : Number.isInteger(option.feeKrw)
      ? option.feeKrw
      : null;
  return {
    id: `option-${index + 1}`,
    label: option.name,
    feeAmount: feeAmount !== null && feeAmount >= 0 ? feeAmount : null,
    currency,
    size: typeof option.size === "string" ? option.size : null,
    vatIncluded,
    note,
    includes: Array.isArray(option.includes) ? option.includes : [],
  };
}

function reasonLabel(reason) {
  if (reason === "master:needs-source") return "행사 시리즈 공식 출처 보강 필요";
  if (reason === "primary-source:not-s1-s2") return "대표 출처가 S1/S2가 아님";
  if (reason === "dates:missing") return "개최 날짜 없음";
  if (reason === "dates:conflict") return "공식 원문 사이 날짜 충돌 또는 오기";
  if (reason === "venue:missing") return "장소 또는 상세주소 없음";
  if (reason === "application-status:unmapped") return "신청 상태 정규화 미완료";
  if (reason === "deadline:missing") return "신청 마감 없음";
  if (reason === "selection:missing") return "선정 방식 없음";
  if (reason === "booth-fee:missing") return "참가비 없음";
  if (reason === "refund-policy:missing") return "환불 규정 없음";
  if (reason.startsWith("source:")) return `출처 접근 실패: ${reason.slice(7)}`;
  if (reason.startsWith("missing:")) return `원본 누락 필드: ${reason.slice(8)}`;
  return reason;
}

function unique(values) {
  return [...new Set(values)];
}

function normalizedReviewReasons(edition, master, sourceById, sourceAuditById, normalized) {
  const reasons = [];
  if (master?.researchStatus === "needs_source") reasons.push("master:needs-source");
  if (!["S1", "S2"].includes(sourceById.get(edition.primarySourceId)?.tier)) {
    reasons.push("primary-source:not-s1-s2");
  }
  for (const sourceId of edition.sourceIds ?? []) {
    if (sourceAuditById.get(sourceId)?.availability !== "accessible") {
      reasons.push(`source:${sourceId}`);
    }
  }
  if (!edition.startDate || !edition.endDate) reasons.push("dates:missing");
  if (/날짜.*충돌|오기가|오기가 있어|표기가 충돌/.test(edition.summary ?? "")) {
    reasons.push("dates:conflict");
  }
  if (!edition.venue || !edition.address) reasons.push("venue:missing");
  if (!normalized.application.status) reasons.push("application-status:unmapped");
  if (!normalized.application.deadline.at) reasons.push("deadline:missing");
  if (!normalized.application.selection) reasons.push("selection:missing");
  if (!normalized.application.boothOptions.some((option) => option.feeAmount !== null)) {
    reasons.push("booth-fee:missing");
  }
  if (!normalized.application.refundPolicy) reasons.push("refund-policy:missing");
  reasons.push(...(edition.missingFields ?? []).map((field) => `missing:${field}`));
  return unique(reasons);
}

function reviewMarkdown(catalog) {
  const held = catalog.editions.filter((edition) => edition.publicationStatus === "held");
  const published = catalog.editions.filter((edition) => edition.publicationStatus === "public");
  const sourceFailures = catalog.sources.filter((source) => source.availability !== "accessible");
  const row = (edition) => {
    const reasons = edition.reviewReasons.map(reasonLabel).join(" · ");
    return `| \`${edition.id}\` | ${edition.name.replaceAll("|", "\\|")} | ${edition.publicationStatus === "public" ? "공개·보강 필요" : "보류"} | ${reasons} |`;
  };

  return [
    "# Candidate normalization and review targets",
    "",
    `- Source snapshot: ${catalog.normalizedAt}`,
    `- Normalized masters: ${catalog.masters.length}`,
    `- Normalized editions: ${catalog.editions.length}`,
    `- Public source-checked editions: ${published.length}`,
    `- Held editions: ${held.length}`,
    `- Source URLs requiring recheck: ${sourceFailures.length}`,
    "- Public means the official S1/S2 source URL was reachable and the event dates were present. It does not mean every application field received editor review.",
    "",
    "## Held from public catalog",
    "",
    "| Edition | Event | State | Review reasons |",
    "| --- | --- | --- | --- |",
    ...held.map(row),
    "",
    "## Public but still incomplete",
    "",
    "| Edition | Event | State | Review reasons |",
    "| --- | --- | --- | --- |",
    ...published.map(row),
    "",
  ].join("\n");
}

function internationalReviewMarkdown(catalog) {
  const editions = catalog.editions.filter((edition) => edition.countryCode !== "KR");
  const sources = catalog.sources.filter((source) =>
    editions.some((edition) => edition.sourceIds.includes(source.id)),
  );
  const countryCounts = [...new Set(editions.map((edition) => edition.countryName))]
    .sort((left, right) => left.localeCompare(right, "ko"))
    .map((country) => `${country} ${editions.filter((edition) => edition.countryName === country).length}회차`)
    .join(" · ");
  const row = (edition) => {
    const reasons = edition.reviewReasons.map(reasonLabel).join(" · ");
    return `| \`${edition.id}\` | ${edition.countryName} | ${edition.name.replaceAll("|", "\\|")} | ${edition.startDate}–${edition.endDate} | ${edition.publicationStatus === "public" ? "공개·보강 필요" : "보류"} | ${reasons} |`;
  };

  return [
    "# International stationery event review targets",
    "",
    `- Source snapshot: ${catalog.normalizedAt}`,
    `- Countries: ${countryCounts}`,
    `- Event masters: ${new Set(editions.map((edition) => edition.masterId)).size}`,
    `- Editions: ${editions.length}`,
    `- Accessible official sources: ${sources.filter((source) => source.availability === "accessible").length}/${sources.length}`,
    `- Public source-checked editions: ${editions.filter((edition) => edition.publicationStatus === "public").length}`,
    `- Held editions: ${editions.filter((edition) => edition.publicationStatus === "held").length}`,
    "- Search results were discovery hints only. Every published date is tied to a reachable S1/S2 organizer, association, venue, or public trade-show page.",
    "- Unknown exhibitor deadlines, fees, selection rules, and operations remain null and are listed below for later review.",
    "",
    "| Edition | Country | Event | Dates | State | Review reasons |",
    "| --- | --- | --- | --- | --- | --- |",
    ...editions
      .toSorted((left, right) => left.startDate.localeCompare(right.startDate))
      .map(row),
    "",
  ].join("\n");
}

export async function buildNormalizedCatalog() {
  const batchRegistry = await readJson(batchRegistryPath);
  const batches = [];
  for (const batch of batchRegistry.batches.filter((item) => item.enabled !== false)) {
    const candidateDirectory = path.join(contentDirectory, batch.directory);
    const validation = await validateCandidateBundle(candidateDirectory);
    if (validation.errors.length) {
      throw new Error(`${batch.id}: candidate bundle is invalid: ${validation.errors.join("; ")}`);
    }
    const sourceAudit = await readJson(
      path.join(candidateDirectory, "source-reachability-audit.json"),
    );
    batches.push({ batch, validation, sourceAudit });
  }

  const rawMasters = batches.flatMap(({ batch, validation }) =>
    validation.records.masters.map((record) => ({ ...record, researchBatchId: batch.id })),
  );
  const rawEditions = batches.flatMap(({ batch, validation }) =>
    validation.records.editions.map((record) => ({ ...record, researchBatchId: batch.id })),
  );
  const rawSources = batches.flatMap(({ batch, validation }) =>
    validation.records.sources.map((record) => ({ ...record, researchBatchId: batch.id })),
  );
  const sourceAuditResults = batches.flatMap(({ sourceAudit }) => sourceAudit.results);
  const sourceAuditById = new Map(sourceAuditResults.map((result) => [result.id, result]));
  const sourceById = new Map(rawSources.map((source) => [source.id, source]));
  const duplicateIds = (records) => records.length !== new Set(records.map((record) => record.id)).size;
  if (duplicateIds(rawMasters) || duplicateIds(rawEditions) || duplicateIds(rawSources)) {
    throw new Error("candidate batches contain duplicate IDs");
  }

  const masters = rawMasters.map((master) => ({
    ...master,
    countryCode: master.countryCode ?? "KR",
    countryName: master.countryName ?? "대한민국",
    sourceLanguage: master.sourceLanguage ?? "ko",
    catalogStatus:
      master.researchStatus === "needs_source" ? "needs_review" : "normalized_candidate",
  }));
  const masterById = new Map(masters.map((master) => [master.id, master]));

  const sources = rawSources.map((source) => {
    const audit = sourceAuditById.get(source.id);
    return {
      ...source,
      checkedAt: audit?.checkedAt ?? null,
      availability: audit?.availability ?? "fetch-error",
      httpStatus: audit?.httpStatus ?? null,
      finalUrl: audit?.finalUrl ?? null,
      redirected: audit?.redirected ?? false,
      error: audit?.error ?? null,
    };
  });

  const editions = rawEditions.map((edition) => {
    const normalized = {
      ...edition,
      contentStatus: "needs_review",
      publicationStatus: "held",
      countryCode: edition.countryCode ?? "KR",
      countryName: edition.countryName ?? "대한민국",
      city: edition.city ?? null,
      timeZone: edition.timeZone ?? "Asia/Seoul",
      sourceLanguage: edition.sourceLanguage ?? "ko",
      venueId: edition.venueId ?? null,
      venue: edition.venue ?? null,
      address: edition.address ?? null,
      startDate: edition.startDate ?? null,
      endDate: edition.endDate ?? null,
      application: {
        openConfirmedAt: edition.application?.openConfirmedAt ?? null,
        status: statusMap.get(edition.application?.status) ?? null,
        sourceStatusLabel: edition.application?.status ?? null,
        deadline: {
          kind: normalizeDeadlineKind(
            edition.application?.deadline?.kind,
            edition.application?.deadline?.at,
          ),
          at: edition.application?.deadline?.at ?? null,
          label: edition.application?.deadline?.label ?? null,
        },
        selection: normalizeSelection(edition.application?.selection),
        sourceSelectionLabel: edition.application?.selection ?? null,
        businessRequired: edition.application?.businessRequired ?? null,
        documents: edition.application?.documents ?? [],
        resalePolicy: edition.application?.resalePolicy ?? null,
        refundPolicy: edition.application?.refundPolicy ?? null,
        note: edition.application?.note ?? null,
        boothOptions: (edition.application?.boothOptions ?? []).map(normalizeBoothOption),
      },
      reviewReasons: [],
    };
    const master = masterById.get(edition.masterId);
    normalized.reviewReasons = normalizedReviewReasons(
      edition,
      master,
      sourceById,
      sourceAuditById,
      normalized,
    );
    const hasReachableSources = (edition.sourceIds ?? []).every(
      (sourceId) => sourceAuditById.get(sourceId)?.availability === "accessible",
    );
    const primaryTier = sourceById.get(edition.primarySourceId)?.tier;
    const canPublish =
      master?.researchStatus !== "needs_source" &&
      ["S1", "S2"].includes(primaryTier) &&
      hasReachableSources &&
      Boolean(edition.startDate && edition.endDate);
    normalized.publicationStatus = canPublish ? "public" : "held";
    normalized.contentStatus = canPublish ? "source_checked" : "needs_review";
    return normalized;
  });

  return {
    normalizedAt: batches
      .map(({ sourceAudit }) => sourceAudit.checkedAt)
      .sort()
      .at(-1),
    masters,
    editions,
    sources,
  };
}

function serializedOutputs(catalog) {
  return new Map([
    [outputPaths.masters, `${JSON.stringify(catalog.masters, null, 2)}\n`],
    [outputPaths.editions, `${JSON.stringify(catalog.editions, null, 2)}\n`],
    [outputPaths.sources, `${JSON.stringify(catalog.sources, null, 2)}\n`],
    [outputPaths.review, reviewMarkdown(catalog)],
    [outputPaths.internationalReview, internationalReviewMarkdown(catalog)],
  ]);
}

export function validateNormalizedCatalog(catalog) {
  const errors = [];
  const masterIds = new Set(catalog.masters.map((master) => master.id));
  const sourceById = new Map(catalog.sources.map((source) => [source.id, source]));
  if (masterIds.size !== catalog.masters.length) errors.push("normalized master IDs must be unique");
  if (new Set(catalog.editions.map((edition) => edition.id)).size !== catalog.editions.length) {
    errors.push("normalized edition IDs must be unique");
  }
  if (sourceById.size !== catalog.sources.length) errors.push("normalized source IDs must be unique");
  for (const edition of catalog.editions) {
    if (!masterIds.has(edition.masterId)) errors.push(`${edition.id}: unknown master`);
    if (!sourceById.has(edition.primarySourceId)) errors.push(`${edition.id}: unknown primary source`);
    if (edition.publicationStatus === "public") {
      if (!edition.startDate || !edition.endDate) errors.push(`${edition.id}: public edition has no dates`);
      if (edition.contentStatus !== "source_checked") errors.push(`${edition.id}: public status mismatch`);
      if (!/^[A-Z]{2}$/.test(edition.countryCode)) {
        errors.push(`${edition.id}: invalid country code`);
      }
      if (!edition.timeZone) errors.push(`${edition.id}: missing time zone`);
      for (const option of edition.application.boothOptions) {
        if (option.feeAmount !== null && !/^[A-Z]{3}$/.test(option.currency ?? "")) {
          errors.push(`${edition.id}: fee has no ISO currency`);
        }
      }
      for (const sourceId of edition.sourceIds) {
        if (sourceById.get(sourceId)?.availability !== "accessible") {
          errors.push(`${edition.id}: public edition uses inaccessible source ${sourceId}`);
        }
      }
    }
  }
  return errors;
}

async function runCli() {
  const catalog = await buildNormalizedCatalog();
  const errors = validateNormalizedCatalog(catalog);
  if (errors.length) throw new Error(errors.join("\n"));
  const outputs = serializedOutputs(catalog);

  if (process.argv.includes("--check")) {
    const stale = [];
    for (const [target, expected] of outputs) {
      const actual = (await pathExists(target)) ? await readFile(target, "utf8") : null;
      if (actual !== expected) stale.push(path.relative(contentDirectory, target));
    }
    if (stale.length) throw new Error(`정규화 파일이 최신이 아닙니다: ${stale.join(", ")}`);
  } else {
    await writeJson(outputPaths.masters, catalog.masters);
    await writeJson(outputPaths.editions, catalog.editions);
    await writeJson(outputPaths.sources, catalog.sources);
    await writeText(outputPaths.review, reviewMarkdown(catalog));
    await writeText(outputPaths.internationalReview, internationalReviewMarkdown(catalog));
  }

  const publicCount = catalog.editions.filter((edition) => edition.publicationStatus === "public").length;
  console.log(
    `후보 정규화 통과: 마스터 ${catalog.masters.length}개, 회차 ${catalog.editions.length}개, 출처 ${catalog.sources.length}개, 공개 ${publicCount}개`,
  );
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) await runCli();
