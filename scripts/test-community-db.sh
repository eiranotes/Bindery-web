#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
assertion_file="${1:-supabase/tests/community_rls.test.sql}"

if [[ "${assertion_file}" != /* ]]; then
  assertion_file="${repository_root}/${assertion_file}"
fi

if [[ ! -f "${assertion_file}" ]]; then
  printf 'Community DB assertion file not found: %s\n' "${assertion_file}" >&2
  exit 2
fi

for required_command in initdb pg_ctl psql createdb; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    printf 'Required PostgreSQL command is missing: %s\n' "${required_command}" >&2
    exit 2
  fi
done

community_db_tmp="$(mktemp -d "${TMPDIR:-/tmp}/bindery-community-db.XXXXXX")"
community_db_data="${community_db_tmp}/data"
community_db_socket="${community_db_tmp}/socket"
community_db_name="bindery_community_test"
community_db_started=0

mkdir -p "${community_db_socket}"

cleanup_community_db() {
  if [[ "${community_db_started}" -eq 1 && -d "${community_db_data}" ]]; then
    pg_ctl -D "${community_db_data}" -m fast -w stop >/dev/null 2>&1 || true
  fi

  if [[ -n "${community_db_tmp}" && -d "${community_db_tmp}" ]]; then
    rm -rf -- "${community_db_tmp}"
  fi
}

trap cleanup_community_db EXIT INT TERM

initdb \
  -D "${community_db_data}" \
  --auth=trust \
  --encoding=UTF8 \
  --no-locale \
  >/dev/null

pg_ctl \
  -D "${community_db_data}" \
  -o "-h '' -k '${community_db_socket}'" \
  -w start \
  >/dev/null
community_db_started=1

createdb -h "${community_db_socket}" "${community_db_name}"

psql \
  -v ON_ERROR_STOP=1 \
  -h "${community_db_socket}" \
  -d "${community_db_name}" <<'SQL'
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
SQL

for migration_file in "${repository_root}"/supabase/migrations/*.sql; do
  if [[ ! -f "${migration_file}" ]]; then
    printf 'No migration files found under supabase/migrations\n' >&2
    exit 2
  fi

  psql \
    -v ON_ERROR_STOP=1 \
    -h "${community_db_socket}" \
    -d "${community_db_name}" \
    -f "${migration_file}"
done

psql \
  -v ON_ERROR_STOP=1 \
  -h "${community_db_socket}" \
  -d "${community_db_name}" \
  -f "${repository_root}/supabase/seed.sql"

psql \
  -v ON_ERROR_STOP=1 \
  -h "${community_db_socket}" \
  -d "${community_db_name}" \
  -f "${assertion_file}"

printf 'Community database assertions passed: %s\n' "${assertion_file}"
