alter table public.reports
  add column appealed_at timestamptz;

create table public.community_appeals (
  report_id uuid primary key references public.reports(id) on delete cascade,
  affected_user_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 2000),
  created_at timestamptz not null default now()
);

alter table public.community_appeals enable row level security;
grant select, insert, update, delete on public.community_appeals to service_role;

create index reports_appeal_deadline_lookup
  on public.moderation_actions (report_id, created_at desc)
  where action_type in ('hide', 'lock', 'suspend_account');

do $$
begin
  if exists (
    select 1
    from public.posts post
    join public.comments comment on comment.id = post.accepted_comment_id
    where comment.post_id <> post.id
  ) then
    raise exception 'accepted comment must belong to its post';
  end if;
end;
$$;

create or replace function public.enforce_accepted_comment_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.accepted_comment_id is not null and not exists (
    select 1
    from public.comments
    where id = new.accepted_comment_id
      and post_id = new.id
  ) then
    raise exception 'accepted comment must belong to its post'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_accepted_comment_post on public.posts;
create trigger enforce_accepted_comment_post
before insert or update of accepted_comment_id on public.posts
for each row execute function public.enforce_accepted_comment_post();

revoke insert, update, delete on public.posts from authenticated;
revoke insert, update, delete on public.post_sources from authenticated;
revoke insert, update, delete on public.post_revisions from authenticated;
revoke insert, update, delete on public.comments from authenticated;
revoke insert, update, delete on public.bookmarks from authenticated;
revoke insert, update, delete on public.reports from authenticated;
revoke insert, update, delete on public.moderation_actions from authenticated;

drop function public.create_community_post(
  uuid, text, text, public.post_kind, text, text, text, text, date, timestamptz
);

