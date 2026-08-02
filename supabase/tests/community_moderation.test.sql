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
set local role service_role;
insert into public.posts (
  id, board_id, author_id, category_id, kind, state, title, body, published_at
) values
('81000000-0000-4000-8000-000000000020', 'general',
 '80000000-0000-4000-8000-000000000001', 'business', 'fact', 'published',
 '정상 복구 대상', '정확한 조치만 복구하는 흐름입니다.', now()),
('81000000-0000-4000-8000-000000000021', 'general',
 '80000000-0000-4000-8000-000000000001', 'business', 'fact', 'published',
 '신규 제한 보존 대상', '더 최신 제한을 이전 신고가 해제하면 안 됩니다.', now()),
('81000000-0000-4000-8000-000000000022', 'general',
 '80000000-0000-4000-8000-000000000001', 'business', 'fact', 'published',
 '삭제 보존 대상', '삭제된 글을 복구하면 안 됩니다.', now()),
('81000000-0000-4000-8000-000000000023', 'general',
 '80000000-0000-4000-8000-000000000001', 'business', 'fact', 'published',
 '이의 기각 대상', '이의제기 기각은 원 조치를 유지합니다.', now());
insert into public.reports (id, reporter_id, post_id, reason_code, details) values
('82000000-0000-4000-8000-000000000020',
 '80000000-0000-4000-8000-000000000002',
 '81000000-0000-4000-8000-000000000020', 'spam', '정상 복구'),
('82000000-0000-4000-8000-000000000021',
 '80000000-0000-4000-8000-000000000002',
 '81000000-0000-4000-8000-000000000021', 'spam', '이전 숨김'),
('82000000-0000-4000-8000-000000000022',
 '80000000-0000-4000-8000-000000000002',
 '81000000-0000-4000-8000-000000000021', 'other', '신규 잠금'),
('82000000-0000-4000-8000-000000000023',
 '80000000-0000-4000-8000-000000000002',
 '81000000-0000-4000-8000-000000000022', 'other', '삭제 전 잠금'),
('82000000-0000-4000-8000-000000000024',
 '80000000-0000-4000-8000-000000000002',
 '81000000-0000-4000-8000-000000000023', 'fraud', '이의 기각');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000004',true);
do $$ begin
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000020', 'triage', '정상 복구 검토');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000020', 'hide', '정상 복구 숨김');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000020', 'restore', '같은 신고 숨김 복구');

  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000021', 'triage', '이전 신고 검토');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000021', 'hide', '이전 숨김');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000022', 'triage', '신규 신고 검토');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000022', 'lock', '독립적인 신규 잠금');
  begin
    perform * from public.moderate_community_report(
      '82000000-0000-4000-8000-000000000021', 'restore', '이전 숨김만 복구');
    raise exception 'older report restored over a newer lock';
  exception when raise_exception then
    if sqlerrm <> 'current causal restriction required' then raise; end if;
  end;

  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000023', 'triage', '삭제 대상 검토');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000023', 'lock', '삭제 전 잠금');
  perform * from public.soft_delete_community_post(
    '81000000-0000-4000-8000-000000000022', '독립적인 삭제');
  begin
    perform * from public.moderate_community_report(
      '82000000-0000-4000-8000-000000000023', 'restore', '삭제 뒤 복구 시도');
    raise exception 'restore republished a deleted post';
  exception when raise_exception then
    if sqlerrm <> 'current causal restriction required' then raise; end if;
  end;

  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000024', 'triage', '이의 기각 검토');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000024', 'hide', '이의 기각 전 숨김');
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
do $$ begin
  perform * from public.submit_community_appeal(
    '82000000-0000-4000-8000-000000000024',
    '원 조치의 판단 근거를 다시 검토해 주세요.'
  );
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000003',true);
do $$ begin
  begin
    perform * from public.moderate_community_report(
      '82000000-0000-4000-8000-000000000024', 'reject_appeal', '운영자 기각 시도');
    raise exception 'moderator rejected an appeal';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000004',true);
do $$ begin
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000024', 'reject_appeal', '원 조치가 타당하여 기각');
end $$;
commit;

begin;
set local role service_role;
do $$
declare
  restored_state public.post_state;
  newer_state public.post_state;
  deleted_state public.post_state;
  rejected_state public.post_state;
  rejected_report_state public.report_state;
  rejection_actions integer;
  rejection_audits integer;
  rejection_notifications integer;
