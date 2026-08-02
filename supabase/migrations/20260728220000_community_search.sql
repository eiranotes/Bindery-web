alter table public.posts
  add column search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'B')
  ) stored;

create index posts_search_document_gin
  on public.posts using gin (search_document);

create index posts_search_filters
  on public.posts (board_id, category_id, is_resolved, updated_at desc)
  where state = 'published' and deleted_at is null;

create or replace function public.search_community_posts(
  p_query text,
  p_board_ids text[],
  p_category_id text,
  p_is_resolved boolean,
  p_freshness text,
  p_now timestamptz,
  p_limit integer
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
  )
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
    order by selected_source.checked_at desc, selected_source.id
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
  order by
    search_rank desc,
    post.updated_at desc,
    post.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

revoke all on function public.search_community_posts(
  text,
  text[],
  text,
  boolean,
  text,
  timestamptz,
  integer
) from public;

grant execute on function public.search_community_posts(
  text,
  text[],
  text,
  boolean,
  text,
  timestamptz,
  integer
) to anon, authenticated;
