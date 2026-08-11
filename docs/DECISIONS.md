# Decisions

## D-001 — Information-first authority

Use `기획서_v1.0_정보우선.md` for IA and scope. The community-first v0.3 document is Post-MVP reference only.

## D-002 — Three-ink design authority

Use the latest `DESIGN.md` three-ink Riso palette and Hahmlet / IBM Plex Sans KR / Space Mono system. Do not use the superseded cream/terracotta tokens embedded in older planning and backend prompts.

## D-003 — GPT Sites runtime

Use the GPT Sites vinext/React starter because the user explicitly requested GPT Sites deployment. The public information and SEO contracts are preserved in server-rendered routes. This is a deliberate runtime deviation from the original SvelteKit recommendation, not an unnoticed rewrite.

## D-004 — Safe functional boundary

Implement event discovery, query-state filters, calendar, detail, ICS, notes, news, bookmarks, and read-only Groupbuy status. Keep bookmarks device-local for this deployable version. Do not simulate real payment, settlement, approval, or legal acceptance.

## D-005 — Reference boundary

Behance and competitor work are loose inspiration. Bindery keeps its own three-ink work-order identity and does not copy ticketing layouts, imagery, or branding.

## D-006 — HTML-mockup visual authority with a calm home

The checked-in `bindery/02_디자인/mockup_home.html` and `mockup_event-detail.html` are the visual source of truth. The home page intentionally exposes only the mockup hero, three upcoming deadlines, and five text index links: Events, Notes, Groupbuy, News, and Community. Filters, calendar data, and comparison data live on their own routes. Diary and stationery character comes from the mockup's stock/sheet surfaces, rules, dates, and typography rather than decorative texture or stacked paper effects.

## D-007 — Local scroll ownership for wide information

Wide event-history tables and month calendars keep their intrinsic comparison width, but their immediate sheet owns horizontal scrolling. They must not widen the page shell or create page-level horizontal overflow at 360px.

## D-008 — Request-derived public origin

Metadata, sitemap, robots, and Article JSON-LD derive their absolute origin from the incoming forwarded host and protocol. A configured public origin is only a fallback; production output must never default to an example domain.

## D-009 — Accountless source boundary

The deployed source contains no unused ChatGPT authentication, D1, Drizzle, or mutable example API scaffold. Device-local bookmarks remain the only user state until the product explicitly adopts an authenticated or persistent server-side feature.

## D-010 — Event-context Community, not a free board

**Superseded by D-013.**

Keep v1.0 as the product authority: do not add a free-form board because its
management cost exceeds its information value. Borrow only the archived v0.3
event-room principle, so `/community` accumulates operator-reviewed preparation
questions, field tips, and aggregate records under a named event. Direct
posting, DM, transactions, and raw unreviewed feedback remain out of scope.

## D-011 — Typed theme catalog as the visual-token authority

Keep the current three-ink identity as the default `리소 원색` theme and offer
`먹지 교정` as a restrained alternative. `app/lib/themes.ts` is the only
source for visual color and font-role values. Components consume generated CSS
variables; the selector stores only a validated theme ID on the device.

## D-012 — Responsive structure changes before text is squeezed

At 360px, 768px, and 1280px, primary routes must not create page-level
horizontal overflow. Navigation changes to its compact structure before labels
crowd, multi-column ledgers collapse before headings fragment unnecessarily,
and long trust or boundary copy receives at least a useful mobile measure.
Wide comparison tables and calendars continue to own intentional local scroll.

## D-013 — Information-first free boards split by artist verification

The user's corrected direction supersedes D-010's no-board policy. Community is
now a free-board product with two independent URLs:

- `작가 인증 게시판`: active provisional/verified artists participate; active
  moderators and admins may read for operations but write only with their own
  active artist status.
- `모두의 게시판`: readable regardless of artist-verification status.

