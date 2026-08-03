# Project Status

## Current state

The GPT Sites vinext implementation includes an information-first Community
prototype split into an artist-verified board and a general board, a
catalog-driven theme selector, complete Community destination screens, and
reserved ad inventory. The production site remains owner-only at
<https://bindery-korea-info.eiraworks-9813.chatgpt.site>; the current Community
release is deployed there as owner-only Sites version 5. Community backend work
has progressed locally from clean checkpoint `7f4be4a` through operating
policy, typed authorization, real PostgreSQL/RLS proof, and a fail-closed
Supabase session boundary. The local backend now covers automatic provisional
artist applications, later admin review, single-use operator invitations,
durable split boards, moderation and audit, knowledge promotion, authorized
search, recipient notifications, and explicit Binder account merge. No
production Supabase project or Sites runtime configuration has been created.
The validated source is maintained in the public GitHub repository
<https://github.com/eiranotes/Bindery-web>.

The event catalog now comes from a deterministic official-content pipeline
rather than the five product-validation fixtures. The first editor-checked
batch contains three 2026 Illustration Korea editions backed by 11 accessible
S1/S2 source records. Participant and seller material is physically separated
under a Git-ignored local review store and does not enter public generation.
This source is committed at `3fffb0d`, but it is not yet deployed: the persisted
Sites project ID returns `project not found`, the current Pro account's Sites
dashboard lists no managed sites, and the existing owner-only URL still renders
the five fixture events. A GitHub Pages static preview exporter and deployment
workflow now provide a public fallback target at
<https://eiranotes.github.io/Bindery-web/>; the checked-out state has passed its
local artifact and browser gates, while the first hosted workflow run is pending.

## Completed

- Reviewed the existing WebGPT conversation `웹 콘텐츠 카테고리화 계획` and
  obtained a fresh Pro-model boundary review before implementation.
- Added an allowlisted official collector with robots/HTTP checks, local raw
  cache, normalized SHA-256 records, recheck scheduling, field-level evidence,
  deterministic generation, Markdown reporting, and publication guards.
- Collected and editor-checked the 2026 Illustration Korea Seoul aT, Incheon,
  and Suwon editions from 11 official organizer/venue sources and replaced the
  public event fixtures with generated official data.
- Added a disabled-by-default X API v2 review collector, hashed local author
  identifiers, rule-based topics, JSONL import, and ArchiveBox URL handoff;
  `twscrape==0.19.2` is now an explicitly approved, manually selected local-only
  collector with its account DB and records excluded from Git and deployment.
- Compared current twscrape, Twikit, the-convocation Node scraper, Tweety, and
  snscrape maintenance signals; installed twscrape in an isolated Python 3.11
  environment and proved its health and empty-account failure boundary.
- Added a 26-screen GitHub Pages static preview plus ICS/RSS/robots/sitemap,
  project-path URL rewriting, executable-script removal, a visible static
  limitation banner, and a main-branch Actions deployment workflow.
- Reconciled the concurrent comparison/archive release with the official event
  catalog: unknown booth counts and business requirements remain `정보 없음`
  instead of becoming zero or false. The combined branch passes 108 Node tests,
  30 client tests, 31 Playwright tests, lint, typecheck, production build, and
  desktop/mobile static-preview checks.
- Added the three official catalog IDs to the append-only Community event
  allowlist while preserving legacy Binder links.

- Read all Markdown and HTML documents in the source package.
- Established v1.0 information-first planning as product authority.
- Established the three-ink `DESIGN.md` as visual authority over the superseded cream/terracotta tokens.
- Reviewed current competitors and Behance references.
- Created `PRODUCT.md`, `DESIGN.md`, and a revised low-density north-star UI mock.
- Fixed the home-page acceptance criterion at three upcoming deadlines and five
  understated section links, with Community as the fifth destination.
