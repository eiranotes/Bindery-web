# Changelog

## 2026-08-05

- Added a registered international-stationery candidate pipeline and a
  hash-verified Japan/Taiwan/mainland-China batch with 10 event masters, 15
  editions, and 16 official sources; all 16 URLs passed a live fetch audit.
- Added Design Festa vol.64 from its official event, exhibitor, FAQ, and Tokyo
  Big Sight pages with dates, scale, closed lottery, native JPY booth fees,
  original-work and refund rules, venue address, and onsite conditions.
- Published 15 dated source-checked international editions, raising the
  canonical catalog to 73 masters, 91 editions, 132 sources and the generated
  site catalog to 70 editions while retaining 24 held domestic candidates.
- Added country, city, IANA time zone, source language, official local name, and
  native ISO currency fields. Unlike currencies are no longer ranked against
  each other, and visitor tickets are not stored as exhibitor fees.
- Added a dedicated international-stationery review report, overseas rendered
  coverage, and a conflict-safe Community event allowlist migration for the 14
  new edition IDs.
- Passed content guards, batch hash and source checks, lint, typecheck,
  production build, 116 Node tests, 29 client tests, 31 Playwright tests, and a
  92-screen static Pages export containing every new international detail path.

- Ran a broad Pro-model search for Korean creator events and preserved the exact
  result as 63 EventMaster candidates, 76 edition candidates, 116 source records,
  and a research report with a SHA-256 manifest.
- Added candidate-only validation for JSONL structure, IDs, references, evidence
  backlinks, dates, source tiers, canonical URLs, overlap isolation, and artifact
  integrity without exposing research candidates to public generation.
- Rechecked all 116 claimed official URLs: 104 were accessible, seven returned
  HTTP errors, and five failed to fetch. Generated a reachable top-20 manual
  review queue and left all 76 editions unpromoted pending editor normalization.
- Passed candidate/public content guards, lint, typecheck, production build,
  109 Node tests, 29 client tests, and 31 Playwright tests.
- Normalized the complete 63-master, 76-edition, and 116-source research bundle
  into canonical catalog collections. Added 52 dated editions with reachable
  S1/S2 source chains to public generation, bringing the generated catalog to
  55 editions while holding 24 unsafe editions.
- Added nullable deadline, fee, venue, booth-size, selection, and application
  status handling throughout event sorting, lists, details, comparisons,
  archives, calendar, ICS, and Binder views; unknown values stay `정보 없음`.
- Added a complete held/public-incomplete review report and synchronized the
  database event allowlist with all generated public event IDs.
- Passed lint, typecheck, production build, 112 Node tests, 29 client tests, 31
  Playwright tests, and a 77-screen static Pages export for the expanded catalog.

## 2026-08-03

- Created a WebGPT `Bindery-web` project, uploaded six product, design, strategy,
  audit, pipeline, and implementation-brief sources, applied a fresh Pro review,
  then added the review summary as a seventh reusable project source.
- Rebuilt the global header and Home index around event search, comparison,
  edition history, and preparation Notes; moved News, calendar, and Community
  into supporting navigation and removed Groupbuy from sitemap and static Pages.
- Changed the public wordmark and metadata to `Bindery` and added a persistent,
  self-named Korean/English/Japanese/Chinese shell selector with an explicit
  Korean-original content boundary.
- Consolidated the interface into four base color roles and reserved fluorescent
  pink for non-text deadline emphasis while keeping blue focus indicators.
- Verified the release with content guards, typecheck, production build, 108
  Node tests, 29 client tests, 31 Playwright tests, three visual viewport checks,
  and a 25-screen static Pages artifact without Groupbuy output.
- Disabled the locale selector in the script-free Pages artifact and named that
  limitation in the static-preview banner so the preview does not imply working
  translations.
- Added an allowlisted official-content collector with robots/HTTP checks,
  local raw caching, normalized SHA-256 records, recheck scheduling, field-level
  evidence, deterministic site generation, and human-readable Markdown reports.
- Replaced the five public event fixtures with three editor-checked 2026
  Illustration Korea editions covering Seoul aT, Incheon, and Suwon from 11
  accessible official organizer/venue sources.
- Preserved official uncertainty: capacity-based final deadlines stay distinct
  from early discounts, VAT is explicit, and unknown booth counts, business
  requirements, and logistics render as missing instead of zero or false.
- Added schema files, generated-file staleness checks, publication leak guards,
  all-day ICS output, milestone-aware status/sorting, and focused content,
  domain, rendered-route, feed, and responsive coverage.
- Added a disabled-by-default official X API review collector, local JSONL
  import/reporting, hashed author IDs, rule-based topics, and ArchiveBox URL
  handoff. Local review data is ignored by Git and excluded from official
  generation and reports.
- Added the three official event IDs to the append-only Community allowlist
  while preserving existing legacy event references.
