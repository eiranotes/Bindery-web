# Bindery Community and Whole-UI Audit

**Audited at:** `354d7dac996403a5f94b831b5d876ac00ff49712`
**Date:** 2026-07-26
**Stage:** owner-only deployed prototype
**Scope:** all application routes, internal links and controls, responsive text flow, Community product boundary, accessibility, ad readiness, tests, and project records

## Executive summary

The existing information site has a strong responsive baseline: all 10 primary
routes kept page overflow at zero at 360px, 768px, and 1280px; all 20 existing
internal destinations returned 200; and sampled headings did not fragment into
avoidable three-line stacks. The theme system is already catalog-driven.

The largest issue is not a hidden implementation bug. The current product,
screen, tests, and progress records explicitly prohibit a free board, which now
contradicts the user's corrected requirement. There is also no artist
verification, authorization, post-detail, writing, rules/reporting, or ad-slot
surface. These gaps must be implemented without pretending that a backend or
verified session exists.

## Mechanical evidence

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| Baseline `npm test` | Passed: 24 Node tests, 8 Vitest tests, 5 Playwright tests |
| Primary routes at 360/768/1280 | Zero page-level horizontal overflow |
| Existing internal destinations | 20 unique destinations, all returned 200 |
| Sample heading wrapping | No sampled heading rendered at 3+ lines |
| `npx -y knip --no-progress --reporter compact` | Reported one worker entry, several exports/types, and duplicate default exports as unused |
| `npm audit --json` | Inconclusive: registry response was compressed data that npm failed to decode as JSON |
| Codebase map | 52 source files, no import cycles, no data/service layer |

The npm-audit failure is a transport/tooling failure, not evidence that
dependencies are safe or vulnerable.

## Scorecard

| Area | Score | Evidence |
|---|---:|---|
| Correctness | 76 | Existing routes and local Binder behavior pass; requested board behavior is absent |
| Maintainability | 82 | Small server-first app, no cycles, typed theme catalog; Community model is too narrow |
| UX completeness | 61 | Existing actions resolve, but the requested board, write, verify, rules/report, and error flows do not exist |
| Responsive UI | 88 | No page overflow or observed 3-line heading regression at the three required widths |
| Accessibility | 70 | Native controls, labels, skip link, focus ring, and reduced motion exist; several links miss the project's 44px target and calendar grid semantics are incomplete |
| Security boundary | 72 | No mutable API or auth bypass exists because no auth exists; verified-only content cannot safely be added until server authorization exists |
| Testing | 73 | Strong route/rendered/responsive baseline; no internal-destination crawl or Community flow matrix |
| Documentation | 55 | Current docs agree with the old implementation but contradict the latest user decision |
| **Overall** | **72** | Sound information-site base, incomplete corrected Community product |

## Confirmed findings

### A-01 High — Product policy and UI contradict the current requirement

- `PRODUCT.md` principle 6 excludes free-board posting.
- `docs/DECISIONS.md` D-010 fixes the Community as “not a free board.”
- `app/community/page.tsx` says “자유게시판이 아닙니다.”
- `docs/TASKS.md` defers free-form Community posting.

**Resolution:** retain D-010 as history but mark it superseded by a new decision.
Keep “information first” as the ordering, category, source, and moderation rule
for two actual free boards.

### A-02 High — No artist-verification or authorization seam exists

`docs/DECISIONS.md` D-009 defines an accountless site and the current Community
record type has no board audience, author, verification, or access policy. The
archived v0.3 source also leaves artist verification unresolved.

**Resolution:** introduce one typed board catalog with `public` and
`verified-artist` audiences. Until a server session and durable verification
exist, render a real fail-closed lock screen and expose no artist-board post
content. Browser storage, query values, and visual badges must never grant
access.

### A-03 High — Requested Community destinations do not exist

Only `/community` exists. There are no board lists, post details, write screen,
verification explanation, rules/reporting guidance, or Community-specific
recovery path.

**Resolution:** add independent real URLs for the hub, both boards, a public
post detail, writing, verification, and rules. Keep live reporting and account
submission out of the prototype instead of adding inert buttons.

### A-04 High — No UGC moderation or content-state model exists

The current record model only supports fixed operator-reviewed examples. It has
no published, review, hidden, locked, or removed state and no reporting
contract. The archived v0.3 plan calls for reporting and status controls.

**Resolution:** document the future server model now and expose rules and
moderation boundaries in the prototype. Do not enable durable public
submissions until authenticated identity, rate controls, reporting, and
operator tooling exist.

