# Bindery Community Backend Implementation Plan

> **For Arc:** Use /arc:implement. Build agents report DONE,
> DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED, or AUTH_GATE.

**Feature spec or source:** `docs/arc/specs/2026-07-26-bindery-community-backend-spec.md`; approved user direction in the current task; `PRODUCT.md`; `docs/DECISIONS.md`
**Goal:** Add a secure, auditable backend for member posting and automatically provisional, operator-reviewed artist access while preserving the existing information-first frontend and fail-closed behavior.
**Stack:** vinext/React 19, TypeScript, Node test, Vitest, Playwright, npm, Supabase Auth/Postgres/RLS, isolated local PostgreSQL 17 verification
**Planned at:** 7f4be4a
**Plan schema:** 2
**Planned assurance:** Guarded
**Effective assurance:** Guarded
**Assurance rationale:** The work introduces authentication, authorization, schema and durable user data, artist-only content, UGC, moderation, privileged operations, and a new external backend boundary. The highest-risk auth, permission, and data signals require Guarded assurance.
**Out of scope:** Direct messages, identity-document uploads, payments, settlement, member-issued invitations, public group-buy intake, rankings, real-time chat, live ads, wider production access, and GitHub push.

## File structure

- `docs/COMMUNITY_OPERATIONS.md` — operator rules, review targets, retention,
  correction, deletion, appeal, and incident handling.
- `app/lib/community-access.ts` — pure role, artist-status, and content-state
  authorization rules shared by UI/server boundaries.
- `supabase/migrations/**` — enums, tables, constraints, indexes, seed boards,
  helper functions, grants, and RLS policies.
- `scripts/test-community-db.sh` — isolated local PostgreSQL cluster, Supabase
  role/auth-function bootstrap, migrations, and executable RLS assertions.
- `app/lib/supabase/**` — environment validation and browser/server clients.
- `app/lib/server/community/**` — authenticated commands for verification,
  invitations, posts, comments, reports, and moderation.
- `app/auth/**`, `app/community/**`, `app/admin/community/**` — member,
  artist, and operator flows.
- `tests/**` — domain, schema, server-operation, rendered-route, and browser
  evidence.
- `README.md`, `PRODUCT.md`, `docs/*.md` — setup, decisions, status, tasks,
  change history, and known external gates.

<seams>
  <seam id="access-policy">
    <interface>Community access decision functions and server authorization result</interface>
    <behavior>Anonymous, member, provisional artist, verified artist, moderator, and admin requests receive only the board and mutation capabilities in the approved matrix; suspended, revoked, and missing-session requests deny by default.</behavior>
    <test>tests/community-access.test.ts</test>
  </seam>
  <seam id="database-policy">
    <interface>Supabase Postgres tables, grants, helper functions, and Row Level Security policies</interface>
    <behavior>Database reads and writes enforce the same access matrix independently of browser state, with privileged credentials restricted to server operations and privileged changes recorded in append-only audit history.</behavior>
    <test>tests/community-schema.test.mjs and `bash scripts/test-community-db.sh supabase/tests/community_rls.test.sql`</test>
  </seam>
  <seam id="session-boundary">
    <interface>Rendered auth state and authenticated server operation context</interface>
    <behavior>A valid server-checked session exposes its member capabilities; absent or invalid configuration keeps public reads available, rejects mutations, and leaves the artist board fail-closed.</behavior>
    <test>tests/community-session.test.ts and tests/community-rendered.test.mjs</test>
  </seam>
  <seam id="artist-verification">
    <interface>Artist application, operator review, revocation, and operator invitation commands</interface>
    <behavior>A valid minimum-data submission idempotently grants provisional access and enters review; operator actions and invitation acceptance produce auditable state changes that immediately affect access.</behavior>
    <test>tests/community-verification.test.ts and tests/browser/community-verification.spec.ts</test>
  </seam>
  <seam id="durable-community">
    <interface>General and artist board post, comment, bookmark, source, and report operations</interface>
    <behavior>Public general reads, member mutations, artist-only reads/writes, information-first metadata, soft deletion, and report intake persist through one server-owned contract.</behavior>
    <test>tests/community-operations.test.ts and tests/browser/community-live.spec.ts</test>
  </seam>
  <seam id="moderation-operations">
    <interface>Operator review queues and privileged moderation commands</interface>
    <behavior>Authorized operators can triage reports and act on content or accounts with reasons; every action is auditable, reversible where policy allows, and invisible to unauthorized users.</behavior>
    <test>tests/community-moderation.test.ts and tests/browser/community-moderation.spec.ts</test>
  </seam>
  <seam id="knowledge-lifecycle">
    <interface>Source freshness, accepted-answer, event-link, and operator Note-promotion commands</interface>
    <behavior>Community knowledge retains source and author provenance while gaining explicit freshness, resolution, event context, and maintained-Note state.</behavior>
    <test>tests/community-knowledge.test.ts</test>
  </seam>
  <seam id="community-search">
    <interface>Filtered Postgres community search operation</interface>
    <behavior>Active, authorized content can be searched by text, board, category, resolution, and freshness without returning hidden or unauthorized artist rows.</behavior>
    <test>tests/community-search.test.ts</test>
  </seam>
  <seam id="community-notifications">
    <interface>In-app notification creation, listing, and read-state operations</interface>
    <behavior>Named community events create idempotent recipient-scoped notifications that only the recipient can read or mark as read.</behavior>
    <test>tests/community-notifications.test.ts</test>
  </seam>
  <seam id="binder-sync">
    <interface>My Binder local-to-account bookmark synchronization operation</interface>
    <behavior>Signed-in members can idempotently merge device-local saves into their account while signed-out users keep the existing local-only behavior.</behavior>
    <test>tests/community-binder-sync.test.ts and tests/client/bookmark-flow.test.tsx</test>
  </seam>