- Implemented shared three-ink UI primitives and date-derived event state.
- Implemented event filters, calendar, detail history, official-source notices, ICS, Notes, News, read-only Groupbuy status, and device-local My Binder.
- Added Event and Article JSON-LD, sitemap, robots, RSS, product metadata, and a dedicated social preview.
- Verified URL-backed filtering and the complete save/remove Binder flow in the browser.
- Added client-rendered coverage for the same save/sync/remove flow and restricted-storage failure feedback.
- Verified 360px, 768px, and 1280px layouts with no page-level horizontal overflow and fixed the event-detail table containment regression found at 360px.
- Removed avoidable three-line Groupbuy headings at tablet and desktop widths,
  widened mobile trust/boundary copy, and moved navigation to its compact
  structure before labels crowd.
- Audited all primary routes and visible internal destinations. The previous
  baseline had no 404 links, no page-level overflow at 360px/768px/1280px, and
  no observed avoidable three-line heading regression.
- Replaced the old no-board Community with a two-board hub: `작가 인증 게시판`
  and `모두의 게시판`.
- Added a fail-closed artist-board lock screen that exposes no post content
  before real server authentication and artist verification exist.
- Added a public example post ledger with information categories, status,
  category/order URL filters, post details, source context, and related Notes.
- Added real write, verification, operation/rules, reporting-boundary, and
  product-specific 404 screens so visible Community actions have destinations.
- Added a versioned device-local Community draft with restore, clear, malformed
  value recovery, blocked-storage feedback, and explicit non-publishing copy.
- Added shared-browser and non-expiry warnings, two-step draft deletion, and
  search `noindex` boundaries for non-live Community operation screens.
- Added catalog-driven, labeled, fixed-height ad inventory on Home, the
  Community hub, and the general-board feed without live advertising scripts.
- Raised repeated header, footer, event, calendar, note, and Community targets
  toward the product's 44px interaction standard.
- Corrected Notes/News heading hierarchy and removed the incomplete ARIA grid
  pattern from the visual event calendar.
- Added two catalog-driven themes with complete role tokens, device-local
  selection, invalid-value recovery, and an accessible 44px native selector.
- Completed spec, standards, and Guarded security review, then passed the fresh
  53-test, lint, production-build, and staged-diff closeout gates.
- Deployed application commit `61171cc3ab9772d3c064d7e1192581cb96204e39`
  as owner-only GPT Sites version 5 and confirmed the refreshed production
  screenshot plus the unauthenticated sign-in boundary.
- Deployed the reviewed responsive, Community, and theme release to the
  existing owner-only GPT Sites project and confirmed the home and filtered
  Community routes from production.
- Replaced example-domain SEO output with request-derived production origins and removed unused auth/database starter surfaces.
- Added a reproducible Playwright viewport gate for home density, touch targets, and locally owned wide-data scrolling.
- Saved and deployed the exact validated commit as GPT Sites version 1.
- Confirmed the production deployment status and the rendered Bindery home through the Sites deployment screenshot.
- Approved the Supabase Auth/Postgres/RLS backend direction and recorded a
  Guarded, sequential implementation plan.
- Defined automatic `임시 승인 · 검수 대기`, later operator review, operator
  invitations, role/access separation, minimum public-URL evidence, provisional
  rate controls, report handling, correction, soft deletion, appeal, audit, and
  development retention defaults in `docs/COMMUNITY_OPERATIONS.md`.
- Added typed default-deny account, role, artist-status, capability, and
  transition rules with focused tests.
- Added the initial Supabase community schema and proved its grants and RLS
  against anonymous, member, provisional/verified artist, operator, admin,
  suspended/revoked, hidden-content, notification, audit, and service-role
  cases in an isolated PostgreSQL 17 cluster.
- Added email sign-in and callback routes, public configuration validation,
  verified-claims session handling, database-loaded roles and artist status,
  explicit unconfigured/signed-out/error states, and server-aware artist/write
  boundaries without connecting an external backend.
