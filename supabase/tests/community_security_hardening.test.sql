\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '58000000-0000-4000-8000-000000000001',
    'secure-applicant@example.com',
    '{"display_name":"보안 신청자"}'::jsonb
  ),
  (
    '58000000-0000-4000-8000-000000000002',
    'rate-limited@example.com',
    '{"display_name":"제한 신청자"}'::jsonb
  ),
  (
    '58000000-0000-4000-8000-000000000003',
    'security-admin@example.com',
    '{"display_name":"보안 관리자"}'::jsonb
  ),
  (
    '58000000-0000-4000-8000-000000000004',
    'expired-invite@example.com',
    '{"display_name":"만료 초대자"}'::jsonb
  ),
  (
    '58000000-0000-4000-8000-000000000005',
    'unchecked-invite@example.com',
    '{"display_name":"미동의 초대자"}'::jsonb
  ),
  (
    '58000000-0000-4000-8000-000000000006',
    'stale-invite@example.com',
    '{"display_name":"구버전 동의 초대자"}'::jsonb
  ),
  (
    '58000000-0000-4000-8000-000000000007',
    'concurrent-applicant@example.com',
    '{"display_name":"동시 신청자"}'::jsonb
  );

insert into public.user_roles (user_id, role, reason)
values (
  '58000000-0000-4000-8000-000000000003',
  'admin',
  'security hardening fixture'
);

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '58000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  begin
    insert into public.artist_verifications (
      user_id,
      status,
      activity_name,
      proof_url,
      proof_url_normalized,
      primary_field,
      idempotency_key,
      policy_version
    ) values (
      '58000000-0000-4000-8000-000000000001',
      'provisional',
      '직접 삽입',
      'https://example.com/direct-insert',
      'https://example.com/direct-insert',
      '문구',
      'direct-insert',
      'community-2026-07'
    );
    raise exception 'authenticated direct insert unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform * from public.submit_artist_application(
      gen_random_uuid(),
      '직접 RPC',
      'https://example.com/direct-rpc',
      'https://example.com/direct-rpc',
      '문구',
      null,
      null,
      'direct-rpc',
      'community-2026-07',
      statement_timestamp()
    );
    raise exception 'authenticated legacy submission RPC unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform * from public.consume_artist_application_rate_limit(
      statement_timestamp(),
      86400,
      1
    );
    raise exception 'authenticated rate-limit RPC unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.get_artist_application_by_idempotency_service(
      '58000000-0000-4000-8000-000000000001',
      'secure-request-1'
    );
    raise exception 'authenticated idempotency lookup unexpectedly succeeded';
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
  denied jsonb;
  created jsonb;
  acceptance_count integer;
