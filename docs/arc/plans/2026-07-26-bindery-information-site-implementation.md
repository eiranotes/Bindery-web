# Bindery Information Site Implementation Plan

> **For Arc:** Use /arc:implement. Build agents report DONE, DONE_WITH_CONCERNS,
> NEEDS_CONTEXT, BLOCKED, or AUTH_GATE.

**Feature spec or source:** `../bindery/README.md`, `PRODUCT.md`, `DESIGN.md`
**Goal:** Build a complete, responsive Bindery information site and publish the validated source with GPT Sites.
**Stack:** vinext / React 19 / TypeScript / CSS / Node test / npm
**Planned at:** unborn `main` — GPT Sites starter initialized without a first commit
**Plan schema:** 2
**Planned assurance:** Guarded
**Effective assurance:** Guarded
**Assurance rationale:** Production deployment is an external mutation; event trust, review privacy, and Groupbuy boundaries require explicit fail-closed behavior.
**Out of scope:** Real payments or settlement, public Groupbuy writes, raw review publication, aggregates below N=5, final legal text, Supabase production integration, and a permanent domain.

## File structure

- `app/lib/` — typed fixtures, date-derived event state, URL filtering, calendar/ICS helpers.
- `app/components/` — shared header, footer, event, calendar, notice, and local bookmark components.
- `app/**/page.tsx` — server-rendered public routes.
- `app/events/calendar.ics/route.ts`, `app/rss.xml/route.ts` — interoperable feeds.
- `app/sitemap.ts`, `app/robots.ts` — search discovery.
- `app/globals.css` — three-ink tokens and responsive system.
- `tests/` — built-worker HTML and feed contracts.
- `docs/` — project state, decisions, changelog, research, and plan evidence.

<seams>
  <seam id="event-domain">
    <interface>Pure event status, D-day, query filtering, calendar and ICS helpers in app/lib</interface>
    <behavior>Dates and URL inputs derive stable display state without persisting status columns</behavior>
    <test>tests/event-domain.test.ts and tests/events-rendered.test.mjs</test>
  </seam>
  <seam id="public-routes">
    <interface>Built Cloudflare worker HTTP responses for public pages, feeds, and metadata</interface>
    <behavior>Routes server-render meaningful Korean content and interoperable SEO/feed payloads</behavior>
    <test>npm test</test>
  </seam>
  <seam id="browser-flow">
    <interface>Accessible controls and visible state in the rendered browser</interface>
    <behavior>Filters, calendar, navigation, and local bookmarks provide keyboard and pointer feedback</behavior>
    <test>tests/browser/responsive.spec.ts, tests/client/bookmark-flow.test.tsx, and console inspection at 360px, 768px, and 1280px</test>
  </seam>
  <seam id="bookmark-domain">
    <interface>Versioned bookmark parsing and update helpers in app/lib/bookmarks.ts</interface>
    <behavior>Stored event IDs are normalized, deduplicated, added, and removed deterministically</behavior>
    <test>tests/bookmark-domain.test.ts</test>
  </seam>
</seams>

<task id="1" depends="" type="auto" kind="documentation" status="done">
  <name>Capture product, visual, and research authority</name>
  <files>
    <create>PRODUCT.md</create>
    <create>DESIGN.md</create>
    <create>docs/COMPETITIVE_RESEARCH.md</create>
    <create>docs/design/bindery-north-star.png</create>
    <create>docs/PROJECT_STATUS.md</create>
    <create>docs/TASKS.md</create>
    <create>docs/DECISIONS.md</create>
    <create>docs/CHANGELOG.md</create>
  </files>
  <read_first>All Markdown and HTML under ../bindery</read_first>
  <action>Reconcile product and visual authority, preserve source constraints, and record competitor and Behance lessons.</action>
  <verify>Documents name v1.0 and the three-ink DESIGN.md as authority and explicitly record deferred risk scope.</verify>
  <done>Implementation has an unambiguous product and design contract.</done>
  <commit>docs(site): capture bindery product and design context</commit>
</task>