“Information first” no longer means forbidding a board. It means practical
categories precede casual chat, questions expose resolution state, factual posts
can carry source and confirmation dates, and durable answers can later graduate
to operator Notes. Artist verification signals activity eligibility only and
must not look like factual verification.

Until a real session and authorization layer exists, the artist board fails
closed and exposes no post titles, bodies, or authors. Query values, URL changes,
visual badges, and browser storage never grant artist access.

## D-014 — Complete prototype destinations without fake live service

Every visible Community action must resolve to a real screen or an observable
device-local action. The prototype therefore includes board, post, write,
verification, rules, reporting-boundary, and recovery screens. The write screen
stores one versioned draft in the current browser; it does not claim to publish
or submit. The draft is not encrypted or automatically expired, so the write
screen warns about shared browser profiles and extensions, requires a second
action before deletion, and tells users to clear it after work. The report
screen explains scope but sends nothing until durable intake, moderation
history, and operator notification exist. Locked, write, verification, report,
and example-post routes stay out of the sitemap and carry `noindex` metadata
until their real service boundaries exist.

## D-015 — Catalog-driven reserved ad inventory

Reserve future ad inventory with one `AD_PLACEMENTS` catalog and one `AdSlot`
component. Slots use the literal label `광고`, stable minimum heights, theme
roles, and non-interactive placeholder copy. Place them only on Home, the
Community hub, and within the general-board feed, away from navigation and
primary actions. Do not place ads on writing, verification, lock, error, or
official deadline decision screens. No live provider script or tracking is
included.

## D-016 — Automatic provisional artist access with later review

A valid minimum-data artist application receives `provisional` access in the
same server operation and enters an operator queue. The product-facing label is
always `임시 승인 · 검수 대기`; it must not look like completed identity or
information verification. The review target is seven days. Provisional artists
may read the artist board and, by default, create one post and five comments per
24 hours until review.

The first release collects a public activity name, one normalized public proof
URL, activity field, and current policy acceptance. It does not collect identity
documents, business-registration files, addresses, telephone numbers, or
private attachments. Rejection, suspension, and revocation remove
artist-participation read/write access on the next server authorization check;
an active operator's separate moderation read authority is role-derived.

## D-017 — Separate account role, artist state, and database authorization

Account roles are `member`, `moderator`, and `admin`; artist status is a
separate `provisional`, `verified`, `rejected`, `suspended`, or `revoked`
lifecycle. The general board is public to read and requires an active member to
write, comment, bookmark, or report. The artist board requires an active
provisional or verified artist to write. Active moderators and admins may read
it for operations, but their role alone never grants artist-board post or
comment creation.

Server operations and Postgres Row Level Security both deny by default. Browser
storage, URL/query values, visual badges, and client-provided roles never grant
access. Privileged mutations require an actor and reason and append audit
history. Only admins may finalize artist verification or issue the first
release's single-use operator invitations.

## D-018 — Moderation and retention precede live UGC

Live posting requires durable report intake, operator notification, reasoned
hide/lock/restore actions, soft deletion, correction history, appeal state, and
append-only audit records. Development retention defaults and response targets
live in `docs/COMMUNITY_OPERATIONS.md`; they remain product-owner and legal
inputs until the privacy policy is approved. Live ads, DM, transactions,
identity documents, and file attachments remain out of scope.

## D-019 — Verified Supabase claims and fail-closed runtime configuration

Supabase public URL and publishable key are the only browser-visible backend
configuration. Both must be present and valid before sign-in is offered. A
missing, partial, or invalid configuration keeps public information readable
but leaves every member mutation and artist-board data path closed.

Server authorization validates the access token with `getClaims()` and then
loads profile, account role, and artist status from protected database rows.
It never authorizes from `getSession()` user data, JWT role claims supplied by
the client, URL/query values, or browser storage. Authentication callback
responses are private/no-store, and service-role credentials never use a
`NEXT_PUBLIC_*` variable or enter browser code.

## D-020 — Minimum-data provisional approval and revocable invitations