begin
  select public.submit_artist_application_service(
    '58000000-0000-4000-8000-000000000001',
    '보안 신청자',
    'https://example.com/secure-applicant',
    'https://example.com/secure-applicant',
    '문구',
    null,
    null,
    'secure-request-1',
    'community-2026-07',
    false
  ) into denied;

  if denied ->> 'code' <> 'consent-required' then
    raise exception 'missing consent was not denied: %', denied;
  end if;
  if exists (
    select 1 from public.artist_verifications
    where user_id = '58000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'consent denial still created an application';
  end if;

  select public.submit_artist_application_service(
    '58000000-0000-4000-8000-000000000001',
    '보안 신청자',
    'https://example.com/secure-applicant',
    'https://example.com/secure-applicant',
    '문구',
    null,
    null,
    'secure-request-1',
    'community-2026-06',
    true
  ) into denied;

  if denied ->> 'code' <> 'policy-version-stale' then
    raise exception 'stale policy consent was not denied: %', denied;
  end if;
  select public.submit_artist_application_service(
    '58000000-0000-4000-8000-000000000001',
    '보안 신청자',
    'https://example.com/secure-applicant',
    'https://example.com/secure-applicant',
    '문구',
    null,
    null,
    'secure-request-1',
    'community-2026-07',
    true
  ) into created;

  if created ->> 'code' <> 'created' then
    raise exception 'consented service submission failed: %', created;
  end if;

  select public.get_artist_application_by_idempotency_service(
    '58000000-0000-4000-8000-000000000001',
    'secure-request-1'
  ) into created;
  if created ->> 'code' <> 'existing'
    or created -> 'application' ->> 'idempotency_key' <> 'secure-request-1' then
    raise exception 'service idempotency lookup did not return the existing application: %', created;
  end if;

  select count(*) into acceptance_count
  from public.policy_acceptances
  where user_id = '58000000-0000-4000-8000-000000000001'
    and policy_key = 'community'
    and policy_version = 'community-2026-07';
  if acceptance_count <> 1 then
    raise exception 'consented submission did not record policy acceptance';
  end if;
end
$$;
commit;

begin;
insert into public.artist_application_rate_limits (
  user_id,
  window_started_at,
  attempts,
  updated_at
) values (
  '58000000-0000-4000-8000-000000000002',
  statement_timestamp(),
  1,
  statement_timestamp()
);

set local role service_role;

do $$
declare
  limited jsonb;
begin
  select public.submit_artist_application_service(
    '58000000-0000-4000-8000-000000000002',
    '제한 신청자',
    'https://example.com/rate-limited',
    'https://example.com/rate-limited',
    '문구',
    null,
    null,
    'rate-request-1',
    'community-2026-07',
    true
  ) into limited;

  if limited ->> 'code' <> 'rate-limited' then
    raise exception 'rate-limited service submission was not denied: %', limited;
  end if;
  if exists (
    select 1 from public.artist_verifications
    where user_id = '58000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'rate limit denial still created an application';
  end if;

end
$$;

reset role;
do $$
declare
  attempts_after integer;
begin
  select attempts into attempts_after
  from public.artist_application_rate_limits
  where user_id = '58000000-0000-4000-8000-000000000002';
  if attempts_after <> 2 then
    raise exception 'rate limit attempt was not persisted';
  end if;
end
$$;
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '58000000-0000-4000-8000-000000000003',
  true
);

select * from public.issue_artist_invite(
  '58000000-0000-4000-8000-000000000010',
  'expired-invite@example.com',
  'digest:database-expired-invite',
  '만료 초대자',
  'https://example.com/database-expired-invite',
  'https://example.com/database-expired-invite',
  '문구',
  '데이터베이스 시각 만료 테스트',
  'community-2026-07'
);

select * from public.issue_artist_invite(
  '58000000-0000-4000-8000-000000000011',
  'unchecked-invite@example.com',
  'digest:unchecked-invite',
  '미동의 초대자',
  'https://example.com/unchecked-invite',
  'https://example.com/unchecked-invite',
  '문구',
  '명시적 동의 테스트',
  'community-2026-07'
);

select * from public.issue_artist_invite(
  '58000000-0000-4000-8000-000000000012',
  'stale-invite@example.com',
  'digest:stale-invite',
  '구버전 동의 초대자',
  'https://example.com/stale-invite',
  'https://example.com/stale-invite',
  '문구',
  '현재 버전 동의 테스트',
  'community-2026-07'
);
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '58000000-0000-4000-8000-000000000005',
  true
);

do $$
declare
  result jsonb;
begin
  select public.accept_artist_invite(
    'digest:unchecked-invite',
    false,
    'community-2026-07'
  ) into result;
  if result ->> 'code' <> 'consent-required' then
    raise exception 'unchecked invitation consent was not denied: %', result;
  end if;
end
$$;
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '58000000-0000-4000-8000-000000000006',
  true
);

do $$
declare
  result jsonb;
begin
  select public.accept_artist_invite(
    'digest:stale-invite',
    true,
    'community-2026-06'
  ) into result;
  if result ->> 'code' <> 'policy-version-stale' then
    raise exception 'stale invitation consent was not denied: %', result;
  end if;
end
$$;
commit;

do $$
declare
  verification_count integer;
  acceptance_count integer;
  pending_count integer;
begin
  select count(*) into verification_count
  from public.artist_verifications
  where user_id in (
    '58000000-0000-4000-8000-000000000005',
    '58000000-0000-4000-8000-000000000006'
  );
  select count(*) into acceptance_count
  from public.policy_acceptances
  where user_id in (
    '58000000-0000-4000-8000-000000000005',
    '58000000-0000-4000-8000-000000000006'
  );
  select count(*) into pending_count
  from public.artist_invites
  where id in (
    '58000000-0000-4000-8000-000000000011',
    '58000000-0000-4000-8000-000000000012'
  ) and state = 'pending';
  if verification_count <> 0 or acceptance_count <> 0 or pending_count <> 2 then
    raise exception 'denied invitation consent mutated verification, acceptance, or invite rows';
  end if;
end
$$;

begin;
set local role service_role;
update public.artist_invites
set created_at = clock_timestamp() - interval '8 days',
    expires_at = clock_timestamp() - interval '1 day'
where id = '58000000-0000-4000-8000-000000000010';
commit;

begin;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '58000000-0000-4000-8000-000000000004',
  true
);

do $$
declare
  result jsonb;
