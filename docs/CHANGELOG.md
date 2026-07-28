# Changelog

## 2026-07-28

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
