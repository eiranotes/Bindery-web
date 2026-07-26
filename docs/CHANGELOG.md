# Changelog

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