- Added a pinned `twscrape==0.19.2` local collector with an isolated account DB,
  explicit manual selection, Latest search, hashed author IDs, and no public or
  CI output; documented current Twikit, Node scraper, Tweety, and snscrape signals.
- Added a GitHub Pages static preview exporter and Actions deployment workflow.
  The artifact includes 26 read-only screens plus feeds, removes application
  JavaScript, uses the `/Bindery-web` base path, and labels server actions as unavailable.
- Integrated the new comparison and edition-archive screens with verified event
  data so unknown booth counts and business requirements stay visibly unknown.

## 2026-07-28

- Shortened introductions, home index labels, and Community helper copy across
  public routes while preserving source, permission, safety, and storage
  boundaries; removed the redundant Community principles panel and decorative
  notice side stripes, and raised placeholder contrast to the theme's AA text
  token.
- Added Supabase public configuration validation, browser/server SSR clients,
  email sign-in and callback routes, and verified-claims session resolution.
- Loaded account role and artist status from protected database rows instead
  of trusting client or session metadata, with explicit unconfigured,
  signed-out, signed-in, and error states.
- Connected artist-board and write boundaries to the server session contract
  while preserving content-free fail-closed behavior before production backend
  binding.
- Documented local public environment values, callback URLs, service-role
  secrecy, and isolated PostgreSQL/RLS verification.
- Added automatic provisional artist applications with proof-URL normalization,
  idempotency, Turnstile verification, and database-backed rate limiting.
- Added admin review/revocation screens and seven-day one-time artist
  invitations with target-email binding, acceptance, explicit cancellation,
  and append-only audit history.
- Kept application, admin, and invitation routes private/no-store and
  fail-closed without runtime configuration; verified 360px and 1280px layouts.
- Added durable general-board post/source creation, public list/detail reads,
  member comments, Binder saves, reasoned soft deletion, and report intake.
- Switched configured screens to live rows while preserving the existing
  example board and device-local composer only as an explicit unconfigured
  fallback; added responsive and fail-closed browser coverage.
- Added protected artist-board list/detail/write flows and rolling provisional
  limits enforced at both service and database-trigger boundaries.
- Closed former-author RLS paths after artist revocation and added content-free
  lock screens for unauthorized list, detail, and write routes.
- Added moderator report queues, reasoned content actions, admin-only account
  suspension and appeal resolution, plus separate action and audit history
  screens that remain hidden from ordinary members.
- Added source freshness windows, author-only answer acceptance, event links,
  and operator promotion of resolved sourced discussions into maintained Notes.
- Added a public promoted-Note catalog and detail view that retains the original
  community post, author, checked source, accepted answer, and promotion time.
- Added indexed community search with board, category, resolution, and source
  freshness filters while excluding protected, hidden, and deleted rows before
  results can be returned.
- Added recipient-only in-app notifications for replies, accepted answers,
  artist review decisions, moderation outcomes, and appeal outcomes, including
  an explicit read action.
- Added an explicit signed-in Binder merge that saves supported event and
  readable community bookmarks idempotently, reports conflicts and partial
  failures, and preserves device-local data.
- Reconciled backend setup, operator routines, migration order, backup limits,
  and the remaining external Supabase, Turnstile, legal, and hosted E2E gates.
- Closed direct provisional-artist self-grants with an authenticated Supabase
  Edge Function, single-use Turnstile verification, explicit consent, and a
  service-role-only transactional application RPC.
- Made invitation expiry database-time-only and auditable, including persisted
  expired state that cannot be bypassed with a caller timestamp.
- Added reasoned author/operator post correction with immutable prior-content
  snapshots and append-only operator source rechecks.
- Added opaque rank/update/ID keyset pagination to filtered general and artist
  community feeds while preserving active URL filters.
- Restricted community event links to the maintained database allowlist and
  made invitation issuance exactly seven database days without caller time.
- Bound each appeal to the exact restricting moderation action and prevented a
  successful appeal from reversing a newer post or account restriction.
- Separated artist-board moderation access from artist write capability and
  restricted application records to the applicant or an administrator.
- Added explicit current-policy consent to invitation acceptance, database-owned
  review/revocation time, and transaction-safe concurrent application replay.
- Added appeal rejection and causally safe normal restore without undoing later
  restrictions or deleted content.
- Replaced raw event-bookmark inserts with an allowlisted, account-capped RPC
  and preserved legacy event references during populated migration upgrades.
- Limited public correction history to editor/reason/time metadata, aligned
  correction sources on HTTPS, and made same-day Note source selection stable.
- Made the configured Community hub load durable public rows and render honest
  retryable errors for hub, detail, and report read failures.
- Hid live write, comment, report, account-Binder, correction, and deletion
  affordances when a signed-in account lacks the corresponding active capability.
- Made Note promotion chronology database-owned and rendered expired appeals as
  closed to new submissions before the user reaches the API.
- Restored least-privilege ACLs on both Note-promotion RPC signatures and gated
  account Binder, artist application/invitation, audit, and artist write CTAs by
  active capabilities rather than raw sign-in or role state.