</seams>

<task id="1" depends="" type="auto" kind="documentation" status="done">
  <name>Freeze community operating and data-minimization policy</name>
  <files>
    <create>docs/COMMUNITY_OPERATIONS.md</create>
    <modify>PRODUCT.md</modify>
    <modify>docs/DECISIONS.md</modify>
    <modify>docs/PROJECT_STATUS.md</modify>
    <modify>docs/TASKS.md</modify>
    <modify>docs/CHANGELOG.md</modify>
  </files>
  <read_first>docs/arc/specs/2026-07-26-bindery-community-backend-spec.md, PRODUCT.md, docs/DECISIONS.md, docs/PROJECT_STATUS.md, docs/TASKS.md</read_first>
  <action>Record the approved automatic provisional approval, later operator review, operator invitation, public-general/member-write access, artist-board access matrix, minimum public-URL evidence, state names, review target, correction, soft-deletion, appeal, audit, and no-document-upload boundaries. Keep unapproved legal text explicitly marked as product-owner input.</action>
  <verify>`rg -n "provisional|임시 승인|검수 대기|operator|운영자|7일|soft|소프트|appeal|이의" docs/COMMUNITY_OPERATIONS.md PRODUCT.md docs/*.md` returns the named contracts and `git diff --check` exits zero.</verify>
  <done>Product and operator records agree on one implementable state machine and do not confuse provisional access with factual or identity verification.</done>
  <commit>docs(community): define backend operating policy</commit>
</task>

<task id="2" depends="1" type="auto" kind="behavior" status="done">
  <name>Add tested community authorization and lifecycle contracts</name>
  <files>
    <create>app/lib/community-access.ts</create>
    <create>tests/community-access.test.ts</create>
  </files>
  <read_first>app/lib/community.ts, docs/COMMUNITY_OPERATIONS.md, tests/event-domain.test.ts</read_first>
  <action>Write failing assertions for the approved access matrix and state transitions, then implement typed account roles, account status, artist status, board audience, capabilities, denial reasons, provisional rate-control signal, and valid operator transitions as pure functions. Deny unknown and inactive states by default.</action>
  <seams><seam ref="access-policy" /></seams>
  <behavior>Every actor and state combination produces an explicit capability set and invalid verification transitions are rejected before any database or UI integration.</behavior>
  <examples>An anonymous general read is allowed but general post creation is denied; a provisional artist can access the artist board but receives provisional rate controls; a revoked artist loses artist access; only an admin can verify or revoke an artist.</examples>
  <verify>Red: `node --test tests/community-access.test.ts` fails before the domain contract exists. Green: the same command passes, followed by `npm run lint`.</verify>
  <done>The approved access and lifecycle matrix is executable, type-safe, default-denying, and covered at its pure domain seam.</done>
  <commit>feat(community): define authorization domain</commit>
</task>

