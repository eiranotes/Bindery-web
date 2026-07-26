# Project Status

## Current state

The GPT Sites vinext implementation includes an information-first Community
prototype split into an artist-verified board and a general board, a
catalog-driven theme selector, complete Community destination screens, and
reserved ad inventory. The previous production deployment remains owner-only at
<https://bindery-korea-info.eiraworks-9813.chatgpt.site>; the current Community
release is awaiting final review and redeployment.

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
- Deployed the reviewed responsive, Community, and theme release to the
  existing owner-only GPT Sites project and confirmed the home and filtered
  Community routes from production.
- Replaced example-domain SEO output with request-derived production origins and removed unused auth/database starter surfaces.
- Added a reproducible Playwright viewport gate for home density, touch targets, and locally owned wide-data scrolling.
- Saved and deployed the exact validated commit as GPT Sites version 1.
- Confirmed the production deployment status and the rendered Bindery home through the Sites deployment screenshot.

## Next

- Replace curated sample content with product-owner data and complete legal/privacy policy work.
- Choose and implement authenticated user/artist roles and the minimum-data
  artist verification workflow.
- Implement durable posts, replies, report intake, moderation states, rate
  controls, deletion/appeal history, and UGC link handling before live posting.
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
- The artist-board boundary is visually and semantically fail-closed but has no
  real session or authorization backend yet.
- Community writing stores one draft only in the current browser and does not
  publish, sync, or submit it. It is not encrypted or automatically deleted, so
  shared-browser users must clear it manually.
- Ad spaces are placeholders. No provider, consent flow, measurement, or live
  ad code is connected.
- The original plan named SvelteKit and Supabase. GPT Sites deployment uses the generated vinext/React runtime; this implementation preserves the product contracts but does not pretend a Supabase production backend exists.
