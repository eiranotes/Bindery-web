\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
('80000000-0000-4000-8000-000000000001','author@example.com','{"display_name":"신고대상"}'),
('80000000-0000-4000-8000-000000000002','reporter@example.com','{"display_name":"신고자"}'),
('80000000-0000-4000-8000-000000000003','moderator@example.com','{"display_name":"운영자"}'),
('80000000-0000-4000-8000-000000000004','admin@example.com','{"display_name":"관리자"}');

insert into public.user_roles (user_id, role, reason) values
('80000000-0000-4000-8000-000000000003','moderator','moderation test'),
('80000000-0000-4000-8000-000000000004','admin','moderation test');

insert into public.posts (id,board_id,author_id,category_id,kind,state,title,body,published_at)
values ('81000000-0000-4000-8000-000000000001','general',
'80000000-0000-4000-8000-000000000001','business','fact','published',
'신고 검토 대상 게시글','운영자 처리 흐름을 검증하기 위한 게시글 본문입니다.',now());

insert into public.reports (id,reporter_id,post_id,reason_code,details)
values ('82000000-0000-4000-8000-000000000001',
'80000000-0000-4000-8000-000000000002',
'81000000-0000-4000-8000-000000000001','misinformation','출처 확인 필요');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform * from public.moderate_community_report(
      '82000000-0000-4000-8000-000000000001','triage','회원 시도',now());
    raise exception 'member moderation unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000003',true);
do $$
declare action_count integer; target_state public.post_state;
begin
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000001','triage','출처 확인 시작',now());
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000001','hide','확인 전 임시 숨김',now());
  select state into target_state from public.posts
  where id='81000000-0000-4000-8000-000000000001';
  if target_state <> 'hidden' then raise exception 'moderator hide failed'; end if;
  select count(*) into action_count from public.moderation_actions
  where report_id='82000000-0000-4000-8000-000000000001';
  if action_count <> 2 then raise exception 'action history was overwritten'; end if;
  begin
    perform * from public.moderate_community_report(
      '82000000-0000-4000-8000-000000000001','resolve_appeal','운영자 처리',now());
    raise exception 'moderator appeal resolution unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
commit;

begin;
set local role service_role;
update public.reports set state='appealed'
where id='82000000-0000-4000-8000-000000000001';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000004',true);
do $$
declare report_status public.report_state; target_state public.post_state; audit_count integer;
begin
  select state into report_status from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000001','resolve_appeal','이의 인용 및 복구',now());
  select state into target_state from public.posts
  where id='81000000-0000-4000-8000-000000000001';
  if report_status <> 'closed' or target_state <> 'published' then
    raise exception 'admin appeal resolution failed';
  end if;
  select count(*) into audit_count from public.audit_events
  where target_id='82000000-0000-4000-8000-000000000001';
  if audit_count < 3 then raise exception 'report audit history missing'; end if;
end $$;
commit;
