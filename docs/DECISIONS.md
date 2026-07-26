# Decisions

## D-001 — Information-first authority

Use `기획서_v1.0_정보우선.md` for IA and scope. The community-first v0.3 document is Post-MVP reference only.

## D-002 — Three-ink design authority

Use the latest `DESIGN.md` three-ink Riso palette and Hahmlet / IBM Plex Sans KR / Space Mono system. Do not use the superseded cream/terracotta tokens embedded in older planning and backend prompts.

## D-003 — GPT Sites runtime

Use the GPT Sites vinext/React starter because the user explicitly requested GPT Sites deployment. The public information and SEO contracts are preserved in server-rendered routes. This is a deliberate runtime deviation from the original SvelteKit recommendation, not an unnoticed rewrite.

## D-004 — Safe functional boundary

Implement event discovery, query-state filters, calendar, detail, ICS, notes, news, bookmarks, and read-only Groupbuy status. Keep bookmarks device-local for this deployable version. Do not simulate real payment, settlement, approval, or legal acceptance.

## D-005 — Reference boundary

Behance and competitor work are loose inspiration. Bindery keeps its own three-ink work-order identity and does not copy ticketing layouts, imagery, or branding.

## D-006 — HTML-mockup visual authority with a calm home

The checked-in `bindery/02_디자인/mockup_home.html` and `mockup_event-detail.html` are the visual source of truth. The home page intentionally exposes only the mockup hero, three upcoming deadlines, and four text index links. Filters, calendar, comparison data, news, and Groupbuy status live on their own routes. Diary and stationery character comes from the mockup's stock/sheet surfaces, rules, dates, and typography rather than decorative texture or stacked paper effects.

## D-007 — Local scroll ownership for wide information

Wide event-history tables and month calendars keep their intrinsic comparison width, but their immediate sheet owns horizontal scrolling. They must not widen the page shell or create page-level horizontal overflow at 360px.

## D-008 — Request-derived public origin

Metadata, sitemap, robots, and Article JSON-LD derive their absolute origin from the incoming forwarded host and protocol. A configured public origin is only a fallback; production output must never default to an example domain.

## D-009 — Accountless source boundary

The deployed source contains no unused ChatGPT authentication, D1, Drizzle, or mutable example API scaffold. Device-local bookmarks remain the only user state until the product explicitly adopts an authenticated or persistent server-side feature.
