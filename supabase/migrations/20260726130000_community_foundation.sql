create type public.app_role as enum ('member', 'moderator', 'admin');
create type public.account_status as enum ('active', 'suspended', 'deleted');
create type public.artist_verification_status as enum (
  'provisional',
  'verified',
  'rejected',
  'suspended',
  'revoked'
);
create type public.board_audience as enum ('public', 'artist');
create type public.post_state as enum (
  'draft',
  'published',
  'under_review',
  'hidden',
  'locked',
  'deleted'
);
create type public.post_kind as enum ('experience', 'fact', 'question');
create type public.comment_state as enum (
  'published',
  'under_review',
  'hidden',
  'deleted'
);
create type public.report_state as enum (
  'open',
  'triaged',
  'actioned',
  'dismissed',
  'appealed',
  'closed'
);
create type public.invite_state as enum (
  'pending',
  'accepted',
  'expired',
  'revoked'
);
create type public.moderation_action_type as enum (
  'triage',
  'dismiss',
  'hide',
  'lock',
  'restore',
  'warn',
  'suspend_account',
  'resolve_appeal'
);
create type public.notification_kind as enum (
  'reply',
  'answer_accepted',
  'verification_decision',
  'moderation_outcome',
  'appeal_outcome'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (
    char_length(display_name) between 1 and 40
  ),
  account_status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.artist_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status public.artist_verification_status not null default 'provisional',
  activity_name text not null check (
    char_length(activity_name) between 1 and 80
  ),
  proof_url text not null check (proof_url ~ '^https?://'),
  proof_url_normalized text not null,
  primary_field text not null check (
    char_length(primary_field) between 1 and 80
  ),
  optional_public_url text check (
    optional_public_url is null or optional_public_url ~ '^https?://'
  ),
  applicant_note text check (
    applicant_note is null or char_length(applicant_note) <= 500
  ),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'provisional' and reviewed_at is null)
    or status <> 'provisional'
  )
);

create unique index artist_verifications_proof_url_unique
  on public.artist_verifications (proof_url_normalized);
create index artist_verifications_review_queue
  on public.artist_verifications (status, submitted_at);

create table public.artist_invites (
  id uuid primary key default gen_random_uuid(),
  invited_email text,
  intended_user_id uuid references public.profiles(id) on delete set null,
  token_digest text not null unique,
  state public.invite_state not null default 'pending',
  issued_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (invited_email is not null or intended_user_id is not null),
  check (
    (state = 'accepted' and accepted_by is not null and accepted_at is not null)
    or state <> 'accepted'
  )
);

create index artist_invites_pending_expiry
  on public.artist_invites (expires_at)
  where state = 'pending';

create table public.boards (
  id text primary key check (id in ('general', 'artists')),
  title text not null,
  audience public.board_audience not null,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.boards(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  category_id text not null check (
    category_id in (
      'event',
      'production',
      'cost',
      'business',
      'copyright',
      'shipping',
      'chat'
    )
  ),
  kind public.post_kind not null,
  state public.post_state not null default 'draft',
  title text not null check (char_length(title) between 4 and 120),
  body text not null check (char_length(body) between 10 and 20000),
  is_resolved boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_reason text,
  check (
    (state = 'deleted' and deleted_at is not null)
    or state <> 'deleted'
  )
);

create index posts_board_feed
  on public.posts (board_id, state, published_at desc, created_at desc);
create index posts_author
  on public.posts (author_id, created_at desc);

create table public.post_sources (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  url text not null check (url ~ '^https?://'),
  checked_at date not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index post_sources_post
  on public.post_sources (post_id, checked_at desc);

create table public.post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  editor_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  body text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index post_revisions_post
  on public.post_revisions (post_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  parent_id uuid references public.comments(id) on delete cascade,
  state public.comment_state not null default 'published',
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (
    (state = 'deleted' and deleted_at is not null)
    or state <> 'deleted'
  )
);

create index comments_post
  on public.comments (post_id, created_at);

create table public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason_code text not null check (
    reason_code in (
      'spam',
      'harassment',
      'personal_information',
      'misinformation',
      'fraud',
      'other'
    )
  ),
  details text check (details is null or char_length(details) <= 2000),
  state public.report_state not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolution_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (num_nonnulls(post_id, comment_id) = 1)
);

create unique index reports_member_post_reason_unique
  on public.reports (reporter_id, post_id, reason_code)
  where post_id is not null and state not in ('dismissed', 'closed');
create unique index reports_member_comment_reason_unique
  on public.reports (reporter_id, comment_id, reason_code)
  where comment_id is not null and state not in ('dismissed', 'closed');
create index reports_operator_queue
  on public.reports (state, created_at);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action_type public.moderation_action_type not null,
  target_type text not null check (
    target_type in ('post', 'comment', 'account', 'artist_verification', 'report')
  ),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 2000),
  previous_state jsonb,
  next_state jsonb,
  created_at timestamptz not null default now()
);

