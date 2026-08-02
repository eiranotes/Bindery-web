\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  ('e0000000-0000-4000-8000-000000000001', 'read-author@example.com', '{"display_name":"읽기 작성자"}'::jsonb),
  ('e0000000-0000-4000-8000-000000000002', 'read-reader@example.com', '{"display_name":"읽기 독자"}'::jsonb),
  ('e0000000-0000-4000-8000-000000000003', 'read-operator@example.com', '{"display_name":"읽기 운영자"}'::jsonb),
  ('e0000000-0000-4000-8000-000000000004', 'read-answer@example.com', '{"display_name":"읽기 답변자"}'::jsonb);

insert into public.user_roles (user_id, role, reason)
values ('e0000000-0000-4000-8000-000000000003', 'moderator', 'content read test');

do $$
begin
  if has_function_privilege(
    'anon',
    'public.promote_community_note(uuid,uuid,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.promote_community_note(uuid,uuid,text,text,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'anonymous role retained Note promotion execution';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.promote_community_note(uuid,uuid,text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.promote_community_note(uuid,uuid,text,text,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'authenticated role lost Note promotion execution';
  end if;
end
$$;

insert into public.posts (
  id, board_id, author_id, category_id, kind, state, title, body,
  published_at, created_at, updated_at
)
values (
  'e1000000-0000-4000-8000-000000000001', 'general',
  'e0000000-0000-4000-8000-000000000001', 'production', 'question',
  'published', '공개 제작 질문', '공개 제작 질문의 현재 본문입니다.',
  '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z', '2026-07-28T00:00:00Z'
);

insert into public.comments (id, post_id, author_id, body, created_at)
values (
  'e2000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000004',
  '공식 원문을 기준으로 확인한 답변입니다.',
  '2026-07-28T01:00:00Z'
);

update public.posts
set is_resolved = true,
    accepted_comment_id = 'e2000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000001';

insert into public.post_revisions (
  id, post_id, editor_id, title, body, reason, created_at
)
values (
  'e3000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  '공개되면 안 되는 이전 제목',
  '공개되면 안 되는 이전 본문입니다.',
  '표현을 바로잡았습니다.',
  '2026-07-28T02:00:00Z'
);

insert into public.post_sources (
  id, post_id, label, url, checked_at, valid_for_days, created_by, created_at
)
values
  (
    'e4000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    '같은 날 먼저 확인한 원문', 'https://example.com/same-day-earlier',
    '2026-07-28', 90, 'e0000000-0000-4000-8000-000000000001',
    '2026-07-28T03:00:00Z'
  ),
  (
    'e4000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001',
    '같은 날 나중에 확인한 원문', 'https://example.com/same-day-later',
    '2026-07-28', 90, 'e0000000-0000-4000-8000-000000000003',
    '2026-07-28T04:00:00Z'
  );

begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare
  metadata_rows integer;
  snapshot_denied boolean := false;
begin
  select count(*) into metadata_rows
  from public.post_revisions
  where post_id = 'e1000000-0000-4000-8000-000000000001'
    and editor_id = 'e0000000-0000-4000-8000-000000000001'
    and reason = '표현을 바로잡았습니다.'
    and created_at = '2026-07-28T02:00:00Z';

  if metadata_rows <> 1 then
    raise exception 'anonymous reader could not read required revision metadata';
  end if;

  begin
    perform title, body
    from public.post_revisions
    where post_id = 'e1000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    snapshot_denied := true;
  end;

  if not snapshot_denied then
    raise exception 'anonymous reader unexpectedly read prior title/body';
  end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-000000000002', true);
do $$
declare snapshot_denied boolean := false;
begin
  begin
    perform title, body
    from public.post_revisions
    where post_id = 'e1000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    snapshot_denied := true;
  end;

  if not snapshot_denied then
    raise exception 'authenticated reader unexpectedly read prior title/body';
  end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-000000000003', true);
do $$
declare
  promoted_source text;
  stored_promoted_at timestamptz;
  source_count_before integer;
  source_count_after integer;
begin
  select source_url, promoted_at into promoted_source, stored_promoted_at
  from public.promote_community_note(
    'e5000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'same-day-source-order',
    '같은 날짜의 출처 순서를 검증합니다.',
    '2000-01-01T00:00:00Z'
  );

  if promoted_source <> 'https://example.com/same-day-later' then
    raise exception 'promotion selected a non-latest same-day source: %', promoted_source;
  end if;
  if stored_promoted_at = '2000-01-01T00:00:00Z'
    or stored_promoted_at < statement_timestamp() - interval '5 seconds'
    or stored_promoted_at > clock_timestamp() + interval '1 second' then
    raise exception 'promotion did not use database time: %', stored_promoted_at;
  end if;

  select count(*) into source_count_before
  from public.post_sources
  where post_id = 'e1000000-0000-4000-8000-000000000001';

  begin
    perform * from public.correct_community_post(
      'e1000000-0000-4000-8000-000000000001',
      '공개 제작 질문',
      '공개 제작 질문의 현재 본문입니다.',
      '암호화되지 않은 출처를 거부합니다.',
      'HTTP 원문',
      'http://example.com/recheck',
      '2026-07-28'
    );
    raise exception 'HTTP correction source unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'valid public source required' then raise; end if;
  end;

  select count(*) into source_count_after
  from public.post_sources
  where post_id = 'e1000000-0000-4000-8000-000000000001';

  if source_count_after <> source_count_before then
    raise exception 'invalid HTTP source changed source history';
  end if;
end
$$;
commit;
