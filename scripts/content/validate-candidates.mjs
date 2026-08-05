import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contentDirectory,
  normalizedHtmlText,
  parseArguments,
  pathExists,
  readJson,
} from "./lib.mjs";

const defaultCandidateDirectory = path.join(contentDirectory, "research", "2026-08-05-pro");
const batchRegistryPath = path.join(contentDirectory, "config", "candidate-batches.json");
const candidateFiles = {
  masters: "event-masters.candidates.jsonl",
  editions: "event-editions.candidates.jsonl",
  sources: "source-records.candidates.jsonl",
};
const masterStatuses = new Set(["verified_existing", "needs_source", "existing_overlap"]);
const sourceTiers = new Set(["S1", "S2", "S3"]);
const publishApplicationStatuses = new Set(["scheduled", "open", "capacity", "closed"]);
const publishDeadlineKinds = new Set(["final", "early-bird", "capacity"]);
const publishSelections = new Set(["선착순", "추첨", "심사"]);
const criticalPublishEvidence = [
  "dates",
  "venue",
  "address",
  "applicationStatus",
  "applicationMilestone",
  "boothFee",
  "selection",
  "refundPolicy",
];

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function addDuplicateErrors(errors, records, label) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.id)) errors.push(`${label}: duplicate id ${record.id}`);
    seen.add(record.id);
  }
}

async function readJsonLines(target) {
  const raw = await readFile(target, "utf8");
  const records = [];
  const errors = [];
  for (const [index, line] of raw.split("\n").entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      errors.push(`${path.basename(target)}:${index + 1}: ${error.message}`);
    }
  }
  return { raw, records, errors };
}

function publishBlockers(edition) {
  const blockers = [];
  const requiredStrings = [
    ["startDate", edition.startDate],
    ["endDate", edition.endDate],
    ["venueId", edition.venueId],
    ["venue", edition.venue],
    ["address", edition.address],
    ["application.openConfirmedAt", edition.application?.openConfirmedAt],
    ["application.deadline.at", edition.application?.deadline?.at],
    ["application.deadline.label", edition.application?.deadline?.label],
  ];
  for (const [field, value] of requiredStrings) {
    if (typeof value !== "string" || value.length === 0) blockers.push(`missing:${field}`);
  }
  if (!publishApplicationStatuses.has(edition.application?.status)) {
    blockers.push("normalize:application.status");
  }
  if (!publishDeadlineKinds.has(edition.application?.deadline?.kind)) {
    blockers.push("normalize:application.deadline.kind");
  }
  if (!publishSelections.has(edition.application?.selection)) {
    blockers.push("normalize:application.selection");
  }
  if (!edition.application?.boothOptions?.length) {
    blockers.push("missing:application.boothOptions");
  } else {
    for (const option of edition.application.boothOptions) {
      if (
        typeof option.id !== "string" ||
        typeof option.label !== "string" ||
        !Number.isInteger(option.feeKrw) ||
        typeof option.size !== "string" ||
        typeof option.vatIncluded !== "boolean"
      ) {
        blockers.push("normalize:application.boothOptions");
        break;
      }
    }
  }
  for (const field of criticalPublishEvidence) {
    if (!edition.fieldEvidence?.[field]?.length) blockers.push(`evidence:${field}`);
  }
  return blockers;
}

function reviewScore(edition) {
  const evidenceFields = Object.keys(edition.fieldEvidence ?? {}).length;
  const onsiteFields = Object.values(edition.onsite ?? {}).filter((value) => value !== null).length;
  const applicationFields = [
    edition.application?.openConfirmedAt,
    edition.application?.status,
    edition.application?.deadline?.at,
    edition.application?.selection,
    edition.application?.businessRequired,
    edition.application?.resalePolicy,
    edition.application?.refundPolicy,
  ].filter((value) => value !== null && value !== undefined).length;
  return evidenceFields * 3 + onsiteFields + applicationFields + (edition.application?.boothOptions?.length ?? 0);
}