begin
  if to_regprocedure(
    'public.issue_artist_invite(uuid,text,text,text,text,text,text,text,text,timestamptz,timestamptz)'
  ) is not null then
    raise exception 'backdateable invite issuance signature still exists';
  end if;
  if to_regprocedure('public.accept_artist_invite(text,timestamptz)') is not null then
    raise exception 'backdateable invite acceptance signature still exists';
  end if;
  if to_regprocedure('public.accept_artist_invite(text)') is not null then
    raise exception 'consent-free invite acceptance signature still exists';
  end if;

  select public.accept_artist_invite(
    'digest:database-expired-invite',
    true,
    'community-2026-07'
  ) into result;

  if result ->> 'code' <> 'invite-expired' then
    raise exception 'database-expired invite was not denied: %', result;
  end if;
end
$$;

reset role;
do $$
declare
  persisted_state public.invite_state;
  persisted_accepted_at timestamptz;
  expiry_audit_count integer;
begin
  select state, accepted_at
  into persisted_state, persisted_accepted_at
  from public.artist_invites
  where id = '58000000-0000-4000-8000-000000000010';
  if persisted_state <> 'expired' or persisted_accepted_at is not null then
    raise exception 'expired invite state did not persist safely';
  end if;

  select count(*) into expiry_audit_count
  from public.audit_events
  where actor_id = '58000000-0000-4000-8000-000000000004'
    and target_id = '58000000-0000-4000-8000-000000000010'
    and action = 'update'
    and before_state ->> 'state' = 'pending'
    and after_state ->> 'state' = 'expired';
  if expiry_audit_count <> 1 then
    raise exception 'expired invite audit state was not persisted';
  end if;
end
$$;
commit;

create extension if not exists dblink;

do $$
declare
  first_result jsonb;
  retry_result jsonb;
  first_id uuid;
  retry_id uuid;
  application_count integer;
  attempts_after integer;
begin
  perform dblink_connect(
    'verification_concurrency_a',
    format(
      'host=%s dbname=%s',
      current_setting('unix_socket_directories'),
      current_database()
    )
  );
  perform dblink_connect(
    'verification_concurrency_b',
    format(
      'host=%s dbname=%s',
      current_setting('unix_socket_directories'),
      current_database()
    )
  );
  perform dblink_exec('verification_concurrency_a', 'set role service_role');
  perform dblink_exec('verification_concurrency_b', 'set role service_role');
  perform dblink_exec('verification_concurrency_a', 'begin');

  perform dblink_exec(
    'verification_concurrency_a',
    'do $lock$ begin perform pg_advisory_xact_lock(hashtextextended(''58000000-0000-4000-8000-000000000007:concurrent-request-1'', 0)); end $lock$'
  );

  if dblink_send_query(
    'verification_concurrency_b',
    $query$
      select public.submit_artist_application_service(
        '58000000-0000-4000-8000-000000000007',
        '동시 신청자',
        'https://example.com/concurrent-applicant',
        'https://example.com/concurrent-applicant',
        '문구',
        null,
        null,
        'concurrent-request-1',
        'community-2026-07',
        true
      )
    $query$
  ) <> 1 then
    raise exception 'second concurrency session did not start';
  end if;

  perform pg_sleep(0.1);
  select result into first_result
  from dblink(
    'verification_concurrency_a',
    $query$
      select public.submit_artist_application_service(
        '58000000-0000-4000-8000-000000000007',
        '동시 신청자',
        'https://example.com/concurrent-applicant',
        'https://example.com/concurrent-applicant',
        '문구',
        null,
        null,
        'concurrent-request-1',
        'community-2026-07',
        true
      )
    $query$
  ) as first_call(result jsonb);

  perform dblink_exec('verification_concurrency_a', 'commit');
  select result into retry_result
  from dblink_get_result('verification_concurrency_b') as retry_call(result jsonb);

  first_id := (first_result -> 'application' ->> 'id')::uuid;
  retry_id := (retry_result -> 'application' ->> 'id')::uuid;
  if first_result ->> 'code' <> 'created'
    or retry_result ->> 'code' <> 'existing'
    or retry_id <> first_id then
    raise exception 'concurrent retry did not return the original application: first %, retry %',
      first_result, retry_result;
  end if;

  select count(*) into application_count
  from public.artist_verifications
  where user_id = '58000000-0000-4000-8000-000000000007';
  select attempts into attempts_after
  from public.artist_application_rate_limits
  where user_id = '58000000-0000-4000-8000-000000000007';
  if application_count <> 1 or attempts_after <> 1 then
    raise exception 'concurrent retry duplicated the application or consumed another rate attempt';
  end if;

  perform dblink_disconnect('verification_concurrency_a');
  perform dblink_disconnect('verification_concurrency_b');
end
$$;
