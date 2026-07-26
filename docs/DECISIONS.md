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

The checked-in `bindery/02_디자인/mockup_home.html` and `mockup_event-detail.html` are the visual source of truth. The home page intentionally exposes only the mockup hero, three upcoming deadlines, and five text index links: Events, Notes, Groupbuy, News, and Community. Filters, calendar data, and comparison data live on their own routes. Diary and stationery character comes from the mockup's stock/sheet surfaces, rules, dates, and typography rather than decorative texture or stacked paper effects.

## D-007 — Local scroll ownership for wide information

Wide event-history tables and month calendars keep their intrinsic comparison width, but their immediate sheet owns horizontal scrolling. They must not widen the page shell or create page-level horizontal overflow at 360px.

## D-008 — Request-derived public origin

Metadata, sitemap, robots, and Article JSON-LD derive their absolute origin from the incoming forwarded host and protocol. A configured public origin is only a fallback; production output must never default to an example domain.

## D-009 — Accountless source boundary

The deployed source contains no unused ChatGPT authentication, D1, Drizzle, or mutable example API scaffold. Device-local bookmarks remain the only user state until the product explicitly adopts an authenticated or persistent server-side feature.

## D-010 — Event-context Community, not a free board

**Superseded by D-013.**

Keep v1.0 as the product authority: do not add a free-form board because its
management cost exceeds its information value. Borrow only the archived v0.3
event-room principle, so `/community` accumulates operator-reviewed preparation
questions, field tips, and aggregate records under a named event. Direct
posting, DM, transactions, and raw unreviewed feedback remain out of scope.

## D-011 — Typed theme catalog as the visual-token authority

Keep the current three-ink identity as the default `리소 원색` theme and offer
`먹지 교정` as a restrained alternative. `app/lib/themes.ts` is the only
source for visual color and font-role values. Components consume generated CSS
variables; the selector stores only a validated theme ID on the device.

## D-012 — Responsive structure changes before text is squeezed

At 360px, 768px, and 1280px, primary routes must not create page-level
horizontal overflow. Navigation changes to its compact structure before labels
crowd, multi-column ledgers collapse before headings fragment unnecessarily,
and long trust or boundary copy receives at least a useful mobile measure.
Wide comparison tables and calendars continue to own intentional local scroll.

## D-013 — Information-first free boards split by artist verification

The user's corrected direction supersedes D-010's no-board policy. Community is
now a free-board product with two independent URLs:

- `작가 인증 게시판`: server-verified artists only for both reading and writing.
- `모두의 게시판`: readable regardless of artist-verification status.

“Information first” no longer means forbidding a board. It means practical
categories precede casual chat, questions expose resolution state, factual posts
can carry source and confirmation dates, and durable answers can later graduate
to operator Notes. Artist verification signals activity eligibility only and
must not look like factual verification.

Until a real session and authorization layer exists, the artist board fails
closed and exposes no post titles, bodies, or authors. Query values, URL changes,
visual badges, and browser storage never grant artist access.

## D-014 — Complete prototype destinations without fake live service

Every visible Community action must resolve to a real screen or an observable
device-local action. The prototype therefore includes board, post, write,
verification, rules, reporting-boundary, and recovery screens. The write screen
stores one versioned draft in the current browser; it does not claim to publish
or submit. The draft is not encrypted or automatically expired, so the write
screen warns about shared browser profiles and extensions, requires a second
action before deletion, and tells users to clear it after work. The report
screen explains scope but sends nothing until durable intake, moderation
history, and operator notification exist. Locked, write, verification, report,
and example-post routes stay out of the sitemap and carry `noindex` metadata
until their real service boundaries exist.

## D-015 — Catalog-driven reserved ad inventory

Reserve future ad inventory with one `AD_PLACEMENTS` catalog and one `AdSlot`
component. Slots use the literal label `광고`, stable minimum heights, theme
roles, and non-interactive placeholder copy. Place them only on Home, the
Community hub, and within the general-board feed, away from navigation and
primary actions. Do not place ads on writing, verification, lock, error, or
official deadline decision screens. No live provider script or tracking is
included.