export async function validateCandidateBundle(candidateDirectory = defaultCandidateDirectory) {
  const errors = [];
  const warnings = [];
  const loaded = {};

  for (const [kind, fileName] of Object.entries(candidateFiles)) {
    const target = path.join(candidateDirectory, fileName);
    if (!(await pathExists(target))) {
      errors.push(`missing candidate file: ${fileName}`);
      loaded[kind] = { raw: "", records: [] };
      continue;
    }
    loaded[kind] = await readJsonLines(target);
    errors.push(...loaded[kind].errors);
  }

  const { masters, editions, sources } = Object.fromEntries(
    Object.entries(loaded).map(([kind, value]) => [kind, value.records]),
  );
  addDuplicateErrors(errors, masters, "masters");
  addDuplicateErrors(errors, editions, "editions");
  addDuplicateErrors(errors, sources, "sources");

  const masterById = new Map(masters.map((master) => [master.id, master]));
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  for (const master of masters) {
    if (!masterStatuses.has(master.researchStatus)) {
      errors.push(`${master.id}: invalid researchStatus ${master.researchStatus}`);
    }
    for (const sourceId of master.officialSourceIds ?? []) {
      if (!sourceById.has(sourceId)) errors.push(`${master.id}: unknown official source ${sourceId}`);
    }
  }

  for (const source of sources) {
    if (!sourceTiers.has(source.tier)) errors.push(`${source.id}: invalid source tier ${source.tier}`);
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:") errors.push(`${source.id}: source URL must use HTTPS`);
      if ([...url.searchParams.keys()].some((key) => /^(utm_|fbclid$|gclid$)/i.test(key))) {
        errors.push(`${source.id}: tracking parameter remains in source URL`);
      }
    } catch {
      errors.push(`${source.id}: invalid source URL ${source.url}`);
    }
    for (const masterId of source.eventMasterIds ?? []) {
      if (!masterById.has(masterId)) errors.push(`${source.id}: unknown master ${masterId}`);
    }
  }

  for (const edition of editions) {
    const master = masterById.get(edition.masterId);
    if (!master) errors.push(`${edition.id}: unknown master ${edition.masterId}`);
    if (master?.researchStatus === "needs_source") {
      errors.push(`${edition.id}: needs_source master leaked into edition candidates`);
    }
    if (edition.contentStatus !== "research_candidate") {
      errors.push(`${edition.id}: contentStatus must remain research_candidate`);
    }
    if (edition.startDate && edition.endDate && edition.startDate > edition.endDate) {
      errors.push(`${edition.id}: startDate must not follow endDate`);
    }
    if (!edition.sourceIds?.includes(edition.primarySourceId)) {
      errors.push(`${edition.id}: primary source is not linked`);
    }
    for (const sourceId of edition.sourceIds ?? []) {
      if (!sourceById.has(sourceId)) errors.push(`${edition.id}: unknown source ${sourceId}`);
    }
    for (const [field, evidence] of Object.entries(edition.fieldEvidence ?? {})) {
      if (!Array.isArray(evidence) || evidence.length === 0) {
        errors.push(`${edition.id}: empty evidence for ${field}`);
        continue;
      }
      for (const item of evidence) {
        if (!sourceById.has(item.sourceId)) errors.push(`${edition.id}: unknown evidence source ${item.sourceId}`);
        if (!edition.sourceIds?.includes(item.sourceId)) {
          errors.push(`${edition.id}: evidence source ${item.sourceId} is not linked`);
        }
      }
    }
  }

  const manifestPath = path.join(candidateDirectory, "manifest.json");
  if (await pathExists(manifestPath)) {
    const manifest = await readJson(manifestPath);
    for (const [fileName, expected] of Object.entries(manifest.files ?? {})) {
      const target = path.join(candidateDirectory, fileName);
      if (!(await pathExists(target))) {
        errors.push(`manifest file is missing: ${fileName}`);
        continue;
      }
      const raw = await readFile(target);
      if (digest(raw) !== expected.sha256) errors.push(`${fileName}: SHA-256 mismatch`);
      if (raw.byteLength !== expected.bytes) errors.push(`${fileName}: byte count mismatch`);
      if (expected.lines !== undefined) {
        const text = raw.toString("utf8");
        const lineCount = (text.match(/\n/g) ?? []).length + (text.length > 0 && !text.endsWith("\n") ? 1 : 0);
        if (lineCount !== expected.lines) errors.push(`${fileName}: line count mismatch`);
      }
    }
  } else {
    warnings.push("manifest.json is missing; artifact hashes were not verified");
  }

  const blockersByEdition = new Map(editions.map((edition) => [edition.id, publishBlockers(edition)]));
  return {
    errors,
    warnings,
    records: { masters, editions, sources },
    indexes: { masterById, editionById, sourceById },
    blockersByEdition,
    counts: {
      masters: masters.length,
      editions: editions.length,
      sources: sources.length,
      verifiedExisting: masters.filter((master) => master.researchStatus === "verified_existing").length,
      needsSource: masters.filter((master) => master.researchStatus === "needs_source").length,
      existingOverlap: masters.filter((master) => master.researchStatus === "existing_overlap").length,
      publishReady: [...blockersByEdition.values()].filter((blockers) => blockers.length === 0).length,
      requiresEditorialWork: [...blockersByEdition.values()].filter((blockers) => blockers.length > 0).length,
    },
  };
}

