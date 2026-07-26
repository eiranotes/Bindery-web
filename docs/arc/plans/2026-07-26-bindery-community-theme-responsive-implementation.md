# Bindery Community, Theme Catalog, and Responsive Typography Implementation Plan

> **For Arc:** Use /arc:implement. Build agents report DONE, DONE_WITH_CONCERNS,
> NEEDS_CONTEXT, BLOCKED, or AUTH_GATE.

**Feature spec or source:** User request; `../bindery/01_기획/기획서_v1.0_정보우선.md`; `../bindery/01_기획/기획서_v0.3_커뮤니티우선(보관).md`; `PRODUCT.md`; `DESIGN.md`
**Goal:** Remove cramped responsive text layouts, add an event-context community tab, and make visual themes replaceable through one maintainable catalog.
**Stack:** vinext/React 19, TypeScript, Vitest, Node test, Playwright, npm, GPT Sites
**Planned at:** ba65646
**Plan schema:** 2
**Planned assurance:** Guarded
**Effective assurance:** Guarded
**Assurance rationale:** The work crosses rendered responsive behavior, persistent device-local theme preference, navigation and public routes, and a production Sites deployment; the highest-risk external mutation keeps the plan Guarded.
**Out of scope:** Authenticated posting, free-form boards, direct messages, payment or settlement, raw review publication, public access changes, a server database, and a final permanent domain.

## File structure

- `app/globals.css` — responsive typography, navigation breakpoints, community layout, and token consumers.
- `app/lib/themes.ts` — single catalog of theme metadata and CSS-variable values.
- `app/components/ThemeControl.tsx` — accessible device-local theme selection and recovery.
- `app/components/SiteHeader.tsx`, `app/layout.tsx` — community navigation and catalog wiring.
- `app/lib/types.ts`, `app/lib/data.ts`, `app/community/page.tsx` — moderated event-context community records and URL filters.
- `app/page.tsx`, `app/sitemap.ts` — community discovery.
- `tests/client/theme-catalog.test.tsx`, `tests/client/theme-control.test.tsx`, `tests/content-rendered.test.mjs`, `tests/browser/responsive.spec.ts` — catalog, client, route, and real-layout evidence.
- `PRODUCT.md`, `DESIGN.md`, `README.md`, `docs/*.md`, `docs/arc/plans/*` — product boundary, design system, progress, and lifecycle records.

<seams>
  <seam id="responsive-text">
    <interface>Rendered primary routes at 360×800, 768×1024, and 1280×900</interface>
    <behavior>Pages own no horizontal overflow, long text receives a useful measure, navigation changes structure before it crowds, and representative ledger headings do not fragment into avoidable three-line stacks on tablet or desktop.</behavior>
    <test>tests/browser/responsive.spec.ts</test>
  </seam>
  <seam id="theme-catalog">
    <interface>Theme catalog CSS output and the ThemeControl document data-theme/localStorage contract</interface>
    <behavior>Every listed theme produces the complete variable contract; selecting a theme applies and remembers it, while an unknown stored value falls back to the default.</behavior>
    <test>tests/client/theme-catalog.test.tsx and tests/client/theme-control.test.tsx</test>
  </seam>
  <seam id="community-route">
    <interface>GET /community with optional event and kind query values</interface>
    <behavior>The route exposes moderated, event-context questions and field notes, applies shareable filters, and states that it is not a free-form board or transaction surface.</behavior>
    <test>tests/content-rendered.test.mjs and tests/browser/responsive.spec.ts</test>
  </seam>
</seams>

<task id="1" depends="" type="auto" kind="bugfix" status="done">
  <name>Correct cramped responsive text layouts</name>
  <files>
    <modify>app/globals.css</modify>
    <modify>tests/browser/responsive.spec.ts</modify>
  </files>
  <read_first>app/globals.css, app/groupbuy/page.tsx, app/notes/page.tsx, app/news/page.tsx, tests/browser/responsive.spec.ts</read_first>
  <action>Add failing computed-layout assertions for representative headings, long notices, header structure, and page overflow, then adjust responsive grid columns, text measures, wrapping, and the desktop/mobile navigation breakpoint without hiding information.</action>
  <seams><seam ref="responsive-text" /></seams>
  <behavior>Desktop and tablet stop forcing group-buy titles into narrow three-line columns; mobile notices use the available width; navigation switches before its labels crowd.</behavior>
  <examples>At 1280px and 768px each sample group-buy title occupies at most two lines; at 360px primary prose is not trapped below 280px without a semantic reason; every tested route keeps page overflow at zero.</examples>
  <verify>Baseline: `npm run test:browser` passes before adding the regression. Red: `npx playwright test tests/browser/responsive.spec.ts --config playwright.config.ts` fails on the current three-line group-buy title and 768px header assertions. Green: the same command passes after the CSS change. Then inspect the named routes in the in-app browser at all three viewports.</verify>
  <done>The observed cramped-title regression is absent and the responsive assertions cover all primary routes.</done>
  <commit>fix(ui): improve responsive text flow</commit>
