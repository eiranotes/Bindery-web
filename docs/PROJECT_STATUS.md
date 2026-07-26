# Project Status

## Current state

The GPT Sites vinext implementation now includes a responsive text-flow pass,
an event-context Community route, and a catalog-driven theme selector. The
implementation is verified locally at 360px, 768px, and 1280px. The existing
site remains owner-only at
<https://bindery-korea-info.eiraworks-9813.chatgpt.site>.

## Completed

- Read all Markdown and HTML documents in the source package.
- Established v1.0 information-first planning as product authority.
- Established the three-ink `DESIGN.md` as visual authority over the superseded cream/terracotta tokens.
- Reviewed current competitors and Behance references.
- Created `PRODUCT.md`, `DESIGN.md`, and a revised low-density north-star UI mock.
- Fixed the home-page acceptance criterion at three upcoming deadlines and four understated section links.
- Implemented shared three-ink UI primitives and date-derived event state.
- Implemented event filters, calendar, detail history, official-source notices, ICS, Notes, News, read-only Groupbuy status, and device-local My Binder.
- Added Event and Article JSON-LD, sitemap, robots, RSS, product metadata, and a dedicated social preview.
- Verified URL-backed filtering and the complete save/remove Binder flow in the browser.
- Added client-rendered coverage for the same save/sync/remove flow and restricted-storage failure feedback.
- Verified 360px, 768px, and 1280px layouts with no page-level horizontal overflow and fixed the event-detail table containment regression found at 360px.
- Removed avoidable three-line Groupbuy headings at tablet and desktop widths,
  widened mobile trust/boundary copy, and moved navigation to its compact
  structure before labels crowd.
- Added `/community` as a moderated event-context catalog for preparation
  questions, field tips, and aggregate review records, with URL-backed event
  and kind filters.
- Kept the v1.0 no-board policy: Community exposes no direct posting, DM,
  transaction, or raw unreviewed feedback flow.
- Added two catalog-driven themes with complete role tokens, device-local
  selection, invalid-value recovery, and an accessible 44px native selector.
- Replaced example-domain SEO output with request-derived production origins and removed unused auth/database starter surfaces.
- Added a reproducible Playwright viewport gate for home density, touch targets, and locally owned wide-data scrolling.
- Saved and deployed the exact validated commit as GPT Sites version 1.
- Confirmed the production deployment status and the rendered Bindery home through the Sites deployment screenshot.

## Next

- Replace curated sample content with product-owner data and complete legal/privacy policy work.
- Define moderation intake, correction, and source-verification operations
  before accepting any real community submissions.
- Decide whether to keep owner-only access or explicitly approve a wider audience.

## Known risks

- The Bindery name conflicts with an existing desktop writing app; the private production site keeps the working name but does not claim a final domain.
- Real event data, legal terms, privacy policy, and Groupbuy policy remain product-owner inputs.
- Community records are curated product-validation examples, not live user
  submissions or verified operational guidance.
- The original plan named SvelteKit and Supabase. GPT Sites deployment uses the generated vinext/React runtime; this implementation preserves the product contracts but does not pretend a Supabase production backend exists.
