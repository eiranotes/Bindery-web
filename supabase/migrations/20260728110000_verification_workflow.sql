alter table public.artist_verifications
  add column idempotency_key text,
  add column policy_version text;

update public.artist_verifications
set
  idempotency_key = coalesce(idempotency_key, 'legacy:' || id::text),
  policy_version = coalesce(policy_version, 'community-2026-07');

alter table public.artist_verifications
  alter column idempotency_key set not null,
  alter column policy_version set not null;

create unique index artist_verifications_idempotency_unique
  on public.artist_verifications (user_id, idempotency_key);

alter table public.artist_invites
  add column activity_name text not null,
  add column proof_url text not null,
  add column proof_url_normalized text not null,
  add column primary_field text not null,
  add column policy_version text not null,
  add column revoked_by uuid references public.profiles(id) on delete set null,
  add column revocation_reason text check (
    revocation_reason is null or char_length(revocation_reason) between 1 and 500
  );

create or replace function public.audit_privileged_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before_data jsonb;
  after_data jsonb;
  target_data jsonb;
  event_target_id uuid;
  event_reason text;
begin
  before_data := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_data := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  target_data := coalesce(after_data, before_data);
  event_target_id := coalesce(
    nullif(target_data ->> 'id', '')::uuid,
    nullif(target_data ->> 'user_id', '')::uuid
  );
  event_reason := coalesce(
    target_data ->> 'review_reason',
    target_data ->> 'revocation_reason',
    target_data ->> 'reason',
    target_data ->> 'resolution_reason'
  );

  insert into public.audit_events (
    actor_id,
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state
  )
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    event_target_id,
    event_reason,
    before_data,
    after_data
  );

  return coalesce(new, old);
end;
$$;

alter table public.artist_invites
  add constraint artist_invites_email_normalized
    check (invited_email is null or invited_email = lower(invited_email)),
  add constraint artist_invites_proof_url_public
    check (proof_url ~ '^https?://');

create unique index artist_invites_pending_proof_unique
  on public.artist_invites (proof_url_normalized)
  where state = 'pending';

create table public.artist_application_rate_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0),
  updated_at timestamptz not null default now()
);

alter table public.artist_application_rate_limits enable row level security;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  initial_display_name text;
begin
  initial_display_name := nullif(
    trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')),
    ''
  );
  initial_display_name := coalesce(
    initial_display_name,
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '새 회원'
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(initial_display_name, 40))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role, reason)
  values (new.id, 'member', 'auth signup')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.consume_artist_application_rate_limit(
  p_now timestamptz default now(),
  p_window_seconds integer default 86400,
  p_max_attempts integer default 1
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_row public.artist_application_rate_limits%rowtype;
  window_interval interval;
begin
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;
  if p_window_seconds <= 0 or p_max_attempts <= 0 then
    raise exception 'invalid rate limit configuration';
  end if;

  window_interval := make_interval(secs => p_window_seconds);

  insert into public.artist_application_rate_limits (
    user_id,
    window_started_at,
    attempts,
    updated_at
  )
  values (current_user_id, p_now, 1, p_now)
  on conflict (user_id) do update
  set
    window_started_at = case
      when artist_application_rate_limits.window_started_at + window_interval <= p_now
        then p_now
      else artist_application_rate_limits.window_started_at
    end,
    attempts = case
      when artist_application_rate_limits.window_started_at + window_interval <= p_now
        then 1
      else artist_application_rate_limits.attempts + 1
    end,
    updated_at = p_now
  returning * into current_row;

  allowed := current_row.attempts <= p_max_attempts;
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (
        current_row.window_started_at + window_interval - p_now
      )))::integer
    )
  end;
  return next;
end;
$$;

