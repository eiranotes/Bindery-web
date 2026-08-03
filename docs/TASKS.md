# Tasks

- [x] Reconcile all source documents and identify authority.
- [x] Review competitors and Behance references.
- [x] Establish product and design context.
- [x] Implement shared information architecture and design primitives.
- [x] Implement event discovery, filters, calendar, detail, and ICS.
- [x] Implement Notes, News, Groupbuy information, and My Binder.
- [x] Implement SEO metadata, structured data, sitemap, and RSS.
- [x] Verify build, tests, accessibility, responsive behavior, and browser interactions.
- [x] Save and deploy a GPT Sites production version with owner-only access.
- [x] Audit primary routes at 360px, 768px, and 1280px and correct avoidable
  text crowding.
- [x] Add a typed theme catalog with a device-local accessible selector.
- [x] Add an event-context Community route with event/kind URL filters and
  explicit moderation boundaries.
- [x] Add rendered, client, and Playwright coverage for the new contracts.
- [x] Audit all current destinations and primary responsive routes before
  changing the Community product policy.
- [x] Split Community into a fail-closed artist board and a public general board.
- [x] Add real post detail, write, verification, rules, report-boundary, and
  404 destination screens.
- [x] Add a versioned device-local Community draft with honest live-service boundaries.
- [x] Add labeled fixed-height ad inventory through one placement catalog.
- [x] Add Community destination crawling, route rendering, local draft, ad
  reservation, touch-target, and responsive coverage.
- [x] Correct repeated touch targets, Notes/News heading levels, and calendar semantics.
- [x] Remove false sample identity signals, add two-step draft deletion and
  shared-browser warnings, and keep non-live Community routes out of search.
- [x] Complete whole-implementation review, fresh release verification, and the
  owner-only Sites deployment for the split-board Community release.
- [x] Approve the Supabase Auth/Postgres/RLS backend direction and create a
  Guarded sequential implementation plan from clean checkpoint `7f4be4a`.
- [x] Define automatic provisional approval, later operator review, operator
  invitations, access roles, minimum-data evidence, moderation, deletion,
  appeal, audit, and development retention policy.
- [x] Implement the typed community authorization and lifecycle domain contract.
- [x] Create the Supabase schema and pass real local Postgres/RLS tests.
- [x] Integrate server-validated sessions while preserving unconfigured
  fail-closed behavior.
- [x] Implement provisional artist applications, operator review/revocation,
  and single-use operator invitations with cancellation and audit history.
- [x] Persist the general board, sources, comments, Binder saves, soft deletion,
  and report intake with an honest unconfigured fallback.
- [x] Persist the protected artist board and enforce provisional-artist post and
  comment limits without leaking rows after revocation.
- [x] Add the operator moderation console, scoped actions, and append-only audit
  views.
- [x] Add knowledge freshness, accepted answers, event links, and
  provenance-preserving promotion to maintained Notes.
- [x] Add authorization-aware search, recipient-scoped in-app notifications,
  and explicit lossless Binder account sync.
- [x] Close direct provisional-access and broad content-DML bypasses, use
  database time, add private affected-author appeals, and verify unique
  migration versions plus real Binder RLS.
- [x] Add reasoned post corrections with immutable snapshots, operator source
  rechecks, stable keyset pagination, database event allowlisting, exact
  database-time invitation expiry, and action-bound appeal reversal safety.
- [x] Close final review gaps for artist-board write separation, applicant-row
  privacy, appeal rejection/causal restore, invitation consent and chronology,
  concurrent application idempotency, capped event Binder writes, private
  revision bodies, deterministic Note provenance, and configured error states.
- [x] Audit the full public UI, remove redundant product-explanation copy, and
  retain only actionable source, safety, permission, and storage guidance.
- [x] Create and connect the `eiranotes/Bindery-web` GitHub source repository for
  the validated nested `website/` checkout.
- [x] Reframe the product strategy around a verified creator-event database,
  with Community and editorial surfaces as supporting knowledge layers.
- [x] Add a shareable, server-rendered three-event comparison route.
- [x] Add an event-series edition archive derived from the maintained event
  collection and its history records.
