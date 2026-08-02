\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  ('c0000000-0000-4000-8000-000000000001', 'correction-author@example.com', '{"display_name":"정정 작성자"}'::jsonb),
  ('c0000000-0000-4000-8000-000000000002', 'correction-reader@example.com', '{"display_name":"정정 독자"}'::jsonb),
  ('c0000000-0000-4000-8000-000000000003', 'correction-operator@example.com', '{"display_name":"정정 운영자"}'::jsonb);

insert into public.user_roles (user_id, role, granted_by)
values (
  'c0000000-0000-4000-8000-000000000003',
  'moderator',
  'c0000000-0000-4000-8000-000000000003'
);

insert into public.posts (
  id, board_id, author_id, category_id, kind, state, title, body,
  published_at, created_at, updated_at
)
values
  (
    'c1000000-0000-4000-8000-000000000001', 'general',
    'c0000000-0000-4000-8000-000000000001', 'production', 'fact',
    'published', '수정 전 제작 안내', '수정 전 제작 안내 본문은 충분한 길이입니다.',
    '2026-07-20T00:00:00Z', '2026-07-20T00:00:00Z', '2026-07-20T00:00:00Z'
  ),
  (
    'c1000000-0000-4000-8000-000000000002', 'general',
    'c0000000-0000-4000-8000-000000000001', 'production', 'fact',
    'published', '페이지 두 번째 안내', '페이지 두 번째 안내 본문은 충분한 길이입니다.',
    '2026-07-19T00:00:00Z', '2026-07-19T00:00:00Z', '2026-07-19T00:00:00Z'
  ),
  (
    'c1000000-0000-4000-8000-000000000003', 'general',
    'c0000000-0000-4000-8000-000000000001', 'production', 'fact',
    'published', '페이지 세 번째 안내', '페이지 세 번째 안내 본문은 충분한 길이입니다.',
    '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'
  );

insert into public.post_sources (post_id, label, url, checked_at, created_by, created_at)
values (
  'c1000000-0000-4000-8000-000000000001', '기존 제작사 안내',
  'https://example.com/old', '2026-01-01',
  'c0000000-0000-4000-8000-000000000001', '2026-01-01T00:00:00Z'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000002', true);
do $$
begin
  begin
    perform * from public.correct_community_post(
      'c1000000-0000-4000-8000-000000000001',
      '권한 없는 수정', '권한 없는 수정 본문은 충분한 길이입니다.',
      '다른 회원의 수정 시도입니다.', null, null, null
    );
    raise exception 'non-author correction unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000001', true);
do $$
declare
  stored_updated_at timestamptz;
  snapshot_denied boolean := false;
begin
  perform * from public.correct_community_post(
    'c1000000-0000-4000-8000-000000000001',
    '작성자가 수정한 제작 안내', '작성자가 수정한 제작 안내 본문은 충분한 길이입니다.',
    '제작 단계 표현을 바로잡았습니다.', null, null, null
  );
  begin
    perform title, body
    from public.post_revisions
    where post_id = 'c1000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    snapshot_denied := true;
  end;
  if not snapshot_denied then
    raise exception 'author unexpectedly received direct prior snapshot access';
  end if;
  select updated_at into stored_updated_at from public.posts
  where id = 'c1000000-0000-4000-8000-000000000001';
  if stored_updated_at < clock_timestamp() - interval '1 minute' then
    raise exception 'correction did not use database time';
  end if;
  begin
    perform * from public.correct_community_post(
      'c1000000-0000-4000-8000-000000000001',
      '작성자가 수정한 제작 안내', '작성자가 수정한 제작 안내 본문은 충분한 길이입니다.',
      '작성자의 출처 교체 시도입니다.', '임의 출처', 'https://example.com/author', '2026-07-28'
    );
    raise exception 'author source correction unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end
$$;
commit;

begin;
set local role service_role;
do $$
begin
  if not exists (
    select 1 from public.post_revisions
    where post_id = 'c1000000-0000-4000-8000-000000000001'
      and title = '수정 전 제작 안내'
      and body = '수정 전 제작 안내 본문은 충분한 길이입니다.'
      and reason = '제작 단계 표현을 바로잡았습니다.'
  ) then
    raise exception 'prior title/body were not snapshotted';
  end if;
end
$$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-000000000003', true);
do $$
declare source_count integer;
begin
  perform * from public.correct_community_post(
    'c1000000-0000-4000-8000-000000000001',
    '운영자가 확인한 제작 안내', '운영자가 확인한 제작 안내 본문은 충분한 길이입니다.',
    '공식 안내 원문을 다시 확인했습니다.', '새 제작사 안내',
    'https://example.com/new', '2026-07-28'
  );
  select count(*) into source_count from public.post_sources
  where post_id = 'c1000000-0000-4000-8000-000000000001';
  if source_count <> 2 then
    raise exception 'operator source correction did not append exactly one row';
  end if;
  if not exists (
    select 1 from public.post_sources
    where post_id = 'c1000000-0000-4000-8000-000000000001'
      and label = '새 제작사 안내'
      and url = 'https://example.com/new'
      and checked_at = '2026-07-28'
  ) then
    raise exception 'operator source correction was incomplete';
  end if;
end
$$;
commit;

begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare first_id uuid;
declare first_updated_at timestamptz;
declare second_id uuid;
begin
  select id, updated_at into first_id, first_updated_at
  from public.search_community_posts(
    '', array['general'], 'production', null, 'all', '2026-07-28T12:00:00Z', 1,
    null, null, null
  );
  select id into second_id
  from public.search_community_posts(
    '', array['general'], 'production', null, 'all', '2026-07-28T12:00:00Z', 1,
    0, first_updated_at, first_id
  );
  if first_id is null or second_id is null or first_id = second_id then
    raise exception 'keyset pagination did not reach the next public row';
  end if;
end
$$;
rollback;