create or replace function public.submit_artist_application(
  p_id uuid,
  p_activity_name text,
  p_proof_url text,
  p_proof_url_normalized text,
  p_primary_field text,
  p_optional_public_url text,
  p_applicant_note text,
  p_idempotency_key text,
  p_policy_version text,
  p_submitted_at timestamptz
)
returns setof public.artist_verifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  existing_application public.artist_verifications%rowtype;
begin
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;

  select * into existing_application
  from public.artist_verifications
  where user_id = current_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    return next existing_application;
    return;
  end if;

  if exists (
    select 1 from public.artist_verifications where user_id = current_user_id
  ) then
    raise exception 'artist application already exists' using errcode = '23505';
  end if;

  insert into public.artist_verifications (
    id,
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
  )
  values (
    p_id,
    current_user_id,
    'provisional',
    p_activity_name,
    p_proof_url,
    p_proof_url_normalized,
    p_primary_field,
    p_optional_public_url,
    p_applicant_note,
    p_idempotency_key,
    p_policy_version,
    p_submitted_at
  )
  returning * into existing_application;

  insert into public.policy_acceptances (
    user_id,
    policy_key,
    policy_version,
    accepted_at
  )
  values (
    current_user_id,
    'community',
    p_policy_version,
    p_submitted_at
  )
  on conflict (user_id, policy_key, policy_version) do nothing;

  return next existing_application;
end;
$$;

create or replace function public.review_artist_application(
  p_application_id uuid,
  p_next_status public.artist_verification_status,
  p_reason text,
  p_reviewed_at timestamptz default now()
)
returns setof public.artist_verifications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_application public.artist_verifications%rowtype;
begin
  if not public.has_role('admin') then
    raise exception 'admin required' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'review reason required';
  end if;

  select * into current_application
  from public.artist_verifications
  where id = p_application_id
  for update;

  if not found then
    return;
  end if;

  if not (
    (current_application.status = 'provisional' and p_next_status in ('verified', 'rejected', 'suspended', 'revoked'))
    or (current_application.status = 'verified' and p_next_status in ('suspended', 'revoked'))
    or (current_application.status = 'suspended' and p_next_status in ('provisional', 'verified', 'revoked'))
  ) then
    raise exception 'invalid artist status transition';
  end if;

  update public.artist_verifications
  set
    status = p_next_status,
    reviewed_at = case when p_next_status = 'provisional' then null else p_reviewed_at end,
    reviewed_by = auth.uid(),
    review_reason = p_reason
  where id = p_application_id
  returning * into current_application;

  return next current_application;
end;
$$;

create or replace function public.issue_artist_invite(
  p_id uuid,
  p_invited_email text,
  p_token_digest text,
  p_activity_name text,
  p_proof_url text,
  p_proof_url_normalized text,
  p_primary_field text,
  p_reason text,
  p_policy_version text,
  p_expires_at timestamptz,
  p_created_at timestamptz default now()
)
returns setof public.artist_invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_invite public.artist_invites%rowtype;
begin
  if not public.has_role('admin') then
    raise exception 'admin required' using errcode = '42501';
  end if;

  insert into public.artist_invites (
    id,
    invited_email,
    token_digest,
    state,
    issued_by,
    reason,
    expires_at,
    created_at,
    activity_name,
    proof_url,
    proof_url_normalized,
    primary_field,
    policy_version
  )
  values (
    p_id,
    lower(p_invited_email),
    p_token_digest,
    'pending',
    auth.uid(),
    p_reason,
    p_expires_at,
    p_created_at,
    p_activity_name,
    p_proof_url,
    p_proof_url_normalized,
    p_primary_field,
    p_policy_version
  )
  returning * into created_invite;

  return next created_invite;
end;
$$;

create or replace function public.get_artist_invite_by_token(
  p_token_digest text
)
returns setof public.artist_invites
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select invite.*
  from public.artist_invites invite
  where invite.token_digest = p_token_digest
    and (
      public.has_role('admin')
      or invite.intended_user_id = auth.uid()
      or lower(invite.invited_email) = lower(
        (select email from auth.users where id = auth.uid())
      )
    )
$$;

