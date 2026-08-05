import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  contentDirectory,
  isoDate,
  listJsonFiles,
  loadEditions,
  pathExists,
  readJson,
  writeText,
} from "./lib.mjs";

const registry = await readJson(path.join(contentDirectory, "config", "source-registry.json"));
const sourceById = new Map(registry.sources.map((source) => [source.id, source]));
const recordFiles = await listJsonFiles(path.join(contentDirectory, "sources"));
const records = await Promise.all(recordFiles.map((file) => readJson(file)));
const editions = (await loadEditions()).map(({ value }) => value);
const normalizedEditions = await readJson(
  path.join(contentDirectory, "catalog", "event-editions.json"),
);
const sourceCheckedEditions = normalizedEditions.filter(
  (edition) => edition.publicationStatus === "public",
);
const heldEditions = normalizedEditions.filter(
  (edition) => edition.publicationStatus === "held",
);
const internationalEditions = normalizedEditions.filter(
  (edition) => edition.countryCode !== "KR",
);
const queuePath = path.join(contentDirectory, "queues", "recheck.jsonl");
const queueLines = (await pathExists(queuePath))
  ? (await readFile(queuePath, "utf8")).split(/\r?\n/).filter(Boolean)
  : [];
const lines = [
  `# Bindery 공식 콘텐츠 수집 보고서 — ${isoDate()}`,
  "",
  "> 공개 행사 정보와 로컬 후기 자료는 물리적으로 분리됩니다. 이 보고서에는 후기 원문을 포함하지 않습니다.",
  "",
  "## 요약",
  "",
  `- 공식 출처 레지스트리: ${registry.sources.length}건`,
  `- 수집 완료 레코드: ${records.length}건`,
  `- 접근 가능: ${records.filter((record) => record.availability === "accessible").length}건`,
  `- 운영자 재확인 큐: ${queueLines.length}건`,
  `- 편집 검수 완료 행사 회차: ${editions.length}건`,
  `- 공식 원문 연결·세부 검수 중 회차: ${sourceCheckedEditions.length}건`,
  `- 정규화 후 공개 보류 회차: ${heldEditions.length}건`,
  `- 사이트 생성 회차 합계: ${editions.length + sourceCheckedEditions.length}건`,
  `- 해외 문구 행사: ${internationalEditions.length}회차 (${[...new Set(internationalEditions.map((edition) => edition.countryName))].join(" · ")})`,
  "- 로컬 후기 자료: 이 공식 보고서의 입력·집계 대상에서 제외",
  "",
  "## 공식 출처 상태",
  "",
  "| 등급 | 출처 | 상태 | 변경 | 확인일 | SHA-256 |",
  "| --- | --- | --- | --- | --- | --- |",
  ...records
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(
      (record) =>
        `| ${record.tier} | [${record.publisher}](${record.url}) | ${record.availability} | ${record.changeStatus} | ${record.checkedAt.slice(0, 10)} | \`${(record.contentHash ?? "-").slice(0, 12)}\` |`,
    ),
  "",
  "## 정규화 후보 카탈로그",
  "",
  `- 전체 후보 ${normalizedEditions.length}회차를 정규화했습니다.`,
  `- 공식 S1/S2 출처 연결과 날짜가 확인된 ${sourceCheckedEditions.length}회차는 세부 검수 중 상태로 공개합니다.`,
  `- 날짜 없음 또는 출처 접근 실패가 있는 ${heldEditions.length}회차는 공개 생성에서 제외합니다.`,
  "- 전체 보강·보류 사유는 [후보 검수 목록](candidate-review.md)에 분리했습니다.",
  "- 해외 회차만의 보강 항목은 [해외 문구 행사 검수 목록](international-stationery-review.md)에 분리했습니다.",
  "",
  "## 발행 회차",
  "",
  "| 행사 | 일정 | 장소 | 신청 기준 | 최저 부스비 | 공식 출처 |",
  "| --- | --- | --- | --- | ---: | ---: |",
  ...editions.map(
    (edition) =>
      `| ${edition.name} | ${edition.startDate.slice(0, 10)}–${edition.endDate.slice(0, 10)} | ${edition.venue} | ${edition.application.deadline.label} · ${edition.application.status === "capacity" ? "부스 소진 시까지" : edition.application.status} | ₩${Math.min(...edition.application.boothOptions.map((option) => option.feeKrw)).toLocaleString("ko-KR")} (VAT 별도) | ${edition.sourceIds.length} |`,
  ),
  "",
  "## 필드별 근거",
  "",
  ...editions.flatMap((edition) => [
    `### ${edition.name}`,
    "",
    ...Object.entries(edition.fieldEvidence).flatMap(([field, evidence]) => [
      `- ${field}`,
      ...evidence.map((item) => {
        const source = sourceById.get(item.sourceId);
        return `  - ${source.tier} [${source.publisher}](${source.url}): ${item.note}`;
      }),
    ]),
    "",
  ]),
  "## 공개 보류 또는 미확인",
  "",
  "- 사업자등록 필수 여부는 세 회차 모두 공식 출품 안내에서 명시적으로 확인되지 않아 `확인 중`으로 표시합니다.",
  "- 행사별 부스 수와 규모는 공식 회차 수치가 없어 숫자를 게시하지 않습니다.",
  "- 반입·철수·주차·물류 동선은 참가자 매뉴얼 근거가 확보되기 전까지 비워 둡니다.",
  "- 후기 원문·작성자·평점은 로컬 참고 저장소에만 남기고 사이트 생성기에 전달하지 않습니다.",
  "",
  "## 운영자 다음 확인",
  "",
  "1. 해시가 바뀐 출처는 로컬 캐시 원문과 이전 해시를 비교합니다.",
  "2. 날짜·부스비·위약금·선정 방식이 바뀌면 `fieldEvidence`를 새 근거로 갱신합니다.",
  "3. 후기에서 제기된 내용은 공식 원문으로 다시 확인되기 전까지 행사 필드를 변경하지 않습니다.",
  "",
].join("\n");

const reportsDirectory = path.join(contentDirectory, "reports");
await writeText(path.join(reportsDirectory, "latest.md"), lines);
await writeText(path.join(reportsDirectory, `${isoDate()}-first-batch.md`), lines);
console.log(`Markdown 수집 보고서 생성: content/reports/${isoDate()}-first-batch.md`);