Artist applications accept only a public activity name, activity field, public
proof URL, optional public URL/note, current policy consent, and a server-checked
Turnstile token. The server normalizes and deduplicates proof URLs, consumes a
database rate-limit record, and creates `provisional` access idempotently in one
database operation. The visible state remains `임시 승인 · 검수 대기` until an
admin records a reasoned review decision.

Admin invitations use a hashed, seven-day, single-use token bound to the target
email. The raw acceptance URL is displayed only at issuance. A pending link can
be cancelled only by an admin with an explicit confirmation and reason; a
cancelled link cannot be restored, but a replacement invitation may be issued.
Review, acceptance, and cancellation remain server/RLS enforced and append
actor, target, time, before/after state, and reason to audit history.

## D-021 — Durable rows only when the community backend is configured

The general board keeps the curated example ledger and device-local composer
only while Supabase public configuration is absent. Once configured, lists and
details use authorized Postgres rows exclusively; an empty database renders an
empty state, and a read failure renders an error instead of silently mixing in
examples. Member mutations pass through same-origin no-store server routes and
are independently constrained by RLS.

Post creation stores a published post and optional normalized source in one
database operation. Comments, account Binder saves, and reports are recipient
or actor scoped. Soft deletion preserves a reasoned revision while removing the
post from public reads. Repeated active reports by the same member, target, and
reason return the existing intake rather than creating parallel work.

## D-022 — Protected artist rows and scoped moderation are database contracts

Artist-board authorization applies to list, detail, post, comment, source,
bookmark, report, and author-update paths. Losing provisional/verified status
removes access even to the former artist author's own protected rows. For
provisional artists, a rolling 24-hour limit of one post and five comments is
shown in the UI, checked by the service, and enforced again by serialized
database triggers so parallel requests cannot bypass it.

Moderators may triage, dismiss, hide, lock, and restore reported content with a
reason. Account suspension and appeal resolution require an admin. Report and
post transitions happen in one database operation; every action adds a new
`moderation_actions` row, while report changes also append immutable audit
events. Member and signed-out responses contain no queue or audit payload.

## D-023 — Resolved community knowledge keeps immutable provenance

Source freshness is computed from an explicit confirmation date and validity
window rather than a visual badge alone. Only the question author may accept a
published answer, and accepting it marks the post resolved in the same database
operation. Authors or operators may connect a maintained event identifier, but
the server accepts only identifiers from the product event catalog.

Only an operator may promote a resolved, publicly visible, sourced general-board
question to a maintained Note. Promotion snapshots the original post body,
accepted answer, source URL/check date, original author identity, operator, and
promotion time. Artist-board and hidden content cannot enter the public Note
catalog through this path.

## D-024 — Authorization precedes discovery, delivery, and account merge

Community search computes the caller's readable boards before the database may
rank rows, and the database repeats the board, published-state, deletion, and
RLS checks. Korean text uses the built-in PostgreSQL `simple` configuration for
the first release; a separate search provider requires measured query evidence
and a new privacy/authorization review.

Replies, answer acceptance, verification decisions, moderation outcomes, and
appeal outcomes create idempotent in-app notifications. Listing and read-state
mutation are recipient-only database contracts. External email delivery is not
part of this slice and must not be inferred from an in-app row.

My Binder keeps device-local behavior for guests and adds an explicit merge for
active signed-in members. Merge is idempotent, validates protected post
readability, reports partial failure, and never automatically deletes the local
collection. External Supabase binding, hosted authenticated E2E, backup/restore,
privacy/legal approval, and live advertising remain separate production gates.

## D-025 — Sensitive lifecycle mutations use narrow server/database entrypoints

Artist application is the one community mutation that requires a Supabase Edge
Function. The Function authenticates the caller, requires explicit policy
consent, verifies the single-use Turnstile token exactly once, and then calls a
service-role-only transactional RPC. The Sites runtime never receives the
service-role key or Turnstile secret, and authenticated clients cannot insert a
provisional verification or call the legacy submission/rate RPC directly.

