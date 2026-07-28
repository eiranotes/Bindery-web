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
Supabase session boundary. The local backend now also implements automatic
provisional artist applications, later admin review, single-use operator
invitations, invitation cancellation, and append-only audit evidence. No
production Supabase project or Sites runtime configuration has been created.

## Completed

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

## Next

- Replace curated sample content with product-owner data and complete legal/privacy policy work.
- Add knowledge freshness, accepted answers, event links, and provenance-safe
  promotion from resolved discussions to maintained Notes.
- Add authorization-aware search, recipient-scoped notifications, explicit
  Binder account sync, and the final setup/operations reconciliation.
- Define correction, source-verification, privacy, and legal operations before
  accepting any real Community submission.
- Select an ad provider only after consent, privacy, content suitability, and
  production placement review.
- Decide whether to keep owner-only access or explicitly approve a wider audience.

## Known risks

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
- Community writing stores one draft only in the current browser and does not
  publish, sync, or submit it. It is not encrypted or automatically deleted, so
  shared-browser users must clear it manually.
- Ad spaces are placeholders. No provider, consent flow, measurement, or live
  ad code is connected.
- The original plan named SvelteKit and Supabase. GPT Sites deployment uses the generated vinext/React runtime; this implementation preserves the product contracts but does not pretend a Supabase production backend exists.
- The seven-day review, moderation response, appeal, and development retention
  values are implementation defaults, not published legal terms. Product-owner
  privacy/legal approval is still required before real submissions.
