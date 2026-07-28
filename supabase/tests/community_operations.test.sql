\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '60000000-0000-4000-8000-000000000001',
    'author@example.com',
    '{"display_name":"게시글작성자"}'::jsonb
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    'reader@example.com',
    '{"display_name":"게시글독자"}'::jsonb
  );

begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  begin
    perform * from public.create_community_post(
      '61000000-0000-4000-8000-000000000001',
      'general',
      'production',
      'question',
      '익명 작성은 실패해야 합니다',
      '익명 사용자는 서버 게시 작업을 실행할 수 없습니다.',
      null,
      null,
      null,
      now()
    );
    raise exception 'anonymous post unexpectedly succeeded';
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
  '60000000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  created_id uuid;
  source_count integer;
begin
  select id into created_id
  from public.create_community_post(
    '61000000-0000-4000-8000-000000000001',
    'general',
    'production',
    'question',
    '소량 제작 교정 순서를 확인하고 싶어요',
    '칼선과 흰색 인쇄를 어떤 순서로 확인하는지 경험을 나눠 주세요.',
    '제작사 공식 안내',
    'https://example.com/guide',
    '2026-07-28',
    '2026-07-28T12:00:00+09:00'
  );
  if created_id <> '61000000-0000-4000-8000-000000000001' then
    raise exception 'general post was not created';
  end if;

  select count(*) into source_count
  from public.post_sources
  where post_id = created_id;
  if source_count <> 1 then
    raise exception 'post and source were not stored together';
  end if;

  begin
    perform * from public.create_community_post(
      '61000000-0000-4000-8000-000000000002',
      'artists',
      'production',
      'question',
      '일반회원 작가 글은 실패해야 합니다',
      '작가 권한이 없는 회원은 보호 게시판에 게시할 수 없습니다.',
      null,
      null,
      null,
      now()
    );
    raise exception 'non-artist protected post unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-4000-8000-000000000002',
  true
);

do $$
declare
  visible_posts integer;
  duplicate_blocked boolean := false;
begin
  select count(*) into visible_posts
  from public.posts
  where id = '61000000-0000-4000-8000-000000000001';
  if visible_posts <> 1 then
    raise exception 'public general post was not readable';
  end if;

  insert into public.comments (id, post_id, author_id, body)
  values (
    '62000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    '교정 PDF와 실물 샘플을 따로 확인하는 편이 안전했습니다.'
  );

  insert into public.bookmarks (user_id, post_id)
  values (
    '60000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001'
  )
  on conflict do nothing;

  insert into public.reports (
    id,
    reporter_id,
    post_id,
    reason_code,
    details
  )
  values (
    '63000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001',
    'misinformation',
    '공식 안내와 다른 부분을 확인해 주세요.'
  );

  begin
    insert into public.reports (
      reporter_id,
      post_id,
      reason_code,
      details
    )
    values (
      '60000000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000001',
      'misinformation',
      '중복 신고'
    );
  exception
    when unique_violation then duplicate_blocked := true;
  end;
  if not duplicate_blocked then
    raise exception 'duplicate active report was not blocked';
  end if;

  begin
    perform * from public.soft_delete_community_post(
      '61000000-0000-4000-8000-000000000001',
      '다른 회원의 삭제 시도',
      now()
    );
    raise exception 'non-author delete unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '60000000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  deleted_state public.post_state;
  revision_count integer;
begin
  select state into deleted_state
  from public.soft_delete_community_post(
    '61000000-0000-4000-8000-000000000001',
    '내용을 다시 정리해 올릴 예정',
    '2026-07-28T15:00:00+09:00'
  );
  if deleted_state <> 'deleted' then
    raise exception 'author soft delete did not persist';
  end if;

  select count(*) into revision_count
  from public.post_revisions
  where post_id = '61000000-0000-4000-8000-000000000001'
    and reason = '내용을 다시 정리해 올릴 예정';
  if revision_count <> 1 then
    raise exception 'soft delete did not preserve revision reason';
  end if;
end
$$;
commit;

begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  visible_posts integer;
begin
  select count(*) into visible_posts
  from public.posts
  where id = '61000000-0000-4000-8000-000000000001';
  if visible_posts <> 0 then
    raise exception 'soft-deleted post remained public';
  end if;
end
$$;
rollback;