create or replace function public.revoke_artist_invite(
  p_invite_id uuid,
  p_reason text,
  p_revoked_at timestamptz default now()
)
returns setof public.artist_invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_invite public.artist_invites%rowtype;
begin
  if not public.has_role('admin') then
    raise exception 'admin required' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null or char_length(p_reason) > 500 then
    raise exception 'valid revocation reason required';
  end if;

  select * into current_invite
  from public.artist_invites
  where id = p_invite_id
  for update;

  if not found then
    return;
  end if;
  if current_invite.state <> 'pending' then
    raise exception 'pending invite required';
  end if;

  update public.artist_invites
  set
    state = 'revoked',
    revoked_at = p_revoked_at,
    revoked_by = auth.uid(),
    revocation_reason = trim(p_reason),
    updated_at = p_revoked_at
  where id = current_invite.id
  returning * into current_invite;

  return next current_invite;
end;
$$;

create or replace function public.accept_artist_invite(
  p_token_digest text,
  p_accepted_at timestamptz default now()
)
returns setof public.artist_verifications
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  current_invite public.artist_invites%rowtype;
  created_application public.artist_verifications%rowtype;
begin
  if current_user_id is null or not public.is_active_member() then
    raise exception 'active member required' using errcode = '42501';
  end if;

  select lower(email) into current_email
  from auth.users
  where id = current_user_id;

  select * into current_invite
  from public.artist_invites
  where token_digest = p_token_digest
  for update;

  if not found then
    return;
  end if;
  if current_invite.state <> 'pending' then
    raise exception 'invite already used';
  end if;
  if current_invite.expires_at <= p_accepted_at then
    update public.artist_invites
    set state = 'expired', updated_at = p_accepted_at
    where id = current_invite.id;
    raise exception 'invite expired';
  end if;
  if current_invite.intended_user_id is not null
    and current_invite.intended_user_id <> current_user_id then
    raise exception 'invite recipient mismatch' using errcode = '42501';
  end if;
  if current_invite.invited_email is not null
    and lower(current_invite.invited_email) <> current_email then
    raise exception 'invite recipient mismatch' using errcode = '42501';
  end if;

  update public.artist_invites
  set
    state = 'accepted',
    accepted_by = current_user_id,
    accepted_at = p_accepted_at,
    updated_at = p_accepted_at
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
  )
  values (
    current_user_id,
    'verified',
    current_invite.activity_name,
    current_invite.proof_url,
    current_invite.proof_url_normalized,
    current_invite.primary_field,
    'invite:' || current_invite.id::text,
    current_invite.policy_version,
    p_accepted_at,
    p_accepted_at,
    current_invite.issued_by,
    current_invite.reason
  )
  returning * into created_application;

  insert into public.policy_acceptances (
    user_id,
    policy_key,
    policy_version,
    accepted_at
  )
  values (
    current_user_id,
    'community',
    current_invite.policy_version,
    p_accepted_at
  )
  on conflict (user_id, policy_key, policy_version) do nothing;

  return next created_application;
end;
$$;

revoke all on function public.consume_artist_application_rate_limit(timestamptz, integer, integer) from public;
revoke all on function public.submit_artist_application(uuid, text, text, text, text, text, text, text, text, timestamptz) from public;
revoke all on function public.review_artist_application(uuid, public.artist_verification_status, text, timestamptz) from public;
revoke all on function public.issue_artist_invite(uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz) from public;
revoke all on function public.get_artist_invite_by_token(text) from public;
revoke all on function public.revoke_artist_invite(uuid, text, timestamptz) from public;
revoke all on function public.accept_artist_invite(text, timestamptz) from public;

grant execute on function public.consume_artist_application_rate_limit(timestamptz, integer, integer) to authenticated;
grant execute on function public.submit_artist_application(uuid, text, text, text, text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.review_artist_application(uuid, public.artist_verification_status, text, timestamptz) to authenticated;
grant execute on function public.issue_artist_invite(uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_artist_invite_by_token(text) to authenticated;
grant execute on function public.revoke_artist_invite(uuid, text, timestamptz) to authenticated;
grant execute on function public.accept_artist_invite(text, timestamptz) to authenticated;