<task id="3" depends="2" type="auto" kind="artifact" status="done">
  <name>Create the initial community database and RLS migration</name>
  <files>
    <create>supabase/config.toml</create>
    <create>supabase/migrations/20260726130000_community_foundation.sql</create>
    <create>supabase/seed.sql</create>
    <create>supabase/tests/community_rls.test.sql</create>
    <create>scripts/test-community-db.sh</create>
    <create>tests/community-schema.test.mjs</create>
    <modify>package.json</modify>
    <modify>package-lock.json</modify>
  </files>
  <read_first>app/lib/community-access.ts, docs/COMMUNITY_OPERATIONS.md, package.json</read_first>
  <action>Create the relational schema for profiles, roles, artist verifications, operator invitations, boards, posts, sources, revisions, comments, bookmarks, reports, moderation actions, audit events, notifications, and policy acceptances. Add constraints, normalized proof-URL uniqueness, indexes, grants, security-definer authorization helpers with fixed search paths, seed board identities, and RLS for every exposed table. Add executable SQL assertions for anonymous, member, provisional artist, verified artist, moderator, admin, revocation, hidden content, recipient-only data, and append-only audit behavior. The test script must create an isolated temporary PostgreSQL cluster and reproduce the minimum Supabase database contract: `anon` and `authenticated` NOLOGIN roles, a `service_role` with BYPASSRLS, an `auth` schema with `auth.users(id uuid primary key)`, request-JWT claim storage, and `auth.uid()` reading `request.jwt.claim.sub`. It must apply the production migration and seed files unchanged, execute assertions under `SET LOCAL ROLE` with distinct JWT subjects, and use a shell trap to stop and remove the temporary cluster on success or failure. It must not modify a global database service. Keep service credentials server-only and attachments disabled.</action>
  <verify>`node --test tests/community-schema.test.mjs` validates the migration's required structural contracts. `bash scripts/test-community-db.sh supabase/tests/community_rls.test.sql` must create the isolated database, bootstrap the exact test auth contract, apply the unmodified migration and seed, pass role/JWT-subject Postgres/RLS assertions including service-role BYPASSRLS behavior, and prove trap-based temporary-cluster cleanup. If actual PostgreSQL execution fails, this task remains in progress; static inspection alone cannot complete it.</verify>
  <done>One reproducible migration creates the minimum durable community model and independently enforces the approved access boundary at the database layer.</done>
  <commit>feat(database): add community schema and rls</commit>
</task>

<task id="4" depends="3" type="auto" kind="integration" status="done">
  <name>Integrate Supabase sessions with fail-closed application states</name>
  <files>
    <create>.env.example</create>
    <create>app/lib/supabase/config.ts</create>
    <create>app/lib/supabase/browser.ts</create>
    <create>app/lib/supabase/server.ts</create>
    <create>app/lib/server/community/session.ts</create>
    <create>app/auth/callback/route.ts</create>
    <create>app/auth/sign-in/page.tsx</create>
    <create>tests/community-session.test.ts</create>
    <modify>app/community/artists/page.tsx</modify>
    <modify>app/community/write/page.tsx</modify>
    <modify>.gitignore</modify>
    <modify>tests/community-rendered.test.mjs</modify>
    <modify>README.md</modify>
    <modify>package.json</modify>
    <modify>package-lock.json</modify>
  </files>
  <read_first>app/community/artists/page.tsx, app/community/write/page.tsx, app/layout.tsx, app/lib/site.ts, supabase/migrations/20260726130000_community_foundation.sql</read_first>
  <action>Add validated public environment configuration, cookie-based server session handling, sign-in and callback routes, and one server-owned current-member context. Missing configuration remains an explicit setup state: public examples render, mutations reject, and the artist board exposes no protected data. Never expose the service role.</action>
  <seams><seam ref="session-boundary" /></seams>
  <behavior>The application distinguishes configured signed-out, configured signed-in, and unconfigured states without trusting client-provided roles or claiming successful live operations.</behavior>
  <examples>An unconfigured build renders the existing public site and a setup boundary; a signed-out configured request receives a sign-in path; a server-validated artist session can reach the protected board shell.</examples>
  <verify>Baseline: `npm run build && node --test tests/community-rendered.test.mjs` passes for the current unconfigured fail-closed UI. Red: after adding configured/session cases, `node --test tests/community-session.test.ts` fails because no server session contract exists. Green: `node --test tests/community-session.test.ts`, `npm run build && node --test tests/community-rendered.test.mjs`, `npm run lint`, and `npm run build` exit zero with no production secrets present.</verify>
  <done>Authentication has one server-checked source of truth and preserves honest fail-closed behavior before external project binding.</done>
  <commit>feat(auth): add community session boundary</commit>
</task>

