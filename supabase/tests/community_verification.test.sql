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
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    'moderator@example.com',
    '{"display_name":"검수열람불가운영자"}'::jsonb
  );

insert into public.user_roles (user_id, role, reason)
values (
  '50000000-0000-4000-8000-000000000003',
  'admin',
  'verification workflow fixture'
), (
  '50000000-0000-4000-8000-000000000005',
  'moderator',
  'verification enumeration denial fixture'
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
set local role service_role;

do $$
declare
  created jsonb;
  repeated jsonb;
  created_id uuid;
  repeated_id uuid;
  policy_count integer;
begin
  select public.submit_artist_application_service(
    '50000000-0000-4000-8000-000000000001',
    '신청작가',
    'https://example.com/applicant',
    'https://example.com/applicant',
    '문구',
    null,
    '첫 신청',
    'request-1',
    'community-2026-07',
    true
  ) into created;
  created_id := (created -> 'application' ->> 'id')::uuid;

  select public.submit_artist_application_service(
    '50000000-0000-4000-8000-000000000001',
    '다른 값',
    'https://example.com/changed',
    'https://example.com/changed',
    '일러스트',
    null,
    null,
    'request-1',
    'community-2026-07',
    true
  ) into repeated;
  repeated_id := (repeated -> 'application' ->> 'id')::uuid;
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

end
$$;
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-4000-8000-000000000005',
  true
);
do $$
declare visible_applications integer;
begin
  select count(*) into visible_applications
  from public.artist_verifications;
  if visible_applications <> 0 then
    raise exception 'moderator enumerated % artist applications', visible_applications;
  end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  created_id uuid;
begin
  select id into created_id
  from public.artist_verifications
  where user_id = '50000000-0000-4000-8000-000000000001';
  begin
    perform * from public.review_artist_application(
      created_id,
      'verified',
      'member cannot review'
    );
    raise exception 'member review unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$$;
rollback;

begin;
set local role service_role;
do $$
declare
  duplicate_result jsonb;
begin
  select public.submit_artist_application_service(
    '50000000-0000-4000-8000-000000000002',
    '두번째작가',
    'https://example.com/applicant',
    'https://example.com/applicant',
    '문구',
    null,
    null,
    'request-2',
    'community-2026-07',
    true
  ) into duplicate_result;
  if duplicate_result ->> 'code' <> 'duplicate-proof' then
    raise exception 'duplicate proof URL unexpectedly succeeded: %', duplicate_result;
  end if;
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
  application_id uuid;
  invite_created_at timestamptz;
  invite_expires_at timestamptz;
  review_started_at timestamptz;
  review_finished_at timestamptz;
  persisted_reviewed_at timestamptz;
begin
  select id into application_id
  from public.artist_verifications
  where user_id = '50000000-0000-4000-8000-000000000001';

  if to_regprocedure(
    'public.review_artist_application(uuid,public.artist_verification_status,text,timestamptz)'
  ) is not null then
    raise exception 'timestamp-bearing artist review signature still exists';
  end if;

  review_started_at := clock_timestamp();
  select status, reviewed_at into reviewed_status, persisted_reviewed_at
  from public.review_artist_application(
    application_id,
    'verified',
    '공개 활동 채널 확인'
  );
  review_finished_at := clock_timestamp();
  if reviewed_status <> 'verified' then
    raise exception 'admin review did not verify application';
  end if;
  if persisted_reviewed_at < review_started_at
    or persisted_reviewed_at > review_finished_at then
    raise exception 'artist review chronology was not assigned by the database';
  end if;

  select count(*) into audit_count
  from public.audit_events
  where actor_id = '50000000-0000-4000-8000-000000000003'
    and target_id = application_id;
  if audit_count < 1 then
    raise exception 'admin review did not append audit history';
  end if;

  if to_regprocedure(
    'public.issue_artist_invite(uuid,text,text,text,text,text,text,text,text,timestamptz,timestamptz)'
  ) is not null then
    raise exception 'timestamp-bearing invite issuance signature still exists';
  end if;

  select id, created_at, expires_at
  into invite_id, invite_created_at, invite_expires_at
  from public.issue_artist_invite(
    '52000000-0000-4000-8000-000000000001',
    'invited@example.com',
    'digest:valid-invite',
    '초대작가',
    'https://example.com/invited',
    'https://example.com/invited',
    '문구',
    '오프라인 행사 활동 확인',
    'community-2026-07'
  );
  if invite_id <> '52000000-0000-4000-8000-000000000001' then
    raise exception 'admin invite was not created';
  end if;
  if invite_expires_at - invite_created_at <> interval '7 days' then
    raise exception 'invite lifetime was not exactly seven database days';
  end if;
  if invite_created_at < statement_timestamp() - interval '5 seconds'
    or invite_created_at > clock_timestamp() + interval '1 second' then
    raise exception 'invite creation did not use database time';
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
    'community-2026-07'
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
    'community-2026-07'
  );
