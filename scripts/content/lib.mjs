import { createHash, randomBytes } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

export const rootDirectory = path.resolve(scriptDirectory, "../..");
export const contentDirectory = path.join(rootDirectory, "content");
export const cacheDirectory = path.join(rootDirectory, ".content-cache");
export const privateReviewDirectory = path.join(rootDirectory, "content-local", "reviews");

export async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDirectory(target) {
  await mkdir(target, { recursive: true });
}

export async function readJson(target) {
  return JSON.parse(await readFile(target, "utf8"));
}

export async function readJsonIfPresent(target) {
  return (await pathExists(target)) ? readJson(target) : null;
}

export async function writeJson(target, value) {
  await ensureDirectory(path.dirname(target));
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(target, value) {
  await ensureDirectory(path.dirname(target));
  await writeFile(target, value, "utf8");
}

export async function listJsonFiles(target) {
  if (!(await pathExists(target))) return [];
  const entries = await readdir(target, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const entryPath = path.join(target, entry.name);
        if (entry.isDirectory()) return listJsonFiles(entryPath);
        return entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : [];
      }),
  );
  return nested.flat();
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalizeUrl(value) {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  return url.toString();
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

export function normalizedHtmlText(value) {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function htmlTitle(value) {
  const match = value.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizedHtmlText(match[1]) : null;
}

export function isoDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function addDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function parseArguments(args) {
  const result = { _: [] };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

export async function loadEditions() {
  const files = await listJsonFiles(path.join(contentDirectory, "events"));
  const editionFiles = files.filter((file) => file.includes(`${path.sep}editions${path.sep}`));
  return Promise.all(
    editionFiles.map(async (file) => ({ file, value: await readJson(file) })),
  );
}

export async function loadMasters() {
  const files = await listJsonFiles(path.join(contentDirectory, "events"));
  const masterFiles = files.filter((file) => file.endsWith(`${path.sep}master.json`));
  return Promise.all(masterFiles.map(async (file) => ({ file, value: await readJson(file) })));
}

export async function getOrCreateReviewPepper() {
  const pepperPath = path.join(privateReviewDirectory, ".author-pepper");
  await ensureDirectory(privateReviewDirectory);
  if (await pathExists(pepperPath)) return (await readFile(pepperPath, "utf8")).trim();
  const value = randomBytes(32).toString("hex");
  await writeFile(pepperPath, `${value}\n`, { encoding: "utf8", mode: 0o600 });
  return value;
}