<task id="5" depends="4" type="auto" kind="behavior" status="done">
  <name>Implement provisional artist applications and operator invitations</name>
  <files>
    <create>supabase/migrations/20260728110000_verification_workflow.sql</create>
    <create>supabase/migrations/20260728240000_artist_application_hardening.sql</create>
    <create>supabase/migrations/20260728280000_verification_integrity.sql</create>
    <create>supabase/functions/submit-artist-application/index.ts</create>
    <create>supabase/functions/.env.example</create>
    <create>supabase/tests/community_verification.test.sql</create>
    <create>supabase/tests/community_security_hardening.test.sql</create>
    <create>app/lib/server/community/verification.ts</create>
    <create>app/components/ArtistApplicationForm.tsx</create>
    <create>app/components/AdminArtistReviewForm.tsx</create>
    <create>app/components/AdminArtistInviteForm.tsx</create>
    <create>app/components/AdminArtistInviteRevokeForm.tsx</create>
    <create>app/components/ArtistInviteAcceptForm.tsx</create>
    <create>app/api/community/verification/route.ts</create>
    <create>app/api/community/invitations/[token]/accept/route.ts</create>
    <create>app/api/admin/community/verifications/[id]/route.ts</create>
    <create>app/api/admin/community/invitations/route.ts</create>
    <create>app/api/admin/community/invitations/[id]/route.ts</create>
    <create>app/admin/community/verifications/page.tsx</create>
    <create>app/admin/community/invitations/page.tsx</create>
    <create>app/community/invite/[token]/page.tsx</create>
    <create>tests/community-verification.test.ts</create>
    <create>tests/community-security-hardening.test.mjs</create>
    <create>tests/client/artist-invite-accept.test.tsx</create>
    <create>tests/browser/community-verification.spec.ts</create>
    <modify>app/community/verify/page.tsx</modify>
    <modify>app/globals.css</modify>
  </files>
  <read_first>docs/COMMUNITY_OPERATIONS.md, app/lib/community-access.ts, app/lib/server/community/session.ts, app/community/verify/page.tsx</read_first>
  <action>Write failing command-level tests, then add minimum-data application validation, proof-URL normalization and deduplication, idempotent provisional approval, review queue, admin verify/reject/suspend/revoke actions, operator invitation issuance/acceptance/revocation, reason capture, policy acceptance, audit events, and honest user/operator screens. Put bot and rate-limit adapters at the server mutation boundary.</action>
  <seams><seam ref="artist-verification" /></seams>
  <behavior>A valid bot-checked, rate-permitted submission immediately creates provisional access and a review item; invalid or expired bot tokens and rate-limit excess deny before storage; only authorized operators can finalize or revoke status; operator invitations are single-use and auditable.</behavior>
  <examples>Repeated submission with the same idempotency key returns the original provisional result; a duplicate normalized proof URL is rejected; invalid and expired bot tokens are rejected; a rate-limited account cannot create another application; revocation removes access on the next request; an expired invitation cannot be accepted.</examples>
  <verify>Red: `node --test tests/community-verification.test.ts` fails on the first missing application command. Green: `node --test tests/community-verification.test.ts` passes application, idempotency, duplicate-proof, invalid/expired bot-token, rate-limit, review, revocation, invitation, and audit cases; `npx playwright test tests/browser/community-verification.spec.ts --config playwright.config.ts`, `npm run lint`, and `npm run build` exit zero.</verify>
  <done>Artist access can begin provisionally, be reviewed later, or originate from an operator invitation without bypassing server authorization or audit history.</done>
  <commit>feat(community): add artist verification workflow</commit>
</task>

<task id="6" depends="5" type="auto" kind="behavior" status="done">
  <name>Make the general board durable with reports</name>
  <files>
    <create>app/lib/server/community/posts.ts</create>
    <create>app/lib/server/community/comments.ts</create>
    <create>app/lib/server/community/reports.ts</create>
    <create>supabase/migrations/20260728150000_durable_general_board.sql</create>
    <create>supabase/tests/community_operations.test.sql</create>
    <create>app/api/community/posts/route.ts</create>
    <create>app/api/community/posts/[id]/route.ts</create>
    <create>app/api/community/posts/[id]/comments/route.ts</create>
    <create>app/api/community/posts/[id]/bookmark/route.ts</create>
    <create>app/api/community/reports/route.ts</create>
    <create>app/components/CommunityPostActions.tsx</create>
    <create>app/components/CommunityReportForm.tsx</create>
    <create>tests/community-operations.test.ts</create>
    <create>tests/browser/community-live.spec.ts</create>
    <modify>app/community/general/page.tsx</modify>
    <modify>app/community/general/[slug]/page.tsx</modify>
    <modify>app/community/write/page.tsx</modify>
    <modify>app/community/report/page.tsx</modify>
    <modify>app/components/CommunityComposer.tsx</modify>
  </files>
  <read_first>app/lib/community.ts, app/components/CommunityComposer.tsx, app/lib/server/community/session.ts, docs/COMMUNITY_OPERATIONS.md</read_first>
  <action>Add tested server operations for paginated public reads and authenticated post, source, comment, bookmark, soft-delete, and report mutations. Preserve source/check-date, experience/fact, category, and resolution metadata. Replace the local-only composer only when live configuration is available; retain its explicit local fallback otherwise.</action>
  <seams><seam ref="durable-community" /></seams>
  <behavior>General content is publicly readable, active members can mutate only their permitted rows, reports reach durable intake, and failures never masquerade as successful publication.</behavior>
  <examples>An anonymous list request succeeds but post creation is rejected; a member publishes a sourced question and accepts an answer; another member reports it once; the author soft-deletes it while audit history remains.</examples>
  <verify>Red: `node --test tests/community-operations.test.ts` fails on the first missing durable post operation. Green: `node --test tests/community-operations.test.ts` passes public-read, member-write, source, comment, bookmark, soft-delete, and report cases; `npx playwright test tests/browser/community-live.spec.ts --config playwright.config.ts`, `npm run lint`, and `npm run build` exit zero.</verify>
  <done>The general board has durable, information-first member participation and a real report intake path.</done>
  <commit>feat(community): persist general board activity</commit>
