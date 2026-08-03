import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  addDays,
  cacheDirectory,
  canonicalizeUrl,
  contentDirectory,
  ensureDirectory,
  htmlTitle,
  normalizedHtmlText,
  readJson,
  readJsonIfPresent,
  rootDirectory,
  sha256,
  writeJson,
  writeText,
} from "./lib.mjs";

const registry = await readJson(path.join(contentDirectory, "config", "source-registry.json"));
const recordsDirectory = path.join(contentDirectory, "sources", "2026");
const sourceCacheDirectory = path.join(cacheDirectory, "official");
const queuePath = path.join(contentDirectory, "queues", "recheck.jsonl");
const robotsCache = new Map();

async function robotsDecision(source) {
  const url = new URL(source.url);
  const robotsUrl = `${url.origin}/robots.txt`;
  if (!robotsCache.has(robotsUrl)) {
    robotsCache.set(
      robotsUrl,
      fetch(robotsUrl, {
        headers: { "user-agent": registry.userAgent },
        signal: AbortSignal.timeout(10_000),
      })
        .then(async (response) => ({ status: response.status, text: response.ok ? await response.text() : "" }))
        .catch(() => ({ status: 0, text: "" })),
    );
  }

  const robots = await robotsCache.get(robotsUrl);
  if (!robots.text) return { status: "unavailable", allowed: true };

  let applies = false;
  let allowed = true;
  for (const rawLine of robots.text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawKey, ...rawValue] = line.split(":");
    const key = rawKey.toLowerCase();
    const value = rawValue.join(":").trim();
    if (key === "user-agent") {
      applies = value === "*" || registry.userAgent.toLowerCase().startsWith(value.toLowerCase());
    } else if (applies && key === "disallow" && value && url.pathname.startsWith(value)) {
      allowed = false;
    } else if (applies && key === "allow" && value && url.pathname.startsWith(value)) {
      allowed = true;
    }
  }
  return { status: allowed ? "allowed" : "blocked", allowed };
}

function cacheExtension(contentType) {
  if (contentType.includes("html")) return "html";
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("json")) return "json";
  if (contentType.startsWith("text/")) return "txt";
  return "bin";
}

async function collect(source) {
  const checkedAt = new Date();
  const recordPath = path.join(recordsDirectory, `${source.id}.json`);
  const previous = await readJsonIfPresent(recordPath);
  const robots = await robotsDecision(source);

  if (!robots.allowed) {
    const record = {
      ...source,
      url: canonicalizeUrl(source.url),
      checkedAt: checkedAt.toISOString(),
      recheckDueAt: addDays(checkedAt, source.recheckDays).toISOString(),
      availability: "robots-blocked",
      robots: robots.status,
      httpStatus: null,
      contentType: null,
      contentHash: previous?.contentHash ?? null,
      previousContentHash: previous?.contentHash ?? null,
      changeStatus: "blocked"
    };
    await writeJson(recordPath, record);
    return record;
  }

  try {
    const response = await fetch(source.url, {
      headers: { accept: "text/html,application/pdf;q=0.9,*/*;q=0.5", "user-agent": registry.userAgent },
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      const record = {
        ...source,
        url: canonicalizeUrl(response.url || source.url),
        checkedAt: checkedAt.toISOString(),
        recheckDueAt: addDays(checkedAt, source.recheckDays).toISOString(),
        availability: "http-error",
        robots: robots.status,
        httpStatus: response.status,
        contentType: response.headers.get("content-type")?.split(";")[0] ?? null,
        contentHash: previous?.contentHash ?? null,
        previousContentHash: previous?.contentHash ?? null,
        changeStatus: "error",
      };
      await writeJson(recordPath, record);
      return record;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
    const payloadHash = sha256(bytes);
    const extension = cacheExtension(contentType);
    const cachePath = path.join(sourceCacheDirectory, `${source.id}.${extension}`);
    await ensureDirectory(sourceCacheDirectory);
    await writeFile(cachePath, bytes);

    let title = null;
    let normalizedTextBytes = null;
    let contentHash = payloadHash;
    if (contentType.includes("html")) {
      const html = bytes.toString("utf8");
      title = htmlTitle(html);
      const normalizedText = normalizedHtmlText(html);
      contentHash = sha256(normalizedText);
      normalizedTextBytes = Buffer.byteLength(normalizedText);
      await writeText(path.join(sourceCacheDirectory, `${source.id}.txt`), `${normalizedText}\n`);
    }

    const previousHash = previous?.contentHash ?? null;
    const record = {
      ...source,
      url: canonicalizeUrl(response.url || source.url),
      checkedAt: checkedAt.toISOString(),
      recheckDueAt: addDays(checkedAt, source.recheckDays).toISOString(),
      availability: "accessible",
      robots: robots.status,
      httpStatus: response.status,
      contentType,
      contentHash,
      payloadHash,
      previousContentHash: previousHash,
      changeStatus: previousHash === null ? "new" : previousHash === contentHash ? "unchanged" : "changed",
      title,
      bytes: bytes.length,
      normalizedTextBytes,
      cachePath: path.relative(rootDirectory, cachePath),
    };
    await writeJson(recordPath, record);
    return record;
  } catch (error) {
    const record = {
      ...source,
      url: canonicalizeUrl(source.url),
      checkedAt: checkedAt.toISOString(),
      recheckDueAt: addDays(checkedAt, source.recheckDays).toISOString(),
      availability: "fetch-error",
      robots: robots.status,
      httpStatus: null,
      contentType: null,
      contentHash: previous?.contentHash ?? null,
      previousContentHash: previous?.contentHash ?? null,
      changeStatus: "error",
      error: error instanceof Error ? error.message : String(error),
    };
    await writeJson(recordPath, record);
    return record;
  }
}

await ensureDirectory(recordsDirectory);
const records = [];
for (const source of registry.sources) records.push(await collect(source));

const queueItems = records
  .filter((record) => record.changeStatus !== "unchanged")
  .map((record) => ({
    sourceId: record.id,
    detectedAt: record.checkedAt,
    changeStatus: record.changeStatus,
    availability: record.availability,
    previousContentHash: record.previousContentHash,
    contentHash: record.contentHash,
    status: "needs_review",
  }));
await writeText(queuePath, queueItems.map((item) => JSON.stringify(item)).join("\n") + (queueItems.length ? "\n" : ""));

const accessible = records.filter((record) => record.availability === "accessible").length;
console.log(`공식 출처 ${records.length}건 수집: 접근 가능 ${accessible}건, 검토 큐 ${queueItems.length}건`);
if (accessible !== records.length) process.exitCode = 1;