- Added minimum-data artist applications with Turnstile and database rate-limit
  boundaries, idempotent automatic provisional approval, admin review and
  revocation, and seven-day one-time invitations with explicit cancellation.
- Verified the artist workflow through focused domain tests, isolated
  PostgreSQL RPC/RLS assertions, production builds, fail-closed route tests,
  and 360px/1280px browser overflow checks.
- Added durable general-board post/source creation, public reads, member
  comments and Binder saves, reasoned soft deletion with revision history, and
  idempotent report intake behind same-origin server routes and RLS.
- Preserved the existing example board and device-local draft as the explicit
  fallback when Supabase is not configured; connected environments use only
  durable rows and never substitute examples after a backend read failure.
- Added server/RLS-protected artist-board lists, details, posts, comments,
  Binder saves, reports, and revocation-safe authorization. Provisional artists
  are limited to one post and five comments per rolling 24 hours by both the
  application check and concurrency-safe database triggers.
- Added moderator report queues and reasoned triage, dismiss, hide, lock, and
  restore actions; account suspension and appeal resolution remain admin-only.
  Each action is appended separately and report changes remain in immutable
  audit history, with unauthorized queues returning content-free screens.
- Added explicit source freshness windows, author-only accepted answers,
  maintained event links, and operator Note promotion for resolved sourced
  general-board questions. Promoted Notes preserve the original post, author,
  checked source, accepted answer, and promotion time.
- Added indexed board/category/resolution/freshness search that resolves board
  access before ranking and excludes hidden, deleted, and revoked-access rows.
- Added idempotent in-app notifications for replies, accepted answers,
  verification decisions, moderation outcomes, and appeals. Only the recipient
  can list or mark the durable rows read.
- Added explicit, lossless Binder account merge for signed-in members. Guest
  storage remains local, duplicates are reported, and partial failures never
  delete the current device collection.
- Moved artist application mutation behind a Supabase Edge Function that
  verifies one Turnstile token and calls a service-role-only transactional RPC.
  Direct table/RPC provisional self-grants and backdated invitation acceptance
  are denied; expired invitations persist an audited terminal state.
- Replaced broad authenticated content DML with database-time RPCs, enforced
  same-post answer references, and added account-target suspension audit rows.
- Added a private affected-author appeal path with a database-enforced 14-day
  window. Appeal reasons are stored separately from reporter-visible records.
- Extended device and account Binder collections to public community posts as
  well as events, with an explicit notification entry point from My Binder.
- Added author/operator post correction with immutable prior-title/body
  snapshots, operator-only source rechecks, and visible correction history.
- Added opaque keyset pagination ordered by search rank, update time, and post
  ID so filtered public and artist feeds do not repeat or skip rows as the
  collection grows.
- Bound community event links to the maintained five-event catalog at the
  database layer, moved invitation issue time and exact seven-day expiry fully
  into PostgreSQL, and tied appeals to the exact restricting action so a
  successful appeal cannot undo a later restriction.
- Split artist-board read/moderation from write capability, restricted artist
  application rows to their applicant or an admin, and blocked inactive member
  knowledge and correction controls at both service and database boundaries.
- Added explicit current-policy consent to invitation acceptance, database-owned
  review/revocation time, and transaction-lock evidence that concurrent
  application retries return one row without consuming a second rate attempt.
- Added appeal rejection, causal normal restore, catalog/capped event Binder
  RPCs, metadata-only public revision history, deterministic Note source
  selection, and configured hub/detail/report error states.
- Aligned artist-board operator read access with artist-status-only writing,
  removed inactive-account mutation affordances, rendered expired appeals as
  non-actionable, and made Note promotion time database-owned.
- Restored explicit Note RPC ACLs and capability-gated account Binder, artist
  application/invitation, audit, artist writing, and independent moderation
  controls for inactive and operator-only sessions.
- Completed final specification, Guarded security, engineering-standards, and
  product/browser review with no actionable findings remaining. The fresh
  closeout passed 103 Node tests, 30 client tests, 30 Playwright tests, a
  separate production build, and 12 isolated PostgreSQL/RLS suites.
