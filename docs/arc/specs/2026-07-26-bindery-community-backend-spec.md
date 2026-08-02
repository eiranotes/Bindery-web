# Bindery Community Backend Specification

## Objective

Turn the existing Community prototype into an information-first community hub
with durable member posting, server-enforced artist-board access, automatic
provisional artist approval, later operator review, invitations, reporting, and
auditable moderation.

The existing vinext/React frontend and GPT Sites deployment remain the product
surface. Supabase Auth and Postgres provide identity, durable data, and
row-level authorization. Sensitive mutations pass through server-owned
operations; browser state, URL parameters, and visual badges never grant
access.

## Product boundaries

- `모두의 게시판` is publicly readable. Authenticated active members can
  create posts, comment, bookmark, and report.
- `작가 인증 게시판` participation is readable and writable only by accounts
  with an active provisional or verified artist status. Active moderators and
  admins may read it for operations, but their role alone never grants posts or
  comments.
- A submitted artist application receives `provisional` status automatically
  and enters an operator review queue. The interface must call this
  `임시 승인 · 검수 대기`, never `인증 완료`.
- An operator-issued invitation may grant `verified` status after acceptance.
  Member-to-member invitations are out of scope for the first release.
- Artist status proves participation eligibility only. It does not certify the
  truth of a post.
- Direct messages, private transactions, payments, settlement, public
  group-buy intake, identity-document collection, rankings, live chat, and live
  advertising are out of scope.

## Roles and states

Account roles are independent from artist status.

### Account roles

- `member` — normal authenticated account.
- `moderator` — content and report operations.
- `admin` — role, artist verification, invitation, and policy operations.

### Account status

- `active`
- `suspended`
- `deleted`

### Artist verification status

- `provisional` — automatic access after a valid minimum-data submission.
- `verified` — operator reviewed or operator-invited.
- `rejected`
- `suspended`
- `revoked`

All state changes retain actor, reason, and timestamp history. Revocation or
suspension must remove artist-participation read/write access on the next
server-authorized request without removing a separate active operator's
moderation read authority.

## Access matrix

| Actor | General read | General write/comment/report | Artist read/write | Moderation |
|---|---|---|---|---|
| Anonymous | Yes | No | No | No |
| Active member | Yes | Yes | No | No |
| Provisional artist | Yes | Yes | Yes, with provisional rate controls | No |
| Verified artist | Yes | Yes | Yes | No |
| Moderator | Yes | Yes | Read for moderation; write only with own artist status | Content/report actions |
| Admin | Yes | Yes | Read for operations; write only with own artist status | All role, verification, and policy actions |

Authorization denies by default and is checked in both the server operation and
Postgres Row Level Security. Admin credentials and service-role keys never
reach the browser.

## Minimum-data artist application

Required:

- public activity name;
- one normalized public proof URL;
- primary activity field;
- current community-rule and privacy-policy acceptance.

Optional:

- public shop or event participation URL;
- short operator note.

The first release does not accept identity cards, business-registration
documents, or private file uploads. Submission is idempotent, rate limited,
bot checked, and duplicate normalized proof URLs are rejected. An operator
review should normally complete within seven days.

## Community content lifecycle

Posts use `draft`, `published`, `under_review`, `hidden`, `locked`, and
`deleted`. Reports use `open`, `triaged`, `actioned`, `dismissed`, `appealed`,
and `closed`.

Deletion is soft by default so moderation and appeal history remains
auditable. Privacy deletion is a separate operator workflow. Privileged actions
append to an audit log rather than overwriting history.

Information-first fields include category, question-resolution status,
optional source URL, source label, checked date, and a distinction between
experience and factual guidance. High-value posts may later be promoted into
operator Notes while preserving the source post and author attribution.

## Backend boundaries

- Supabase Auth manages sign-in and JWT refresh.
- Public profile data references `auth.users` without exposing the managed auth
  schema.
- Postgres stores profiles, roles, artist verification, invitations, boards,
  posts, revisions, sources, comments, bookmarks, reports, moderation actions,
  audit events, notifications, and policy acceptances.
- RLS protects every table exposed through the Data API.
- Public reads may use the publishable Supabase client with RLS.
- Posting, commenting, verification submission, invitations, reports, and
  moderation use server operations so rate limits, bot checks, validation, and
  idempotency are applied consistently.
- Attachments remain disabled initially. A later private bucket must use RLS,
  size/type limits, and signed access.

## Delivery order

1. Freeze policies, state names, retention expectations, and the authorization
   matrix.
2. Add tested domain authorization and lifecycle contracts.
3. Add the Postgres schema, seed boards, indexes, constraints, and RLS.
4. Add Supabase session handling and honest configured/unconfigured states.
5. Add provisional artist submission, operator review, and operator invitation.
6. Make the general board durable with posts, comments, sources, bookmarks, and
   reports.
7. Enable the artist board and moderation console.
8. Add information freshness, accepted answers, Note promotion, event links,
   search, and notifications.
9. Consider live ads only after consent, privacy, content-suitability, and
   measurement policies are complete.

## Acceptance criteria

- Anonymous requests cannot obtain artist-board rows or perform mutations.
- Member, provisional artist, verified artist, moderator, and admin behavior
  matches the access matrix.
- A valid application produces provisional access and a review-queue record
  without claiming completed verification.
- Operator verification, rejection, suspension, revocation, and invitation are
  auditable and immediately affect authorization.
- General posts and comments persist; reports reach an operator-visible queue.
- Every privileged mutation records actor, reason, timestamp, and target.
- Missing backend configuration keeps the existing site readable and the
  artist board fail-closed without presenting a fake successful action.