create or replace function public.create_community_post(
  p_id uuid,
  p_board_id text,
  p_category_id text,
  p_kind public.post_kind,
  p_title text,
  p_body text,
  p_source_label text,
  p_source_url text,
  p_source_checked_at date,
  p_published_at timestamptz
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select * from public.create_community_post(
    p_id,
    p_board_id,
    p_category_id,
    p_kind,
    p_title,
    p_body,
    p_source_label,
    p_source_url,
    p_source_checked_at
  );
end;
$$;

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
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  if not public.can_access_board(p_board_id) then
    raise exception 'board access required' using errcode = '42501';
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

drop function public.soft_delete_community_post(uuid, text, timestamptz);

create or replace function public.soft_delete_community_post(
  p_post_id uuid,
  p_reason text,
  p_deleted_at timestamptz
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select * from public.soft_delete_community_post(p_post_id, p_reason);
end;
$$;

create or replace function public.soft_delete_community_post(
  p_post_id uuid,
  p_reason text
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_post public.posts%rowtype;
  db_now timestamptz := clock_timestamp();
begin
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null or char_length(p_reason) > 500 then
    raise exception 'valid deletion reason required';
  end if;

  select * into current_post
  from public.posts
  where id = p_post_id
  for update;

  if not found then return; end if;
  if current_post.state not in ('draft', 'published', 'locked') then
    raise exception 'post cannot be deleted in current state';
  end if;
  if current_post.author_id <> current_user_id and not public.is_operator() then
    raise exception 'post author or operator required' using errcode = '42501';
  end if;

  insert into public.post_revisions (
    post_id, editor_id, title, body, reason, created_at
  ) values (
    current_post.id, current_user_id, current_post.title, current_post.body,
    trim(p_reason), db_now
  );

  update public.posts
  set state = 'deleted', deleted_at = db_now, deleted_by = current_user_id,
      deletion_reason = trim(p_reason), updated_at = db_now
  where id = current_post.id
  returning * into current_post;

  return next current_post;
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
    or not public.can_read_post(current_post.id) then
    raise exception 'published readable post required' using errcode = '42501';
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

create or replace function public.set_community_bookmark(
  p_post_id uuid,
  p_saved boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.is_active_member()
    or not public.can_read_post(p_post_id) then
    raise exception 'active member with post access required' using errcode = '42501';
  end if;
  if p_saved then
    insert into public.bookmarks (user_id, post_id, created_at)
    values (current_user_id, p_post_id, clock_timestamp())
    on conflict (user_id, post_id) do nothing;
  else
    delete from public.bookmarks
    where user_id = current_user_id and post_id = p_post_id;
  end if;
  return p_saved;
end;
$$;

create or replace function public.merge_community_bookmark(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  inserted_count integer;
begin
  if current_user_id is null or not public.is_active_member()
    or not public.can_read_post(p_post_id) then
    raise exception 'active member with post access required' using errcode = '42501';
  end if;
  insert into public.bookmarks (user_id, post_id, created_at)
  values (current_user_id, p_post_id, clock_timestamp())
  on conflict (user_id, post_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

create or replace function public.submit_community_report(
  p_id uuid,
  p_post_id uuid,
  p_reason_code text,
  p_details text
)
returns table (id uuid, existing boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  existing_id uuid;
begin
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  if p_reason_code not in (
    'spam', 'harassment', 'personal_information', 'misinformation', 'fraud', 'other'
  ) or (p_details is not null and char_length(trim(p_details)) > 2000) then
    raise exception 'valid report required';
  end if;
  if not exists (
    select 1 from public.posts
    where posts.id = p_post_id
      and posts.state = 'published'
      and public.can_read_post(posts.id)
  ) then
    raise exception 'published readable post required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(current_user_id::text),
    hashtext(p_post_id::text || ':' || p_reason_code)
  );
  select report.id into existing_id
  from public.reports report
  where report.reporter_id = current_user_id
    and report.post_id = p_post_id
    and report.reason_code = p_reason_code
    and report.state not in ('dismissed', 'closed')
  limit 1;
  if existing_id is not null then
    id := existing_id;
    existing := true;
    return next;
    return;
  end if;

  insert into public.reports (
    id, reporter_id, post_id, reason_code, details, created_at, updated_at
  ) values (
    p_id, current_user_id, p_post_id, p_reason_code,
    nullif(trim(p_details), ''), clock_timestamp(), clock_timestamp()
  )
  returning reports.id into id;
  existing := false;
  return next;
end;
$$;

drop function public.moderate_community_report(
  uuid, public.moderation_action_type, text, timestamptz
);

create or replace function public.moderate_community_report(
  p_report_id uuid,
  p_action public.moderation_action_type,
  p_reason text,
  p_acted_at timestamptz
)
returns setof public.reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select * from public.moderate_community_report(p_report_id, p_action, p_reason);
end;
$$;

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
  next_report_state public.report_state;
  next_post_state public.post_state;
  previous_account_status public.account_status;
  adverse_action public.moderation_action_type;
  db_now timestamptz := clock_timestamp();
begin
  if not public.is_operator() then
    raise exception 'operator required' using errcode = '42501';
  end if;
  if p_action in ('suspend_account', 'resolve_appeal')
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
  elsif p_action = 'restore' and current_report.state in ('actioned', 'dismissed') then
    next_report_state := 'closed';
  elsif p_action = 'resolve_appeal' and current_report.state = 'appealed' then
    next_report_state := 'closed';
  else
    raise exception 'invalid moderation transition';
  end if;

  select action.action_type into adverse_action
  from public.moderation_actions action
  where action.report_id = current_report.id
    and action.action_type in ('hide', 'lock', 'suspend_account')
  order by action.created_at desc
  limit 1;

  next_post_state := current_post.state;
  if p_action = 'hide' then next_post_state := 'hidden';
  elsif p_action = 'lock' then next_post_state := 'locked';
  elsif p_action in ('restore', 'resolve_appeal') then next_post_state := 'published';
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
  elsif p_action = 'resolve_appeal' and adverse_action = 'suspend_account' then
    select account_status into previous_account_status
    from public.profiles where id = current_post.author_id for update;
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
  select * into selected_action
  from public.moderation_actions action
  where action.report_id = selected_report.id
    and action.action_type in ('hide', 'lock', 'suspend_account')
  order by action.created_at desc
  limit 1;
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
  select * into selected_appeal
  from public.community_appeals as appeal
  where appeal.report_id = selected_report.id
    and appeal.affected_user_id = auth.uid();
  appeal_reason := case when found then selected_appeal.reason else null end;
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
  order by action.created_at desc
  limit 1;
  if not found then raise exception 'appealable action required'; end if;
  if db_now > selected_action.created_at + interval '14 days' then
    raise exception 'appeal deadline expired' using errcode = '22023';
  end if;

  before_report := to_jsonb(selected_report);
  insert into public.community_appeals (
    report_id, affected_user_id, reason, created_at
  ) values (
    selected_report.id, auth.uid(), trim(p_reason), db_now
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

drop function public.accept_community_answer(uuid, timestamptz);

create or replace function public.accept_community_answer(
  p_comment_id uuid,
  p_accepted_at timestamptz
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query select * from public.accept_community_answer(p_comment_id);
end;
$$;

create or replace function public.accept_community_answer(p_comment_id uuid)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_comment public.comments%rowtype;
  selected_post public.posts%rowtype;
begin
  if auth.uid() is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  select * into selected_comment
  from public.comments where id = p_comment_id and state = 'published';
  if not found then return; end if;
  select * into selected_post
  from public.posts where id = selected_comment.post_id for update;
  if not found then return; end if;
  if selected_post.author_id <> auth.uid() then
    raise exception 'post author required' using errcode = '42501';
  end if;
  if selected_post.kind <> 'question'
    or selected_post.state <> 'published' then
    raise exception 'published question required';
  end if;
  update public.posts
  set accepted_comment_id = selected_comment.id, is_resolved = true,
      updated_at = clock_timestamp()
  where id = selected_post.id
  returning * into selected_post;
  return next selected_post;
end;
$$;

drop function public.link_community_event(uuid, text, timestamptz);

create or replace function public.link_community_event(
  p_post_id uuid,
  p_event_id text,
  p_linked_at timestamptz
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query select * from public.link_community_event(p_post_id, p_event_id);
end;
$$;

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
  if p_event_id !~ '^[a-z0-9][a-z0-9-]{1,79}$' then
    raise exception 'valid event id required';
  end if;
  select * into selected_post from public.posts where id = p_post_id for update;
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

drop function public.promote_community_note(uuid, uuid, text, text, timestamptz);

create or replace function public.promote_community_note(
  p_id uuid,
  p_source_post_id uuid,
  p_slug text,
  p_summary text,
  p_promoted_at timestamptz
)
returns setof public.community_note_promotions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select * from public.promote_community_note(
    p_id, p_source_post_id, p_slug, p_summary
  );
end;
$$;

create or replace function public.promote_community_note(
  p_id uuid,
  p_source_post_id uuid,
  p_slug text,
  p_summary text
)
returns setof public.community_note_promotions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_post public.posts%rowtype;
  selected_source public.post_sources%rowtype;
  selected_answer public.comments%rowtype;
  author_name text;
  created_note public.community_note_promotions%rowtype;
begin
  if not public.is_operator() then
    raise exception 'operator required' using errcode = '42501';
  end if;
  select * into selected_post from public.posts
  where id = p_source_post_id for update;
  if not found then return; end if;
  if selected_post.board_id <> 'general'
    or selected_post.state <> 'published'
    or not selected_post.is_resolved
    or selected_post.accepted_comment_id is null then
    raise exception 'resolved public post required';
  end if;
  select * into selected_source from public.post_sources
  where post_id = selected_post.id order by checked_at desc limit 1;
  if not found then raise exception 'source required'; end if;
  select * into selected_answer from public.comments
  where id = selected_post.accepted_comment_id
    and post_id = selected_post.id and state = 'published';
  if not found then raise exception 'accepted answer required'; end if;
  select display_name into author_name from public.profiles
  where id = selected_post.author_id;
  insert into public.community_note_promotions (
    id, slug, title, summary, body, source_post_id, source_author_id,
    source_author_name, source_url, source_checked_at, promoted_by, promoted_at
  ) values (
    p_id, lower(p_slug), selected_post.title, trim(p_summary),
    selected_post.body || E'\n\n채택 답변\n' || selected_answer.body,
    selected_post.id, selected_post.author_id, author_name,
    selected_source.url, selected_source.checked_at, auth.uid(), clock_timestamp()
  ) returning * into created_note;
  return next created_note;
end;
$$;

drop function public.mark_community_notification_read(uuid, timestamptz);

create or replace function public.mark_community_notification_read(
  p_notification_id uuid,
  p_read_at timestamptz
)
returns setof public.notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select * from public.mark_community_notification_read(p_notification_id);
end;
$$;

create or replace function public.mark_community_notification_read(
  p_notification_id uuid
)
returns setof public.notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare updated_notification public.notifications%rowtype;
begin
  if auth.uid() is null then return; end if;
  update public.notifications
  set read_at = coalesce(read_at, clock_timestamp())
  where id = p_notification_id and recipient_id = auth.uid()
  returning * into updated_notification;
  if found then return next updated_notification; end if;
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
    when new.action_type = 'resolve_appeal' then 'appeal_outcome'::public.notification_kind
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

revoke all on function public.create_community_post(
  uuid, text, text, public.post_kind, text, text, text, text, date, timestamptz
) from public, anon, authenticated;
revoke all on function public.create_community_post(
  uuid, text, text, public.post_kind, text, text, text, text, date
) from public, anon, authenticated;
revoke all on function public.soft_delete_community_post(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.soft_delete_community_post(uuid, text)
  from public, anon, authenticated;
revoke all on function public.create_community_comment(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.set_community_bookmark(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.merge_community_bookmark(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_community_report(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.moderate_community_report(
  uuid, public.moderation_action_type, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.moderate_community_report(
  uuid, public.moderation_action_type, text
) from public, anon, authenticated;
revoke all on function public.get_community_appeal_context(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_community_appeal(uuid, text)
  from public, anon, authenticated;
revoke all on function public.accept_community_answer(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.accept_community_answer(uuid)
  from public, anon, authenticated;
revoke all on function public.link_community_event(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.link_community_event(uuid, text)
  from public, anon, authenticated;
revoke all on function public.promote_community_note(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.promote_community_note(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.mark_community_notification_read(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.mark_community_notification_read(uuid)
  from public, anon, authenticated;
revoke all on function public.enforce_accepted_comment_post()
  from public, anon, authenticated;

grant execute on function public.create_community_post(
  uuid, text, text, public.post_kind, text, text, text, text, date, timestamptz
) to authenticated;
grant execute on function public.create_community_post(
  uuid, text, text, public.post_kind, text, text, text, text, date
) to authenticated;
grant execute on function public.soft_delete_community_post(uuid, text, timestamptz)
  to authenticated;
grant execute on function public.soft_delete_community_post(uuid, text)
  to authenticated;
grant execute on function public.create_community_comment(uuid, uuid, text)
  to authenticated;
grant execute on function public.set_community_bookmark(uuid, boolean)
  to authenticated;
grant execute on function public.merge_community_bookmark(uuid)
  to authenticated;
grant execute on function public.submit_community_report(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.moderate_community_report(
  uuid, public.moderation_action_type, text, timestamptz
) to authenticated;
grant execute on function public.moderate_community_report(
  uuid, public.moderation_action_type, text
) to authenticated;
grant execute on function public.get_community_appeal_context(uuid)
  to authenticated;
grant execute on function public.submit_community_appeal(uuid, text)
  to authenticated;
grant execute on function public.accept_community_answer(uuid, timestamptz)
  to authenticated;
grant execute on function public.accept_community_answer(uuid)
  to authenticated;
grant execute on function public.link_community_event(uuid, text, timestamptz)
  to authenticated;
grant execute on function public.link_community_event(uuid, text)
  to authenticated;
grant execute on function public.promote_community_note(uuid, uuid, text, text, timestamptz)
  to authenticated;
grant execute on function public.promote_community_note(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.mark_community_notification_read(uuid, timestamptz)
  to authenticated;
grant execute on function public.mark_community_notification_read(uuid)
  to authenticated;