async function checkOneSource(source, checkedAt) {
  try {
    const response = await fetch(source.url, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/pdf,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "User-Agent": "BinderyCandidateAudit/0.1 (+official-source reachability check)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type")?.split(";")[0] ?? null;
    const contentHash = contentType?.includes("html")
      ? digest(normalizedHtmlText(bytes.toString("utf8")))
      : digest(bytes);
    return {
      id: source.id,
      url: source.url,
      tier: source.tier,
      checkedAt,
      availability: response.ok ? "accessible" : "http-error",
      httpStatus: response.status,
      contentType,
      contentHash,
      bytes: bytes.length,
      finalUrl: response.url,
      redirected: response.redirected,
      error: null,
    };
  } catch (error) {
    return {
      id: source.id,
      url: source.url,
      tier: source.tier,
      checkedAt,
      availability: "fetch-error",
      httpStatus: null,
      contentType: null,
      contentHash: null,
      bytes: null,
      finalUrl: null,
      redirected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkCandidateSources(sources, { concurrency = 8, onProgress } = {}) {
  const checkedAt = new Date().toISOString();
  const results = new Array(sources.length);
  let nextIndex = 0;
  let completed = 0;
  const workers = Array.from({ length: Math.min(concurrency, sources.length) }, async () => {
    while (nextIndex < sources.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await checkOneSource(sources[index], checkedAt);
      completed += 1;
      if (completed % 20 === 0 || completed === sources.length) onProgress?.(completed, sources.length);
    }
  });
  await Promise.all(workers);
  return {
    version: 1,
    checkedAt,
    userAgent: "BinderyCandidateAudit/0.1 (+official-source reachability check)",
    timeoutMs: 15_000,
    counts: {
      total: results.length,
      accessible: results.filter((result) => result.availability === "accessible").length,
      httpError: results.filter((result) => result.availability === "http-error").length,
      fetchError: results.filter((result) => result.availability === "fetch-error").length,
      redirected: results.filter((result) => result.redirected).length,
    },
    results,
  };
}

function reviewQueueMarkdown(validation, sourceAudit) {
  const sourceResultById = new Map((sourceAudit?.results ?? []).map((result) => [result.id, result]));
  const rows = validation.records.editions
    .map((edition) => {
      const failedSources = (edition.sourceIds ?? []).filter(
        (sourceId) => sourceResultById.get(sourceId)?.availability !== "accessible",
      );
      return {
        edition,
        failedSources,
        score: reviewScore(edition),
        blockers: validation.blockersByEdition.get(edition.id),
      };
    })
    .filter(({ edition, failedSources }) => {
      const master = validation.indexes.masterById.get(edition.masterId);
      return master?.researchStatus !== "needs_source" && failedSources.length === 0;
    })
    .sort((left, right) => right.score - left.score || left.edition.id.localeCompare(right.edition.id))
    .slice(0, 20);

  const failedResults = (sourceAudit?.results ?? []).filter((result) => result.availability !== "accessible");
  return [
    "# Candidate editor-review queue",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Source audit: ${sourceAudit?.checkedAt ?? "not run"}`,
    `- Structurally valid candidates: ${validation.counts.editions}`,
    `- Directly publishable candidates: ${validation.counts.publishReady}`,
    `- Inaccessible or erroring source URLs: ${failedResults.length}`,
    "- Rule: this is a review queue, not public event data. An editor must reopen the official source and normalize every listed blocker before promotion.",
    "",
    "## Top 20 reachable candidates",
    "",
    "| Rank | Edition | Event | Review score | Remaining publish blockers |",
    "| ---: | --- | --- | ---: | ---: |",
    ...rows.map(
      ({ edition, score, blockers }, index) =>
        `| ${index + 1} | \`${edition.id}\` | ${edition.name.replaceAll("|", "\\|")} | ${score} | ${blockers.length} |`,
    ),
    "",
    "## Failed source checks",
    "",
    ...(failedResults.length
      ? failedResults.map(
          (result) =>
            `- \`${result.id}\`: ${result.availability}${result.httpStatus ? ` (${result.httpStatus})` : ""} — ${result.url}`,
        )
      : ["- None"]),
    "",
  ].join("\n");
}

async function runCli() {
  const args = parseArguments(process.argv.slice(2));
  const batchRegistry = args.all ? await readJson(batchRegistryPath) : null;
  const targets = batchRegistry
    ? batchRegistry.batches
        .filter((batch) => batch.enabled !== false)
        .map((batch) => ({
          id: batch.id,
          directory: path.join(contentDirectory, batch.directory),
        }))
    : [
        {
          id: path.basename(args.directory ? path.resolve(args.directory) : defaultCandidateDirectory),
          directory: args.directory ? path.resolve(args.directory) : defaultCandidateDirectory,
        },
      ];

  let failed = false;
  for (const target of targets) {
    const validation = await validateCandidateBundle(target.directory);
    if (validation.errors.length) {
      for (const error of validation.errors) console.error(`- ${target.id}: ${error}`);
      console.error(`${target.id} 후보 검증 실패: ${validation.errors.length}건`);
      failed = true;
      continue;
    }
    for (const warning of validation.warnings) {
      console.warn(`- ${target.id} warning: ${warning}`);
    }

    let sourceAudit = null;
    if (args["check-sources"]) {
      sourceAudit = await checkCandidateSources(validation.records.sources, {
        onProgress: (completed, total) =>
          console.log(`${target.id} 공식 출처 확인: ${completed}/${total}`),
      });
      if (args["write-source-audit"]) {
        await writeFile(
          path.join(target.directory, "source-reachability-audit.json"),
          `${JSON.stringify(sourceAudit, null, 2)}\n`,
          "utf8",
        );
      }
    } else {
      const auditPath = path.join(target.directory, "source-reachability-audit.json");
      if (await pathExists(auditPath)) sourceAudit = await readJson(auditPath);
    }

    if (args["write-review-queue"]) {
      await writeFile(
        path.join(target.directory, "editor-review-queue.md"),
        reviewQueueMarkdown(validation, sourceAudit),
        "utf8",
      );
    }

    console.log(
      `${target.id} 후보 검증 통과: 마스터 ${validation.counts.masters}개, 회차 ${validation.counts.editions}개, 출처 ${validation.counts.sources}개`,
    );
    console.log(
      `상태: 실재 확인 ${validation.counts.verifiedExisting}개, 출처 보강 필요 ${validation.counts.needsSource}개, 기존 중복 ${validation.counts.existingOverlap}개`,
    );
    if (sourceAudit) {
      console.log(
        `출처 접근성: 정상 ${sourceAudit.counts.accessible}개, HTTP 오류 ${sourceAudit.counts.httpError}개, fetch 오류 ${sourceAudit.counts.fetchError}개`,
      );
    }
  }
  if (failed) process.exitCode = 1;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) await runCli();
