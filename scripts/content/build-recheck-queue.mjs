import path from "node:path";

import {
  contentDirectory,
  listJsonFiles,
  readJson,
  writeText,
} from "./lib.mjs";

const queuePath = path.join(contentDirectory, "queues", "recheck.jsonl");
const normalizedSources = await readJson(
  path.join(contentDirectory, "catalog", "source-records.json"),
);
const collectedSourceFiles = await listJsonFiles(
  path.join(contentDirectory, "sources"),
);
const collectedSources = await Promise.all(
  collectedSourceFiles.map((file) => readJson(file)),
);
const now = new Date(process.env.BINDERY_RECHECK_AT ?? Date.now());

if (Number.isNaN(now.getTime())) {
  throw new Error("BINDERY_RECHECK_AT must be a valid ISO date-time");
}

const sourcesById = new Map(
  [...normalizedSources, ...collectedSources].map((source) => [source.id, source]),
);
const queue = [...sourcesById.values()]
  .flatMap((source) => {
    const dueAt = source.recheckDueAt ? new Date(source.recheckDueAt) : null;
    const overdue = dueAt && dueAt.getTime() < now.getTime();
    const changeNeedsReview = ["changed", "blocked", "error"].includes(
      source.changeStatus,
    );
    if (!overdue && !changeNeedsReview) return [];
    return [
      {
        sourceId: source.id,
        detectedAt: now.toISOString(),
        checkedAt: source.checkedAt ?? null,
        recheckDueAt: source.recheckDueAt ?? null,
        reason: overdue ? "recheck-overdue" : `source-${source.changeStatus}`,
        availability: source.availability,
        previousContentHash: source.previousContentHash ?? null,
        contentHash: source.contentHash ?? null,
        status: "needs_review",
      },
    ];
  })
  .toSorted((left, right) =>
    `${left.recheckDueAt ?? ""}:${left.sourceId}`.localeCompare(
      `${right.recheckDueAt ?? ""}:${right.sourceId}`,
    ),
  );

await writeText(
  queuePath,
  queue.map((item) => JSON.stringify(item)).join("\n") + (queue.length ? "\n" : ""),
);

console.log(
  `재검수 큐 ${queue.length}건 생성 (${now.toISOString().slice(0, 10)} 기준)`,
);