### A-05 Medium — Information-first post fields are missing

Community content lacks explicit source URL, source label, confirmation date,
question resolution status, useful/reply counts, and a distinction between
artist identity and factual verification.

**Resolution:** model information categories and resolution state, require
source context for source-based posts, and label all current posts as product
examples. Keep “작가 인증” distinct from “정보 확인.”

### A-06 Medium — Multiple links miss the project's 44px target

Desktop navigation, footer navigation, calendar entries, event title links, and
Community inline links measured roughly 21–38px high. This is stricter than
WCAG 2.2 AA's 24px minimum but contradicts Bindery's own 44px quality bar and
the touch-oriented target.

**Resolution:** enlarge repeated navigation and row targets through padding or
make the useful row/cell the link. Do not inflate inline prose links.

### A-07 Medium — Tests cannot prevent new dead-end controls

The current browser suite checks selected home controls and route overflow, but
does not crawl internal destinations or exercise a Community hub-to-detail-
write/verify/rules matrix. Rendered tests also enshrine the obsolete no-board
copy.

**Resolution:** add rendered contracts for every new route, a browser
destination crawl, a Community interaction test, and a broader repeated-control
target-size check.

### A-08 Medium — No reusable ad inventory contract exists

There is no ad component, placement catalog, label, or reserved dimension.

**Resolution:** create one `AdSlot` component backed by a typed placement
catalog. Use the literal “광고” label, a stable minimum block size, spacing from
navigation and buttons, and no live script. Do not place ads on writing,
verification, locked, error, or official deadline decision screens.

### A-09 Medium — Calendar grid semantics are incomplete

`app/events/calendar/page.tsx` places `columnheader` and `gridcell` children
directly under `role="grid"` without rows and does not implement grid keyboard
behavior.

**Resolution:** either provide the complete accessible grid pattern or remove
the grid roles and retain a simple semantic calendar/list representation. This
is a separate corrective slice from the Community feature.

### A-10 Low — Heading levels in Notes and News are flatter than the visual hierarchy

The list section heading and each entry title all use `h2`. Entry titles should
normally be `h3` under the named list section.

**Resolution:** correct heading levels in the accessibility cleanup slice and
keep visual styling independent from semantic rank.

### A-11 Medium — Product-specific 404/recovery UI is absent

Dynamic event and note routes call `notFound()` but the app has no custom
`not-found.tsx`. A deleted or unknown Community post would fall into a generic
framework dead end.

**Resolution:** add a Bindery recovery screen that links to Community, Events,
and Home. Permission denial remains a dedicated lock screen, not a 404.

## Information-first Community recommendations

1. Use two independently addressable boards: `작가 인증 게시판` and `모두의 게시판`.
2. Sort practical categories before casual conversation: 행사 준비, 제작·발주,
   가격·원가, 사업자·세금, 저작권, 판매·배송, 자유 대화.
3. Give questions `답변 대기`, `해결`, and `최신 확인 필요` states. Promote
   durable solved threads into operator Notes.
4. Attach source URL and confirmation date to event/vendor factual posts and
   cross-link relevant Event and Note pages.
5. Make artist verification mean identity/activity eligibility only. It must
   not imply that every claim is fact-checked.
6. Add URL-based category, status, and order filters. A future phase can connect
   post saves to My Binder.
7. Use ad inventory only below board selection, within the general-board feed
   after real content, and near the home footer. Never put it next to navigation,
   writing controls, verification, locked states, or deadline decisions.
8. Continue excluding DM, real-time chat, transactions, rankings, and
   engagement competition until their information value and safety operations
   are proven.

## Ad and UGC guardrails

- Google AdSense requires ads to be distinguishable from content and not placed
  where users may confuse them with navigation or other controls.
- Reserve ad dimensions before load to prevent layout shifts.
- Mark future user-posted outbound links as `rel="ugc"` (and `nofollow` where
  appropriate), and establish visible anti-spam/reporting policy before live
  submissions.
- Keep all current content and draft behavior clearly labeled as example or
  device-local prototype data.

## Implementation clusters

1. **Board and access structure:** typed catalog, hub, public list/details,
   fail-closed artist board.
2. **Complete destinations:** local draft, verify explanation, rules, recovery.
3. **Ad inventory:** reusable slot catalog and three non-interruptive placements.
4. **Responsive/accessibility:** repeated target sizing, semantic navigation,
   text measures, overflow, and ad separation.
5. **Future backend gate:** authenticated user/artist roles, durable posts,
   reporting, moderation state, rate controls, and legal/privacy review.