begin
  select state into restored_state from public.posts
  where id = '81000000-0000-4000-8000-000000000020';
  select state into newer_state from public.posts
  where id = '81000000-0000-4000-8000-000000000021';
  select state into deleted_state from public.posts
  where id = '81000000-0000-4000-8000-000000000022';
  select state into rejected_state from public.posts
  where id = '81000000-0000-4000-8000-000000000023';
  select state into rejected_report_state from public.reports
  where id = '82000000-0000-4000-8000-000000000024';
  if restored_state <> 'published' then
    raise exception 'exact causal restore did not publish the post';
  end if;
  if newer_state <> 'locked' then
    raise exception 'older restore undid a newer independent restriction';
  end if;
  if deleted_state <> 'deleted' then
    raise exception 'restore undid a later deletion';
  end if;
  if rejected_state <> 'hidden' or rejected_report_state <> 'closed' then
    raise exception 'appeal rejection changed the restriction or did not close the appeal';
  end if;
  select count(*) into rejection_actions
  from public.moderation_actions
  where report_id = '82000000-0000-4000-8000-000000000024'
    and action_type = 'reject_appeal';
  select count(*) into rejection_audits
  from public.audit_events
  where target_type = 'reports'
    and target_id = '82000000-0000-4000-8000-000000000024'
    and after_state ->> 'state' = 'closed';
  select count(*) into rejection_notifications
  from public.notifications
  where kind = 'appeal_outcome'
    and payload ->> 'report_id' = '82000000-0000-4000-8000-000000000024'
    and payload ->> 'action' = 'reject_appeal';
  if rejection_actions <> 1 or rejection_audits < 1 or rejection_notifications < 1 then
    raise exception 'appeal rejection history incomplete: action %, audit %, notification %',
      rejection_actions, rejection_audits, rejection_notifications;
  end if;
end
$$;
commit;

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
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform * from public.community_appeals;
    raise exception 'reporter read private appeal records';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.submit_community_appeal(
      '82000000-0000-4000-8000-000000000001',
      '신고자는 대상 계정의 이의제기를 제출할 수 없습니다.'
    );
    raise exception 'reporter appeal unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
do $$
declare appeal_state public.report_state;
begin
  select report_state into appeal_state from public.submit_community_appeal(
    '82000000-0000-4000-8000-000000000001',
    '숨김 판단에 반영되지 않은 공식 출처를 다시 검토해 주세요.'
  );
  if appeal_state <> 'appealed' then raise exception 'affected author appeal failed'; end if;
end $$;
commit;

begin;
set local role service_role;
do $$
declare appeal_audits integer; causal_actions integer;
begin
  select count(*) into appeal_audits from public.audit_events
  where action = 'appeal_submitted'
    and target_type = 'report'
    and target_id = '82000000-0000-4000-8000-000000000001';
  if appeal_audits <> 1 then raise exception 'appeal audit event missing'; end if;
  select count(*) into causal_actions
  from public.community_appeals appeal
  join public.moderation_actions action on action.id = appeal.action_id
  where appeal.report_id = '82000000-0000-4000-8000-000000000001'
    and action.report_id = appeal.report_id
    and action.action_type = 'hide';
  if causal_actions <> 1 then
    raise exception 'appeal did not retain its causal moderation action';
  end if;
end $$;
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

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
do $$ begin
  perform * from public.submit_community_appeal(
    '82000000-0000-4000-8000-000000000002',
    '첫 번째 계정 정지 조치에 대해 다시 검토해 주세요.'
  );
end $$;
commit;

begin;
set local role service_role;
insert into public.reports (id,reporter_id,post_id,reason_code,details)
values ('82000000-0000-4000-8000-000000000004',
'80000000-0000-4000-8000-000000000002',
'81000000-0000-4000-8000-000000000001','personal_information',
'독립적인 신규 계정 정지 사유');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000004',true);
do $$ begin
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000004',
    'suspend_account','이의 대상과 독립적인 신규 정지');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000002',
    'resolve_appeal','첫 번째 정지만 취소');
end $$;
commit;

begin;
set local role service_role;
do $$
declare account_state public.account_status; reversal_count integer;
begin
  select account_status into account_state
  from public.profiles
  where id = '80000000-0000-4000-8000-000000000001';
  if account_state <> 'suspended' then
    raise exception 'older appeal reactivated an independently suspended account';
  end if;
  select count(*) into reversal_count
  from public.audit_events
  where action = 'account_suspension_reversed'
    and target_id = '80000000-0000-4000-8000-000000000001';
  if reversal_count <> 0 then
    raise exception 'older appeal recorded a false account reversal';
  end if;
