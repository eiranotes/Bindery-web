\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
('a0000000-0000-4000-8000-000000000001','notify-author@example.com','{"display_name":"알림 글쓴이"}'),
('a0000000-0000-4000-8000-000000000002','notify-answer@example.com','{"display_name":"알림 답변자"}'),
('a0000000-0000-4000-8000-000000000003','notify-artist@example.com','{"display_name":"알림 작가"}'),
('a0000000-0000-4000-8000-000000000004','notify-admin@example.com','{"display_name":"알림 관리자"}'),
('a0000000-0000-4000-8000-000000000005','notify-reporter@example.com','{"display_name":"알림 신고자"}'),
('a0000000-0000-4000-8000-000000000006','notify-other@example.com','{"display_name":"다른 회원"}');

insert into public.user_roles (user_id, role, reason)
values ('a0000000-0000-4000-8000-000000000004','admin','notification test');

insert into public.posts (
  id, board_id, author_id, category_id, kind, state, title, body, published_at
) values (
  'a1000000-0000-4000-8000-000000000001', 'general',
  'a0000000-0000-4000-8000-000000000001', 'event', 'question', 'published',
  '알림 흐름 질문', '답변과 운영 결과 알림을 확인하는 질문입니다.', now()
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
select * from public.create_community_comment(
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  '알림을 만들 답변입니다.'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select * from public.accept_community_answer(
  'a2000000-0000-4000-8000-000000000001', now()
);
commit;

begin;
set local role service_role;
insert into public.artist_verifications (
  id, user_id, status, activity_name, proof_url, proof_url_normalized,
  primary_field, idempotency_key, policy_version
) values (
  'a3000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000003', 'provisional', '알림 작가',
  'https://example.com/notify-artist', 'https://example.com/notify-artist',
  '일러스트', 'notification-test', 'community-2026-07'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
select * from public.review_artist_application(
  'a3000000-0000-4000-8000-000000000001', 'verified', '공개 활동 확인'
);
commit;

begin;
set local role service_role;
insert into public.reports (id, reporter_id, post_id, reason_code, details)
values (
  'a4000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-000000000001',
  'misinformation', '알림 처리 확인'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
select * from public.moderate_community_report(
  'a4000000-0000-4000-8000-000000000001', 'hide', '검토 후 숨김', now()
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select * from public.submit_community_appeal(
  'a4000000-0000-4000-8000-000000000001',
  '숨김 조치의 근거를 다시 검토해 주세요.'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
select * from public.moderate_community_report(
  'a4000000-0000-4000-8000-000000000001', 'resolve_appeal', '이의 인용', now()
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
do $$
declare
  reply_count integer;
  moderation_count integer;
begin
  select count(*) into reply_count from public.notifications where kind = 'reply';
  select count(*) into moderation_count from public.notifications where kind = 'moderation_outcome';
  if reply_count <> 1 then raise exception 'expected one idempotent reply notification, found %', reply_count; end if;
  if moderation_count <> 1 then raise exception 'post author expected one moderation outcome, found %', moderation_count; end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
do $$
declare accepted_count integer;
begin
  select count(*) into accepted_count from public.notifications where kind = 'answer_accepted';
  if accepted_count <> 1 then raise exception 'answer author expected accepted notification, found %', accepted_count; end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
do $$
declare decision_status text;
begin
  select payload->>'status' into decision_status
  from public.notifications where kind = 'verification_decision';
  if decision_status <> 'verified' then raise exception 'artist verification decision missing'; end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000005',true);
do $$
declare
  first_id uuid;
  unread_count integer;
  appeal_count integer;
begin
  select id into first_id from public.notifications
  where kind = 'moderation_outcome' order by created_at limit 1;
  perform * from public.mark_community_notification_read(first_id, now());
  select count(*) into unread_count from public.notifications where read_at is null;
  select count(*) into appeal_count from public.notifications where kind = 'appeal_outcome';
  if unread_count <> 1 then raise exception 'marking one item affected another, unread %', unread_count; end if;
  if appeal_count <> 1 then raise exception 'reporter appeal outcome missing'; end if;

  begin
    update public.notifications set payload = '{"tampered":true}'::jsonb;
    raise exception 'recipient directly updated notification content';
  exception when insufficient_privilege then null; end;
end
$$;
commit;

set role service_role;
insert into public.notifications (
  id, recipient_id, kind, target_type, target_id, deduplication_key
) values (
  'a5000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'reply', 'post', 'a1000000-0000-4000-8000-000000000001',
  'reply:known-foreign-notification'
);
reset role;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000006',true);
do $$
declare visible_count integer; marked_count integer;
begin
  select count(*) into visible_count from public.notifications;
  select count(*) into marked_count
  from public.mark_community_notification_read(
    'a5000000-0000-4000-8000-000000000001',
    now()
  );
  if visible_count <> 0 then raise exception 'other member read recipient notifications'; end if;
  if marked_count <> 0 then raise exception 'other member marked recipient notification'; end if;
end
$$;
rollback;
