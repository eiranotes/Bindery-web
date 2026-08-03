import { newsItems } from "../lib/data.ts";

function xml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const items = newsItems
    .map(
      (item) => `<item>
  <title>${xml(item.title)}</title>
  <link>${xml(item.sourceUrl)}</link>
  <guid isPermaLink="false">${xml(item.id)}</guid>
  <pubDate>${new Date(`${item.publishedAt}T12:00:00+09:00`).toUTCString()}</pubDate>
  <category>${xml(item.category)}</category>
  <description>${xml(item.summary)}</description>
</item>`,
    )
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Bindery 소식</title>
  <link>${xml(origin)}</link>
  <description>만드는 사람에게 필요한 공식 공지와 업계 변화의 원문 색인</description>
  <language>ko-KR</language>
  ${items}
</channel>
</rss>`;

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