Posts, comments, sources, revisions, bookmarks, reports, moderation actions,
accepted answers, knowledge promotion, notification read state, and invitation
acceptance use narrow RPCs for supported mutations. Database time, not a caller
timestamp, controls limits, audit time, invitation expiry, and appeal deadlines.
Raw lifecycle DML is revoked even where older RLS policies remain as defense in
depth.

An appeal belongs to the author affected by a hide, lock, or account suspension.
Its reason is stored outside the reporter-readable report row, the database
enforces the 14-day window, and only an admin resolves it. Account suspension
and reversal also write account-targeted immutable audit events.

## D-026 — Corrections, pagination, and reversals preserve causal history

Post correction is a narrow authenticated RPC. An author may correct a live
post with a reason; an operator may additionally append a newly checked public
source. The old title and body are copied to an immutable revision before the
post changes, and source rows are appended instead of overwritten. Public
views select the latest checked source, so provenance remains inspectable.

Community feeds use opaque keyset cursors over search rank, database update
time, and post ID. The application resolves readable boards before search, and
the database repeats published/deleted/RLS constraints before applying the
cursor. Offset pagination is not used for mutable community feeds.

Invitation creation and exact seven-day expiry originate from one database
clock. Community event references must exist in a private service-maintained
allowlist that mirrors the product catalog. Each appeal stores the exact hide,
lock, or account-suspension action being challenged; resolving it may reverse
only that still-effective restriction and never a later moderation action.

## D-027 — Read, write, consent, and reversal authority stay separate

Operator visibility of the artist board does not imply artist write authority.
The database uses a separate write predicate that requires an active member and,
for the artist board, that member's own provisional or verified artist state.
Artist applications are readable only by the applicant or an admin; moderators
operate content and reports without enumerating application notes.

Invitation acceptance requires explicit consent to the current community policy
before either the invite, verification, or acceptance ledger changes. Artist
review and invitation revocation times come from the database clock. Application
idempotency is serialized per user and key before rate-limit mutation, so a
concurrent replay returns the original application instead of consuming another
attempt.

Public revision history exposes editor, reason, and time metadata but not the
prior title or body snapshot. Normal restore and appeal acceptance reverse only
the exact still-effective restriction; appeal rejection closes the case while
preserving it. Event Binder writes are catalog-bound, idempotent, active-member
RPCs capped at 100 rows per account, while legacy references are preserved and
classified during migration.

## D-028 — Interface copy states the task or the boundary once

Public pages use short task descriptions and noun-phrase indexes instead of
repeating the product philosophy above each section. The Community hub no
longer explains its information architecture in a separate principles panel;
the board labels, filters, states, and source fields demonstrate that structure.

Source freshness, example-data status, official-link checks, permissions,
moderation consequences, and device-local storage risks remain explicit where
the user makes a decision. Notices use the same complete rule and sheet
vocabulary as the rest of Bindery rather than a decorative colored side stripe.

## D-029 — Official facts and local experience research use separate pipelines

Publishable event data is keyed by EventMaster and EventEdition, and every
critical field carries FieldEvidence linked to an allowlisted SourceRecord.
S1 organizer sources may support dates, applications, fees, selection, refunds,
and operations; S2 venue/public sources may support venue identity and address.
Automatic fetching records source availability, normalized hashes, and recheck
dates, but cannot promote an edition beyond `editor_checked` or invent a field.

Unknown quantities and requirements remain `null`; zero and false are reserved
for explicit official facts. A capacity-based final deadline is not replaced by
an early-discount date. Generated JSON and TypeScript must be deterministic and
checked for staleness before release.

Participant and seller experience material is S5 and never supports a public
event field. It is stored only under Git-ignored `content-local/reviews`, uses
hashed author identifiers, and has no public count or aggregate. The official
report and generator do not read the local review store; a guard blocks local
paths, raw reviews, and nonzero review counts from publishable artifacts.