</task>

<task id="7" depends="6" type="auto" kind="behavior" status="done">
  <name>Enable server-protected artist board reads and writes</name>
  <files>
    <create>tests/community-artist-board.test.ts</create>
    <create>tests/browser/community-artist-board.spec.ts</create>
    <create>supabase/migrations/20260728170000_artist_board_limits.sql</create>
    <create>supabase/tests/community_artist_board.test.sql</create>
    <create>app/community/artists/[slug]/page.tsx</create>
    <modify>app/community/artists/page.tsx</modify>
    <modify>app/community/write/page.tsx</modify>
    <modify>app/globals.css</modify>
  </files>
  <read_first>app/lib/community-access.ts, app/lib/server/community/posts.ts, app/community/artists/page.tsx, docs/COMMUNITY_OPERATIONS.md</read_first>
  <action>Use the durable post contract for artist-only reads/writes, apply provisional rate-control signals, and keep protected content absent from unauthorized HTML and metadata. Preserve the lock and application paths for anonymous, member, suspended, rejected, and revoked states.</action>
  <seams><seam ref="durable-community" /></seams>
  <behavior>Only active provisional or verified artists receive protected rows or artist-board write capability; every other state receives an appropriate content-free boundary.</behavior>
  <examples>A provisional artist reads and writes with the provisional control signal; a verified artist reads and writes normally; a revoked artist receives the lock screen and no protected post data in HTML or metadata.</examples>
  <verify>Red: `node --test tests/community-artist-board.test.ts` fails on the first missing protected-board operation. Green: `node --test tests/community-artist-board.test.ts` passes all artist states; `npx playwright test tests/browser/community-artist-board.spec.ts --config playwright.config.ts` confirms content-free unauthorized HTML and authorized UI; `npm run lint` and `npm run build` exit zero.</verify>
  <done>The artist board is live behind one server and database-enforced access boundary without protected-data leakage.</done>
  <commit>feat(community): enable protected artist board</commit>
</task>

<task id="8" depends="7" type="auto" kind="behavior" status="done">
  <name>Add the moderation console and audited operator actions</name>
  <files>
    <create>app/lib/server/community/moderation.ts</create>
    <create>app/admin/community/reports/page.tsx</create>
    <create>app/admin/community/audit/page.tsx</create>
    <create>app/components/AdminModerationForm.tsx</create>
    <create>app/api/admin/community/reports/[id]/route.ts</create>
    <create>supabase/migrations/20260728190000_moderation_console.sql</create>
    <create>supabase/migrations/20260728250000_content_integrity_appeals.sql</create>
    <create>supabase/migrations/20260728270000_lifecycle_integrity.sql</create>
    <create>supabase/tests/community_moderation.test.sql</create>
    <create>tests/community-moderation.test.ts</create>
    <create>tests/browser/community-moderation.spec.ts</create>
    <create>app/api/community/reports/[id]/appeal/route.ts</create>
    <create>app/community/appeals/[id]/page.tsx</create>
    <create>app/components/CommunityAppealForm.tsx</create>
    <modify>app/globals.css</modify>
  </files>
  <read_first>app/lib/server/community/reports.ts, app/lib/server/community/session.ts, docs/COMMUNITY_OPERATIONS.md</read_first>
  <action>Add operator queues for reports and content actions. Require reasons for triage, dismiss, hide, lock, restore, account suspension, and appeal decisions; enforce moderator/admin scope and append audit history without exposing queues to members.</action>
  <seams><seam ref="moderation-operations" /></seams>
  <behavior>Authorized moderators and admins can perform only their scoped, reasoned actions; unauthorized users cannot read queues; every state change appends immutable actor, target, reason, and timestamp history.</behavior>
  <examples>A moderator triages and hides a reported post; an admin restores it after appeal; a member cannot list reports; a second action adds history instead of overwriting the first.</examples>
  <verify>Red: `node --test tests/community-moderation.test.ts` fails on the first missing operator command. Green: `node --test tests/community-moderation.test.ts` passes role, reason, transition, appeal, and audit cases; `npx playwright test tests/browser/community-moderation.spec.ts --config playwright.config.ts`, `npm run lint`, and `npm run build` exit zero.</verify>
  <done>The minimum operator workflow is live, scoped, reasoned, auditable, and inaccessible to normal members.</done>
  <commit>feat(moderation): add community operator console</commit>
