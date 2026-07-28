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
  p_published_at timestamptz default now()
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
    id,
    board_id,
    author_id,
    category_id,
    kind,
    state,
    title,
    body,
    published_at,
    created_at,
    updated_at
  )
  values (
    p_id,
    p_board_id,
    current_user_id,
    p_category_id,
    p_kind,
    'published',
    p_title,
    p_body,
    p_published_at,
    p_published_at,
    p_published_at
  )
  returning * into created_post;

  if source_count = 3 then
    insert into public.post_sources (
      post_id,
      label,
      url,
      checked_at,
      created_by,
      created_at
    )
    values (
      created_post.id,
      p_source_label,
      p_source_url,
      p_source_checked_at,
      current_user_id,
      p_published_at
    );
  end if;

  return next created_post;
end;
$$;

create or replace function public.soft_delete_community_post(
  p_post_id uuid,
  p_reason text,
  p_deleted_at timestamptz default now()
)
returns setof public.posts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_post public.posts%rowtype;
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

  if not found then
    return;
  end if;
  if current_post.state not in ('draft', 'published', 'locked') then
    raise exception 'post cannot be deleted in current state';
  end if;
  if current_post.author_id <> current_user_id and not public.is_operator() then
    raise exception 'post author or operator required' using errcode = '42501';
  end if;

  insert into public.post_revisions (
    post_id,
    editor_id,
    title,
    body,
    reason,
    created_at
  )
  values (
    current_post.id,
    current_user_id,
    current_post.title,
    current_post.body,
    trim(p_reason),
    p_deleted_at
  );

  update public.posts
  set
    state = 'deleted',
    deleted_at = p_deleted_at,
    deleted_by = current_user_id,
    deletion_reason = trim(p_reason),
    updated_at = p_deleted_at
  where id = current_post.id
  returning * into current_post;

  return next current_post;
end;
$$;

revoke all on function public.create_community_post(uuid, text, text, public.post_kind, text, text, text, text, date, timestamptz) from public;
revoke all on function public.soft_delete_community_post(uuid, text, timestamptz) from public;

grant execute on function public.create_community_post(uuid, text, text, public.post_kind, text, text, text, text, date, timestamptz) to authenticated;
grant execute on function public.soft_delete_community_post(uuid, text, timestamptz) to authenticated;
