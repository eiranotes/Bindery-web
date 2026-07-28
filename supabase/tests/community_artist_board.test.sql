\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '70000000-0000-4000-8000-000000000001',
    'provisional@example.com',
    '{"display_name":"임시승인작가"}'::jsonb
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    'verified@example.com',
    '{"display_name":"검수완료작가"}'::jsonb
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    'member@example.com',
    '{"display_name":"일반회원"}'::jsonb
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
  policy_version,
  reviewed_at,
  review_reason
)
values
  (
    '71000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'provisional',
    '임시승인작가',
    'https://example.com/provisional-board',
    'https://example.com/provisional-board',
    '문구',
    'artist-board:provisional',
    'community-2026-07',
    null,
    null
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    'verified',
    '검수완료작가',
    'https://example.com/verified-board',
    'https://example.com/verified-board',
    '일러스트',
    'artist-board:verified',
    'community-2026-07',
    '2026-07-28T12:00:00+09:00',
    '테스트 검수 완료'
  );

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000003',
  true
);

do $$
declare
  visible_posts integer;
begin
  select count(*) into visible_posts
  from public.posts
  where board_id = 'artists';
  if visible_posts <> 0 then
    raise exception 'ordinary member could read artist posts';
  end if;

  begin
    perform * from public.create_community_post(
      '72000000-0000-4000-8000-000000000003',
      'artists',
      'production',
      'question',
      '일반회원 작가 글은 실패해야 합니다',
      '작가 상태가 없는 회원은 이 글을 만들 수 없어야 합니다.',
      null,
      null,
      null,
      '2026-07-28T12:00:00+09:00'
    );
    raise exception 'ordinary member artist post unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  rate_allowed boolean;
  comment_index integer;
begin
  perform * from public.create_community_post(
    '72000000-0000-4000-8000-000000000001',
    'artists',
    'production',
    'experience',
    '임시 승인 작가의 첫 제작 경험',
    '작가 전용 게시판의 24시간 작성 제한을 확인하는 본문입니다.',
    null,
    null,
    null,
    '2026-07-28T12:00:00+09:00'
  );

  select allowed into rate_allowed
  from public.check_provisional_artist_content_limit(
    'post',
    '2026-07-28T12:01:00+09:00'
  );
  if rate_allowed then
    raise exception 'provisional post limit did not close after first post';
  end if;

  begin
    perform * from public.create_community_post(
      '72000000-0000-4000-8000-000000000004',
      'artists',
      'production',
      'question',
      '임시 승인 작가의 두 번째 글',
      '24시간 안의 두 번째 글은 데이터베이스에서 거부되어야 합니다.',
      null,
      null,
      null,
      '2026-07-28T12:02:00+09:00'
    );
    raise exception 'second provisional post unexpectedly succeeded';
  exception
    when invalid_parameter_value then null;
  end;

  for comment_index in 1..5 loop
    insert into public.comments (
      id,
      post_id,
      author_id,
      body,
      created_at
    )
    values (
      ('73000000-0000-4000-8000-' || lpad(comment_index::text, 12, '0'))::uuid,
      '72000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000001',
      '임시 승인 댓글 ' || comment_index,
      '2026-07-28T12:10:00+09:00'::timestamptz + make_interval(mins => comment_index)
    );
  end loop;

  begin
    insert into public.comments (
      id,
      post_id,
      author_id,
      body,
      created_at
    )
    values (
      '73000000-0000-4000-8000-000000000006',
      '72000000-0000-4000-8000-000000000001',
      '70000000-0000-4000-8000-000000000001',
      '여섯 번째 댓글',
      '2026-07-28T12:20:00+09:00'
    );
    raise exception 'sixth provisional comment unexpectedly succeeded';
  exception
    when invalid_parameter_value then null;
  end;
end
$$;
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  perform * from public.create_community_post(
    '72000000-0000-4000-8000-000000000002',
    'artists',
    'event',
    'fact',
    '검수 완료 작가의 첫 안내',
    '검수 완료 작가는 임시 승인 작성 제한을 적용받지 않습니다.',
    null,
    null,
    null,
    '2026-07-28T13:00:00+09:00'
  );
  perform * from public.create_community_post(
    '72000000-0000-4000-8000-000000000005',
    'artists',
    'event',
    'fact',
    '검수 완료 작가의 두 번째 안내',
    '같은 24시간 안에도 두 번째 게시글을 작성할 수 있습니다.',
    null,
    null,
    null,
    '2026-07-28T13:01:00+09:00'
  );
end
$$;
commit;

begin;
set local role service_role;
update public.artist_verifications
set
  status = 'revoked',
  reviewed_at = '2026-07-28T14:00:00+09:00',
  review_reason = '접근 회수 테스트'
where user_id = '70000000-0000-4000-8000-000000000001';
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  visible_posts integer;
begin
  select count(*) into visible_posts
  from public.posts
  where board_id = 'artists';
  if visible_posts <> 0 then
    raise exception 'revoked artist retained protected post access';
  end if;
end
$$;
rollback;
