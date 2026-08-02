drop function public.issue_artist_invite(
  uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz
);

create or replace function public.issue_artist_invite(
  p_id uuid,
  p_invited_email text,
  p_token_digest text,
  p_activity_name text,
  p_proof_url text,
  p_proof_url_normalized text,
  p_primary_field text,
  p_reason text,
  p_policy_version text
)
returns setof public.artist_invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_invite public.artist_invites%rowtype;
  db_now timestamptz := clock_timestamp();
begin
  if not public.has_role('admin') then
    raise exception 'admin required' using errcode = '42501';
  end if;

  insert into public.artist_invites (
    id, invited_email, token_digest, state, issued_by, reason,
    expires_at, created_at, activity_name, proof_url,
    proof_url_normalized, primary_field, policy_version
  ) values (
    p_id, lower(p_invited_email), p_token_digest, 'pending', auth.uid(),
    p_reason, db_now + interval '7 days', db_now, p_activity_name,
    p_proof_url, p_proof_url_normalized, p_primary_field, p_policy_version
  )
  returning * into created_invite;

  return next created_invite;
end;
$$;

revoke all on function public.issue_artist_invite(
  uuid, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.issue_artist_invite(
  uuid, text, text, text, text, text, text, text, text
) to authenticated;

alter type public.moderation_action_type
  add value if not exists 'reject_appeal' after 'resolve_appeal';

create table public.community_event_allowlist (
  event_id text primary key check (
    char_length(event_id) between 1 and 120
    and event_id ~ '^[a-z0-9][a-z0-9-]*$'
  ),
  is_catalog boolean not null default false,
  legacy_sources text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

insert into public.community_event_allowlist (event_id, is_catalog) values
  ('illustar-2026-winter', true),
  ('seoul-illustration-2026-v20', true),
  ('mungu-box-2026-8', true),
  ('daegu-illustration-2026', true),
  ('design-festa-2026', true);

-- Preserve syntactically valid historical links during populated upgrades, while
-- keeping them ineligible for new user mutations unless they are in the catalog.
insert into public.community_event_allowlist (
  event_id,
  is_catalog,
  legacy_sources
)
select
  observed.event_id,
  false,
  array_agg(distinct observed.source order by observed.source)
from (
  select event_id, 'posts'::text as source
  from public.posts
  where event_id is not null
  union all
  select event_id, 'event_bookmarks'::text as source
  from public.event_bookmarks
) observed
where not exists (
  select 1
  from public.community_event_allowlist catalog
  where catalog.event_id = observed.event_id
)
group by observed.event_id;

alter table public.community_event_allowlist enable row level security;
revoke all on public.community_event_allowlist from public, anon, authenticated;
grant select, insert, update, delete on public.community_event_allowlist to service_role;

alter table public.posts
  add constraint posts_event_id_allowlisted
  foreign key (event_id)
  references public.community_event_allowlist(event_id)
  on update cascade
  on delete restrict
  not valid;

alter table public.event_bookmarks
  add constraint event_bookmarks_event_id_allowlisted
  foreign key (event_id)
  references public.community_event_allowlist(event_id)
  on update cascade
  on delete restrict
  not valid;

alter table public.posts
  validate constraint posts_event_id_allowlisted;
alter table public.event_bookmarks
  validate constraint event_bookmarks_event_id_allowlisted;

drop policy if exists event_bookmarks_insert_own
  on public.event_bookmarks;
revoke insert on public.event_bookmarks from authenticated;

create or replace function public.merge_event_bookmark(p_event_id text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  bookmark_count integer;
  inserted_count integer;
begin
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.community_event_allowlist allowed
    where allowed.event_id = p_event_id
      and allowed.is_catalog
  ) then
    raise exception 'catalog event required' using errcode = '23503';
  end if;

  perform 1 from public.profiles
  where id = current_user_id
  for update;

  if exists (
    select 1 from public.event_bookmarks
    where user_id = current_user_id and event_id = p_event_id
  ) then
    return false;
  end if;

  select count(*) into bookmark_count
  from public.event_bookmarks
  where user_id = current_user_id;
  if bookmark_count >= 100 then
    raise exception 'event bookmark cap reached' using errcode = '22023';
  end if;

  insert into public.event_bookmarks (user_id, event_id, created_at)
  values (current_user_id, p_event_id, clock_timestamp())
  on conflict (user_id, event_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.merge_event_bookmark(text)
  from public, anon, authenticated;
grant execute on function public.merge_event_bookmark(text)
  to authenticated;

create or replace function public.can_write_board(target_board_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_member()
    and coalesce(
      (
        select case
          when audience = 'public' then true
          else public.has_artist_access()
        end
        from public.boards
        where id = target_board_id
      ),
      false
    )
$$;

revoke all on function public.can_write_board(text)
  from public, anon, authenticated;
grant execute on function public.can_write_board(text)
  to authenticated;

create or replace function public.create_community_post(
  p_id uuid,
  p_board_id text,
  p_category_id text,
  p_kind public.post_kind,
  p_title text,
  p_body text,
  p_source_label text,
  p_source_url text,
  p_source_checked_at date
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  created_post public.posts%rowtype;
  source_count integer := num_nonnulls(
    p_source_label,
    p_source_url,
    p_source_checked_at
  );
  db_now timestamptz := clock_timestamp();
begin
  if current_user_id is null or not public.can_write_board(p_board_id) then
    raise exception 'board write access required' using errcode = '42501';
  end if;
  if source_count not in (0, 3) then
    raise exception 'complete source fields required';
  end if;
  if source_count = 3 and p_source_url !~ '^https?://' then
    raise exception 'public source url required';
  end if;

  insert into public.posts (
    id, board_id, author_id, category_id, kind, state, title, body,
    published_at, created_at, updated_at
  ) values (
    p_id, p_board_id, current_user_id, p_category_id, p_kind, 'published',
    p_title, p_body, db_now, db_now, db_now
  )
  returning * into created_post;

  if source_count = 3 then
    insert into public.post_sources (
      post_id, label, url, checked_at, created_by, created_at
    ) values (
      created_post.id, p_source_label, p_source_url, p_source_checked_at,
      current_user_id, db_now
    );
  end if;

  return next created_post;
end;
$$;

create or replace function public.create_community_comment(
  p_id uuid,
  p_post_id uuid,
  p_body text
)
returns setof public.comments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_post public.posts%rowtype;
  created_comment public.comments%rowtype;
  db_now timestamptz := clock_timestamp();
begin
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  if nullif(trim(p_body), '') is null or char_length(trim(p_body)) > 5000 then
    raise exception 'valid comment body required';
  end if;
  select * into current_post from public.posts where id = p_post_id;
  if not found or current_post.state <> 'published'
    or not public.can_read_post(current_post.id)
    or not public.can_write_board(current_post.board_id) then
    raise exception 'published writable post required' using errcode = '42501';
  end if;

  insert into public.comments (
    id, post_id, author_id, state, body, created_at, updated_at
  ) values (
    p_id, current_post.id, current_user_id, 'published', trim(p_body), db_now, db_now
  )
  returning * into created_comment;
  return next created_comment;
end;
$$;

drop policy if exists artist_verifications_select_own_or_operator
  on public.artist_verifications;
create policy artist_verifications_select_own_or_admin
on public.artist_verifications
for select
using (user_id = auth.uid() or public.has_role('admin'));

create or replace function public.link_community_event(
  p_post_id uuid,
  p_event_id text
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare selected_post public.posts%rowtype;
begin
  if not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.community_event_allowlist allowed
    where allowed.event_id = p_event_id
      and allowed.is_catalog
  ) then
    raise exception 'allowlisted event required' using errcode = '23503';
  end if;

  select * into selected_post
  from public.posts
  where id = p_post_id
  for update;
  if not found then return; end if;
  if selected_post.author_id <> auth.uid() and not public.is_operator() then
    raise exception 'post author or operator required' using errcode = '42501';
  end if;
  if not public.can_access_board(selected_post.board_id) then
    raise exception 'board access required' using errcode = '42501';
  end if;

  update public.posts
  set event_id = p_event_id, updated_at = clock_timestamp()
  where id = selected_post.id
  returning * into selected_post;
  return next selected_post;
end;
$$;

alter table public.community_appeals
  add column action_id uuid;

update public.community_appeals appeal
set action_id = (
  select action.id
  from public.moderation_actions action
  where action.report_id = appeal.report_id
    and action.action_type in ('hide', 'lock', 'suspend_account')
  order by action.created_at desc, action.id desc
  limit 1
)
where appeal.action_id is null;

do $$
begin
  if exists (
    select 1 from public.community_appeals where action_id is null
  ) then
    raise exception 'community appeal is missing its appealed action';
  end if;
end;
$$;

alter table public.community_appeals
  alter column action_id set not null,
  add constraint community_appeals_action_id_fkey
    foreign key (action_id)
    references public.moderation_actions(id)
    on delete restrict;

create index community_appeals_action_lookup
  on public.community_appeals (action_id);

create or replace function public.enforce_community_appeal_action()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.moderation_actions action
    where action.id = new.action_id
      and action.report_id = new.report_id
      and action.action_type in ('hide', 'lock', 'suspend_account')
  ) then
    raise exception 'appeal action must restrict the appealed report'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger enforce_community_appeal_action
before insert or update of report_id, action_id
on public.community_appeals
for each row execute function public.enforce_community_appeal_action();

revoke all on function public.enforce_community_appeal_action()
  from public, anon, authenticated;

create or replace function public.moderate_community_report(
  p_report_id uuid,
  p_action public.moderation_action_type,
  p_reason text
)
returns setof public.reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_report public.reports%rowtype;
  current_post public.posts%rowtype;
  current_appeal public.community_appeals%rowtype;
  appealed_action public.moderation_actions%rowtype;
  restricting_action public.moderation_actions%rowtype;
  next_report_state public.report_state;
  next_post_state public.post_state;
  previous_account_status public.account_status;
  db_now timestamptz := clock_timestamp();
begin
  if not public.is_operator() then
    raise exception 'operator required' using errcode = '42501';
  end if;
  if p_action in ('suspend_account', 'resolve_appeal', 'reject_appeal')
    and not public.has_role('admin') then
    raise exception 'admin required' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null or char_length(p_reason) > 2000 then
    raise exception 'valid moderation reason required';
  end if;

  select * into current_report
  from public.reports
  where id = p_report_id
  for update;
  if not found or current_report.post_id is null then return; end if;

  select * into current_post
  from public.posts
  where id = current_report.post_id
  for update;
  if not found then return; end if;

  if p_action = 'triage' and current_report.state = 'open' then
    next_report_state := 'triaged';
  elsif p_action = 'dismiss' and current_report.state in ('open', 'triaged') then
    next_report_state := 'dismissed';
  elsif p_action in ('hide', 'lock', 'suspend_account')
    and current_report.state in ('open', 'triaged') then
    next_report_state := 'actioned';
  elsif p_action = 'restore' and current_report.state = 'actioned' then
    select * into restricting_action
    from public.moderation_actions action
    where action.report_id = current_report.id
      and action.target_type = 'post'
      and action.target_id = current_post.id
      and action.action_type in ('hide', 'lock')
    order by action.created_at desc, action.id desc
    limit 1;
    if not found
      or not (
        (restricting_action.action_type = 'hide' and current_post.state = 'hidden')
        or (restricting_action.action_type = 'lock' and current_post.state = 'locked')
      )
      or exists (
        select 1
        from public.moderation_actions later_action
        where later_action.target_type = 'post'
          and later_action.target_id = current_post.id
          and later_action.action_type in ('hide', 'lock')
          and (later_action.created_at, later_action.id)
            > (restricting_action.created_at, restricting_action.id)
      ) then
      raise exception 'current causal restriction required';
    end if;
    next_report_state := 'closed';
  elsif p_action in ('resolve_appeal', 'reject_appeal')
    and current_report.state = 'appealed' then
    next_report_state := 'closed';
    select * into current_appeal
    from public.community_appeals
    where report_id = current_report.id;
    if not found then
      raise exception 'appealed action required';
    end if;
    select * into appealed_action
    from public.moderation_actions
    where id = current_appeal.action_id
      and report_id = current_report.id;
    if not found then
      raise exception 'appealed action required';
    end if;
  else
    raise exception 'invalid moderation transition';
  end if;

  next_post_state := current_post.state;
  if p_action = 'hide' then
    next_post_state := 'hidden';
  elsif p_action = 'lock' then
    next_post_state := 'locked';
  elsif p_action = 'restore' then
    next_post_state := 'published';
  elsif p_action = 'resolve_appeal'
    and (
      (appealed_action.action_type = 'hide' and current_post.state = 'hidden')
      or (appealed_action.action_type = 'lock' and current_post.state = 'locked')
    )
    and not exists (
      select 1
      from public.moderation_actions later_action
      where later_action.target_type = 'post'
        and later_action.target_id = current_post.id
        and later_action.action_type in ('hide', 'lock')
        and (later_action.created_at, later_action.id)
          > (appealed_action.created_at, appealed_action.id)
    ) then
    next_post_state := 'published';
  end if;

  insert into public.moderation_actions (
    report_id, actor_id, action_type, target_type, target_id, reason,
    previous_state, next_state, created_at
  ) values (
    current_report.id, auth.uid(), p_action, 'post', current_post.id,
    trim(p_reason),
    jsonb_build_object('report', current_report.state, 'post', current_post.state),
    jsonb_build_object('report', next_report_state, 'post', next_post_state),
    db_now
  );

  if next_post_state <> current_post.state then
    update public.posts set state = next_post_state, updated_at = db_now
    where id = current_post.id;
  end if;

  if p_action = 'suspend_account' then
    select account_status into previous_account_status
    from public.profiles where id = current_post.author_id for update;
    update public.profiles
    set account_status = 'suspended', updated_at = db_now
    where id = current_post.author_id;
    insert into public.audit_events (
      actor_id, action, target_type, target_id, reason,
      before_state, after_state, created_at
    ) values (
      auth.uid(), 'account_suspended', 'account', current_post.author_id,
      trim(p_reason),
      jsonb_build_object('account_status', previous_account_status),
      jsonb_build_object('account_status', 'suspended'), db_now
    );
  elsif p_action = 'resolve_appeal'
    and appealed_action.action_type = 'suspend_account' then
    select account_status into previous_account_status
    from public.profiles where id = current_post.author_id for update;
    if previous_account_status = 'suspended'
      and not exists (
        select 1
        from public.moderation_actions later_action
        join public.posts later_post
          on later_action.target_type = 'post'
          and later_action.target_id = later_post.id
        where later_action.action_type = 'suspend_account'
          and later_post.author_id = current_post.author_id
          and (later_action.created_at, later_action.id)
            > (appealed_action.created_at, appealed_action.id)
      ) then
      update public.profiles
      set account_status = 'active', updated_at = db_now
      where id = current_post.author_id;
      insert into public.audit_events (
        actor_id, action, target_type, target_id, reason,
        before_state, after_state, created_at
      ) values (
        auth.uid(), 'account_suspension_reversed', 'account', current_post.author_id,
        trim(p_reason),
        jsonb_build_object('account_status', previous_account_status),
        jsonb_build_object('account_status', 'active'), db_now
      );
    end if;
  end if;

  update public.reports
  set state = next_report_state, assigned_to = auth.uid(),
      resolution_reason = trim(p_reason),
      closed_at = case
        when next_report_state in ('dismissed', 'closed') then db_now else null
      end,
      updated_at = db_now
  where id = current_report.id
  returning * into current_report;

  return next current_report;
end;
$$;

create or replace function public.notify_community_moderation_action()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  report_record public.reports%rowtype;
  post_record public.posts%rowtype;
  notification_type public.notification_kind;
  event_payload jsonb;
  appeal_deadline timestamptz;
begin
  if new.action_type = 'triage' or new.report_id is null then return new; end if;
  select * into report_record from public.reports where id = new.report_id;
  if not found or report_record.post_id is null then return new; end if;
  select * into post_record from public.posts where id = report_record.post_id;
  if not found then return new; end if;
  notification_type := case
    when new.action_type in ('resolve_appeal', 'reject_appeal')
      then 'appeal_outcome'::public.notification_kind
    else 'moderation_outcome'::public.notification_kind
  end;
  appeal_deadline := case
    when new.action_type in ('hide', 'lock', 'suspend_account')
      then new.created_at + interval '14 days'
    else null
  end;
  event_payload := jsonb_build_object(
    'action', new.action_type,
    'reason', new.reason,
    'report_id', report_record.id,
    'post_id', post_record.id,
    'board_id', post_record.board_id,
    'post_title', post_record.title,
    'affected_user_id', post_record.author_id,
    'appeal_deadline_at', appeal_deadline
  );
  perform public.enqueue_community_notification(
    report_record.reporter_id, notification_type, new.actor_id, 'report',
    report_record.id, new.id::text, event_payload, new.created_at
  );
  perform public.enqueue_community_notification(
    post_record.author_id, notification_type, new.actor_id, 'report',
    report_record.id, new.id::text, event_payload, new.created_at
  );
  return new;
end;
$$;

create or replace function public.get_community_appeal_context(p_report_id uuid)
returns table (
  report_id uuid,
  post_id uuid,
  post_title text,
  affected_user_id uuid,
  report_state public.report_state,
  action_type public.moderation_action_type,
  action_at timestamptz,
  deadline_at timestamptz,
  appealed_at timestamptz,
  appeal_reason text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  selected_report public.reports%rowtype;
  selected_post public.posts%rowtype;
  selected_action public.moderation_actions%rowtype;
  selected_appeal public.community_appeals%rowtype;
begin
  if auth.uid() is null then return; end if;
  select * into selected_report from public.reports where id = p_report_id;
  if not found or selected_report.post_id is null then return; end if;
  select * into selected_post from public.posts where id = selected_report.post_id;
  if not found or selected_post.author_id <> auth.uid() then return; end if;

  select * into selected_appeal
  from public.community_appeals appeal
  where appeal.report_id = selected_report.id
    and appeal.affected_user_id = auth.uid();

  if found then
    select * into selected_action
    from public.moderation_actions action
    where action.id = selected_appeal.action_id;
  else
    select * into selected_action
    from public.moderation_actions action
    where action.report_id = selected_report.id
      and action.action_type in ('hide', 'lock', 'suspend_account')
    order by action.created_at desc, action.id desc
    limit 1;
  end if;
  if not found then return; end if;

  report_id := selected_report.id;
  post_id := selected_post.id;
  post_title := selected_post.title;
  affected_user_id := selected_post.author_id;
  report_state := selected_report.state;
  action_type := selected_action.action_type;
  action_at := selected_action.created_at;
  deadline_at := selected_action.created_at + interval '14 days';
  appealed_at := selected_report.appealed_at;
  appeal_reason := selected_appeal.reason;
  return next;
end;
$$;

create or replace function public.submit_community_appeal(
  p_report_id uuid,
  p_reason text
)
returns table (
  report_id uuid,
  post_id uuid,
  post_title text,
  affected_user_id uuid,
  report_state public.report_state,
  action_type public.moderation_action_type,
  action_at timestamptz,
  deadline_at timestamptz,
  appealed_at timestamptz,
  appeal_reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_report public.reports%rowtype;
  selected_post public.posts%rowtype;
  selected_action public.moderation_actions%rowtype;
  before_report jsonb;
  db_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and account_status in ('active', 'suspended')
  ) then
    raise exception 'affected account required' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null
    or char_length(trim(p_reason)) not between 10 and 2000 then
    raise exception 'valid appeal reason required';
  end if;

  select * into selected_report
  from public.reports where id = p_report_id for update;
  if not found or selected_report.post_id is null then return; end if;
  select * into selected_post
  from public.posts where id = selected_report.post_id for update;
  if not found or selected_post.author_id <> auth.uid() then
    raise exception 'affected post author required' using errcode = '42501';
  end if;
  if selected_report.state <> 'actioned' then
    raise exception 'report is not appealable';
  end if;
  select * into selected_action
  from public.moderation_actions action
  where action.report_id = selected_report.id
    and action.action_type in ('hide', 'lock', 'suspend_account')
  order by action.created_at desc, action.id desc
  limit 1;
  if not found then raise exception 'appealable action required'; end if;
  if db_now > selected_action.created_at + interval '14 days' then
    raise exception 'appeal deadline expired' using errcode = '22023';
  end if;

  before_report := to_jsonb(selected_report);
  insert into public.community_appeals (
    report_id, action_id, affected_user_id, reason, created_at
  ) values (
    selected_report.id, selected_action.id, auth.uid(), trim(p_reason), db_now
  );

  update public.reports
  set state = 'appealed', appealed_at = db_now, updated_at = db_now
  where id = selected_report.id
  returning * into selected_report;

  insert into public.audit_events (
    actor_id, action, target_type, target_id, reason,
    before_state, after_state, created_at
  ) values (
    auth.uid(), 'appeal_submitted', 'report', selected_report.id,
    trim(p_reason), before_report, to_jsonb(selected_report), db_now
  );

  return query select * from public.get_community_appeal_context(selected_report.id);
end;
$$;
