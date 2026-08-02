create or replace function public.correct_community_post(
  p_post_id uuid,
  p_title text,
  p_body text,
  p_reason text,
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
  current_post public.posts%rowtype;
  corrected_post public.posts%rowtype;
  source_count integer := num_nonnulls(
    p_source_label,
    p_source_url,
    p_source_checked_at
  );
  database_now timestamptz := clock_timestamp();
  operator_request boolean;
begin
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 4 and 120 then
    raise exception 'valid correction title required';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 10 and 20000 then
    raise exception 'valid correction body required';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'valid correction reason required';
  end if;
  if source_count not in (0, 3) then
    raise exception 'complete source fields required';
  end if;
  if source_count = 3 then
    if char_length(btrim(p_source_label)) not between 1 and 120
      or p_source_url !~ '^https://'
    then
      raise exception 'valid public source required';
    end if;
  end if;

  select * into current_post
  from public.posts
  where id = p_post_id
  for update;

  if not found then
    return;
  end if;

  operator_request := public.is_operator();
  if current_post.state not in ('published', 'locked') then
    raise exception 'post cannot be corrected in current state';
  end if;
  if not operator_request and (
    current_post.author_id <> current_user_id
    or current_post.state <> 'published'
    or not public.can_access_board(current_post.board_id)
  ) then
    raise exception 'post author or operator required' using errcode = '42501';
  end if;
  if source_count = 3 and not operator_request then
    raise exception 'operator required for source correction' using errcode = '42501';
  end if;

  insert into public.post_revisions (
    post_id,
    editor_id,
    title,
    body,
    reason,
    created_at
  ) values (
    current_post.id,
    current_user_id,
    current_post.title,
    current_post.body,
    btrim(p_reason),
    database_now
  );

  update public.posts
  set
    title = btrim(p_title),
    body = btrim(p_body),
    updated_at = database_now
  where id = current_post.id
  returning * into corrected_post;

  if source_count = 3 then
    insert into public.post_sources (
      post_id,
      label,
      url,
      checked_at,
      created_by,
      created_at
    ) values (
      corrected_post.id,
      btrim(p_source_label),
      p_source_url,
      p_source_checked_at,
      current_user_id,
      database_now
    );
  end if;

  return next corrected_post;
end;
$$;

revoke all on function public.correct_community_post(
  uuid, text, text, text, text, text, date
) from public;
grant execute on function public.correct_community_post(
  uuid, text, text, text, text, text, date
) to authenticated;

drop function public.search_community_posts(
  text,
  text[],
  text,
  boolean,
  text,
  timestamptz,
  integer
);

create function public.search_community_posts(
  p_query text,
  p_board_ids text[],
  p_category_id text,
  p_is_resolved boolean,
  p_freshness text,
  p_now timestamptz,
  p_limit integer,
  p_cursor_rank real default null,
  p_cursor_updated_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  board_id text,
  author_id uuid,
  author_name text,
  category_id text,
  kind public.post_kind,
  state public.post_state,
  title text,
  body text,
  is_resolved boolean,
  source_label text,
  source_url text,
  source_checked_at date,
  source_valid_for_days integer,
  freshness text,
  search_rank real,
  published_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with search_parameters as (
    select
      nullif(btrim(p_query), '') as normalized_query,
      case
        when p_freshness in ('fresh', 'stale', 'missing') then p_freshness
        else 'all'
      end as normalized_freshness,
      coalesce(p_now, statement_timestamp())::date as search_date
  ), ranked_posts as (
    select
      post.id,
      post.board_id,
      post.author_id,
      profile.display_name as author_name,
      post.category_id,
      post.kind,
      post.state,
      post.title,
      post.body,
      post.is_resolved,
      source.label as source_label,
      source.url as source_url,
      source.checked_at as source_checked_at,
      source.valid_for_days as source_valid_for_days,
      case
        when source.id is null then 'missing'
        when source.checked_at + source.valid_for_days > parameters.search_date
          then 'fresh'
        else 'stale'
      end as freshness,
      case
        when parameters.normalized_query is null then 0::real
        else ts_rank_cd(
          post.search_document,
          websearch_to_tsquery('simple', parameters.normalized_query)
        )
      end as search_rank,
      post.published_at,
      post.updated_at,
      post.deleted_at
    from public.posts as post
    join public.profiles as profile on profile.id = post.author_id
    left join lateral (
      select selected_source.*
      from public.post_sources as selected_source
      where selected_source.post_id = post.id
      order by
        selected_source.checked_at desc,
        selected_source.created_at desc,
        selected_source.id
      limit 1
    ) as source on true
    cross join search_parameters as parameters
    where post.state = 'published'
      and post.deleted_at is null
      and cardinality(coalesce(p_board_ids, array[]::text[])) > 0
      and post.board_id = any(p_board_ids)
      and public.can_access_board(post.board_id)
      and (p_category_id is null or post.category_id = p_category_id)
      and (p_is_resolved is null or post.is_resolved = p_is_resolved)
      and (
        parameters.normalized_query is null
        or post.search_document @@ websearch_to_tsquery(
          'simple',
          parameters.normalized_query
        )
      )
      and (
        parameters.normalized_freshness = 'all'
        or parameters.normalized_freshness = case
          when source.id is null then 'missing'
          when source.checked_at + source.valid_for_days > parameters.search_date
            then 'fresh'
          else 'stale'
        end
      )
  )
  select
    result.id,
    result.board_id,
    result.author_id,
    result.author_name,
    result.category_id,
    result.kind,
    result.state,
    result.title,
    result.body,
    result.is_resolved,
    result.source_label,
    result.source_url,
    result.source_checked_at,
    result.source_valid_for_days,
    result.freshness,
    result.search_rank,
    result.published_at,
    result.updated_at,
    result.deleted_at
  from ranked_posts as result
  where
    (
      p_cursor_rank is null
      and p_cursor_updated_at is null
      and p_cursor_id is null
    )
    or (
      p_cursor_rank is not null
      and p_cursor_updated_at is not null
      and p_cursor_id is not null
      and (
        result.search_rank < p_cursor_rank
        or (
          result.search_rank = p_cursor_rank
          and result.updated_at < p_cursor_updated_at
        )
        or (
          result.search_rank = p_cursor_rank
          and result.updated_at = p_cursor_updated_at
          and result.id > p_cursor_id
        )
      )
    )
  order by
    result.search_rank desc,
    result.updated_at desc,
    result.id
  limit least(greatest(coalesce(p_limit, 50), 1), 101)
$$;

revoke all on function public.search_community_posts(
  text,
  text[],
  text,
  boolean,
  text,
  timestamptz,
  integer,
  real,
  timestamptz,
  uuid
) from public;

grant execute on function public.search_community_posts(
  text,
  text[],
  text,
  boolean,
  text,
  timestamptz,
  integer,
  real,
  timestamptz,
  uuid
) to anon, authenticated;