- Audited the public UI with the Impeccable product register, removed the
  redundant Community principles section, shortened page introductions and
  helper copy, and replaced accent-stripe notices with the existing flat rule
  vocabulary. Placeholder text now uses a verified AA theme token; safety,
  source, permission, and local-storage boundaries remain explicit.
- Created the private `eiranotes/Bindery-web` GitHub repository as the source
  remote for this nested `website/` checkout.

## Next

- Complete the first GitHub Pages workflow run and hosted desktop/mobile smoke
  check before claiming the public fallback is live.
- Restore management access to the existing owner-only Sites project only if the
  Sites-hosted preview is still needed; the future real domain requires a server runtime.
- Expand the official registry one event family at a time and review every
  changed hash before publishing regenerated fields.
- Add an approved X cookie interactively to the ignored twscrape account DB (or
  supply an X API token) before the first local review capture; initialize the
  separate local ArchiveBox vault if snapshots are required.
- Replace remaining non-event curated sample content with product-owner data
  and complete legal/privacy policy work.
- Request a separate commit checkpoint for the completed post-`d44a6d2`
  backend slices if they should be recorded in Git.
- Provision and bind an external Supabase/Turnstile environment only after an
  explicit mutation checkpoint and product-owner approval.
- Approve the implemented correction/source-verification operating routine and
  complete privacy and legal review before accepting any real Community
  submission.
- Select an ad provider only after consent, privacy, content suitability, and
  production placement review.
- Decide whether to keep owner-only access or explicitly approve a wider audience.

## Known risks

- The current owner-only production URL is stale relative to `main`. The signed-in
  URL is viewable from the current account, but its Sites management project is
  not available through the current connector/session, so version save and
  production deployment are blocked without owner-side access recovery. The Pages
  fallback is deliberately static and does not supply that missing server runtime.

- The first official batch covers one event family and three editions, not the
  wider Korean creator-event market. Unknown booth counts, business-registration
  requirements, and logistics remain intentionally blank.
- X/local review collection is prepared but contains zero records because no
  local twscrape account DB or bearer token is configured. Repository activity is
  only a maintenance signal, not a trust guarantee; unofficial endpoints may
  break without notice and can create service-policy or account restrictions.

- The Bindery name conflicts with an existing desktop writing app; the private production site keeps the working name but does not claim a final domain.
- Real event data, legal terms, privacy policy, and Groupbuy policy remain product-owner inputs.
- Community posts and authors are product-validation examples, not live user
  submissions or verified operational guidance.
- The artist-board boundary now consumes a verified server session contract,
  but the owner-only production deployment has no Supabase runtime values and
  therefore remains intentionally locked.
- Artist application, review, and invitation code is complete locally, but
  real email delivery, Turnstile, and Supabase behavior remain unverified until
  the product owner approves and supplies an external project/runtime binding.
- Search, notifications, appeals, account Binder merge, and promoted Notes are
  complete in source and isolated PostgreSQL proof but have not been exercised
  against an external Supabase project or hosted authenticated session.
- In the current unconfigured owner-only deployment, Community writing stores
  one draft only in the browser and does not publish. Configured environments
  use the server/RLS publishing path. The fallback draft is not encrypted or
  automatically deleted, so shared-browser users must clear it manually.
- The Edge Function, email callback, Turnstile verification, hosted RLS, backup
  and recovery behavior have not been exercised against an external Supabase
  project; local PostgreSQL proof does not replace that production gate.
- Ad spaces are placeholders. No provider, consent flow, measurement, or live
  ad code is connected.
- The original plan named SvelteKit and Supabase. GPT Sites deployment uses the generated vinext/React runtime; this implementation preserves the product contracts but does not pretend a Supabase production backend exists.
- The seven-day review, moderation response, appeal, and development retention
  values are implementation defaults, not published legal terms. Product-owner
  privacy/legal approval is still required before real submissions.
