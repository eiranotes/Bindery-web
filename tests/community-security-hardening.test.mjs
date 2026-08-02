import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const edgeFunctionPath = new URL(
  "../supabase/functions/submit-artist-application/index.ts",
  import.meta.url,
);
const siteRoutePath = new URL(
  "../app/api/community/verification/route.ts",
  import.meta.url,
);
const verificationIntegrityMigrationPath = new URL(
  "../supabase/migrations/20260728280000_verification_integrity.sql",
  import.meta.url,
);

test("keeps privileged submission credentials inside the Edge Function", async () => {
  const [edgeFunction, siteRoute] = await Promise.all([
    readFile(edgeFunctionPath, "utf8"),
    readFile(siteRoutePath, "utf8"),
  ]);

  assert.match(edgeFunction, /TURNSTILE_SECRET_KEY/);
  assert.match(edgeFunction, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edgeFunction, /\/auth\/v1\/user/);
  assert.match(edgeFunction, /submit_artist_application_service/);
  assert.match(edgeFunction, /createSubmitArtistApplicationHandler/);
  assert.match(edgeFunction, /get_artist_application_by_idempotency_service/);
  assert.match(edgeFunction, /policyConsent\s*!==\s*true/);
  assert.doesNotMatch(siteRoute, /SERVICE_ROLE/);
  assert.equal(edgeFunction.match(/turnstile\/v0\/siteverify/g)?.length, 1);
});

test("serializes idempotent submissions before recheck and rate mutation", async () => {
  const migration = await readFile(verificationIntegrityMigrationPath, "utf8");
  const lockAt = migration.indexOf("pg_advisory_xact_lock");
  const recheckAt = migration.indexOf("select * into existing_application", lockAt);
  const rateMutationAt = migration.indexOf(
    "insert into public.artist_application_rate_limits",
    recheckAt,
  );

  assert.ok(lockAt >= 0, "transaction advisory lock is required");
  assert.ok(recheckAt > lockAt, "idempotency must be rechecked under the lock");
  assert.ok(
    rateMutationAt > recheckAt,
    "rate attempts must be consumed only after the locked recheck",
  );
  assert.match(migration, /clock_timestamp\(\)/);
  assert.match(
    migration,
    /drop function if exists public\.review_artist_application\([\s\S]*?timestamptz/,
  );
  assert.match(
    migration,
    /drop function if exists public\.revoke_artist_invite\(uuid, text, timestamptz\)/,
  );
  assert.match(
    migration,
    /create function public\.accept_artist_invite\([\s\S]*?p_policy_consent boolean,[\s\S]*?p_policy_version text/,
  );
});
