import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { contentDirectory, listJsonFiles, rootDirectory } from "./lib.mjs";

const execFileAsync = promisify(execFile);
const errors = [];

const { stdout: trackedPrivate } = await execFileAsync(
  "git",
  ["ls-files", "--", "content-local", ".content-cache"],
  { cwd: rootDirectory },
);
if (trackedPrivate.trim()) {
  errors.push(`로컬 전용 경로가 Git에 추적됨: ${trackedPrivate.trim().replaceAll("\n", ", ")}`);
}

for (const privatePath of ["content-local", ".content-cache"]) {
  try {
    await execFileAsync("git", ["check-ignore", "-q", privatePath], { cwd: rootDirectory });
  } catch {
    errors.push(`${privatePath}가 .gitignore로 보호되지 않음`);
  }
}

const publishableFiles = [
  ...(await listJsonFiles(path.join(contentDirectory, "events"))),
  ...(await listJsonFiles(path.join(contentDirectory, "generated"))),
  path.join(rootDirectory, "app", "lib", "generated", "events.ts"),
  path.join(contentDirectory, "reports", "latest.md"),
];
const forbiddenPatterns = [
  [/content-local|privateReviewDirectory/, "로컬 후기 경로 참조"],
  [/\"reviews\"\s*:|\breviewAggregate\b/, "후기 원문 또는 집계 필드"],
  [/\"reviewCount\"\s*:\s*(?!0\b)\d+/, "0이 아닌 공개 후기 수"],
];

for (const file of publishableFiles) {
  const body = await readFile(file, "utf8");
  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(body)) errors.push(`${path.relative(rootDirectory, file)}: ${label} 발견`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  throw new Error(`공개/로컬 콘텐츠 경계 검사 실패: ${errors.length}건`);
}

console.log("공개/로컬 콘텐츠 경계 검사 통과");
