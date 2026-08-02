\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'search-reader@example.com',
    '{"display_name":"검색 독자"}'::jsonb
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'search-artist@example.com',
    '{"display_name":"검색 작가"}'::jsonb
  );

insert into public.artist_verifications (
  id,
  user_id,
  status,
  activity_name,
  proof_url,
  proof_url_normalized,
  primary_field,
  idempotency_key,
  policy_version
)
values (
  'a1000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  'provisional',
  '검색 작가',
  'https://example.com/search-artist',
  'https://example.com/search-artist',
  '문구',
  'search-artist-application',
  'community-2026-07'
);

insert into public.posts (
  id,
  board_id,
  author_id,
  category_id,
  kind,
  state,
  title,
  body,
  is_resolved,
  published_at,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    'a2000000-0000-4000-8000-000000000001',
    'general',
    'a0000000-0000-4000-8000-000000000001',
    'production',
    'question',
    'published',
    '스티커 교정 순서',
    '칼선과 흰색 인쇄의 교정 순서를 확인합니다.',
    true,
    '2026-07-20T00:00:00Z',
    '2026-07-20T00:00:00Z',
    '2026-07-28T00:00:00Z',
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    'general',
    'a0000000-0000-4000-8000-000000000001',
    'cost',
    'fact',
    'published',
    '오래된 교정 비용 안내',
    '예전 제작비와 교정 비용을 기록한 글입니다.',
    false,
    '2025-01-01T00:00:00Z',
    '2025-01-01T00:00:00Z',
    '2025-01-02T00:00:00Z',
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000003',
    'artists',
    'a0000000-0000-4000-8000-000000000002',
    'production',
    'experience',
    'published',
    '작가 전용 스티커 교정 경험',
    '작가 게시판에서만 공유하는 제작소 교정 경험입니다.',
    false,
    '2026-07-21T00:00:00Z',
    '2026-07-21T00:00:00Z',
    '2026-07-27T00:00:00Z',
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000004',
    'general',
    'a0000000-0000-4000-8000-000000000001',
    'production',
    'fact',
    'hidden',
    '숨긴 스티커 교정 안내',
    '운영자가 숨긴 글은 검색 결과에 나오면 안 됩니다.',
    false,
    '2026-07-22T00:00:00Z',
    '2026-07-22T00:00:00Z',
    '2026-07-29T00:00:00Z',
    null
  ),
  (
    'a2000000-0000-4000-8000-000000000005',
    'general',
    'a0000000-0000-4000-8000-000000000001',
    'production',
    'fact',
    'deleted',
    '삭제한 스티커 교정 안내',
    '삭제된 글은 검색 결과에 나오면 안 됩니다.',
    false,
    '2026-07-22T00:00:00Z',
    '2026-07-22T00:00:00Z',
    '2026-07-29T00:00:00Z',
    '2026-07-29T00:00:00Z'
  );

insert into public.post_sources (
  post_id,
  label,
  url,
  checked_at,
  valid_for_days,
  created_by
)
values
  (
    'a2000000-0000-4000-8000-000000000001',
    '제작사 안내',
    'https://example.com/fresh-guide',
    '2026-07-20',
    90,
    'a0000000-0000-4000-8000-000000000001'
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    '이전 비용 안내',
    'https://example.com/stale-guide',
    '2025-01-01',
    30,
    'a0000000-0000-4000-8000-000000000001'
  );

do $$
declare
  gin_index_count integer;
begin
  select count(*) into gin_index_count
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'posts'
    and indexname = 'posts_search_document_gin'
    and indexdef ilike '%using gin%search_document%';
  if gin_index_count <> 1 then
    raise exception 'community search GIN index is missing';
  end if;
end
$$;

begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  visible_count integer;
  protected_count integer;
  hidden_count integer;
  filtered_count integer;
begin
  select count(*) into visible_count
  from public.search_community_posts(
    '스티커 교정',
    array['general', 'artists'],
    null,
    null,
    'all',
    '2026-07-28T12:00:00Z',
    50
  );
  if visible_count <> 1 then
    raise exception 'anonymous search expected one active general result, found %', visible_count;
  end if;

  select count(*) into protected_count
  from public.search_community_posts(
    '교정',
    array['artists'],
    null,
    null,
    'all',
    '2026-07-28T12:00:00Z',
    50
  );
  if protected_count <> 0 then
    raise exception 'anonymous search leaked artist rows';
  end if;

  select count(*) into hidden_count
  from public.search_community_posts(
    '숨긴',
    array['general'],
    null,
    null,
    'all',
    '2026-07-28T12:00:00Z',
    50
  );
  if hidden_count <> 0 then
    raise exception 'anonymous search returned hidden content';
  end if;

  select count(*) into filtered_count
  from public.search_community_posts(
    '교정',
    array['general'],
    'production',
    true,
    'fresh',
    '2026-07-28T12:00:00Z',
    50
  );
  if filtered_count <> 1 then
    raise exception 'category, resolution, and freshness filters did not converge';
  end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000002',
  true
);

do $$
declare artist_count integer;
begin
  select count(*) into artist_count
  from public.search_community_posts(
    '스티커 교정',
    array['general', 'artists'],
    null,
    null,
    'all',
    '2026-07-28T12:00:00Z',
    50
  )
  where board_id = 'artists';
  if artist_count <> 1 then
    raise exception 'provisional artist search expected one protected result, found %', artist_count;
  end if;
end
$$;
rollback;

update public.artist_verifications
set
  status = 'revoked',
  reviewed_at = '2026-07-28T12:30:00Z',
  review_reason = '검색 권한 회수 검증'
where user_id = 'a0000000-0000-4000-8000-000000000002';

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'a0000000-0000-4000-8000-000000000002',
  true
);

do $$
declare artist_count integer;
begin
  select count(*) into artist_count
  from public.search_community_posts(
    '교정',
    array['artists'],
    null,
    null,
    'all',
    '2026-07-28T12:00:00Z',
    50
  );
  if artist_count <> 0 then
    raise exception 'revoked artist retained protected search results';
  end if;
end
$$;
rollback;