create index moderation_actions_target
  on public.moderation_actions (target_type, target_id, created_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_target
  on public.audit_events (target_type, target_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind public.notification_kind not null,
  actor_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid,
  deduplication_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (recipient_id, deduplication_key)
);

create index notifications_recipient_unread
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create table public.policy_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_key text not null,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_key, policy_version)
);

insert into public.boards (id, title, audience)
values
  ('general', '모두의 게시판', 'public'),
  ('artists', '작가 인증 게시판', 'artist');

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger artist_verifications_touch_updated_at
before update on public.artist_verifications
for each row execute function public.touch_updated_at();

create trigger artist_invites_touch_updated_at
before update on public.artist_invites
for each row execute function public.touch_updated_at();

create trigger posts_touch_updated_at
before update on public.posts
for each row execute function public.touch_updated_at();

create trigger comments_touch_updated_at
before update on public.comments
for each row execute function public.touch_updated_at();

create trigger reports_touch_updated_at
before update on public.reports
for each row execute function public.touch_updated_at();

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and account_status = 'active'
  )
$$;

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_member()
    and exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = required_role
    )
$$;

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('moderator') or public.has_role('admin')
$$;

create or replace function public.has_artist_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_member()
    and exists (
      select 1
      from public.artist_verifications
      where user_id = auth.uid()
        and status in ('provisional', 'verified')
    )
$$;

create or replace function public.can_access_board(target_board_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select case
        when audience = 'public' then true
        else public.has_artist_access() or public.is_operator()
      end
      from public.boards
      where id = target_board_id
    ),
    false
  )
$$;

create or replace function public.can_read_post(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.posts
    where id = target_post_id
      and (
        (
          state in ('published', 'locked')
          and public.can_access_board(board_id)
        )
        or author_id = auth.uid()
        or public.is_operator()
      )
  )
$$;

