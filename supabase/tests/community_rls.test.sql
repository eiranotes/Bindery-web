\set ON_ERROR_STOP on

insert into auth.users (id)
values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000007');

insert into public.profiles (id, display_name, account_status)
values
  ('00000000-0000-4000-8000-000000000001', '일반회원', 'active'),
  ('00000000-0000-4000-8000-000000000002', '임시작가', 'active'),
  ('00000000-0000-4000-8000-000000000003', '검수작가', 'active'),
  ('00000000-0000-4000-8000-000000000004', '운영자', 'active'),
  ('00000000-0000-4000-8000-000000000005', '관리자', 'active'),
  ('00000000-0000-4000-8000-000000000006', '정지회원', 'suspended'),
  ('00000000-0000-4000-8000-000000000007', '회수작가', 'active')
on conflict (id) do update
set
  display_name = excluded.display_name,
  account_status = excluded.account_status;

insert into public.user_roles (user_id, role, reason)
values
  ('00000000-0000-4000-8000-000000000001', 'member', '테스트 회원'),
  ('00000000-0000-4000-8000-000000000002', 'member', '테스트 임시 작가'),
  ('00000000-0000-4000-8000-000000000003', 'member', '테스트 검수 작가'),
  ('00000000-0000-4000-8000-000000000004', 'member', '운영자 기본 역할'),
  ('00000000-0000-4000-8000-000000000004', 'moderator', '테스트 운영자'),
  ('00000000-0000-4000-8000-000000000005', 'member', '관리자 기본 역할'),
  ('00000000-0000-4000-8000-000000000005', 'admin', '테스트 관리자'),
  ('00000000-0000-4000-8000-000000000006', 'member', '테스트 정지 회원'),
  ('00000000-0000-4000-8000-000000000007', 'member', '테스트 회수 작가')
on conflict (user_id, role) do nothing;

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
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'provisional',
    '임시작가',
    'https://example.com/provisional',
    'https://example.com/provisional',
    '문구',
    'fixture:provisional',
    'community-2026-07',
    null,
    null
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    'verified',
    '검수작가',
    'https://example.com/verified',
    'https://example.com/verified',
    '일러스트',
    'fixture:verified',
    'community-2026-07',
    now(),
    '테스트 검수 완료'
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000007',
    'revoked',
    '회수작가',
    'https://example.com/revoked',
    'https://example.com/revoked',
    '문구',
    'fixture:revoked',
    'community-2026-07',
    now(),
    '테스트 회수'
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
  published_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'general',
    '00000000-0000-4000-8000-000000000001',
    'event',
    'question',
    'published',
    '공개 행사 질문',
    '공개 게시판의 테스트 본문입니다.',
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'general',
    '00000000-0000-4000-8000-000000000003',
    'event',
    'fact',
    'hidden',
    '숨김 일반 글',
    '운영자만 확인할 숨김 테스트 본문입니다.',
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'artists',
    '00000000-0000-4000-8000-000000000003',
    'production',
    'experience',
    'published',
    '작가 제작 경험',
    '작가 게시판의 보호된 테스트 본문입니다.',
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'artists',
    '00000000-0000-4000-8000-000000000004',
    'production',
    'fact',
    'hidden',
    '숨김 작가 글',
    '운영자만 확인할 작가 게시판 본문입니다.',
    now()
  );

insert into public.reports (
  id,
  reporter_id,
  post_id,
  reason_code,
  details
)
values (
  '30000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'other',
  '권한 테스트 신고'
);

insert into public.notifications (
  id,
  recipient_id,
  kind,
  target_type,
  target_id,
  deduplication_key
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'reply',
    'post',
    '20000000-0000-4000-8000-000000000001',
    'reply:member'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'verification_decision',
    'artist_verification',
    '10000000-0000-4000-8000-000000000002',
    'verification:provisional'
  );

begin;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  visible_posts integer;
begin
  select count(*) into visible_posts from public.posts;
  if visible_posts <> 1 then
    raise exception 'anonymous expected 1 public post, found %', visible_posts;
  end if;

  begin
    insert into public.posts (
      board_id,
      author_id,
      category_id,
      kind,
      state,
      title,
      body
    )
    values (
      'general',
      '00000000-0000-4000-8000-000000000001',
      'event',
      'question',
      'published',
      '익명 작성 실패',
      '익명 사용자는 작성할 수 없어야 합니다.'
    );
    raise exception 'anonymous insert unexpectedly succeeded';
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
  '00000000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  visible_posts integer;
  visible_notifications integer;