</task>

<task id="2" depends="1" type="auto" kind="integration" status="done">
  <name>Introduce a maintainable theme catalog</name>
  <files>
    <create>app/lib/themes.ts</create>
    <create>app/components/ThemeControl.tsx</create>
    <modify>app/layout.tsx</modify>
    <modify>app/components/SiteHeader.tsx</modify>
    <modify>app/globals.css</modify>
    <create>tests/client/theme-catalog.test.tsx</create>
    <create>tests/client/theme-control.test.tsx</create>
    <modify>tests/browser/responsive.spec.ts</modify>
  </files>
  <read_first>DESIGN.md, app/layout.tsx, app/components/SiteHeader.tsx, app/globals.css, app/lib/bookmarks.ts, tests/client/bookmark-flow.test.tsx</read_first>
  <action>Record the current rendered/default-token baseline, add catalog completeness, CSS generation, document selection, invalid-storage fallback, body-text contrast, selector focus, and touch-target assertions, then move visual-role values into a typed catalog that generates the theme CSS. Keep the existing three-ink design as the default, add one restrained proofing alternative, and expose an accessible native selector that persists only the theme id on the device.</action>
  <seams><seam ref="theme-catalog" /></seams>
  <behavior>Theme definitions have one source of truth and can be added or replaced without editing component styles; selection applies immediately and survives reload.</behavior>
  <examples>Choosing “먹지 교정” changes data-theme and stores its id; a malformed stored id renders “리소 원색”; adding a catalog record automatically creates a selector option and complete CSS selector.</examples>
  <verify>Baseline: render the existing layout and record the current default token values. Red: after adding the catalog/ThemeControl assertions, `npx vitest run tests/client/theme-catalog.test.tsx tests/client/theme-control.test.tsx --config vitest.config.ts` fails because the catalog and selector do not exist. Green: the identical command passes after implementation, including complete tokens, required 4.5:1 body-text contrast pairs, selection, persistence, and invalid-value fallback. `npx playwright test tests/browser/responsive.spec.ts --config playwright.config.ts` passes the 44px selector target and focus-visible checks. Exercise selection and reload in the browser at desktop and mobile widths.</verify>
  <done>Two product-aligned themes are selectable and every theme token is maintained in one typed catalog.</done>
  <commit>feat(theme): add catalog-driven themes</commit>
</task>

<task id="3" depends="1,2" type="auto" kind="behavior" status="done">
  <name>Add an event-context community tab</name>
  <files>
    <modify>app/lib/types.ts</modify>
    <modify>app/lib/data.ts</modify>
    <create>app/community/page.tsx</create>
    <modify>app/components/SiteHeader.tsx</modify>
    <modify>app/page.tsx</modify>
    <modify>app/sitemap.ts</modify>
    <modify>app/globals.css</modify>
    <modify>tests/content-rendered.test.mjs</modify>
    <modify>tests/browser/responsive.spec.ts</modify>
  </files>
  <read_first>../bindery/01_기획/기획서_v1.0_정보우선.md, ../bindery/01_기획/기획서_v0.3_커뮤니티우선(보관).md, docs/DECISIONS.md, app/events/page.tsx, app/news/page.tsx, app/lib/data.ts, app/sitemap.ts</read_first>
  <action>Add a failing rendered-route assertion for `/community` and its filtering/safety contract, run it red, then build a server-rendered community catalog around event-specific, operator-moderated questions and field notes. Reuse URL query filtering and ledger patterns, add navigation and sitemap discovery, state the safety boundary in the interface, and rerun the same seam green.</action>
  <seams><seam ref="community-route" /></seams>
  <behavior>Visitors can filter useful community records by event and record kind without encountering an unmoderated free-form feed or simulated publishing flow.</behavior>
  <examples>`/community` lists all reviewed records; `?event=illustar-2026-winter` narrows to that event; `?kind=현장+팁` narrows by kind; unknown values safely show the unfiltered catalog.</examples>
  <verify>Red: `node --test tests/content-rendered.test.mjs` fails after adding the missing `/community` route assertion. Green: the same command passes after implementation. `npx playwright test tests/browser/responsive.spec.ts --config playwright.config.ts` passes with `/community` in the 360/768/1280 route matrix. Inspect default, event-filtered, kind-filtered, and safe empty states in the browser at 360px and 1280px.</verify>
  <done>`/community` renders reviewed records, event and kind filters produce the expected subsets or safe unfiltered fallback, and the visible copy explicitly excludes free-form posting, direct transactions, and unreviewed raw 후기.</done>
  <commit>feat(community): add moderated event catalog</commit>