</task>

<task id="9" depends="8" type="auto" kind="behavior" status="done">
  <name>Add knowledge freshness and operator Note promotion</name>
  <files>
    <create>supabase/migrations/20260728210000_community_knowledge.sql</create>
    <create>supabase/tests/community_knowledge.test.sql</create>
    <create>app/lib/server/community/knowledge.ts</create>
    <create>app/api/community/posts/[id]/knowledge/route.ts</create>
    <create>app/components/CommunityKnowledgeActions.tsx</create>
    <create>tests/community-knowledge.test.ts</create>
    <modify>app/community/general/[slug]/page.tsx</modify>
    <modify>app/notes/page.tsx</modify>
    <modify>app/notes/[slug]/page.tsx</modify>
    <modify>tests/community-rendered.test.mjs</modify>
  </files>
  <read_first>app/lib/server/community/posts.ts, app/lib/data.ts, app/notes/page.tsx, docs/COMMUNITY_OPERATIONS.md</read_first>
  <action>Add source freshness windows, accepted answers, event links, and operator Note promotion with immutable provenance. Extend the schema only for these knowledge lifecycle fields and preserve the original post, author, source, and checked date.</action>
  <seams><seam ref="knowledge-lifecycle" /></seams>
  <behavior>Durable discussion can become resolved and maintained information without losing its source or author chain.</behavior>
  <examples>A sourced answer becomes stale after its check window; an author accepts an answer; an operator promotes the resolved post to a Note that links back to the original; a hidden post cannot be promoted.</examples>
  <verify>Red: `node --test tests/community-knowledge.test.ts` fails on the first missing freshness operation. Green: `node --test tests/community-knowledge.test.ts` passes freshness, answer, event-link, promotion, provenance, and hidden-content cases; `bash scripts/test-community-db.sh supabase/tests/community_knowledge.test.sql` applies all migrations and passes the actual Postgres authorization behavior; `npm run build && node --test tests/community-rendered.test.mjs`, `npm run lint`, and `npm run build` exit zero.</verify>
  <done>Community knowledge has explicit freshness, resolution, event context, and provenance-preserving Note promotion.</done>
  <commit>feat(community): add knowledge lifecycle</commit>
</task>

<task id="10" depends="9" type="auto" kind="behavior" status="done">
  <name>Add authorized filtered community search</name>
  <files>
    <create>supabase/migrations/20260728220000_community_search.sql</create>
    <create>supabase/migrations/20260728260000_community_corrections_pagination.sql</create>
    <create>supabase/migrations/20260728290000_content_read_integrity.sql</create>
    <create>supabase/tests/community_search.test.sql</create>
    <create>supabase/tests/community_corrections_pagination.test.sql</create>
    <create>supabase/tests/content_read_integrity.test.sql</create>
    <create>app/lib/server/community/search.ts</create>
    <create>tests/community-search.test.ts</create>
    <create>tests/community-corrections-pagination.test.ts</create>
    <create>tests/browser/community-search.spec.ts</create>
    <create>tests/browser/community-pagination.spec.ts</create>
    <create>tests/client/community-correction.test.tsx</create>
    <create>tests/client/community-read-states.test.tsx</create>
    <modify>app/api/community/posts/[id]/route.ts</modify>
    <modify>app/components/CommunityPostActions.tsx</modify>
    <modify>app/community/general/page.tsx</modify>
    <modify>app/community/artists/page.tsx</modify>
  </files>
  <read_first>app/lib/server/community/posts.ts, supabase/migrations/20260726140000_community_knowledge.sql, app/community/general/page.tsx</read_first>
  <action>Add indexed Postgres text search with board, category, resolution, and freshness filters plus opaque keyset pagination. Add reasoned author/operator correction, immutable prior-content snapshots, and operator-only append-only source rechecks. Apply the caller's board authorization before results are ranked or returned, exclude hidden/deleted content, and defer a separate Korean search service until measured queries show a need.</action>
  <seams><seam ref="community-search" /></seams>
  <behavior>Members can find authorized active content with stable filters and rank/update/ID cursors, while authors and operators can correct facts without erasing history and anonymous users never receive artist or moderated rows.</behavior>
  <examples>An anonymous practical-category search returns matching general posts only; a provisional artist can include artist results; a revoked artist immediately loses them; hidden posts never appear.</examples>
  <verify>Red: `node --test tests/community-search.test.ts` fails on the first missing search operation. Green: `node --test tests/community-search.test.ts` passes authorization, filters, hidden-content, and stable-order cases; `bash scripts/test-community-db.sh supabase/tests/community_search.test.sql` proves anonymous search cannot return artist or hidden rows while authorized artist search can in actual Postgres; `npx playwright test tests/browser/community-search.spec.ts --config playwright.config.ts`, `npm run lint`, and `npm run build` exit zero.</verify>
  <done>Community search is indexed, filterable, authorization-aware, and does not leak protected or moderated content.</done>
  <commit>feat(community): add authorized search</commit>
