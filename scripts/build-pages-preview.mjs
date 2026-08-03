import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist-pages");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "Bindery-web";
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? "eiranotes";
const basePath = `/${repositoryName}`;
const publicOrigin = `https://${owner}.github.io`;
const publicSite = `${publicOrigin}${basePath}`;
const unprefixedPublicUrl = new RegExp(
  `${publicOrigin.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/(?!${repositoryName}(?:/|$))`,
  "gu",
);

process.env.NEXT_PUBLIC_SITE_URL = publicSite;

const generatedEvents = JSON.parse(
  await readFile(path.join(root, "content", "generated", "events.json"), "utf8"),
);

const pageRoutes = [
  "/",
  "/events",
  "/events/compare",
  "/events/archive",
  "/events/calendar",
  ...generatedEvents.map((event) => `/events/${event.slug}/${event.edition}`),
  "/notes",
  "/notes/simple-tax-start",
  "/notes/reading-print-quotes",
  "/notes/first-booth-checklist",
  "/notes/booth-break-even",
  "/groupbuy",
  "/news",
  "/community",
  "/community/general",
  "/community/general/first-booth-card-reader-checklist",
  "/community/general/small-run-sticker-proofing",
  "/community/general/booth-price-break-even",
  "/community/general/simple-tax-business-start",
  "/community/general/packing-table-favorite-tools",
  "/community/rules",
  "/me",
  "/me/notifications",
  "/auth/sign-in",
];

const fileRoutes = ["/events/calendar.ics", "/rss.xml", "/robots.txt", "/sitemap.xml"];

function addTrailingSlash(value) {
  const [pathname, suffix = ""] = value.split(/(?=[?#])/u, 2);
  if (
    pathname.endsWith("/") ||
    /\.[a-z0-9]{2,8}$/iu.test(pathname) ||
    pathname.startsWith("/assets/")
  ) {
    return value;
  }
  return `${pathname}/${suffix}`;
}

function prefixLocalUrl(value) {
  if (!value.startsWith("/") || value === "/" || value.startsWith(`${basePath}/`)) {
    return value === "/" ? `${basePath}/` : value;
  }
  return `${basePath}${addTrailingSlash(value)}`;
}

function staticHtml(source) {
  let html = source
    .replaceAll("http://localhost:3000", publicSite)
    .replace(unprefixedPublicUrl, `${publicSite}/`)
    .replace(
      /<script\b(?![^>]*type=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/giu,
      "",
    )
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/giu, "")
    .replace(
      /\b(href|src|action|data-rsc-css-href)=(['"])(\/[^'"]*)\2/giu,
      (_, attribute, quote, value) => `${attribute}=${quote}${prefixLocalUrl(value)}${quote}`,
    );

  const previewStyle = `<style data-github-pages-preview>
.github-pages-preview{margin:0;padding:.72rem clamp(1rem,4vw,3rem);border-bottom:1px solid var(--rule);background:var(--ink-yellow);color:var(--text);font:600 .78rem/1.55 var(--font-body);letter-spacing:.01em}
.github-pages-preview strong{font-family:var(--font-utility);font-size:.72rem;letter-spacing:.08em}.github-pages-preview a{color:inherit;text-underline-offset:.2em}
</style>`;
  const previewNotice = `<aside class="github-pages-preview" aria-label="정적 프리뷰 안내"><strong>STATIC PREVIEW</strong> · 공식 행사 정보 중심 GitHub Pages 체험판입니다. 로그인·저장·작성 기능은 동작하지 않습니다. <a href="${basePath}/events/">행사 정보 보기</a></aside>`;
  html = html.replace("</head>", `${previewStyle}</head>`).replace("<body>", `<body>${previewNotice}`);

  if (html.includes("http://localhost") || /<script\b(?![^>]*type=["']application\/ld\+json["'])/iu.test(html)) {
    throw new Error("static preview contains a local origin or executable application script");
  }
  return html;
}

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("pages", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

function environment() {
  return {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
}

function context() {
  return { waitUntil() {}, passThroughOnException() {} };
}

async function fetchRoute(worker, route, accept) {
  const response = await worker.fetch(
    new Request(`${publicOrigin}${route}`, {
      headers: {
        accept,
        host: `${owner}.github.io`,
        "x-forwarded-host": `${owner}.github.io`,
        "x-forwarded-proto": "https",
      },
    }),
    environment(),
    context(),
  );
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  return response;
}

function pageOutputPath(route) {
  return route === "/"
    ? path.join(output, "index.html")
    : path.join(output, route.slice(1), "index.html");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const clientOutput = path.join(root, "dist", "client");
await cp(clientOutput, output, {
  recursive: true,
  filter(source) {
    const relative = path.relative(clientOutput, source);
    return (
      !relative.startsWith(".vite") &&
      !relative.endsWith(".js") &&
      relative !== "_headers" &&
      relative !== ".assetsignore"
    );
  },
});
const worker = await loadWorker();

for (const route of pageRoutes) {
  const response = await fetchRoute(worker, route, "text/html");
  const target = pageOutputPath(route);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, staticHtml(await response.text()), "utf8");
}

const notFound = await worker.fetch(
  new Request(`${publicOrigin}/__bindery_static_preview_not_found__`, {
    headers: { accept: "text/html", "x-forwarded-host": `${owner}.github.io` },
  }),
  environment(),
  context(),
);
await writeFile(path.join(output, "404.html"), staticHtml(await notFound.text()), "utf8");

for (const route of fileRoutes) {
  const response = await fetchRoute(worker, route, "*/*");
  const target = path.join(output, route.slice(1));
  await mkdir(path.dirname(target), { recursive: true });
  const body = (await response.text())
    .replace(unprefixedPublicUrl, `${publicSite}/`)
    .replaceAll(`>${publicOrigin}<`, `>${publicSite}/<`);
  await writeFile(target, body, "utf8");
}

await writeFile(path.join(output, ".nojekyll"), "", "utf8");
console.log(`GitHub Pages 정적 프리뷰 ${pageRoutes.length}개 화면 생성: ${publicSite}/`);
