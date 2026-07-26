# Bindery Free Boards, Ad Slots, and UI Completion Implementation Plan

> **For Arc:** Use /arc:implement. Build agents report DONE, DONE_WITH_CONCERNS,
> NEEDS_CONTEXT, BLOCKED, or AUTH_GATE.

**Feature spec or source:** User correction; `../bindery/01_기획/기획서_v0.3_커뮤니티우선(보관).md`; `../bindery/01_기획/기획서_v1.0_정보우선.md`; `PRODUCT.md`; `DESIGN.md`
**Goal:** Replace the curated Community catalog with an information-first free-board system split by artist-verification status, close every Community navigation destination, reserve clearly labeled ad inventory, and keep mobile/desktop text flow usable.
**Stack:** vinext/React 19, TypeScript, Vitest, Node test, Playwright, npm, GPT Sites
**Planned at:** 354d7dac996403a5f94b831b5d876ac00ff49712
**Plan schema:** 2
**Planned assurance:** Guarded
**Effective assurance:** Guarded
**Assurance rationale:** The feature introduces a future authorization boundary, user-generated-content entry screens, browser-local drafts, new public routes, ad placement, and a production Sites deployment. The current prototype must not imply that server-side identity or publishing enforcement exists.
**Out of scope:** Real authentication, durable public posting, identity-document upload, server-side artist verification, direct messages, payments, live ads, public access changes, and a production moderation backend.

## File structure

- `app/lib/community.ts` — board catalog, categories, sample posts, and safe lookup/filter functions.
- `app/components/CommunityBoardNav.tsx`, `CommunityPostList.tsx` — shared board navigation and information-led post ledger.
- `app/components/CommunityComposer.tsx` — device-local draft form with explicit non-publishing boundary.
- `app/components/AdSlot.tsx` — labeled, size-reserved ad inventory primitive.
- `app/community/**` — Community hub, two board screens, general-board post detail, write, verification, and rules screens.
- `app/page.tsx`, `app/sitemap.ts`, `app/globals.css` — discovery, route indexing, ad slots, responsive layout, and touch/focus behavior.
- `tests/**` — rendered route, local-draft, internal-destination, accessibility, ad-slot, and 360/768/1280 evidence.
- `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/**` — product correction, decisions, audit, status, tasks, and changelog.

<seams>
  <seam id="board-boundary">
    <interface>GET /community, /community/artists, and /community/general</interface>
    <behavior>The hub explains both free boards; the artist board exposes no post content without the future verified session; the general board remains readable to everyone and defaults to practical information before casual conversation.</behavior>
    <test>tests/community-rendered.test.mjs and tests/browser/responsive.spec.ts</test>
  </seam>
  <seam id="community-destinations">
    <interface>All Community links, buttons, and form actions</interface>
    <behavior>Every visible Community action resolves to a real screen or performs a named local action. No control implies live verification, reporting, or public posting.</behavior>
    <test>tests/browser/community-destinations.spec.ts and tests/client/community-composer.test.tsx</test>
  </seam>
  <seam id="ad-inventory">
    <interface>AdSlot placement id, format, label, and reserved dimensions</interface>
    <behavior>Home and Community ad inventory is clearly labeled “광고”, visually distinct from content and navigation, and reserves height before any future ad loads.</behavior>
    <test>tests/browser/responsive.spec.ts and tests/responsive-contract.test.mjs</test>
  </seam>
</seams>