X collection uses the official API only. Active but unofficial tools such as
`twscrape` and Twikit were evaluated as implementation references but rejected
from the runtime because they automate non-API site endpoints. ArchiveBox is a
separate local evidence vault for already acquired public URLs, not an alternate
X collector. Collector activation, API credentials, public use, or quotation
requires a separate operating decision.

## D-030 — Approved local twscrape and static GitHub Pages preview

The product owner's 2026-08-03 approval supersedes D-029 only where it limited X
collection to the official API. Pin `twscrape==0.19.2` in a Python 3.10+ local
environment and run it only through the explicitly named `manualOnly` collector.
Its account SQLite database, cookies, raw text, author pepper, normalized records,
and reports remain under Git-ignored `content-local/reviews`. They never enter the
official generator, public counts, search index, GitHub Actions, or Pages artifact.
The official X API remains available as the lower-policy-risk alternative.

Because the current vinext application requires a server runtime, GitHub Pages is
a static product preview rather than a substitute production deployment. Export
public information pages, assets, ICS, RSS, robots, and sitemap under the
`/Bindery-web` project path; remove application JavaScript and visibly label
login, save, write, and server mutations as unavailable. A later custom-domain
production deployment must restore an actual server runtime and re-run hosted
authentication, authorization, and mutation proof.

## D-031 — Event-first navigation, restrained palette, and honest locale shell

The 2026-08-03 WebGPT Pro review confirmed that the strategy was already
event-first while the global navigation still gave Groupbuy and Community equal
weight. Make event search, comparison, edition history, and preparation Notes the
four primary destinations. Keep News, calendar, and Community as supporting
navigation. Retain the Groupbuy route only as noindexed source for later policy
work and omit it from navigation, sitemap, and static deployment.

Use one four-role palette: Surface `#F4F3EF`, Ink `#1B1D2A`, Structure Blue
`#3D5588`, and Deadline Pink `#FF48B0`. Derived rules and muted text may mix those
roles, but pink is not body text, a focus color, or the only status signal.

Add Korean, English, Japanese, and Simplified Chinese interface-shell choices
using self-named language labels. Until translated event data exists, only shared
navigation and controls change. Keep the page language Korean and state that event
names and bodies remain Korean originals; a locale preference must not imply a
translation that does not exist.

## D-032 — Large discovery batches remain quarantined until editor promotion

Model-assisted web research may discover EventMaster, EventEdition, and
SourceRecord candidates at a larger scale than the maintained public registry.
Preserve each received batch exactly with file hashes and provenance, but keep
it under `content/research/` with `research_candidate`, `needs_source`, and
`existing_overlap` states. The public generator, comparison, feeds, and
Community event allowlist must not read this directory.

Candidate validation checks JSONL parsing, IDs, references, evidence backlinks,
dates, source tiers, canonical HTTPS URLs, existing-series overlap, and the
received artifact hashes. A separate live GET audit records reachability because
a source URL that existed during research can later fail, redirect, or block an
automated client. HTTP and fetch failure do not prove that an event is fictional,
but they block automatic promotion until an editor reopens or replaces the source.

The editor-review queue may rank reachable candidates by evidence and populated
fields, but its score is operational triage rather than product quality or
publishability. Promotion still requires manual S1/S2 review, normalization to
the public schema, complete critical FieldEvidence, an accessible collected
source record, and the existing deterministic content gates. Unknown official
facts remain unknown rather than being inferred to satisfy the schema.

## D-033 — Source-checked editions may precede field-complete editor review

The product owner's 2026-08-05 instruction supersedes D-032 only where it kept
all normalized candidates out of public generation until full field review.
Normalize the complete research bundle into canonical EventMaster, EventEdition,
and SourceRecord collections. A candidate edition may enter the public catalog
as `source_checked` when its master is not `needs_source`, its primary source is
S1 or S2, every linked source passed the recorded accessibility check, and both
event dates are present. `editor_checked` remains a separate, stronger state.

