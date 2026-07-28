\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '50000000-0000-4000-8000-000000000001',
    'applicant@example.com',
    '{"display_name":"신청작가"}'::jsonb
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    'second@example.com',
    '{"display_name":"두번째작가"}'::jsonb
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    'admin@example.com',
    '{"display_name":"검수관리자"}'::jsonb
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    'invited@example.com',
    '{"display_name":"초대작가"}'::jsonb
  );

insert into public.user_roles (user_id, role, reason)
values (
  '50000000-0000-4000-8000-000000000003',
  'admin',
  'verification workflow fixture'
);

do $$
declare
  profile_name text;
  member_role_count integer;
begin
  select display_name into profile_name
  from public.profiles
  where id = '50000000-0000-4000-8000-000000000001';
  if profile_name <> '신청작가' then
    raise exception 'auth trigger did not create expected profile';
  end if;

  select count(*) into member_role_count
  from public.user_roles
  where user_id = '50000000-0000-4000-8000-000000000001'
    and role = 'member';
  if member_role_count <> 1 then
    raise exception 'auth trigger did not create member role';
  end if;
end
$$;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  first_allowed boolean;
  second_allowed boolean;
  retry_seconds integer;
  created_id uuid;
  repeated_id uuid;
  policy_count integer;
begin
  select allowed into first_allowed
  from public.consume_artist_application_rate_limit(
    '2026-07-28T10:00:00+09:00',
    86400,
    1
  );
  if not first_allowed then
    raise exception 'first rate-limit attempt should be allowed';
  end if;

  select allowed, retry_after_seconds
  into second_allowed, retry_seconds
  from public.consume_artist_application_rate_limit(
    '2026-07-28T10:01:00+09:00',
    86400,
    1
  );
  if second_allowed or retry_seconds <= 0 then
    raise exception 'second rate-limit attempt should be denied';
  end if;

  select id into created_id
  from public.submit_artist_application(
    '51000000-0000-4000-8000-000000000001',
    '신청작가',
    'https://example.com/applicant',
    'https://example.com/applicant',
    '문구',
    null,
    '첫 신청',
    'request-1',
    'community-2026-07',
    '2026-07-28T10:02:00+09:00'
  );

  select id into repeated_id
  from public.submit_artist_application(
    '51000000-0000-4000-8000-000000000099',
    '다른 값',
    'https://example.com/changed',
    'https://example.com/changed',
    '일러스트',
    null,
    null,
    'request-1',
    'community-2026-07',
    '2026-07-28T10:03:00+09:00'
  );
  if repeated_id <> created_id then
    raise exception 'idempotent submission did not return the original row';
  end if;

  select count(*) into policy_count
  from public.policy_acceptances
  where user_id = '50000000-0000-4000-8000-000000000001'
    and policy_key = 'community'
    and policy_version = 'community-2026-07';
  if policy_count <> 1 then
    raise exception 'application did not record policy acceptance';
  end if;

  begin
    perform * from public.review_artist_application(
      created_id,
      'verified',
      'member cannot review',
      '2026-07-28T11:00:00+09:00'
    );
    raise exception 'member review unexpectedly succeeded';
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
  '50000000-0000-4000-8000-000000000002',
  true
);

do $$
begin
  begin
    perform * from public.submit_artist_application(
      '51000000-0000-4000-8000-000000000002',
      '두번째작가',
      'https://example.com/applicant',
      'https://example.com/applicant',
      '문구',
      null,
      null,
      'request-2',
      'community-2026-07',
      '2026-07-28T10:10:00+09:00'
    );
    raise exception 'duplicate proof URL unexpectedly succeeded';
  exception
    when unique_violation then null;
  end;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-4000-8000-000000000003',
  true
);

do $$
declare
  reviewed_status public.artist_verification_status;
  audit_count integer;
  invite_id uuid;