<task id="1" depends="" type="auto" kind="audit" status="in_progress">
  <name>Audit current UI, destinations, and information-first product gaps</name>
  <files>
    <create>docs/arc/audits/2026-07-26-bindery-community-ui-audit.md</create>
  </files>
  <read_first>PRODUCT.md, DESIGN.md, docs/DECISIONS.md, app/**, tests/**, ../bindery/01_기획/*.md</read_first>
  <action>Run mechanical checks, inventory all routes and controls, inspect representative mobile and desktop layouts, review the artist-verification and information-archive source material, and vet parallel product/accessibility/Next.js/security findings. Convert confirmed findings into scoped implementation tasks.</action>
  <verify>`npm run lint` and baseline `npm test` pass; every current internal destination returns 200; the audit records the npm-audit transport failure separately from application findings.</verify>
  <done>The audit distinguishes current bugs, requested product changes, implementation-safe prototype boundaries, and future backend obligations.</done>
  <commit>docs(audit): assess community and ui completion</commit>
</task>

<task id="2" depends="1" type="auto" kind="behavior" status="pending">
  <name>Build the two-board Community information architecture</name>
  <files>
    <create>app/lib/community.ts</create>
    <create>app/components/CommunityBoardNav.tsx</create>
    <create>app/components/CommunityPostList.tsx</create>
    <modify>app/community/page.tsx</modify>
    <create>app/community/artists/page.tsx</create>
    <create>app/community/general/page.tsx</create>
    <create>app/community/general/[slug]/page.tsx</create>
    <modify>app/lib/data.ts</modify>
    <modify>app/lib/types.ts</modify>
    <modify>app/page.tsx</modify>
    <modify>app/sitemap.ts</modify>
    <modify>app/globals.css</modify>
  </files>
  <read_first>app/community/page.tsx, app/lib/data.ts, app/lib/types.ts, app/page.tsx, app/sitemap.ts, app/globals.css</read_first>
  <action>Replace the old no-board ledger with a Community hub and two explicit board routes. Keep the artist board locked and content-free until verified auth exists. Give the general board shareable category/sort filters, a compact information-led ledger, safe unknown-query fallback, example-data labeling, and real post detail routes.</action>
  <seams><seam ref="board-boundary" /></seams>
  <behavior>The current product correction is visible, the two audiences cannot be confused, and the prototype never treats a client-only value as artist authorization.</behavior>
  <verify>Rendered tests cover hub, locked artist board, general filtering, safe fallback, post detail, and unknown post 404. Browser tests cover all new routes at 360px, 768px, and 1280px.</verify>
  <done>Both free boards have distinct real screens and the verified-only boundary fails closed.</done>
  <commit>feat(community): split free boards by verification</commit>
</task>

<task id="3" depends="2" type="auto" kind="integration" status="pending">
  <name>Complete Community actions and local draft flow</name>
  <files>
    <create>app/components/CommunityComposer.tsx</create>
    <create>app/community/write/page.tsx</create>
    <create>app/community/verify/page.tsx</create>
    <create>app/community/rules/page.tsx</create>
    <create>tests/client/community-composer.test.tsx</create>
    <create>tests/browser/community-destinations.spec.ts</create>
    <modify>app/globals.css</modify>
  </files>
  <read_first>app/lib/bookmarks.ts, app/components/BookmarkButton.tsx, tests/client/bookmark-flow.test.tsx, app/components/SiteHeader.tsx</read_first>
  <action>Add real write, verification-explanation, and community-rules screens. The composer saves and clears one versioned device-local draft, announces outcomes, uses visible labels and useful validation, and explicitly does not publish. Artist-board composition routes users to verification status instead of simulating a privilege check. Crawl visible Community destinations and require non-error responses.</action>
  <seams><seam ref="community-destinations" /></seams>
  <behavior>“글 쓰기”, “작가 인증”, rules, board navigation, post rows, save, and clear all have an observable destination or result.</behavior>
  <verify>Vitest covers restored, saved, cleared, malformed, and blocked-storage draft states. Playwright crawls Community links/actions, checks keyboard focus and labels, and finds no 404 destination.</verify>
  <done>No visible Community control is a dead end or a fake live-service claim.</done>
  <commit>feat(community): complete prototype actions</commit>
</task>

<task id="4" depends="2" type="auto" kind="integration" status="pending">
  <name>Reserve policy-safe ad inventory</name>
  <files>
    <create>app/components/AdSlot.tsx</create>
    <modify>app/page.tsx</modify>
    <modify>app/community/page.tsx</modify>
    <modify>app/community/general/page.tsx</modify>
    <modify>app/globals.css</modify>
    <modify>tests/responsive-contract.test.mjs</modify>
    <modify>tests/browser/responsive.spec.ts</modify>
  </files>
  <read_first>app/page.tsx, app/community/page.tsx, app/globals.css, tests/browser/responsive.spec.ts</read_first>
  <action>Create one reusable labeled ad-slot primitive and place reserved leaderboard/in-feed inventory away from navigation and primary decision controls. Use stable format-specific minimum heights, responsive bounds, and theme roles without adding live scripts or fake advertiser content.</action>
  <seams><seam ref="ad-inventory" /></seams>
  <behavior>Future inventory has predictable locations and dimensions while current pages remain clean, legible, and honest.</behavior>
  <verify>CSS-contract and browser assertions confirm labels, unique placement ids, reserved heights, no page overflow, no overlap with controls, and correct 360/768/1280 layout.</verify>
  <done>Three maintainable ad slots exist without layout shift or misleading placement.</done>
  <commit>feat(ads): reserve labeled inventory slots</commit>
</task>

<task id="5" depends="3,4" type="auto" kind="documentation" status="pending">
  <name>Reconcile product, design, audit, and progress records</name>
  <files>
    <modify>README.md</modify>
    <modify>PRODUCT.md</modify>
    <modify>DESIGN.md</modify>
    <modify>docs/PROJECT_STATUS.md</modify>
    <modify>docs/TASKS.md</modify>
    <modify>docs/DECISIONS.md</modify>
    <modify>docs/CHANGELOG.md</modify>
    <modify>docs/arc/audits/2026-07-26-bindery-community-ui-audit.md</modify>
    <modify>docs/arc/plans/2026-07-26-bindery-freeboard-ads-ui-completion-implementation.md</modify>
    <modify>docs/arc/plans/INDEX.md</modify>
  </files>
  <read_first>README.md, PRODUCT.md, DESIGN.md, docs/PROJECT_STATUS.md, docs/TASKS.md, docs/DECISIONS.md, docs/CHANGELOG.md</read_first>
  <action>Record the user’s correction as a superseding product decision, the two-board access model, information-first ranking and categories, UGC/moderation obligations, local-draft limitation, ad-slot rules, completed UI audit, and remaining backend/legal risks.</action>
  <verify>`rg -n "작가 인증 게시판|모두의 게시판|광고|임시저장|D-010" README.md PRODUCT.md DESIGN.md docs/*.md` returns the expected contracts and `git diff --check` exits zero.</verify>
  <done>All project records match the actual prototype and do not call local drafts or example posts live community data.</done>
  <commit>docs(site): record free-board and ad contracts</commit>
</task>

<task id="6" depends="5" type="auto" kind="artifact" status="pending">
  <name>Review and validate one exact implementation target</name>
  <files>
    <modify>docs/arc/plans/2026-07-26-bindery-freeboard-ads-ui-completion-implementation.md</modify>
    <modify>docs/arc/plans/INDEX.md</modify>
  </files>
  <read_first>package.json, .openai/hosting.json, docs/arc/plans/2026-07-26-bindery-freeboard-ads-ui-completion-implementation.md</read_first>
  <action>Capture one attributable target and run whole-implementation spec, standards, product/accessibility, and security-boundary review against it. If a finding changes source, declare and complete a corrective task before rerunning the review. Then run one fresh closeout gate.</action>
  <verify>On the unchanged approved target, `npm run lint`, `npm test`, `npm run build`, and `git diff --check` each exit zero.</verify>
  <done>All review axes approve one exact target and the fresh gate passes without source changes afterward.</done>
  <commit>chore(site): validate free-board release</commit>
</task>

<task id="7" depends="6" type="auto" kind="deployment" status="pending">
  <name>Publish the exact reviewed target to owner-only Sites</name>
  <files>
    <modify>docs/PROJECT_STATUS.md</modify>
    <modify>docs/CHANGELOG.md</modify>
    <modify>docs/arc/plans/2026-07-26-bindery-freeboard-ads-ui-completion-implementation.md</modify>
    <modify>docs/arc/plans/INDEX.md</modify>
  </files>
  <read_first>.openai/hosting.json, docs/PROJECT_STATUS.md, docs/arc/plans/2026-07-26-bindery-freeboard-ads-ui-completion-implementation.md</read_first>
  <action>Commit the exact verified source, push only that HEAD to the configured Sites source repository with per-command credentials, package from that commit, save a version, deploy with the existing owner-only access policy, and smoke-test the new routes. Do not push to GitHub or widen access.</action>
  <verify>Local HEAD, Sites source SHA, and saved-version SHA agree; deployment succeeds; authenticated production GETs for the hub, both boards, a general post, write, verify, and rules return 200 and contain the expected boundaries.</verify>
  <done>The exact approved source is the owner-only production version and the worktree is clean.</done>
  <commit>feat(site): ship free boards and ad slots</commit>
</task>

## Implementation state

**Execution base:** `354d7dac996403a5f94b831b5d876ac00ff49712`
**Declared scope:** `app/**`, `tests/**`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/**`, `.openai/hosting.json`
**Pre-existing dirty paths:**

- none

**Excluded metadata:** this plan and `docs/arc/plans/INDEX.md`
**Commit posture:** the existing-site feature request and mandatory Sites workflow authorize exact local commits and pushes only to the configured Sites source repository; no GitHub push or public access change is authorized.
**Last coherent commit:** `354d7dac996403a5f94b831b5d876ac00ff49712`
**Closeout:** pending

## Decision log

- The user’s current instruction supersedes D-010’s no-board rule. Information-first now governs board ordering, categorization, source context, and moderation rather than forbidding boards.
- The archived v0.3 document supplies the event-context accumulation and unresolved artist-verification concern, but does not authorize fake authentication.
- Reserved ads use the literal label “광고”, fixed containers, and distance from navigation and primary controls. No live ad script is introduced.
- A browser-local draft is useful prototype behavior but is not public posting. The UI must state this at the action point.
