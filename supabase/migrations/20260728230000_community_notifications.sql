create or replace function public.enqueue_community_notification(
  p_recipient_id uuid,
  p_kind public.notification_kind,
  p_actor_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_event_id text,
  p_payload jsonb default '{}'::jsonb,
  p_created_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_recipient_id is null
    or p_recipient_id = p_actor_id
    or nullif(trim(p_target_type), '') is null
    or nullif(trim(p_event_id), '') is null then
    return;
  end if;

  insert into public.notifications (
    recipient_id,
    kind,
    actor_id,
    target_type,
    target_id,
    deduplication_key,
    payload,
    created_at
  )
  values (
    p_recipient_id,
    p_kind,
    p_actor_id,
    trim(p_target_type),
    p_target_id,
    p_kind::text || ':' || trim(p_event_id),
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_created_at, now())
  )
  on conflict (recipient_id, deduplication_key) do nothing;
end;
$$;

create or replace function public.notify_community_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient uuid;
  parent_author uuid;
  post_record public.posts%rowtype;
begin
  if new.state <> 'published' then return new; end if;

  select * into post_record from public.posts where id = new.post_id;
  if not found then return new; end if;

  if new.parent_id is not null then
    select author_id into parent_author
    from public.comments
    where id = new.parent_id and post_id = new.post_id;
  end if;
  recipient := coalesce(parent_author, post_record.author_id);

  perform public.enqueue_community_notification(
    recipient,
    'reply',
    new.author_id,
    'post',
    new.post_id,
    new.id::text,
    jsonb_build_object(
      'comment_id', new.id,
      'post_id', new.post_id,
      'board_id', post_record.board_id,
      'post_title', post_record.title
    ),
    new.created_at
  );
  return new;
end;
$$;

drop trigger if exists notify_community_comment_created on public.comments;
create trigger notify_community_comment_created
after insert on public.comments
for each row execute function public.notify_community_comment();

create or replace function public.notify_community_answer_accepted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  answer_author uuid;
begin
  if new.accepted_comment_id is null
    or new.accepted_comment_id is not distinct from old.accepted_comment_id then
    return new;
  end if;

  select author_id into answer_author
  from public.comments
  where id = new.accepted_comment_id
    and post_id = new.id
    and state = 'published';

  perform public.enqueue_community_notification(
    answer_author,
    'answer_accepted',
    auth.uid(),
    'post',
    new.id,
    new.accepted_comment_id::text,
    jsonb_build_object(
      'comment_id', new.accepted_comment_id,
      'post_id', new.id,
      'board_id', new.board_id,
      'post_title', new.title
    ),
    new.updated_at
  );
  return new;
end;
$$;

drop trigger if exists notify_community_answer_accepted on public.posts;
create trigger notify_community_answer_accepted
after update of accepted_comment_id, is_resolved on public.posts
for each row execute function public.notify_community_answer_accepted();

create or replace function public.notify_artist_verification_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is not distinct from old.status then return new; end if;

  perform public.enqueue_community_notification(
    new.user_id,
    'verification_decision',
    coalesce(new.reviewed_by, auth.uid()),
    'artist_verification',
    new.id,
    new.id::text || ':' || new.status::text,
    jsonb_build_object(
      'status', new.status,
      'reason', new.review_reason
    ),
    coalesce(new.reviewed_at, new.updated_at)
  );
  return new;
end;
$$;

drop trigger if exists notify_artist_verification_decision on public.artist_verifications;
create trigger notify_artist_verification_decision
after update of status on public.artist_verifications
for each row execute function public.notify_artist_verification_decision();

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
  event_payload := jsonb_build_object(
    'action', new.action_type,
    'reason', new.reason,
    'report_id', report_record.id,
    'post_id', post_record.id,
    'board_id', post_record.board_id,
    'post_title', post_record.title
  );

  perform public.enqueue_community_notification(
    report_record.reporter_id,
    notification_type,
    new.actor_id,
    'report',
    report_record.id,
    new.id::text,
    event_payload,
    new.created_at
  );
  perform public.enqueue_community_notification(
    post_record.author_id,
    notification_type,
    new.actor_id,
    'report',
    report_record.id,
    new.id::text,
    event_payload,
    new.created_at
  );
  return new;
end;
$$;

drop trigger if exists notify_community_moderation_action on public.moderation_actions;
create trigger notify_community_moderation_action
after insert on public.moderation_actions
for each row execute function public.notify_community_moderation_action();

create or replace function public.mark_community_notification_read(
  p_notification_id uuid,
  p_read_at timestamptz default now()
)
returns setof public.notifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_notification public.notifications%rowtype;
begin
  if auth.uid() is null then return; end if;

  update public.notifications
  set read_at = coalesce(read_at, p_read_at, now())
  where id = p_notification_id
    and recipient_id = auth.uid()
  returning * into updated_notification;

  if found then return next updated_notification; end if;
end;
$$;

revoke all on function public.enqueue_community_notification(
  uuid, public.notification_kind, uuid, text, uuid, text, jsonb, timestamptz
) from public, anon, authenticated;
revoke all on function public.notify_community_comment() from public, anon, authenticated;
revoke all on function public.notify_community_answer_accepted() from public, anon, authenticated;
revoke all on function public.notify_artist_verification_decision() from public, anon, authenticated;
revoke all on function public.notify_community_moderation_action() from public, anon, authenticated;
revoke all on function public.mark_community_notification_read(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mark_community_notification_read(uuid, timestamptz)
  to authenticated;

revoke update on public.notifications from authenticated;