<task id="2" depends="1" type="auto" kind="behavior" status="done">
  <name>Implement the event domain and shared design system</name>
  <files>
    <create>app/lib/types.ts</create>
    <create>app/lib/data.ts</create>
    <create>app/lib/events.ts</create>
    <create>app/components/*</create>
    <create>tests/event-domain.test.ts</create>
    <create>tests/worker-harness.mjs</create>
    <modify>app/globals.css</modify>
    <modify>app/layout.tsx</modify>
  </files>
  <read_first>PRODUCT.md, DESIGN.md, app/page.tsx, app/layout.tsx, app/globals.css</read_first>
  <action>Write failing event-domain assertions first, then build typed realistic content, date-derived event state, reusable three-ink components, semantic layout, focus and reduced-motion contracts.</action>
  <seams><seam ref="event-domain" /></seams>
  <behavior>All event state and D-day labels are derived from dates and shared components preserve the documented visual and accessibility system.</behavior>
  <examples>An open application shows 접수중; an expired event shows 종료; missing onsite data renders 정보 없음.</examples>
  <verify>
    Red: `node --test tests/event-domain.test.ts` fails before `app/lib/events.ts` exists.
    Green: `node --test tests/event-domain.test.ts` passes.
    `npm run build` exits 0.
  </verify>
  <done>The domain and component foundation can render every planned route without duplicated state logic.</done>
  <commit>feat(site): add event domain and riso design system</commit>
</task>

<task id="3" depends="2" type="auto" kind="behavior" status="done">
  <name>Implement device-local bookmark behavior</name>
  <files>
    <create>app/lib/bookmarks.ts</create>
    <create>app/components/BookmarkButton.tsx</create>
    <create>app/components/BinderClient.tsx</create>
    <create>tests/bookmark-domain.test.ts</create>
  </files>
  <read_first>app/lib/types.ts, app/lib/data.ts, PRODUCT.md, DESIGN.md</read_first>
  <action>Write failing bookmark-state assertions first, then implement one device-local storage contract shared by event actions and My Binder, with explicit empty and saved states.</action>
  <seams><seam ref="bookmark-domain" /></seams>
  <behavior>Saving and removing event IDs uses one versioned local-storage record and produces consistent visible feedback everywhere.</behavior>
  <examples>An unknown stored ID is ignored; adding the same event twice is idempotent; the empty binder points back to the event list.</examples>
  <verify>
    Red: `node --test tests/bookmark-domain.test.ts` fails before `app/lib/bookmarks.ts` exists.
    Green: `node --test tests/bookmark-domain.test.ts` passes.
  </verify>
  <done>Events and My Binder share one tested local bookmark contract.</done>
  <commit>feat(binder): add device-local bookmark state</commit>
</task>

<task id="4" depends="2,3" type="auto" kind="behavior" status="done">
  <name>Implement event discovery, calendar, and detail routes</name>
  <files>
    <modify>app/page.tsx</modify>
    <create>app/events/page.tsx</create>
    <create>app/events/calendar/page.tsx</create>
    <create>app/events/[slug]/[edition]/page.tsx</create>
    <create>app/events/calendar.ics/route.ts</create>
    <create>tests/events-rendered.test.mjs</create>
  </files>
  <read_first>app/lib/data.ts, app/lib/events.ts, app/components/BookmarkButton.tsx, DESIGN.md, tests/worker-harness.mjs</read_first>
  <action>Write failing built-worker route assertions first, then build a deliberately sparse diary-like home, URL-backed event filters, monthly calendar, edition detail, official source notices, history, N≥5 gate, bookmarks, and ICS.</action>
  <seams><seam ref="public-routes" /><seam ref="browser-flow" /></seams>
  <behavior>Visitors can compare current events, navigate by URL state, inspect a trustworthy detail page, save locally, and subscribe to calendar data.</behavior>
  <examples>A `?region=부산` URL narrows results; an N=3 review renders an explanation without aggregate values; ICS returns `text/calendar`.</examples>
  <verify>
    Red: after adding event-route assertions, `npm run build && node --test tests/events-rendered.test.mjs` fails.
    Green: the same focused command passes.
    Home renders no more than three upcoming deadlines and four section index links, with no calendar, filter form, comparison table, news feed, or Groupbuy board.
    Browser at `http://localhost:3000/events?region=부산`: one 부산 result and URL state are visible.
    Browser at `http://localhost:3000/events/illustar-fair/2026-winter`: official-source notice, history table, N&lt;5 explanation, and bookmark feedback are visible.
  </verify>
  <done>The complete event decision flow works from home through detail and calendar.</done>
  <commit>feat(events): build discovery calendar and detail flows</commit>
</task>

<task id="5" depends="2" type="auto" kind="behavior" status="done">
  <name>Implement Notes and News routes</name>
  <files>
    <create>app/notes/page.tsx</create>
    <create>app/notes/[slug]/page.tsx</create>
    <create>app/news/page.tsx</create>
    <create>tests/content-rendered.test.mjs</create>
  </files>
  <read_first>PRODUCT.md, DESIGN.md, app/lib/data.ts, tests/worker-harness.mjs</read_first>
  <action>Write failing built-worker content assertions first, then build the Notes index/detail and source-linked News timeline with stale and legal-information states.</action>
  <seams><seam ref="public-routes" /></seams>
  <behavior>Notes and News are substantive server-rendered information surfaces with update dates, source boundaries, and useful navigation.</behavior>
  <examples>A stale tax note shows its exact update date and warning; a News item links to its named source without reproducing the full article.</examples>
  <verify>
    Red: after adding content assertions, `npm run build && node --test tests/content-rendered.test.mjs` fails.
    Green: the same focused command passes.
  </verify>
  <done>Notes and News provide complete, source-aware public content routes.</done>
  <commit>feat(content): add notes and news routes</commit>
</task>

<task id="6" depends="2" type="auto" kind="behavior" status="done">
  <name>Implement the safe Groupbuy information route</name>
  <files>
    <create>app/groupbuy/page.tsx</create>
    <create>tests/groupbuy-rendered.test.mjs</create>
  </files>
  <read_first>PRODUCT.md, docs/DECISIONS.md, app/lib/data.ts, tests/worker-harness.mjs</read_first>
  <action>Write a failing safety-boundary assertion first, then build a read-only status board with organizer-history and responsibility guidance but no payment, settlement, or public posting control.</action>
  <seams><seam ref="public-routes" /></seams>
  <behavior>Groupbuy communicates progress and trust boundaries without implying that Bindery mediates a transaction.</behavior>
  <examples>The page says 결제와 정산에 관여하지 않습니다 and contains no payment CTA or checkout form.</examples>
  <verify>
    Red: after adding the safety assertion, `npm run build && node --test tests/groupbuy-rendered.test.mjs` fails.
    Green: the same focused command passes and the response contains no `결제하기`.
  </verify>
  <done>The Groupbuy pillar is useful but fail-closed at the documented policy boundary.</done>
  <commit>feat(groupbuy): add safe read-only status board</commit>
</task>

<task id="7" depends="3" type="auto" kind="behavior" status="done">
  <name>Implement My Binder route</name>
  <files>
    <create>app/me/page.tsx</create>
    <create>tests/binder-rendered.test.mjs</create>
  </files>
  <read_first>app/components/BinderClient.tsx, app/lib/bookmarks.ts, app/lib/data.ts, tests/worker-harness.mjs</read_first>
  <action>Write a failing My Binder route assertion first, then render the shared local bookmark state with explicit empty, saved, and removal states.</action>
  <seams><seam ref="public-routes" /><seam ref="browser-flow" /></seams>
  <behavior>My Binder explains device-local storage and reflects the same event IDs toggled on event pages.</behavior>
  <examples>Fresh storage shows a directional empty state; a saved event can be removed and disappears without a reload.</examples>
  <verify>
    Red: after adding the route assertion, `npm run build && node --test tests/binder-rendered.test.mjs` fails.
    Green: the same focused command passes.
    Browser: save one event on `/events/illustar-fair/2026-winter`, open `/me`, verify the event appears, remove it, and verify the empty guidance appears.
  </verify>
  <done>My Binder provides a complete device-local save and remove flow.</done>
  <commit>feat(binder): add my binder route</commit>
</task>

<task id="8" depends="4,5,6,7" type="auto" kind="integration" status="done">
  <name>Wire SEO, feeds, social preview, and route verification</name>
  <files>
    <modify>app/layout.tsx</modify>
    <create>app/sitemap.ts</create>
    <create>app/robots.ts</create>
    <create>app/rss.xml/route.ts</create>
    <create>public/og.png</create>
    <delete>tests/rendered-html.test.mjs</delete>
    <create>tests/seo-feeds.test.mjs</create>
    <modify>package.json</modify>
    <delete>app/_sites-preview/SkeletonPreview.tsx</delete>
    <delete>app/_sites-preview/preview.css</delete>
  </files>
  <read_first>app/page.tsx, app/layout.tsx, app/events/[slug]/[edition]/page.tsx, app/notes/[slug]/page.tsx, app/events/calendar.ics/route.ts, tests/worker-harness.mjs, tests/events-rendered.test.mjs, tests/content-rendered.test.mjs, package.json</read_first>
  <action>Add failing metadata/feed assertions first, remove starter preview infrastructure, then add product metadata, Event and Article JSON-LD, sitemap, RSS, social preview, and complete built-worker contracts.</action>
  <seams><seam ref="public-routes" /></seams>
  <behavior>The built worker returns useful HTML and standards-compliant feeds with no starter markers or broken metadata.</behavior>
  <examples>Home HTML contains the product title; ICS is text/calendar; RSS is application/rss+xml; sitemap includes event and note routes.</examples>
  <verify>
    Red: `npm run build && node --test tests/seo-feeds.test.mjs` fails before the metadata, feeds, and preview cleanup exist.
    Green: `npm test` runs and passes `tests/*.test.mjs` plus `tests/*.test.ts`.
    `npm run lint`, `npm run build`, and `git diff --check` exit 0.
  </verify>
  <done>Search, link previews, and feed consumers can discover the production site.</done>
  <commit>feat(site): wire metadata feeds and verification</commit>
</task>

<task id="9" depends="8" type="auto" kind="deployment" status="done">
  <name>Review, validate, and publish with GPT Sites</name>
  <files>
    <modify>docs/PROJECT_STATUS.md</modify>
    <modify>docs/TASKS.md</modify>
    <modify>docs/CHANGELOG.md</modify>
    <modify>.openai/hosting.json</modify>
  </files>
  <read_first>PRODUCT.md, DESIGN.md, docs/PROJECT_STATUS.md, docs/TASKS.md, docs/CHANGELOG.md, docs/arc/plans/2026-07-26-bindery-information-site-implementation.md</read_first>
  <action>Run independent spec and standards review, responsive design assessments, browser flows, fresh build/test gate, save a Sites version, deploy privately, and verify deployment status.</action>
  <verify>
    Browser viewports `360x800`, `768x1024`, and `1280x900`: no page-level horizontal overflow; primary controls measure at least 44px on the 360px viewport; the home preserves generous empty space, one headline, a three-row deadline ledger, and four understated section links without surfacing lower-route detail; the 360px home recomposes them into one column without increasing information density.
    Browser interaction: the D-day pink layer moves from `translate(2px, 1px)` to aligned on hover/focus and is aligned under reduced motion; font fallback keeps the header and first viewport free of clipping.
    Browser console has no error-level entries on home, event list, event detail, Notes, Groupbuy, and My Binder.
    Fresh `npm run lint`, `npm test` (all `tests/*.test.mjs` and `tests/*.test.ts`), `npm run build`, and `git diff --check` exit 0 on the unchanged final target.
    Sites deployment status is `succeeded` and the deployed URL returns the Bindery home title.
  </verify>
  <done>The exact validated source is available at the production Sites URL.</done>
  <commit>chore(site): prepare validated production deployment</commit>
</task>

## Implementation state

**Execution base:** none — unborn Git repository created by the GPT Sites initializer
**Declared scope:** `app/**`, `public/**`, `tests/**`, `PRODUCT.md`, `DESIGN.md`, `docs/**`, `package*.json`, `.openai/hosting.json`
**Pre-existing dirty paths:**

- none — the untracked starter was created by this task before implementation

**Excluded metadata:** this plan and `docs/arc/plans/INDEX.md`
**Commit posture:** exact validated source committed and pushed only to the configured GPT Sites source repository
**Last coherent commit:** `a6a6db0811ec1d53d17244e3540ff119cf4e45ef`
**Closeout:** passed — 2026-07-26; attributable target `bd00aca6bf6022318160a77ce53cd8e5867aa7b0d8ccb67ab0c37b287244e575` excluding this plan and `docs/arc/plans/INDEX.md`; `npm run lint`, `npm test`, `npm run build`, and `git diff --cached --check`; Sites version 1 deployment `appgdep_6a6593622f5c81919a4dde7ed7571576` succeeded and its generated production screenshot contains the Bindery home

## Decision log

- The original SvelteKit recommendation is superseded for this deployed artifact by the user-requested GPT Sites runtime; product and SEO behavior remain the contract.
- The latest three-ink `DESIGN.md` overrides old cream/terracotta tokens in planning and backend prompt text.
- “끝까지 진행” is treated as delegation to choose the strongest generated north-star direction; the approved carry-forward is the asymmetric hero/deadline ledger, utility filter strip, data-first grid, and structurally recomposed mobile view.
- Generated mock text and icons are not literal UI assets. All production text and controls remain semantic HTML/CSS.
- Resumption verified the existing task 2–8 implementation with 21 focused domain, rendered-route, feed, and responsive-contract assertions before marking those slices done.
- A 360px browser check found the event-history table widening the entire detail page. The detail grid now allows its child to shrink while the table keeps its own horizontal scroll boundary.
- Whole-implementation review found a missing current-date signal, example-origin SEO output, silent blocked-storage removal, insufficient hydrated Binder evidence, and unused auth/D1 starter scope. The implementation now renders today’s date, derives origin from request headers, reports storage failures, exercises the client flow in Vitest/jsdom, and removes the unused scaffold.
- Standards re-review found the responsive regression assertion still mirrored CSS implementation. A Playwright gate now measures actual 360×800, 768×1024, and 1280×900 layout behavior, local wide-data scrolling, home density, and 44px primary controls.