- Corrected the unconfigured artist-write boundary so it explains the missing
  backend and links to verification criteria instead of implying account suspension.
- Replaced broad authenticated content DML with narrow database-time RPCs and
  added same-post accepted-answer enforcement plus account-target suspension
  audit evidence.
- Added affected-author appeals with a private reason record, 14-day database
  deadline, account notification link, administrator resolution, and audit
  history.
- Extended device/account Binder behavior to public community posts and added
  real PostgreSQL RLS evidence plus unique migration-version verification.
- Added `npm run typecheck` to the required test gate and corrected remaining
  live-vs-fallback UI copy for writing, reporting, rules, and event bookmarks.

## 2026-07-26

- Initialized the GPT Sites web project.
- Added product and design context derived from the authoritative Bindery documents.
- Added competitive and Behance reference review.
- Adopted the checked-in home and event-detail HTML mockups as visual authority, with a reduced-density home.
- Added event discovery, URL filters, a monthly calendar, ICS, trusted event detail pages, and date-derived application states.
- Added source-aware Notes and News, a read-only Groupbuy board, and a device-local My Binder save/remove flow.
- Added JSON-LD, sitemap, robots, RSS, product metadata, favicon, and a dedicated social preview.
- Added domain, rendered-route, feed, bookmark, and responsive CSS contract tests.
- Fixed mobile event-detail overflow so wide history tables scroll inside their own sheet instead of widening the page.
- Replaced remaining starter package and README identity with Bindery product documentation.
- Added the current Korean date to the home planner.
- Changed absolute SEO and structured-data URLs to use the deployed request origin instead of an example domain.
- Added client-rendered tests for save, same-tab Binder sync, removal, empty state, and blocked-storage feedback.
- Added explicit My Binder feedback when browser storage prevents removal.
- Removed unused authentication, D1, Drizzle, and mutable example API starter surfaces.
- Added reproducible 360px, 768px, and 1280px browser assertions for page overflow, local table/calendar scrolling, home information density, and 44px primary controls.
- Deployed the exact validated source as owner-only GPT Sites version 1 at <https://bindery-korea-info.eiraworks-9813.chatgpt.site>.
- Audited all primary routes at 360px, 768px, and 1280px; removed avoidable
  Groupbuy title wrapping, widened mobile boundary copy, and moved the compact
  header breakpoint before navigation crowding.
- Added an event-context Community tab with reviewed preparation questions,
  field tips, aggregate records, shareable event/kind filters, and explicit
  no-posting/no-DM/no-transaction boundaries.
- Added a typed theme catalog with `리소 원색` and `먹지 교정`, device-local
  persistence, safe invalid-value fallback, and an accessible native selector.
- Added rendered route/filter tests, theme catalog and selection tests, and
  responsive browser coverage for Community and theme controls.
- Deployed the responsive, Community, and theme release to the existing
  owner-only GPT Sites URL and smoke-tested the home and filtered Community
  routes.
- Audited 10 primary routes at 360px, 768px, and 1280px plus all 20 existing
  internal destinations; confirmed no baseline 404 link or page-level overflow.
- Superseded the previous no-board Community decision with two information-first
  free boards split by artist-verification status.
- Added a fail-closed artist-board screen and a public general board with
  category/order filters, example post details, source context, and related Notes.
- Added complete Community write, verification, rules, report-boundary, and
  product-specific 404 screens.
- Added a versioned device-local Community draft with restore, clear, malformed
  value recovery, storage-failure feedback, and explicit non-publishing copy.
- Added labeled fixed-height ad inventory on Home, the Community hub, and the
  general-board feed through one placement catalog, without live ad scripts.
- Enlarged repeated navigation and row targets, corrected Notes/News heading
  hierarchy, and replaced incomplete calendar grid semantics with a simpler
  labeled group.
- Added rendered Community contracts, client draft tests, internal-destination
  crawling, ad reservation checks, and new-route responsive coverage.
- Marked every sample author and activity metric as example data, added
  shared-browser draft warnings and two-step deletion, and excluded non-live
  Community operation and example-post screens from search indexing.
- Preserved keyboard focus through draft-deletion confirmation and added
  keyboard-order/focus-ring browser coverage for representative Community
  navigation, post, and composer actions.
- Deployed the reviewed split-board Community and reserved-ad release as
  owner-only GPT Sites version 5 at
  <https://bindery-korea-info.eiraworks-9813.chatgpt.site>.
- Recorded the approved community backend architecture and its Guarded,
  sequential implementation plan from clean checkpoint `7f4be4a`.
- Defined automatic `임시 승인 · 검수 대기`, seven-day operator review,
  admin-issued invitations, public-general/member-write access, server/RLS
  artist access, minimum public-URL evidence, provisional rate controls,
  moderation, correction, soft deletion, appeal, audit, and development
  retention defaults.
