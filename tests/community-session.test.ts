import assert from "node:assert/strict";
import test from "node:test";

import {
  getSupabasePublicConfig,
  type PublicEnvironment,
} from "../app/lib/supabase/config.ts";
import { safeCommunityReturnPath } from "../app/lib/supabase/redirect.ts";
import {
  getCurrentCommunityMember,
  type CommunitySessionSource,
} from "../app/lib/server/community/session.ts";

function environment(
  values: Partial<PublicEnvironment> = {},
): PublicEnvironment {
  return {
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    ...values,
  };
}

test("reports complete, partial, and invalid Supabase public configuration", () => {
  assert.deepEqual(getSupabasePublicConfig(environment()), {
    status: "unconfigured",
    missing: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ],
    invalid: [],
  });

  assert.deepEqual(
    getSupabasePublicConfig(
      environment({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      }),
    ),
    {
      status: "unconfigured",
      missing: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
      invalid: [],
    },
  );

  assert.deepEqual(
    getSupabasePublicConfig(
      environment({
        NEXT_PUBLIC_SUPABASE_URL: "javascript:alert(1)",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
      }),
    ),
    {
      status: "unconfigured",
      missing: [],
      invalid: ["NEXT_PUBLIC_SUPABASE_URL"],
    },
  );

  assert.deepEqual(
    getSupabasePublicConfig(
      environment({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co/",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
      }),
    ),
    {
      status: "configured",
      url: "https://project.supabase.co",
      publishableKey: "publishable-test-key",
    },
  );
});

test("keeps auth return paths on the current site", () => {
  assert.equal(
    safeCommunityReturnPath("/community/invite/safe-token"),
    "/community/invite/safe-token",
  );
  assert.equal(safeCommunityReturnPath("https://evil.example"), "/community");
  assert.equal(safeCommunityReturnPath("//evil.example"), "/community");
  assert.equal(safeCommunityReturnPath(null), "/community");
});

test("keeps the unconfigured site readable and all member mutations fail closed", async () => {
  const result = await getCurrentCommunityMember({
    config: getSupabasePublicConfig(environment()),
  });

  assert.equal(result.state, "unconfigured");
  assert.equal(result.member, null);
  assert.deepEqual(result.access.capabilities, ["general:read"]);
  assert.equal(result.access.artistDenialReason, "sign-in-required");
});

test("treats missing verified claims as signed out", async () => {
  const source: CommunitySessionSource = {
    getVerifiedSubject: async () => null,
    getProfile: async () => {
      throw new Error("profile lookup must not run");
    },
    getRoles: async () => {
      throw new Error("role lookup must not run");
    },
    getArtistStatus: async () => {
      throw new Error("artist lookup must not run");
    },
  };

  const result = await getCurrentCommunityMember({
    config: {
      status: "configured",
      url: "https://project.supabase.co",
      publishableKey: "publishable-test-key",
    },
    source,
  });

  assert.equal(result.state, "signed_out");
  assert.equal(result.member, null);
  assert.deepEqual(result.access.capabilities, ["general:read"]);
});

test("derives role and artist access only from server-loaded database rows", async () => {
  const source: CommunitySessionSource = {
    getVerifiedSubject: async () => "member-1",
    getProfile: async () => ({
      id: "member-1",
      displayName: "종이작가",
      accountStatus: "active",
    }),
    getRoles: async () => ["member"],
    getArtistStatus: async () => "provisional",
  };

  const result = await getCurrentCommunityMember({
    config: {
      status: "configured",
      url: "https://project.supabase.co",
      publishableKey: "publishable-test-key",
    },
    source,
  });

  assert.equal(result.state, "signed_in");
  assert.equal(result.member?.id, "member-1");
  assert.equal(result.member?.displayName, "종이작가");
  assert.equal(result.member?.actor.role, "member");
  assert.equal(result.member?.actor.artistStatus, "provisional");
  assert.equal(result.access.artistAccess, "provisional");
  assert.deepEqual(result.access.provisionalLimits, {
    postsPer24Hours: 1,
    commentsPer24Hours: 5,
  });
});

test("uses the highest server-loaded operator role and ignores inactive artist status", async () => {
  const source: CommunitySessionSource = {
    getVerifiedSubject: async () => "admin-1",
    getProfile: async () => ({
      id: "admin-1",
      displayName: "관리자",
      accountStatus: "active",
    }),
    getRoles: async () => ["member", "moderator", "admin"],
    getArtistStatus: async () => "revoked",
  };

  const result = await getCurrentCommunityMember({
    config: {
      status: "configured",
      url: "https://project.supabase.co",
      publishableKey: "publishable-test-key",
    },
    source,
  });

  assert.equal(result.member?.actor.role, "admin");
  assert.equal(result.access.artistAccess, "operator");
  assert.equal(
    result.access.capabilities.includes("admin:artist-review"),
    true,
  );
});

test("returns an explicit fail-closed error state when session data cannot be loaded", async () => {
  const source: CommunitySessionSource = {
    getVerifiedSubject: async () => "member-1",
    getProfile: async () => {
      throw new Error("database unavailable");
    },
    getRoles: async () => ["member"],
    getArtistStatus: async () => "verified",
  };

  const result = await getCurrentCommunityMember({
    config: {
      status: "configured",
      url: "https://project.supabase.co",
      publishableKey: "publishable-test-key",
    },
    source,
  });

  assert.equal(result.state, "error");
  assert.equal(result.member, null);
  assert.deepEqual(result.access.capabilities, ["general:read"]);
  assert.equal(result.message, "회원 권한을 확인하지 못했습니다.");
});
