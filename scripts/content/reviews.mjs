import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  contentDirectory,
  ensureDirectory,
  getOrCreateReviewPepper,
  isoDate,
  parseArguments,
  pathExists,
  privateReviewDirectory,
  readJson,
  sha256,
  writeText,
} from "./lib.mjs";

const execFileAsync = promisify(execFile);
const args = parseArguments(process.argv.slice(2));
const command = args._[0] ?? "report";
const config = await readJson(path.join(contentDirectory, "config", "review-sources.json"));
const recordsPath = path.join(privateReviewDirectory, "records.jsonl");

function publicHttpsUrl(value) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const privateIpv4 =
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  if (
    url.protocol !== "https:" ||
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    privateIpv4 ||
    url.username ||
    url.password
  ) {
    throw new Error("review source URL must be a public HTTPS URL");
  }
  url.hash = "";
  return url.toString();
}

function classify(text) {
  const rules = {
    crowd: ["관람객", "사람", "붐비", "한산", "줄"],
    sales: ["매출", "판매", "완판", "재고", "객단가"],
    operations: ["운영", "스태프", "안내", "응대", "입장"],
    logistics: ["반입", "철수", "주차", "택배", "대차"],
    cost: ["부스비", "비용", "숙박", "교통비", "식비"],
    returnIntent: ["재참가", "다시 참가", "다음에도", "재방문"],
  };
  return Object.entries(rules)
    .filter(([, terms]) => terms.some((term) => text.includes(term)))
    .map(([category]) => category)
    .concat("other")
    .filter((value, index, values) => value !== "other" || values.length === 1);
}

