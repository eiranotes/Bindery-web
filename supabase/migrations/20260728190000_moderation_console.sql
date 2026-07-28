create or replace function public.moderate_community_report(
  p_report_id uuid,
  p_action public.moderation_action_type,
  p_reason text,
  p_acted_at timestamptz default now()
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
  if not found or current_report.post_id is null then
    return;
  end if;

  select * into current_post
  from public.posts
  where id = current_report.post_id
  for update;
  if not found then
    return;
  end if;

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

  next_post_state := current_post.state;
  if p_action = 'hide' then
    next_post_state := 'hidden';
  elsif p_action = 'lock' then
    next_post_state := 'locked';
  elsif p_action in ('restore', 'resolve_appeal') then
    next_post_state := 'published';
  end if;

  insert into public.moderation_actions (
    report_id, actor_id, action_type, target_type, target_id, reason,
    previous_state, next_state, created_at
  )
  values (
    current_report.id, auth.uid(), p_action, 'post', current_post.id,
    trim(p_reason),
    jsonb_build_object('report', current_report.state, 'post', current_post.state),
    jsonb_build_object('report', next_report_state, 'post', next_post_state),
    p_acted_at
  );

  if next_post_state <> current_post.state then
    update public.posts
    set state = next_post_state, updated_at = p_acted_at
    where id = current_post.id;
  end if;

  if p_action = 'suspend_account' then
    update public.profiles
    set account_status = 'suspended', updated_at = p_acted_at
    where id = current_post.author_id;
  end if;

  update public.reports
  set
    state = next_report_state,
    assigned_to = auth.uid(),
    resolution_reason = trim(p_reason),
    closed_at = case when next_report_state in ('dismissed', 'closed') then p_acted_at else null end,
    updated_at = p_acted_at
  where id = current_report.id
  returning * into current_report;

  return next current_report;
end;
$$;

revoke all on function public.moderate_community_report(uuid, public.moderation_action_type, text, timestamptz) from public;
grant execute on function public.moderate_community_report(uuid, public.moderation_action_type, text, timestamptz) to authenticated;