</task>

<task id="4" depends="1,2,3" type="auto" kind="documentation" status="done">
  <name>Document the responsive, community, and theme contracts</name>
  <files>
    <modify>README.md</modify>
    <modify>PRODUCT.md</modify>
    <modify>DESIGN.md</modify>
    <modify>docs/PROJECT_STATUS.md</modify>
    <modify>docs/TASKS.md</modify>
    <modify>docs/DECISIONS.md</modify>
    <modify>docs/CHANGELOG.md</modify>
  </files>
  <read_first>README.md, PRODUCT.md, DESIGN.md, docs/PROJECT_STATUS.md, docs/TASKS.md, docs/DECISIONS.md, docs/CHANGELOG.md</read_first>
  <action>Record the community boundary, catalog-driven theming procedure, responsive text acceptance criteria, completed work, and remaining authenticated-community risks without presenting sample data as live user content.</action>
  <verify>`rg -n "커뮤니티|테마 카탈로그|360px|768px|1280px" README.md PRODUCT.md DESIGN.md docs/PROJECT_STATUS.md docs/TASKS.md docs/DECISIONS.md docs/CHANGELOG.md` returns the expected contract records; `git diff --check` exits zero; inspect the documentation diff for agreement.</verify>
  <done>Product, design, setup, decisions, status, tasks, and changelog agree with the implemented behavior.</done>
  <commit>docs(site): record community and theme system</commit>
</task>

<task id="4a" depends="4" type="auto" kind="bugfix" status="done">
  <name>Remove effect-driven theme state and synchronize duplicate controls</name>
  <files>
    <modify>app/components/ThemeControl.tsx</modify>
    <modify>tests/client/theme-control.test.tsx</modify>
  </files>
  <read_first>app/components/ThemeControl.tsx, tests/client/theme-control.test.tsx</read_first>
  <action>Replace the mount-effect state update rejected by `react-hooks/set-state-in-effect` with an uncontrolled native select synchronized through its ref and a same-document custom theme event. Cover two controls so a desktop selection updates the hidden mobile selector without relying on a storage event that browsers do not dispatch to the source document.</action>
  <seams><seam ref="theme-catalog" /></seams>
  <behavior>The initial stored theme, cross-tab storage events, and same-tab duplicate controls all agree without a cascading render.</behavior>
  <verify>Red evidence: `npm run lint` reports `react-hooks/set-state-in-effect` at `ThemeControl.tsx:36`. Green: `npx vitest run tests/client/theme-control.test.tsx --config vitest.config.ts` and `npm run lint` pass.</verify>
  <done>No effect calls setState, both rendered theme controls synchronize in the same tab, and the catalog behavior remains green.</done>
  <commit>fix(theme): synchronize selectors without effect state</commit>
</task>

<task id="4b" depends="4a" type="auto" kind="bugfix" status="done">
  <name>Close theme-token and persistence evidence gaps</name>
  <files>
    <modify>app/globals.css</modify>
    <modify>app/components/ThemeControl.tsx</modify>
    <modify>tests/client/theme-control.test.tsx</modify>
    <modify>tests/browser/responsive.spec.ts</modify>
    <modify>tests/events-rendered.test.mjs</modify>
  </files>
  <read_first>app/globals.css, app/components/ThemeControl.tsx, tests/client/theme-control.test.tsx, tests/browser/responsive.spec.ts, tests/events-rendered.test.mjs</read_first>
  <action>Replace the remaining Riso-specific empty-calendar fill with a catalog-role-derived value, reset to the default theme when a cross-tab `localStorage.clear()` storage event arrives, add valid restored-preference and storage-event coverage, assert the rendered calendar fill changes between catalog themes, and update the home density expectation from four to the newly required five information links.</action>
  <seams><seam ref="theme-catalog" /></seams>
  <behavior>Every rendered visual color responds to catalog replacement; valid saved preferences restore, cross-tab removal/clear resets safely, and the home contract recognizes Community discovery.</behavior>
  <verify>Red evidence: three independent reviews identify `app/globals.css:1306`; standards review identifies ignored null-key storage events and missing restore/sync coverage; `npm test` fails `events-rendered.test.mjs` with `5 !== 4`. Green: focused client/browser/rendered tests, lint, and the complete `npm test` pass.</verify>
  <done>No component CSS contains the identified default-palette bypass, storage reset and restore behaviors are observed, the calendar visibly remaps with the theme, and the full test suite is green.</done>
  <commit>fix(theme): close catalog and persistence gaps</commit>