async function readRecords() {
  if (!(await pathExists(recordsPath))) return [];
  return (await readFile(recordsPath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function saveRecords(records) {
  await ensureDirectory(privateReviewDirectory);
  const unique = [...new Map(records.map((record) => [`${record.provider}:${record.providerId}`, record])).values()]
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  await writeText(recordsPath, unique.map((record) => JSON.stringify(record)).join("\n") + (unique.length ? "\n" : ""));
  return unique;
}

async function collectX(collector) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("X_BEARER_TOKEN is required for the official X API collector");
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", collector.query);
  url.searchParams.set("max_results", String(Math.max(10, Math.min(100, collector.maxResults ?? 100))));
  url.searchParams.set("tweet.fields", "id,author_id,created_at,text,lang,public_metrics");
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, "user-agent": "BinderyReviewCollector/0.1" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`X API returned ${response.status}`);
  const payload = await response.json();
  const pepper = await getOrCreateReviewPepper();
  const collectedAt = new Date().toISOString();
  return (payload.data ?? []).map((post) => ({
    provider: "x-api-v2",
    providerId: post.id,
    eventMasterId: collector.eventMasterId,
    sourceUrl: `https://x.com/i/web/status/${post.id}`,
    publishedAt: post.created_at,
    collectedAt,
    authorHash: sha256(`${pepper}:${post.author_id}`),
    text: post.text,
    categories: classify(post.text),
    metricsAtCollection: post.public_metrics ?? null,
    publicOutput: false,
  }));
}

async function normalizeExternalRows(rows, collector, provider) {
  const pepper = await getOrCreateReviewPepper();
  const collectedAt = new Date().toISOString();
  return rows.map((item) => {
    if (!item.id || !item.url || !item.text) {
      throw new Error(`${provider} returned a row without id, url, or text`);
    }
    return {
      provider,
      providerId: String(item.id),
      eventMasterId: collector.eventMasterId,
      sourceUrl: publicHttpsUrl(item.url),
      publishedAt: item.createdAt ?? null,
      collectedAt,
      authorHash: item.authorId ? sha256(`${pepper}:${item.authorId}`) : null,
      text: item.text,
      categories: classify(item.text),
      metricsAtCollection: item.metrics ?? null,
      publicOutput: false,
    };
  });
}

async function collectTwscrape(collector) {
  const python = path.resolve(
    args.python ??
      process.env.TWSCRAPE_PYTHON ??
      path.join(privateReviewDirectory, "twscrape", ".venv", "bin", "python"),
  );
  const database = path.resolve(
    args.database ?? collector.database ?? path.join(privateReviewDirectory, "twscrape", "accounts.db"),
  );
  const adapter = path.join(process.cwd(), "tools", "review-collectors", "twscrape", "collect.py");

  if (!(await pathExists(python))) {
    throw new Error("twscrape Python environment is missing; run npm run reviews:twscrape:setup");
  }
  if (!(await pathExists(database))) {
    throw new Error(
      "twscrape account database is missing; add a cookie to the Git-ignored local database first",
    );
  }

  const { stdout } = await execFileAsync(
    python,
    [
      adapter,
      "--db",
      database,
      "--query",
      collector.query,
      "--limit",
      String(Math.max(1, Math.min(500, collector.maxResults ?? 100))),
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 120_000,
    },
  );
  const rows = stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return normalizeExternalRows(rows, collector, "twscrape");
}

async function collect() {
  const selected = args.collector
    ? config.collectors.filter((collector) => collector.id === args.collector)
    : config.collectors.filter((collector) => collector.enabled);
  if (args.collector && !selected.length) {
    throw new Error(`unknown review collector: ${args.collector}`);
  }
  if (!selected.length) {
    console.log("후기 수집기 0건 활성화: 공식 X API 토큰과 운영 승인 전까지 로컬 파이프라인만 준비됩니다.");
    return;
  }
  const existing = await readRecords();
  const additions = [];
  for (const collector of selected) {
    if (collector.provider === "x-api-v2") additions.push(...(await collectX(collector)));
    else if (collector.provider === "twscrape") additions.push(...(await collectTwscrape(collector)));
    else throw new Error(`unsupported review collector provider: ${collector.provider}`);
  }
  const saved = await saveRecords([...existing, ...additions]);
  console.log(`로컬 후기 ${additions.length}건 수집, 중복 제거 후 ${saved.length}건 보관`);
}

async function importJsonl() {
  if (!args.input || !args.provider || !args["event-master"]) {
    throw new Error("import requires --input, --provider, and --event-master");
  }
  const sourceLines = (await readFile(path.resolve(args.input), "utf8")).split(/\r?\n/).filter(Boolean);
  const imported = await normalizeExternalRows(
    sourceLines.map((line) => JSON.parse(line)),
    { eventMasterId: args["event-master"] },
    args.provider,
  );
  const saved = await saveRecords([...(await readRecords()), ...imported]);
  console.log(`외부 공개 URL 자료 ${imported.length}건 가져오기, 총 ${saved.length}건 보관`);
}

async function report() {
  const records = await readRecords();
  const providers = Object.entries(
    records.reduce((accumulator, record) => {
      accumulator[record.provider] = (accumulator[record.provider] ?? 0) + 1;
      return accumulator;
    }, {}),
  );
  const categories = Object.entries(
    records.flatMap((record) => record.categories).reduce((accumulator, category) => {
      accumulator[category] = (accumulator[category] ?? 0) + 1;
      return accumulator;
    }, {}),
  );
  const markdown = [
    `# 로컬 후기 참고 보고서 — ${isoDate()}`,
    "",
    "> 게시용 데이터가 아닙니다. 원문과 작성자 식별 정보는 Git 및 사이트 생성 경로와 분리됩니다.",
    "",
    `- 보관 건수: ${records.length}`,
    `- 공개 출력: 0`,
    "",
    "## 수집원",
    "",
    ...(providers.length ? providers.map(([provider, count]) => `- ${provider}: ${count}건`) : ["- 아직 수집된 자료 없음"]),
    "",
    "## 규칙 기반 주제 분류",
    "",
    ...(categories.length ? categories.map(([category, count]) => `- ${category}: ${count}건`) : ["- 아직 분류할 자료 없음"]),
    "",
    "## 사용 경계",
    "",
    "- 후기는 공식 날짜·가격·규정을 직접 덮어쓸 수 없습니다.",
    "- 문제 제기는 운영자 재확인 단서로만 사용합니다.",
    "- 원문 삭제·수정 가능성을 고려해 URL과 수집 시각을 함께 보관합니다.",
    "- 공개 집계나 인용은 별도 제품·법률·개인정보 검토 없이는 만들지 않습니다.",
    "",
  ].join("\n");
  await writeText(path.join(privateReviewDirectory, "REPORT.md"), markdown);
  console.log(`로컬 후기 보고서 생성: ${path.relative(process.cwd(), path.join(privateReviewDirectory, "REPORT.md"))}`);
}

async function archiveInput() {
  const records = await readRecords();
  const urls = [...new Set(records.map((record) => record.sourceUrl))];
  await writeText(path.join(privateReviewDirectory, "archivebox-input.txt"), urls.join("\n") + (urls.length ? "\n" : ""));
  console.log(`ArchiveBox 입력 URL ${urls.length}건 생성`);
}

if (command === "collect") await collect();
else if (command === "import") await importJsonl();
else if (command === "report") await report();
else if (command === "archive") await archiveInput();
else throw new Error(`unknown reviews command: ${command}`);
