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
        or (
          author_id = auth.uid()
          and public.can_access_board(board_id)
        )
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
        and public.can_access_board(board_id)
    )
$$;

drop policy posts_update_author_or_operator on public.posts;
create policy posts_update_author_or_operator
on public.posts
for update
using (
  (
    author_id = auth.uid()
    and public.is_active_member()
    and public.can_access_board(board_id)
    and state in ('draft', 'published')
  )
  or public.is_operator()
)
with check (
  (
    author_id = auth.uid()
    and public.can_access_board(board_id)
    and state in ('draft', 'published', 'deleted')
  )
  or public.is_operator()
);

drop policy comments_select_with_post on public.comments;
create policy comments_select_with_post
on public.comments
for select
using (
  (
    state = 'published'
    and public.can_read_post(post_id)
  )
  or (
    author_id = auth.uid()
    and exists (
      select 1
      from public.posts
      where id = post_id
        and public.can_access_board(board_id)
    )
  )
  or public.is_operator()
);

drop policy comments_update_author_or_operator on public.comments;
create policy comments_update_author_or_operator
on public.comments
for update
using (
  (
    author_id = auth.uid()
    and public.is_active_member()
    and state = 'published'
    and exists (
      select 1
      from public.posts
      where id = post_id
        and public.can_access_board(board_id)
    )
  )
  or public.is_operator()
)
with check (
  (
    author_id = auth.uid()
    and state in ('published', 'deleted')
    and exists (
      select 1
      from public.posts
      where id = post_id
        and public.can_access_board(board_id)
    )
  )
  or public.is_operator()
);

create or replace function public.check_provisional_artist_content_limit(
  p_action text,
  p_now timestamptz default now()
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  usage_count integer;
  first_used_at timestamptz;
  action_limit integer;
begin
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  if p_action not in ('post', 'comment') then
    raise exception 'invalid artist content action';
  end if;
  if not exists (
    select 1
    from public.artist_verifications
    where user_id = current_user_id
      and status = 'provisional'
  ) then
    allowed := true;
    retry_after_seconds := 0;
    return next;
    return;
  end if;

  action_limit := case when p_action = 'post' then 1 else 5 end;
  if p_action = 'post' then
    select count(*), min(created_at)
    into usage_count, first_used_at
    from public.posts
    where author_id = current_user_id
      and board_id = 'artists'
      and created_at > p_now - interval '24 hours';
  else
    select count(*), min(comment.created_at)
    into usage_count, first_used_at
    from public.comments comment
    join public.posts post on post.id = comment.post_id
    where comment.author_id = current_user_id
      and post.board_id = 'artists'
      and comment.created_at > p_now - interval '24 hours';
  end if;

  allowed := usage_count < action_limit;
  retry_after_seconds := case
    when allowed or first_used_at is null then 0
    else greatest(
      1,
      ceil(extract(epoch from (first_used_at + interval '24 hours' - p_now)))::integer
    )
  end;
  return next;
end;
$$;

create or replace function public.enforce_provisional_artist_content_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_author_id uuid;
  target_board_id text;
  target_action text;
  usage_count integer;
  action_limit integer;
begin
  if tg_table_name = 'posts' then
    target_author_id := new.author_id;
    target_board_id := new.board_id;
    target_action := 'post';
  else
    target_author_id := new.author_id;
    select board_id into target_board_id
    from public.posts
    where id = new.post_id;
    target_action := 'comment';
  end if;

  if target_board_id <> 'artists' or not exists (
    select 1
    from public.artist_verifications
    where user_id = target_author_id
      and status = 'provisional'
  ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(target_author_id::text),
    hashtext(target_action)
  );
  action_limit := case when target_action = 'post' then 1 else 5 end;

  if target_action = 'post' then
    select count(*) into usage_count
    from public.posts
    where author_id = target_author_id
      and board_id = 'artists'
      and created_at > new.created_at - interval '24 hours';
  else
    select count(*) into usage_count
    from public.comments comment
    join public.posts post on post.id = comment.post_id
    where comment.author_id = target_author_id
      and post.board_id = 'artists'
      and comment.created_at > new.created_at - interval '24 hours';
  end if;

  if usage_count >= action_limit then
    raise exception 'provisional artist % limit exceeded', target_action
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger enforce_provisional_artist_post_limit
before insert on public.posts
for each row execute function public.enforce_provisional_artist_content_limit();

create trigger enforce_provisional_artist_comment_limit
before insert on public.comments
for each row execute function public.enforce_provisional_artist_content_limit();

revoke all on function public.check_provisional_artist_content_limit(text, timestamptz) from public;
grant execute on function public.check_provisional_artist_content_limit(text, timestamptz) to authenticated;