- [x] Move Home and Events entry actions toward comparison, archive, and current
  deadline decisions while preserving the calm five-index home.
- [x] Add comparison and archive routes to the sitemap and repository README.
- [x] Record the data operating model, metrics, phased roadmap, launch gates,
  monetization boundaries, and AI prerequisites.
- [x] Complete a source-based UI/UX audit across the design system, primary
  routes, trust boundaries, responsive contracts, and event decision flows.
- [x] Add comparison decision summaries, early data-state disclosure,
  keyboard-focusable table regions, mobile scroll cues, and sticky row labels.
- [x] Add scalable archive wayfinding, current-edition labels, and UI release
  gates in `docs/UI_UX_AUDIT_2026-08-02.md`.
- [x] Review the existing WebGPT Pro content-categorization plan and obtain a
  fresh Pro boundary review for the concrete repository.
- [x] Build official-source collection, evidence classification, validation,
  deterministic generation, recheck queue, Markdown reporting, and leak guards.
- [x] Collect and publish the first official batch: 2026 Illustration Korea
  Seoul aT, Incheon, and Suwon, backed by 11 S1/S2 source records.
- [x] Build the separate local-only X API/JSONL review pipeline and ArchiveBox
  handoff without public output.
- [x] Pin and integrate `twscrape` as a manually selected local-only collector,
  verify its isolated Python environment, and compare maintained alternatives.
- [x] Build a GitHub Pages static preview artifact and main-branch deployment
  workflow with explicit non-functional server/user-action boundaries.
- [x] Deploy the public Pages preview and smoke-test the hosted home, event list,
  comparison, archive, ICS, desktop, and mobile surfaces.
- [x] Create the WebGPT `Bindery-web` project, upload the product/design/source
  brief, and obtain a fresh Pro-model implementation review.
- [x] Make event search, comparison, edition archive, and preparation Notes the
  four primary destinations; demote Community and hide Groupbuy from discovery.
- [x] Replace the theme selector with an honest Korean/English/Japanese/Chinese
  shell locale skeleton and preserve Korean as the untranslated content language.
- [x] Reduce the UI to Surface, Ink, Structure Blue, and Deadline Pink base roles.
- [x] Re-run content, type, build, 108 Node, 29 client, 31 browser, static Pages,
  and 360/768/1280 visual gates for the event-first release.
- [ ] Restore owner management access to the existing GPT Sites project and
  deploy the current `main` without changing its owner-only access policy.
- [ ] Add an approved X account cookie interactively to the ignored twscrape DB
  (or provision an X API token), then perform the first private review collection.
- [ ] Approve and execute external Supabase/Turnstile provisioning, hosted
  runtime binding, backup/restore rehearsal, and authenticated production E2E.

## Event-data roadmap

- [ ] Split `EventMaster`, `EventEdition`, and `SourceRecord` into explicit
  domain types and canonical data collections.
- [ ] Separate product-validation examples from verified public event records.
- [ ] Add the first verified batch of 20 real event masters and their available
  historical editions.
- [ ] Reach 50 event masters and 120 editions with official-source coverage and
  freshness tracking.
- [ ] Add domain tests for archive deduplication, edition ordering, and compare
  selection normalization.
- [x] Add Playwright coverage for `/events/compare` and `/events/archive` at
  360px, 768px, and 1280px, including local table scrolling.
- [ ] Add event-data status labels for example, verified, stale, superseded, and
  archived records.
- [ ] Add operator source-review and correction workflows before automated
  event ingestion.
- [ ] Add image provenance and rights metadata before publishing posters or
  venue photographs.

## Deferred by product policy

- Payment or settlement mediation.
- Public Groupbuy posting before terms, approval, and reporting policy review.
- Raw review publication or aggregate access below N=5.
- DM, transactions, and unmoderated raw feedback.
- Live advertising, consent, tracking, and provider integration.
- Identity-document and private attachment collection.
- Member-issued invitations and referral rewards.
- Automated scraping that publishes event facts without operator review.
- Generic AI recommendations before verified event coverage and evaluation data.
- Discovery crawling outside the explicit official-source allowlist.
- Final legal terms, privacy policy, and a permanent domain.