Source accessibility proves that an official URL can be reached, not that every
structured value received human review. Public source-checked screens therefore
name the pending review state, link the official original, and render unknown
deadlines, fees, venues, booth sizes, selection methods, refunds, and operations
as `정보 없음`. They must not infer placeholder prices, dates, requirements, or
application state. Undated editions, `needs_source` masters, non-S1/S2 primary
sources, and editions with any inaccessible linked source remain normalized but
held from public generation.

Keep one generated review report separating held editions from public-but-
incomplete editions. The calendar and ICS omit unknown application deadlines;
comparison summaries exclude unknown fees and deadlines from leader claims; the
account Binder allowlist follows exactly the generated public event IDs.

## D-034 — International event batches preserve local facts without conversion

Register international research as independent hash-verified candidate batches
instead of mixing hand-edited rows into the domestic artifact. Each edition
stores ISO country code, Korean country label, city, IANA time zone, source
language, and the official local-language name when available. Search results
may locate a page, but only reachable S1/S2 organizer, association, venue,
official factsheet, or public trade-show authority pages support publication.

Keep fees in their stated ISO 4217 currency and original amount. Do not invent a
KRW conversion, compare unlike currencies for a lowest-fee claim, or treat a
visitor ticket as an exhibitor booth fee. A confirmed event date and reachable
official source can produce `source_checked`; unknown exhibitor deadlines,
selection, tax treatment, refund policy, and onsite operations remain null and
enter the separate international review report.

An adjacent creator market may enter this batch when its official material
explicitly supports original art, stationery-adjacent goods, illustration, or
handmade sales. Store it as a broad `복합` event and state that boundary in its
summary; do not relabel it as a stationery-only fair. Design Festa vol.64 is the
first application of this rule.

## D-035 — Creator operations expand as four evidence-separated production layers

After event coverage, expand Notes and tools through one four-layer production
decision chain: normalized print/finishing specifications, versioned provider
claims for fully specified offerings, public packing/shipping rules, and
scenario-based inventory/cost/profit calculation. Do not
start with a broad vendor directory, generic legal chatbot, or opaque creator
ranking. The first release must prove source coverage and change handling for a
complete creator workflow rather than maximize record count.

Use a creator-operations source taxonomy separate from event S1–S5. `G1` law and
official procedures, `G2` public-agency guidance, `V1` vendor/platform public
claims, `V2` authenticated or contracted user values, and `E1` creator experience
remain distinct records and visual states. Search results and model extractions
are unpublishable candidates. A public number must retain its publisher, option
signature, effective date, checked date, and exceptions; a calculation must expose
its public sources, private inputs, and assumptions.

Logged-in quotes, seller dashboards, personal tax/registration material, private
contracts, and raw creator reviews are not collection targets. Automatic fetching
may cache and hash permitted public HTML/PDF/API sources, but changes only create
review work. High-risk tax, safety, rights, certification, and fee content becomes
stale when its check window expires and never produces a personalized legal,
tax, safety-conformity, or trademark-availability conclusion. Seller/tax,
product-safety, rights, marketplace-fee, and ecommerce-obligation topics remain
P1 official-source checklists until those conditional review paths are proven.

## D-036 — High-risk creator guidance is a dated source register, not a ruling

Tax and customs guidance may enter Notes before the broader creator-operations
schema only as a manually reviewed, source-traceable guide. Each guide must show
its audience, check date, conditional facts, action sequence, warning ledger,
checklist, official source register, and recheck cadence. It must not calculate
a user's tax, decide an HS code, guarantee zero-rating, or promise destination
duty treatment.

Postal acceptance, Korean export declaration/evidence, and destination import
tax are separate layers. Country examples are dated watchlist entries, not a
single global rule; terminology uses current Incoterms such as DAP/DDP rather
than the obsolete DDU label. Changes to high-risk sources create review work and
an expired check window must be visible as stale before the guide is reused.