</task>

<task id="11" depends="9" type="auto" kind="behavior" status="done">
  <name>Add recipient-scoped in-app notifications</name>
  <files>
    <create>app/lib/server/community/notifications.ts</create>
    <create>tests/community-notifications.test.ts</create>
    <create>app/me/notifications/page.tsx</create>
    <create>app/api/community/notifications/[id]/read/route.ts</create>
    <create>supabase/migrations/20260728230000_community_notifications.sql</create>
    <create>supabase/tests/community_notifications.test.sql</create>
  </files>
  <read_first>app/lib/server/community/comments.ts, app/lib/server/community/moderation.ts, supabase/migrations/20260726130000_community_foundation.sql</read_first>
  <action>Create idempotent in-app notifications for replies, accepted answers, verification decisions, moderation outcomes, and appeals. Limit listing and read-state mutation to the recipient and keep external email delivery out of this slice.</action>
  <seams><seam ref="community-notifications" /></seams>
  <behavior>Named events create at most one recipient-scoped notification, and only that recipient can list or mark it read.</behavior>
  <examples>Two retries for one reply create one notification; an artist receives a verification decision; another member cannot read either record; marking one item read does not affect another.</examples>
  <verify>Red: `node --test tests/community-notifications.test.ts` fails on the first missing notification operation. Green: `node --test tests/community-notifications.test.ts` passes idempotency, event, recipient, and read-state cases; `npm run lint` and `npm run build` exit zero.</verify>
  <done>Members receive durable, private in-app notifications for the minimum community events without external delivery dependencies.</done>
  <commit>feat(community): add in-app notifications</commit>
</task>

<task id="12" depends="6" type="auto" kind="behavior" status="done">
  <name>Synchronize My Binder bookmarks for signed-in members</name>
  <files>
    <create>app/lib/server/community/binder-sync.ts</create>
    <create>tests/community-binder-sync.test.ts</create>
    <create>supabase/migrations/20260728205000_binder_event_bookmarks.sql</create>
    <create>supabase/tests/community_binder_sync.test.sql</create>
    <create>app/api/community/binder-sync/route.ts</create>
    <modify>app/components/BinderClient.tsx</modify>
    <modify>app/components/CommunityPostActions.tsx</modify>
    <modify>app/lib/bookmarks.ts</modify>
    <modify>app/me/page.tsx</modify>
    <modify>tests/client/bookmark-flow.test.tsx</modify>
  </files>
  <read_first>app/lib/bookmarks.ts, app/components/BinderClient.tsx, app/me/page.tsx, app/lib/server/community/session.ts</read_first>
  <action>Add an explicit signed-in merge operation that normalizes and idempotently copies supported device-local saves into account bookmarks, reports conflicts, and leaves local data untouched until the server confirms success. Preserve the existing local-only path for signed-out and unconfigured users.</action>
  <seams><seam ref="binder-sync" /></seams>
  <behavior>Account members can carry Binder saves across devices without losing or duplicating the current device collection, while guests retain unchanged local behavior.</behavior>
  <examples>Two sync retries create one server bookmark; a local-only event and community post merge together; a rejected server item remains local with an explicit result; signed-out use never sends data.</examples>
  <verify>Red: `node --test tests/community-binder-sync.test.ts` fails on the first missing sync operation. Green: `node --test tests/community-binder-sync.test.ts` and `npx vitest run tests/client/bookmark-flow.test.tsx --config vitest.config.ts` pass merge, idempotency, partial-result, and guest cases; `npm run lint` and `npm run build` exit zero.</verify>
  <done>My Binder supports explicit, lossless account synchronization while preserving its existing guest contract.</done>
  <commit>feat(binder): sync member bookmarks</commit>
</task>