end
$$;
commit;

begin;
set local role service_role;
insert into public.posts (
  id,board_id,author_id,category_id,kind,state,title,body,published_at
) values (
  '81000000-0000-4000-8000-000000000002','general',
  '80000000-0000-4000-8000-000000000001','business','fact','published',
  '다중 제한 대상 게시글','독립적인 제한과 삭제를 검증합니다.',now()
);
insert into public.reports (id,reporter_id,post_id,reason_code,details) values
('82000000-0000-4000-8000-000000000005',
 '80000000-0000-4000-8000-000000000002',
 '81000000-0000-4000-8000-000000000002','spam','첫 번째 숨김 조치'),
('82000000-0000-4000-8000-000000000006',
 '80000000-0000-4000-8000-000000000002',
 '81000000-0000-4000-8000-000000000002','other','독립적인 잠금 조치');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000003',true);
do $$ begin
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000005','triage','첫 신고 확인');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000005','hide','첫 번째 숨김');
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
do $$ begin
  perform * from public.submit_community_appeal(
    '82000000-0000-4000-8000-000000000005',
    '첫 번째 숨김 조치에 대한 이의를 제출합니다.'
  );
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000004',true);
do $$ begin
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000006','triage','독립 신고 확인');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000006','lock','독립적인 신규 잠금');
  perform * from public.soft_delete_community_post(
    '81000000-0000-4000-8000-000000000002','신규 잠금 이후 독립 삭제');
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000005','resolve_appeal','첫 번째 숨김만 취소');
end $$;
commit;

begin;
set local role service_role;
do $$
declare post_state public.post_state; deletion_time timestamptz;
begin
  select state, deleted_at into post_state, deletion_time
  from public.posts
  where id = '81000000-0000-4000-8000-000000000002';
  if post_state <> 'deleted' or deletion_time is null then
    raise exception 'older appeal republished a newly restricted or deleted post';
  end if;
end
$$;
commit;

begin;
set local role service_role;
insert into public.reports (id,reporter_id,post_id,reason_code,details)
values ('82000000-0000-4000-8000-000000000002',
'80000000-0000-4000-8000-000000000002',
'81000000-0000-4000-8000-000000000001','harassment','계정 정지 감사 확인');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000004',true);
do $$
begin
  perform * from public.moderate_community_report(
    '82000000-0000-4000-8000-000000000002','suspend_account','반복 위반 확인');
end $$;
commit;

begin;
set local role service_role;
do $$
declare account_state public.account_status; account_audits integer;
begin
  select account_status into account_state from public.profiles
  where id='80000000-0000-4000-8000-000000000001';
  if account_state <> 'suspended' then raise exception 'account was not suspended'; end if;
  select count(*) into account_audits from public.audit_events
  where action='account_suspended'
    and target_type='account'
    and target_id='80000000-0000-4000-8000-000000000001';
  if account_audits < 1 then raise exception 'immutable account-target suspension audit missing'; end if;
end $$;
commit;

begin;
set local role service_role;
insert into public.reports (id,reporter_id,post_id,reason_code,details,state)
values ('82000000-0000-4000-8000-000000000003',
'80000000-0000-4000-8000-000000000002',
'81000000-0000-4000-8000-000000000001','fraud','기한 만료 확인','actioned');
insert into public.moderation_actions (
  report_id,actor_id,action_type,target_type,target_id,reason,created_at
) values (
  '82000000-0000-4000-8000-000000000003',
  '80000000-0000-4000-8000-000000000004','hide','post',
  '81000000-0000-4000-8000-000000000001','15일 전 조치',now()-interval '15 days'
);
do $$
declare unrelated_action_id uuid;
begin
  select id into unrelated_action_id
  from public.moderation_actions
  where report_id = '82000000-0000-4000-8000-000000000001'
    and action_type = 'hide'
  order by created_at desc
  limit 1;
  begin
    insert into public.community_appeals (
      report_id, action_id, affected_user_id, reason
    ) values (
      '82000000-0000-4000-8000-000000000003', unrelated_action_id,
      '80000000-0000-4000-8000-000000000001',
      '다른 신고의 조치를 참조하면 안 됩니다.'
    );
    raise exception 'appeal accepted an unrelated action';
  exception when check_violation then null; end;
end
$$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform * from public.submit_community_appeal(
      '82000000-0000-4000-8000-000000000003','14일 기한이 지난 요청입니다.'
    );
    raise exception 'expired appeal unexpectedly succeeded';
  exception when invalid_parameter_value then null; end;
end $$;
rollback;
