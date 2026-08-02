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
  stored_created_at timestamptz;
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
    '2001-01-01T00:00:00Z'
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
  select created_at into stored_created_at from public.posts where id = created_id;
  if stored_created_at < clock_timestamp() - interval '1 minute' then
    raise exception 'legacy client timestamp was trusted for post creation';
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
  first_report_id uuid;
  repeated_report_id uuid;
begin
  select count(*) into visible_posts
  from public.posts
  where id = '61000000-0000-4000-8000-000000000001';
  if visible_posts <> 1 then
    raise exception 'public general post was not readable';
  end if;

  perform * from public.create_community_comment(
    '62000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    '교정 PDF와 실물 샘플을 따로 확인하는 편이 안전했습니다.'
  );

  perform public.set_community_bookmark(
    '61000000-0000-4000-8000-000000000001', true
  );

  select id into first_report_id from public.submit_community_report(
    '63000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    'misinformation',
    '공식 안내와 다른 부분을 확인해 주세요.'
  );
  select id into repeated_report_id from public.submit_community_report(
    '63000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001',
    'misinformation',
    '중복 신고'
  );
  if first_report_id <> repeated_report_id then
    raise exception 'duplicate active report was not idempotent';
  end if;

  begin
    insert into public.comments (post_id, author_id, body, created_at)
    values (
      '61000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      '직접 삽입', '2001-01-01T00:00:00Z'
    );
    raise exception 'raw comment insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.posts
    set state = 'hidden', updated_at = '2001-01-01T00:00:00Z'
    where id = '61000000-0000-4000-8000-000000000001';
    raise exception 'raw post lifecycle update unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.reports (reporter_id, post_id, reason_code, created_at)
    values (
      '60000000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000001', 'spam',
      '2001-01-01T00:00:00Z'
    );
    raise exception 'raw report insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.post_revisions (post_id, editor_id, title, body, created_at)
    values (
      '61000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      '위조 이력', '위조 이력 본문', '2001-01-01T00:00:00Z'
    );
    raise exception 'raw post revision insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

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
  stored_deleted_at timestamptz;
begin
  select state into deleted_state
  from public.soft_delete_community_post(
    '61000000-0000-4000-8000-000000000001',
    '내용을 다시 정리해 올릴 예정',
    '2001-01-01T00:00:00Z'
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
  select deleted_at into stored_deleted_at from public.posts
  where id = '61000000-0000-4000-8000-000000000001';
  if stored_deleted_at < clock_timestamp() - interval '1 minute' then
    raise exception 'legacy client timestamp was trusted for soft delete';
  end if;
end
$$;
commit;

begin;
set local role service_role;
do $$
begin
  insert into public.posts (
    id, board_id, author_id, category_id, kind, state, title, body, published_at
  ) values (
    '61000000-0000-4000-8000-000000000002', 'general',
    '60000000-0000-4000-8000-000000000001', 'production', 'question',
    'published', '다른 질문 게시글', '다른 글의 답변 연결을 막기 위한 게시글입니다.', now()
  );
  begin
    update public.posts
    set accepted_comment_id = '62000000-0000-4000-8000-000000000001'
    where id = '61000000-0000-4000-8000-000000000002';
    raise exception 'cross-post accepted comment unexpectedly succeeded';
  exception when check_violation then null; end;
end
$$;
rollback;

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