create or replace function public.is_post_author(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_member()
    and exists (
      select 1
      from public.posts
      where id = target_post_id
        and author_id = auth.uid()
    )
$$;

revoke all on function public.is_active_member() from public;
revoke all on function public.has_role(public.app_role) from public;
revoke all on function public.is_operator() from public;
revoke all on function public.has_artist_access() from public;
revoke all on function public.can_access_board(text) from public;
revoke all on function public.can_read_post(uuid) from public;
revoke all on function public.is_post_author(uuid) from public;

grant execute on function public.is_active_member()
  to anon, authenticated, service_role;
grant execute on function public.has_role(public.app_role)
  to anon, authenticated, service_role;
grant execute on function public.is_operator()
  to anon, authenticated, service_role;
grant execute on function public.has_artist_access()
  to anon, authenticated, service_role;
grant execute on function public.can_access_board(text)
  to anon, authenticated, service_role;
grant execute on function public.can_read_post(uuid)
  to anon, authenticated, service_role;
grant execute on function public.is_post_author(uuid)
  to anon, authenticated, service_role;

create or replace function public.audit_privileged_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before_data jsonb;
  after_data jsonb;
  target_data jsonb;
  event_target_id uuid;
  event_reason text;
begin
  before_data := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_data := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  target_data := coalesce(after_data, before_data);
  event_target_id := coalesce(
    nullif(target_data ->> 'id', '')::uuid,
    nullif(target_data ->> 'user_id', '')::uuid
  );
  event_reason := coalesce(
    target_data ->> 'review_reason',
    target_data ->> 'reason',
    target_data ->> 'resolution_reason'
  );

  insert into public.audit_events (
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state
  )
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    event_target_id,
    event_reason,
    before_data,
    after_data
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_artist_verifications
after insert or update or delete on public.artist_verifications
for each row execute function public.audit_privileged_change();

create trigger audit_artist_invites
after insert or update or delete on public.artist_invites
for each row execute function public.audit_privileged_change();

create trigger audit_user_roles
after insert or update or delete on public.user_roles
for each row execute function public.audit_privileged_change();

create trigger audit_reports
after update on public.reports
for each row execute function public.audit_privileged_change();

create or replace function public.prevent_audit_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'audit events are append-only';
end;
$$;

create trigger prevent_audit_event_mutation
before update or delete on public.audit_events
for each row execute function public.prevent_audit_event_mutation();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.artist_verifications enable row level security;
alter table public.artist_invites enable row level security;
alter table public.boards enable row level security;
alter table public.posts enable row level security;
alter table public.post_sources enable row level security;
alter table public.post_revisions enable row level security;
alter table public.comments enable row level security;
alter table public.bookmarks enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;
alter table public.policy_acceptances enable row level security;

create policy profiles_select_visible
on public.profiles
for select
using (
  account_status = 'active'
  or id = auth.uid()
  or public.is_operator()
);

create policy profiles_update_own
on public.profiles
for update
using (id = auth.uid() and public.is_active_member())
with check (id = auth.uid() and account_status = 'active');

create policy user_roles_select_own_or_operator
on public.user_roles
for select
using (user_id = auth.uid() or public.is_operator());

create policy user_roles_insert_admin
on public.user_roles
for insert
with check (public.has_role('admin'));

create policy user_roles_update_admin
on public.user_roles
for update
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy user_roles_delete_admin
on public.user_roles
for delete
using (public.has_role('admin'));

create policy artist_verifications_select_own_or_operator
on public.artist_verifications
for select
using (user_id = auth.uid() or public.is_operator());

create policy artist_verifications_insert_own
on public.artist_verifications
for insert
with check (
  user_id = auth.uid()
  and status = 'provisional'
  and public.is_active_member()
);

create policy artist_verifications_update_admin
on public.artist_verifications
for update
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy artist_invites_select_target_or_admin
on public.artist_invites
for select
using (
  intended_user_id = auth.uid()
  or accepted_by = auth.uid()
  or public.has_role('admin')
);

create policy artist_invites_insert_admin
on public.artist_invites
for insert
with check (
  public.has_role('admin')
  and issued_by = auth.uid()
);

create policy artist_invites_update_admin
on public.artist_invites
for update
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy boards_select_all
on public.boards
for select
using (true);

create policy posts_select_authorized
on public.posts
for select
using (public.can_read_post(id));

create policy posts_insert_authorized
on public.posts
for insert
with check (
  author_id = auth.uid()
  and public.is_active_member()
  and public.can_access_board(board_id)
  and state in ('draft', 'published')
);

create policy posts_update_author_or_operator
on public.posts
for update
using (
  (
    author_id = auth.uid()
    and public.is_active_member()
    and state in ('draft', 'published')
  )
  or public.is_operator()
)
with check (
  (
    author_id = auth.uid()
    and state in ('draft', 'published', 'deleted')
  )
  or public.is_operator()
);

create policy post_sources_select_with_post
on public.post_sources
for select
using (public.can_read_post(post_id));

create policy post_sources_insert_author_or_operator
on public.post_sources
for insert
with check (
  created_by = auth.uid()
  and (
    public.is_post_author(post_id)
    or public.is_operator()
  )
);

create policy post_sources_update_author_or_operator
on public.post_sources
for update
using (
  public.is_post_author(post_id)
  or public.is_operator()
)
with check (
  public.is_post_author(post_id)
  or public.is_operator()
);

create policy post_revisions_select_with_post
on public.post_revisions
for select
using (public.can_read_post(post_id));

create policy post_revisions_insert_author_or_operator
on public.post_revisions
for insert
with check (
  editor_id = auth.uid()
  and (
    public.is_post_author(post_id)
    or public.is_operator()
  )
);

create policy comments_select_with_post
on public.comments
for select
using (
  (
    state = 'published'
    and public.can_read_post(post_id)
  )
  or author_id = auth.uid()
  or public.is_operator()
);

create policy comments_insert_authorized
on public.comments
for insert
with check (
  author_id = auth.uid()
  and public.is_active_member()
  and public.can_read_post(post_id)
  and exists (
    select 1
    from public.posts
    where id = post_id
      and state = 'published'
  )
);

create policy comments_update_author_or_operator
on public.comments
for update
using (
  (
    author_id = auth.uid()
    and public.is_active_member()
    and state = 'published'
  )
  or public.is_operator()
)
with check (
  (
    author_id = auth.uid()
    and state in ('published', 'deleted')
  )
  or public.is_operator()
);

create policy bookmarks_select_own
on public.bookmarks
for select
using (user_id = auth.uid());

create policy bookmarks_insert_own
on public.bookmarks
for insert
with check (
  user_id = auth.uid()
  and public.is_active_member()
  and public.can_read_post(post_id)
);

create policy bookmarks_delete_own
on public.bookmarks
for delete
using (user_id = auth.uid() and public.is_active_member());

create policy reports_select_own_or_operator
on public.reports
for select
using (reporter_id = auth.uid() or public.is_operator());

create policy reports_insert_own
on public.reports
for insert
with check (
  reporter_id = auth.uid()
  and public.is_active_member()
  and (
    (post_id is not null and public.can_read_post(post_id))
    or (
      comment_id is not null
      and exists (
        select 1
        from public.comments
        where id = comment_id
          and public.can_read_post(post_id)
      )
    )
  )
);

create policy reports_update_operator
on public.reports
for update
using (public.is_operator())
with check (public.is_operator());

create policy moderation_actions_select_operator
on public.moderation_actions
for select
using (public.is_operator());

create policy moderation_actions_insert_operator
on public.moderation_actions
for insert
with check (
  actor_id = auth.uid()
  and public.is_operator()
);

create policy audit_events_select_admin
on public.audit_events
for select
using (public.has_role('admin'));

create policy notifications_select_own
on public.notifications
for select
using (recipient_id = auth.uid());

create policy notifications_update_own
on public.notifications
for update
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy policy_acceptances_select_own_or_admin
on public.policy_acceptances
for select
using (user_id = auth.uid() or public.has_role('admin'));

create policy policy_acceptances_insert_own
on public.policy_acceptances
for insert
with check (
  user_id = auth.uid()
  and public.is_active_member()
);

grant usage on schema public to anon, authenticated, service_role;
grant usage on type
  public.app_role,
  public.account_status,
  public.artist_verification_status,
  public.board_audience,
  public.post_state,
  public.post_kind,
  public.comment_state,
  public.report_state,
  public.invite_state,
  public.moderation_action_type,
  public.notification_kind
to anon, authenticated, service_role;

grant select on public.boards to anon, authenticated;
grant select (id, display_name, created_at)
  on public.profiles to anon, authenticated;
grant select on public.posts, public.post_sources, public.post_revisions,
  public.comments to anon, authenticated;

grant select, insert, update on public.posts to authenticated;
grant select, insert, update on public.post_sources to authenticated;
grant select, insert on public.post_revisions to authenticated;
grant select, insert, update on public.comments to authenticated;
grant select, insert, delete on public.bookmarks to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert, update on public.artist_verifications to authenticated;
grant select, insert, update on public.artist_invites to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert on public.moderation_actions to authenticated;
grant select on public.audit_events to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert on public.policy_acceptances to authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;

grant select, insert, update, delete
  on all tables in schema public to service_role;

revoke update, delete on public.audit_events from anon, authenticated;