begin
  select count(*) into visible_posts from public.posts;
  if visible_posts <> 1 then
    raise exception 'member expected 1 public post, found %', visible_posts;
  end if;

  select count(*) into visible_notifications from public.notifications;
  if visible_notifications <> 1 then
    raise exception 'member expected only own notification, found %',
      visible_notifications;
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
    published_at
  )
  values (
    '21000000-0000-4000-8000-000000000001',
    'general',
    '00000000-0000-4000-8000-000000000001',
    'event',
    'question',
    'published',
    '회원 공개 글',
    '정상 회원의 공개 게시판 작성 테스트입니다.',
    now()
  );

  begin
    insert into public.posts (
      board_id,
      author_id,
      category_id,
      kind,
      state,
      title,
      body,
      published_at
    )
    values (
      'artists',
      '00000000-0000-4000-8000-000000000001',
      'production',
      'experience',
      'published',
      '일반 회원 작가 글',
      '일반 회원의 작가 게시판 작성은 실패해야 합니다.',
      now()
    );
    raise exception 'member artist-board insert unexpectedly succeeded';
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
  '00000000-0000-4000-8000-000000000002',
  true
);

do $$
declare
  artist_posts integer;
begin
  select count(*) into artist_posts
  from public.posts
  where board_id = 'artists';

  if artist_posts <> 1 then
    raise exception 'provisional artist expected 1 visible artist post, found %',
      artist_posts;
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
    published_at
  )
  values (
    '22000000-0000-4000-8000-000000000001',
    'artists',
    '00000000-0000-4000-8000-000000000002',
    'production',
    'experience',
    'published',
    '임시 작가 글',
    '임시 승인 작가의 보호 게시판 작성 테스트입니다.',
    now()
  );
end
$$;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);

do $$
declare
  artist_posts integer;
begin
  select count(*) into artist_posts
  from public.posts
  where board_id = 'artists';

  if artist_posts <> 1 then
    raise exception 'verified artist expected 1 visible artist post, found %',
      artist_posts;
  end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);

do $$
declare
  visible_posts integer;
  visible_reports integer;
begin
  select count(*) into visible_posts from public.posts;
  if visible_posts <> 4 then
    raise exception 'moderator expected all 4 posts, found %', visible_posts;
  end if;

  select count(*) into visible_reports from public.reports;
  if visible_reports <> 1 then
    raise exception 'moderator expected report queue, found %', visible_reports;
  end if;

  insert into public.moderation_actions (
    report_id,
    actor_id,
    action_type,
    target_type,
    target_id,
    reason
  )
  values (
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000004',
    'triage',
    'post',
    '20000000-0000-4000-8000-000000000001',
    '테스트 신고 분류'
  );
end
$$;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000005',
  true
);

update public.artist_verifications
set
  status = 'verified',
  reviewed_at = now(),
  reviewed_by = '00000000-0000-4000-8000-000000000005',
  review_reason = '테스트 관리자 검수'
where user_id = '00000000-0000-4000-8000-000000000002';

do $$
declare
  audit_count integer;
begin
  select count(*) into audit_count
  from public.audit_events
  where actor_id = '00000000-0000-4000-8000-000000000005'
    and target_type = 'artist_verifications'
    and target_id = '10000000-0000-4000-8000-000000000002';

  if audit_count <> 1 then
    raise exception 'admin verification expected one audit event, found %',
      audit_count;
  end if;
end
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);

do $$
declare
  artist_posts integer;
begin
  select count(*) into artist_posts
  from public.posts
  where board_id = 'artists';

  if artist_posts <> 1 then
    raise exception 'newly verified artist expected artist access, found %',
      artist_posts;
  end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000007',
  true
);

do $$
declare
  artist_posts integer;
begin
  select count(*) into artist_posts
  from public.posts
  where board_id = 'artists';

  if artist_posts <> 0 then
    raise exception 'revoked artist expected no artist rows, found %',
      artist_posts;
  end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000006',
  true
);

do $$
declare
  artist_posts integer;
begin
  select count(*) into artist_posts
  from public.posts
  where board_id = 'artists';

  if artist_posts <> 0 then
    raise exception 'suspended account expected no artist rows, found %',
      artist_posts;
  end if;
end
$$;
rollback;

begin;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  all_posts integer;
begin
  select count(*) into all_posts from public.posts;
  if all_posts <> 4 then
    raise exception 'service role BYPASSRLS expected 4 posts, found %',
      all_posts;
  end if;

  begin
    update public.audit_events
    set action = 'tamper'
    where id = (
      select id
      from public.audit_events
      order by created_at
      limit 1
    );
    raise exception 'audit update unexpectedly succeeded';
  exception
    when raise_exception then
      if sqlerrm <> 'audit events are append-only' then
        raise;
      end if;
  end;
end
$$;
rollback;
