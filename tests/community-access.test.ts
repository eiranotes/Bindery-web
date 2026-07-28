import assert from "node:assert/strict";
import test from "node:test";

import {
  ARTIST_PROVISIONAL_LIMITS,
  decideArtistStatusTransition,
  getCommunityAccess,
  type CommunityActor,
  type CommunityCapability,
} from "../app/lib/community-access.ts";

function expectCapabilities(
  actor: CommunityActor | null,
  expected: CommunityCapability[],
) {
  const access = getCommunityAccess(actor);

  for (const capability of expected) {
    assert.equal(
      access.capabilities.includes(capability),
      true,
      `expected ${capability} for ${JSON.stringify(actor)}`,
    );
  }

  return access;
}

test("keeps general reading public while member mutations require an active account", () => {
  const anonymous = getCommunityAccess(null);

  assert.deepEqual(anonymous.capabilities, ["general:read"]);
  assert.equal(anonymous.artistDenialReason, "sign-in-required");

  const member = expectCapabilities(
    {
      authenticated: true,
      accountStatus: "active",
      role: "member",
      artistStatus: "none",
    },
    [
      "general:read",
      "general:write",
      "general:comment",
      "general:bookmark",
      "general:report",
    ],
  );

  assert.equal(member.capabilities.includes("artist:read"), false);
  assert.equal(member.artistDenialReason, "artist-status-required");

  const suspended = getCommunityAccess({
    authenticated: true,
    accountStatus: "suspended",
    role: "admin",
    artistStatus: "verified",
  });

  assert.deepEqual(suspended.capabilities, ["general:read"]);
  assert.equal(suspended.artistDenialReason, "account-inactive");
});

test("grants artist access only to active provisional and verified artists", () => {
  const provisional = expectCapabilities(
    {
      authenticated: true,
      accountStatus: "active",
      role: "member",
      artistStatus: "provisional",
    },
    ["artist:read", "artist:write", "artist:comment"],
  );

  assert.equal(provisional.artistAccess, "provisional");
  assert.deepEqual(provisional.provisionalLimits, ARTIST_PROVISIONAL_LIMITS);
  assert.equal(provisional.artistDenialReason, null);

  const verified = expectCapabilities(
    {
      authenticated: true,
      accountStatus: "active",
      role: "member",
      artistStatus: "verified",
    },
    ["artist:read", "artist:write", "artist:comment"],
  );

  assert.equal(verified.artistAccess, "verified");
  assert.equal(verified.provisionalLimits, null);

  for (const artistStatus of [
    "rejected",
    "suspended",
    "revoked",
  ] as const) {
    const denied = getCommunityAccess({
      authenticated: true,
      accountStatus: "active",
      role: "member",
      artistStatus,
    });

    assert.equal(denied.capabilities.includes("artist:read"), false);
    assert.equal(denied.artistAccess, "none");
    assert.equal(denied.artistDenialReason, "artist-status-inactive");
  }
});

test("keeps moderation and administration capabilities separate", () => {
  const moderator = expectCapabilities(
    {
      authenticated: true,
      accountStatus: "active",
      role: "moderator",
      artistStatus: "none",
    },
    ["artist:read", "moderation:content", "moderation:reports"],
  );

  assert.equal(moderator.capabilities.includes("artist:write"), false);
  assert.equal(moderator.capabilities.includes("admin:artist-review"), false);

  const admin = expectCapabilities(
    {
      authenticated: true,
      accountStatus: "active",
      role: "admin",
      artistStatus: "none",
    },
    [
      "artist:read",
      "artist:write",
      "artist:comment",
      "moderation:content",
      "moderation:reports",
      "admin:artist-review",
      "admin:invite",
      "admin:roles",
    ],
  );

  assert.equal(admin.artistAccess, "operator");
});

test("denies unknown runtime roles and states by default", () => {
  const access = getCommunityAccess({
    authenticated: true,
    accountStatus: "unexpected",
    role: "owner",
    artistStatus: "approved",
  } as unknown as CommunityActor);

  assert.deepEqual(access.capabilities, ["general:read"]);
  assert.equal(access.artistDenialReason, "account-inactive");
});

test("allows self-submission to provisional but reserves review decisions for admins", () => {
  assert.deepEqual(
    decideArtistStatusTransition({
      actor: {
        authenticated: true,
        accountStatus: "active",
        role: "member",
        artistStatus: "none",
      },
      from: "none",
      to: "provisional",
      isSelf: true,
    }),
    { allowed: true, reason: "allowed" },
  );

  assert.deepEqual(
    decideArtistStatusTransition({
      actor: {
        authenticated: true,
        accountStatus: "active",
        role: "member",
        artistStatus: "provisional",
      },
      from: "provisional",
      to: "verified",
      isSelf: true,
    }),
    { allowed: false, reason: "admin-required" },
  );

  assert.deepEqual(
    decideArtistStatusTransition({
      actor: {
        authenticated: true,
        accountStatus: "active",
        role: "moderator",
        artistStatus: "provisional",
      },
      from: "provisional",
      to: "revoked",
      isSelf: false,
    }),
    { allowed: false, reason: "admin-required" },
  );
});

test("allows only valid admin verification, invitation, suspension, and revocation transitions", () => {
  const admin: CommunityActor = {
    authenticated: true,
    accountStatus: "active",
    role: "admin",
    artistStatus: "none",
  };

  for (const transition of [
    ["none", "verified"],
    ["provisional", "verified"],
    ["provisional", "rejected"],
    ["verified", "suspended"],
    ["verified", "revoked"],
    ["suspended", "verified"],
  ] as const) {
    assert.deepEqual(
      decideArtistStatusTransition({
        actor: admin,
        from: transition[0],
        to: transition[1],
        isSelf: false,
      }),
      { allowed: true, reason: "allowed" },
    );
  }

  assert.deepEqual(
    decideArtistStatusTransition({
      actor: admin,
      from: "revoked",
      to: "verified",
      isSelf: false,
    }),
    { allowed: false, reason: "invalid-transition" },
  );

  assert.deepEqual(
    decideArtistStatusTransition({
      actor: { ...admin, accountStatus: "suspended" },
      from: "provisional",
      to: "verified",
      isSelf: false,
    }),
    { allowed: false, reason: "inactive-account" },
  );
});