<task id="13" depends="10,11,12" type="auto" kind="documentation" status="done">
  <name>Reconcile setup, operations, progress, and residual gates</name>
  <files>
    <modify>README.md</modify>
    <modify>PRODUCT.md</modify>
    <modify>docs/COMMUNITY_OPERATIONS.md</modify>
    <modify>docs/PROJECT_STATUS.md</modify>
    <modify>docs/TASKS.md</modify>
    <modify>docs/DECISIONS.md</modify>
    <modify>docs/CHANGELOG.md</modify>
    <modify>docs/arc/plans/2026-07-26-bindery-community-backend-implementation.md</modify>
    <modify>docs/arc/plans/INDEX.md</modify>
  </files>
  <read_first>README.md, PRODUCT.md, docs/COMMUNITY_OPERATIONS.md, docs/PROJECT_STATUS.md, docs/TASKS.md, docs/DECISIONS.md, docs/CHANGELOG.md</read_first>
  <action>Document exact local and hosted configuration, migrations, backup boundaries, operator routines, implemented capabilities, verification evidence, and remaining privacy/legal/provider/production-access gates. Remove prototype claims only where the live behavior actually replaces them.</action>
  <verify>Documentation links and named commands resolve, `rg -n "프로토타입|실제|Supabase|RLS|임시 승인|검수" README.md PRODUCT.md docs/*.md` matches the final boundary, and `git diff --check` exits zero.</verify>
  <done>Project records and operator instructions match the verified implementation and distinguish local proof from external production gates.</done>
  <commit>docs(community): record backend operations</commit>
</task>

## Implementation state

**Execution base:** `7f4be4a26b5b1f00f23df3e727b755f3ff4c5c62`
**Declared scope:** `app/**`, `supabase/**`, `scripts/**`, `tests/**`, `README.md`, `PRODUCT.md`, `docs/**`, `package.json`, `package-lock.json`
**Pre-existing dirty paths:**

- none

**Excluded metadata:** this plan and `docs/arc/plans/INDEX.md`
**Commit posture:** the user authorized checkpoint commit `d44a6d2` for tasks 1–8. Later implementation slices remain uncommitted until separately authorized.
**Last coherent commit:** `d44a6d24926fa5571fa3595492eef92918374a4b`
**Closeout:** passed 2026-07-28T14:41:13+09:00 — `npm test` (103 Node, 30 Vitest, 30 Playwright), separate `npm run build`, all 12 isolated PostgreSQL/RLS suites, `npm run lint`, and `git diff --check` passed.

## Decision log

- The clean starting worktree required no empty checkpoint commit; existing HEAD
  `7f4be4a` is the requested pre-work checkpoint.
- The user later authorized a verified checkpoint commit for completed tasks
  1–8; it was recorded as `d44a6d2` without push or deployment.
- The approved architecture keeps GPT Sites/vinext as the frontend and uses
  Supabase Auth/Postgres/RLS as the backend boundary.
- Automatic approval is named `provisional` and remains visibly distinct from
  operator-reviewed `verified`.
- The current implementation request does not authorize a GitHub push, wider
  Sites access, or creation of an external Supabase project without an exact
  mutation checkpoint.
- Plan-document review required real Postgres/RLS gates for every schema
  migration, independent later-slice dependencies, and separate artist,
  moderation, knowledge, search, notification, and Binder outcomes. The third
  review passed all seven Arc contract dimensions.
- Docker, Podman, Colima, and OrbStack are absent, while Homebrew PostgreSQL
  17.10 is available. Real RLS evidence therefore uses an isolated temporary
  PostgreSQL cluster with Supabase role and `auth.uid()` test stubs; it does not
  modify a global database service or weaken the actual-database gate.
- Whole-implementation review found direct provisional-access, broad DML,
  duplicate migration, typecheck, redirect, invitation expiry, appeal-entry,
  and Binder-evidence gaps. The fixes use an Edge-only service credential,
  database-time RPCs, unique migrations, private appeals, and a required
  TypeScript gate; the review axes must rerun on the corrected fingerprint.
- Corrected-target review then found Edge handler evidence, response-loss
  idempotency, discoverable correction, stable pagination, Binder batch-size,
  caller-time invitation issue, event-reference, and causal appeal-reversal
  gaps. The final target adds direct Edge behavior tests, service-only replay
  lookup, immutable correction/source history, opaque keyset cursors, explicit
  oversized-merge rejection, database-time invite issue, an event allowlist,
  and action-bound latest-restriction-safe appeal resolution.
- Final fixed-target review found remaining write/read separation, applicant
  privacy, appeal rejection and normal-restore causality, invite consent and
  chronology, concurrent replay, legacy upgrade, event Binder, revision-body,
  configured-error, and deterministic Note-source gaps. The corrected target
  uses independent board-write authority, admin-only application visibility,
  accept/reject appeal outcomes, exact-action restore, explicit policy consent,
  database clocks and advisory locking, upgrade-safe allowlist classification,
  a capped event RPC, metadata-only revision reads, durable configured states,
  and stable source ordering. All review axes must rerun on the new fingerprint.
- The final corrected target passed specification, Guarded security/data,
  engineering-standards, and product/browser review. Browser evidence covered
  360px, 768px, and 1280px routes, 21 visible destinations, 44px targets,
  overflow, text measure, ad reservations, themes, and fail-closed boundaries.
  Hosted authenticated Supabase E2E remains a separate external gate.