end
$$;
commit;

begin;
set local role service_role;
update public.artist_invites
set created_at = clock_timestamp() - interval '8 days',
    expires_at = clock_timestamp() - interval '1 day'
where id = '52000000-0000-4000-8000-000000000002';
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
      'member must not revoke'
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
  persisted_revoked_at timestamptz;
  revoke_started_at timestamptz;
  revoke_finished_at timestamptz;
  revoke_audit_count integer;
begin
  if to_regprocedure(
    'public.revoke_artist_invite(uuid,text,timestamptz)'
  ) is not null then
    raise exception 'timestamp-bearing invite revocation signature still exists';
  end if;

  revoke_started_at := clock_timestamp();
  select state, revoked_at into revoked_state, persisted_revoked_at
  from public.revoke_artist_invite(
    '52000000-0000-4000-8000-000000000003',
    '대상 이메일 변경 요청'
  );
  revoke_finished_at := clock_timestamp();
  if revoked_state <> 'revoked' then
    raise exception 'admin invite revocation did not persist';
  end if;
  if persisted_revoked_at < revoke_started_at
    or persisted_revoked_at > revoke_finished_at then
    raise exception 'invite revocation chronology was not assigned by the database';
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
  acceptance_result jsonb;
  expired_result jsonb;
  expired_state public.invite_state;
begin
  select count(*) into visible_invites
  from public.get_artist_invite_by_token('digest:valid-invite');
  if visible_invites <> 1 then
    raise exception 'invite recipient could not inspect own invite';
  end if;

  select public.accept_artist_invite(
    'digest:valid-invite',
    true,
    'community-2026-07'
  )
  into acceptance_result;
  accepted_status := (acceptance_result -> 'application' ->> 'status')::public.artist_verification_status;
  if accepted_status <> 'verified' then
    raise exception 'invite acceptance did not create verified artist';
  end if;

  select public.accept_artist_invite(
    'digest:valid-invite',
    true,
    'community-2026-07'
  )
  into acceptance_result;
  if acceptance_result ->> 'code' <> 'invite-used' then
    raise exception 'single-use invite unexpectedly succeeded twice';
  end if;

  select public.accept_artist_invite(
    'digest:expired-invite',
    true,
    'community-2026-07'
  )
  into expired_result;
  if expired_result ->> 'code' <> 'invite-expired' then
    raise exception 'expired invite unexpectedly succeeded';
  end if;
  select state into expired_state
  from public.artist_invites
  where token_digest = 'digest:expired-invite';
  if expired_state <> 'expired' then
    raise exception 'expired invite state did not persist';
  end if;

  select public.accept_artist_invite(
    'digest:revoked-invite',
    true,
    'community-2026-07'
  )
  into acceptance_result;
  if acceptance_result ->> 'code' <> 'invite-used' then
    raise exception 'revoked invite unexpectedly succeeded';
  end if;
end
$$;
commit;
