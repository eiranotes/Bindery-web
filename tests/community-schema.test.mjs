import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260726130000_community_foundation.sql",
  import.meta.url,
);
const migration = await readFile(migrationUrl, "utf8");

const requiredTables = [
  "profiles",
  "user_roles",
  "artist_verifications",
  "artist_invites",
  "boards",
  "posts",
  "post_sources",
  "post_revisions",
  "comments",
  "bookmarks",
  "reports",
  "moderation_actions",
  "audit_events",
  "notifications",
  "policy_acceptances",
];

test("declares the complete initial community schema", () => {
  for (const table of requiredTables) {
    assert.match(
      migration,
      new RegExp(`create table public\\.${table}\\b`, "i"),
      `missing public.${table}`,
    );
  }

  assert.match(migration, /proof_url_normalized\s+text\s+not null/i);
  assert.match(
    migration,
    /create unique index artist_verifications_proof_url_unique/i,
  );
  assert.match(migration, /insert into public\.boards/i);
  assert.match(migration, /'general'.*'public'/is);
  assert.match(migration, /'artists'.*'artist'/is);
});

test("enables RLS on every exposed community table", () => {
  for (const table of requiredTables) {
    assert.match(
      migration,
      new RegExp(
        `alter table public\\.${table}\\s+enable row level security`,
        "i",
      ),
      `RLS is not enabled for public.${table}`,
    );
  }
});

test("uses fixed-search-path authorization helpers and append-only audit history", () => {
  for (const helper of [
    "is_active_member",
    "has_role",
    "is_operator",
    "has_artist_access",
    "can_access_board",
    "can_read_post",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `create or replace function public\\.${helper}\\b[\\s\\S]*?set search_path = public, pg_temp`,
        "i",
      ),
      `missing fixed search_path on public.${helper}`,
    );
  }

  assert.match(migration, /create trigger audit_artist_verifications/i);
  assert.match(migration, /create trigger audit_artist_invites/i);
  assert.match(migration, /create trigger audit_user_roles/i);
  assert.match(migration, /create trigger prevent_audit_event_mutation/i);
  assert.match(migration, /audit events are append-only/i);
});

test("declares role-specific grants and board/content policies", () => {
  assert.match(migration, /grant usage on schema public to anon, authenticated/i);
  assert.match(
    migration,
    /grant select on public\.posts,[\s\S]*?to anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant select, insert, update on public\.posts to authenticated/i,
  );
  assert.match(migration, /create policy posts_select_authorized/i);
  assert.match(migration, /create policy posts_insert_authorized/i);
  assert.match(migration, /create policy artist_verifications_insert_own/i);
  assert.match(migration, /create policy reports_select_own_or_operator/i);
  assert.match(migration, /create policy notifications_select_own/i);
  assert.doesNotMatch(migration, /service[_-]?role[_-]?key/i);
});
