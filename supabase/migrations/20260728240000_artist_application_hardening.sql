revoke insert, update, delete on table public.artist_verifications from authenticated;
revoke insert, update, delete on table public.artist_invites from authenticated;

revoke execute on function public.consume_artist_application_rate_limit(timestamptz, integer, integer)
  from anon, authenticated;
revoke execute on function public.submit_artist_application(uuid, text, text, text, text, text, text, text, text, timestamptz)
  from anon, authenticated;

create or replace function public.get_artist_application_by_idempotency_service(
  p_user_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when application.id is null then null
    else jsonb_build_object(
      'ok', true,
      'code', 'existing',
      'application', to_jsonb(application)
    )
  end
  from (select 1) as seed
  left join lateral (
    select artist_verifications.*
    from public.artist_verifications
    where user_id = p_user_id
      and idempotency_key = trim(p_idempotency_key)
    limit 1
  ) as application on true;
$$;

revoke all on function public.get_artist_application_by_idempotency_service(uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_artist_application_by_idempotency_service(uuid, text)
  to service_role;

create or replace function public.submit_artist_application_service(
  p_user_id uuid,
  p_activity_name text,
  p_proof_url text,
  p_proof_url_normalized text,
  p_primary_field text,
  p_optional_public_url text,
  p_applicant_note text,
  p_idempotency_key text,
  p_policy_version text,
  p_policy_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  database_now timestamptz := statement_timestamp();
  existing_application public.artist_verifications%rowtype;
  current_rate public.artist_application_rate_limits%rowtype;
  created_application public.artist_verifications%rowtype;
  retry_seconds integer;
begin
  if p_policy_consent is distinct from true then
    return jsonb_build_object('ok', false, 'code', 'consent-required');
  end if;

  if p_user_id is null or not exists (
    select 1
    from public.profiles
    where id = p_user_id and account_status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  if nullif(trim(p_activity_name), '') is null
    or char_length(trim(p_activity_name)) > 80
    or nullif(trim(p_primary_field), '') is null
    or char_length(trim(p_primary_field)) > 80
    or nullif(trim(p_idempotency_key), '') is null
    or char_length(trim(p_idempotency_key)) > 120
    or nullif(trim(p_policy_version), '') is null
    or p_proof_url !~ '^https?://'
    or p_proof_url_normalized !~ '^https?://'
    or (p_optional_public_url is not null and p_optional_public_url !~ '^https?://')
    or (p_applicant_note is not null and char_length(p_applicant_note) > 500) then
    return jsonb_build_object('ok', false, 'code', 'invalid-input');
  end if;

  select * into existing_application
  from public.artist_verifications
  where user_id = p_user_id
    and idempotency_key = trim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'ok', true,
      'code', 'existing',
      'application', to_jsonb(existing_application)
    );
  end if;

  if exists (
    select 1 from public.artist_verifications where user_id = p_user_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'already-applied');
  end if;

  insert into public.artist_application_rate_limits (
    user_id,
    window_started_at,
    attempts,
    updated_at
  ) values (
    p_user_id,
    database_now,
    1,
    database_now
  )
  on conflict (user_id) do update
  set
    window_started_at = case
      when artist_application_rate_limits.window_started_at + interval '24 hours' <= database_now
        then database_now
      else artist_application_rate_limits.window_started_at
    end,
    attempts = case
      when artist_application_rate_limits.window_started_at + interval '24 hours' <= database_now
        then 1
      else artist_application_rate_limits.attempts + 1
    end,
    updated_at = database_now
  returning * into current_rate;

  if current_rate.attempts > 1 then
    retry_seconds := greatest(
      1,
      ceil(extract(epoch from (
        current_rate.window_started_at + interval '24 hours' - database_now
      )))::integer
    );
    return jsonb_build_object(
      'ok', false,
      'code', 'rate-limited',
      'retryAfterSeconds', retry_seconds
    );
  end if;

  if exists (
    select 1
    from public.artist_verifications
    where proof_url_normalized = p_proof_url_normalized
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate-proof');
  end if;

  insert into public.artist_verifications (
    user_id,
    status,
    activity_name,
    proof_url,
    proof_url_normalized,
    primary_field,
    optional_public_url,
    applicant_note,
    idempotency_key,
    policy_version,
    submitted_at
  ) values (
    p_user_id,
    'provisional',
    trim(p_activity_name),
    trim(p_proof_url),
    trim(p_proof_url_normalized),
    trim(p_primary_field),
    nullif(trim(p_optional_public_url), ''),
    nullif(trim(p_applicant_note), ''),
    trim(p_idempotency_key),
    trim(p_policy_version),
    database_now
  )
  returning * into created_application;

  insert into public.policy_acceptances (
    user_id,
    policy_key,
    policy_version,
    accepted_at
  ) values (
    p_user_id,
    'community',
    trim(p_policy_version),
    database_now
  )
  on conflict (user_id, policy_key, policy_version) do nothing;

  return jsonb_build_object(
    'ok', true,
    'code', 'created',
    'application', to_jsonb(created_application)
  );
end;
$$;

revoke all on function public.submit_artist_application_service(
  uuid, text, text, text, text, text, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.submit_artist_application_service(
  uuid, text, text, text, text, text, text, text, text, boolean
) to service_role;

drop function if exists public.accept_artist_invite(text, timestamptz);

create function public.accept_artist_invite(p_token_digest text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  database_now timestamptz := statement_timestamp();
  current_user_id uuid := auth.uid();
  current_email text;
  current_invite public.artist_invites%rowtype;
  created_application public.artist_verifications%rowtype;
begin
  if current_user_id is null or not public.is_active_member() then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;

  select lower(email) into current_email
  from auth.users
  where id = current_user_id;

  select * into current_invite
  from public.artist_invites
  where token_digest = p_token_digest
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invite-not-found');
  end if;
  if current_invite.state <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'invite-used');
  end if;
  if current_invite.intended_user_id is not null
    and current_invite.intended_user_id <> current_user_id then
    return jsonb_build_object('ok', false, 'code', 'invite-recipient-mismatch');
  end if;
  if current_invite.invited_email is not null
    and lower(current_invite.invited_email) <> current_email then
    return jsonb_build_object('ok', false, 'code', 'invite-recipient-mismatch');
  end if;

  if current_invite.expires_at <= database_now then
    update public.artist_invites
    set state = 'expired', updated_at = database_now
    where id = current_invite.id;
    return jsonb_build_object('ok', false, 'code', 'invite-expired');
  end if;

  update public.artist_invites
  set
    state = 'accepted',
    accepted_by = current_user_id,
    accepted_at = database_now,
    updated_at = database_now
  where id = current_invite.id;

  insert into public.artist_verifications (
    user_id,
    status,
    activity_name,
    proof_url,
    proof_url_normalized,
    primary_field,
    idempotency_key,
    policy_version,
    submitted_at,
    reviewed_at,
    reviewed_by,
    review_reason
  ) values (
    current_user_id,
    'verified',
    current_invite.activity_name,
    current_invite.proof_url,
    current_invite.proof_url_normalized,
    current_invite.primary_field,
    'invite:' || current_invite.id::text,
    current_invite.policy_version,
    database_now,
    database_now,
    current_invite.issued_by,
    current_invite.reason
  )
  returning * into created_application;

  insert into public.policy_acceptances (
    user_id,
    policy_key,
    policy_version,
    accepted_at
  ) values (
    current_user_id,
    'community',
    current_invite.policy_version,
    database_now
  )
  on conflict (user_id, policy_key, policy_version) do nothing;

  return jsonb_build_object(
    'ok', true,
    'code', 'accepted',
    'application', to_jsonb(created_application)
  );
end;
$$;

revoke all on function public.accept_artist_invite(text) from public, anon;
grant execute on function public.accept_artist_invite(text) to authenticated;