</task>

<task id="5" depends="4b" type="auto" kind="artifact" status="done">
  <name>Review and validate one exact implementation target</name>
  <files>
    <modify>docs/arc/plans/2026-07-26-bindery-community-theme-responsive-implementation.md</modify>
    <modify>docs/arc/plans/INDEX.md</modify>
  </files>
  <read_first>package.json, .openai/hosting.json, docs/arc/plans/2026-07-26-bindery-community-theme-responsive-implementation.md</read_first>
  <action>Capture one attributable target and run whole-implementation spec and standards review plus product/browser review against it. Do not edit source inside this task. If any finding requires a change, add a separately declared schema-2 corrective task with exact files, kind, evidence, dependencies, and done criteria, complete it, then rerun this task. Once all axes approve, run one fresh closeout gate and record its receipt.</action>
  <verify>On the unchanged approved target, `npm run lint`, `npm test`, `npm run build`, and `git diff --check` each exit zero; both whole-implementation review axes and the product/browser specialist approve the same target.</verify>
  <done>The exact attributable target has three review approvals and one fresh full verification receipt with no source changes after either.</done>
  <commit>chore(site): validate community and theme release</commit>
</task>

<task id="6" depends="5" type="auto" kind="deployment" status="in_progress">
  <name>Publish the exact reviewed target to owner-only Sites</name>
  <files>
    <modify>docs/arc/plans/2026-07-26-bindery-community-theme-responsive-implementation.md</modify>
    <modify>docs/arc/plans/INDEX.md</modify>
  </files>
  <read_first>.openai/hosting.json, docs/PROJECT_STATUS.md, docs/arc/plans/2026-07-26-bindery-community-theme-responsive-implementation.md</read_first>
  <action>Use the current request and mandatory existing-Sites workflow authority to create one final local source commit, push only that exact HEAD to the configured Sites source repository with per-command authentication, save one Sites version, redeploy with the already verified owner-only access policy, and perform an authenticated read-only production smoke check. Do not push to GitHub or change access.</action>
  <verify>The configured Sites source branch, saved version source SHA, and local HEAD are identical; Sites reports `succeeded`; an authenticated GET of production contains `커뮤니티`, both theme option labels, and the Bindery home title; `git status --short` is empty.</verify>
  <done>The exact reviewed HEAD is the owner-only production Sites version, its HTML contains the new navigation and theme catalog, and the local worktree is clean.</done>
  <commit>feat(site): ship community and theme catalog</commit>
</task>

## Implementation state

**Execution base:** `ba6564661a6b1c9cc5750c3ac81d50d050766ad0`
**Declared scope:** `app/**`, `tests/**`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/**`, `.openai/hosting.json`
**Pre-existing dirty paths:**

- none

**Excluded metadata:** this plan and `docs/arc/plans/INDEX.md`
**Commit posture:** the current existing-site change request plus the mandatory Sites workflow authorize one exact final local commit and push only to the configured Sites source repository; no GitHub push or PR is authorized
**Last coherent commit:** `ba6564661a6b1c9cc5750c3ac81d50d050766ad0`
**Closeout:** approved target `64ffa7ce5639837b22697efc7fd0a1bfe4280b8e73957e0434bee0fba1100b69`; spec, standards, and product/browser axes approved; fresh 2026-07-26 15:24 KST gate passed `npm run lint`, `npm test` (24 Node, 8 Vitest, 5 Playwright), `npm run build`, and `git diff --check`

## Decision log

- v1.0 remains the primary authority: the new Community route is not a free-form board. It uses v0.3 only for the event-context accumulation model.
- The default theme preserves the current three-ink identity. Alternate catalog entries remap roles without changing layout, typography hierarchy, or safety semantics.
- Browser baseline found no page-level overflow. The concrete regression is avoidable three-line group-buy headings at 768px and 1280px; calendar and event-history overflow remains intentionally owned by their local sheets.