begin
  select status into reviewed_status
  from public.review_artist_application(
    '51000000-0000-4000-8000-000000000001',
    'verified',
    '공개 활동 채널 확인',
    '2026-07-28T12:00:00+09:00'
  );
  if reviewed_status <> 'verified' then
    raise exception 'admin review did not verify application';
  end if;

  select count(*) into audit_count
  from public.audit_events
  where actor_id = '50000000-0000-4000-8000-000000000003'
    and target_id = '51000000-0000-4000-8000-000000000001';
  if audit_count < 1 then
    raise exception 'admin review did not append audit history';
  end if;

  select id into invite_id
  from public.issue_artist_invite(
    '52000000-0000-4000-8000-000000000001',
    'invited@example.com',
    'digest:valid-invite',
    '초대작가',
    'https://example.com/invited',
    'https://example.com/invited',
    '문구',
    '오프라인 행사 활동 확인',
    'community-2026-07',
    '2026-08-04T12:00:00+09:00',
    '2026-07-28T12:00:00+09:00'
  );
  if invite_id <> '52000000-0000-4000-8000-000000000001' then
    raise exception 'admin invite was not created';
  end if;

  perform * from public.issue_artist_invite(
    '52000000-0000-4000-8000-000000000002',
    'invited@example.com',
    'digest:expired-invite',
    '만료작가',
    'https://example.com/expired-invited',
    'https://example.com/expired-invited',
    '일러스트',
    '만료 테스트',
    'community-2026-07',
    '2026-07-20T12:00:00+09:00',
    '2026-07-10T12:00:00+09:00'
  );

  perform * from public.issue_artist_invite(
    '52000000-0000-4000-8000-000000000003',
    'invited@example.com',
    'digest:revoked-invite',
    '취소대상작가',
    'https://example.com/revoked-invited',
    'https://example.com/revoked-invited',
    '제본',
    '초대 취소 테스트',
    'community-2026-07',
    '2026-08-04T12:00:00+09:00',
    '2026-07-28T12:00:00+09:00'
  );
end
$$;
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-4000-8000-000000000002',
  true
);

do $$
declare
  visible_invites integer;
begin
  select count(*) into visible_invites
  from public.get_artist_invite_by_token('digest:valid-invite');
  if visible_invites <> 0 then
    raise exception 'wrong recipient could inspect invite';
  end if;

  begin
    perform * from public.revoke_artist_invite(
      '52000000-0000-4000-8000-000000000003',
      'member must not revoke',
      '2026-07-28T13:00:00+09:00'
    );
    raise exception 'member unexpectedly revoked invite';
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
  '50000000-0000-4000-8000-000000000003',
  true
);

do $$
declare
  revoked_state public.invite_state;
  revoke_audit_count integer;
begin
  select state into revoked_state
  from public.revoke_artist_invite(
    '52000000-0000-4000-8000-000000000003',
    '대상 이메일 변경 요청',
    '2026-07-28T13:10:00+09:00'
  );
  if revoked_state <> 'revoked' then
    raise exception 'admin invite revocation did not persist';
  end if;

  select count(*) into revoke_audit_count
  from public.audit_events
  where actor_id = '50000000-0000-4000-8000-000000000003'
    and target_id = '52000000-0000-4000-8000-000000000003'
    and reason = '대상 이메일 변경 요청';
  if revoke_audit_count <> 1 then
    raise exception 'invite revocation audit reason was not appended';
  end if;
end
$$;
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-4000-8000-000000000004',
  true
);

do $$
declare
  visible_invites integer;
  accepted_status public.artist_verification_status;
begin
  select count(*) into visible_invites
  from public.get_artist_invite_by_token('digest:valid-invite');
  if visible_invites <> 1 then
    raise exception 'invite recipient could not inspect own invite';
  end if;

  select status into accepted_status
  from public.accept_artist_invite(
    'digest:valid-invite',
    '2026-07-29T12:00:00+09:00'
  );
  if accepted_status <> 'verified' then
    raise exception 'invite acceptance did not create verified artist';
  end if;

  begin
    perform * from public.accept_artist_invite(
      'digest:valid-invite',
      '2026-07-29T12:01:00+09:00'
    );
    raise exception 'single-use invite unexpectedly succeeded twice';
  exception
    when raise_exception then
      if sqlerrm <> 'invite already used' then
        raise;
      end if;
  end;

  begin
    perform * from public.accept_artist_invite(
      'digest:expired-invite',
      '2026-07-29T12:00:00+09:00'
    );
    raise exception 'expired invite unexpectedly succeeded';
  exception
    when raise_exception then
      if sqlerrm <> 'invite expired' then
        raise;
      end if;
  end;

  begin
    perform * from public.accept_artist_invite(
      'digest:revoked-invite',
      '2026-07-29T12:00:00+09:00'
    );
    raise exception 'revoked invite unexpectedly succeeded';
  exception
    when raise_exception then
      if sqlerrm <> 'invite already used' then
        raise;
      end if;
  end;
end
$$;
commit;
