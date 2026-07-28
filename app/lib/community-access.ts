export const ACCOUNT_ROLES = ["member", "moderator", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "suspended", "deleted"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ARTIST_STATUSES = [
  "none",
  "provisional",
  "verified",
  "rejected",
  "suspended",
  "revoked",
] as const;
export type ArtistStatus = (typeof ARTIST_STATUSES)[number];

export const COMMUNITY_CAPABILITIES = [
  "general:read",
  "general:write",
  "general:comment",
  "general:bookmark",
  "general:report",
  "artist:read",
  "artist:write",
  "artist:comment",
  "moderation:content",
  "moderation:reports",
  "admin:artist-review",
  "admin:invite",
  "admin:roles",
] as const;
export type CommunityCapability = (typeof COMMUNITY_CAPABILITIES)[number];

export type CommunityActor = {
  authenticated: boolean;
  accountStatus: AccountStatus;
  role: AccountRole;
  artistStatus: ArtistStatus;
};

export const ARTIST_PROVISIONAL_LIMITS = {
  postsPer24Hours: 1,
  commentsPer24Hours: 5,
} as const;

export type ArtistAccess = "none" | "provisional" | "verified" | "operator";
export type ArtistDenialReason =
  | "sign-in-required"
  | "account-inactive"
  | "artist-status-required"
  | "artist-status-inactive"
  | null;

export type CommunityAccess = {
  capabilities: CommunityCapability[];
  artistAccess: ArtistAccess;
  artistDenialReason: ArtistDenialReason;
  provisionalLimits: typeof ARTIST_PROVISIONAL_LIMITS | null;
};

export type ArtistTransitionReason =
  | "allowed"
  | "sign-in-required"
  | "inactive-account"
  | "admin-required"
  | "invalid-transition";

export type ArtistTransitionDecision = {
  allowed: boolean;
  reason: ArtistTransitionReason;
};

const GENERAL_MEMBER_CAPABILITIES: CommunityCapability[] = [
  "general:read",
  "general:write",
  "general:comment",
  "general:bookmark",
  "general:report",
];

const ARTIST_MEMBER_CAPABILITIES: CommunityCapability[] = [
  "artist:read",
  "artist:write",
  "artist:comment",
];

const MODERATOR_CAPABILITIES: CommunityCapability[] = [
  "artist:read",
  "moderation:content",
  "moderation:reports",
];

const ADMIN_CAPABILITIES: CommunityCapability[] = [
  "artist:read",
  "artist:write",
  "artist:comment",
  "moderation:content",
  "moderation:reports",
  "admin:artist-review",
  "admin:invite",
  "admin:roles",
];

const ADMIN_ARTIST_TRANSITIONS: Record<ArtistStatus, ArtistStatus[]> = {
  none: ["verified"],
  provisional: ["verified", "rejected", "suspended", "revoked"],
  verified: ["suspended", "revoked"],
  rejected: [],
  suspended: ["provisional", "verified", "revoked"],
  revoked: [],
};

function includesValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isActiveKnownActor(actor: CommunityActor) {
  return (
    actor.authenticated &&
    includesValue(ACCOUNT_STATUSES, actor.accountStatus) &&
    actor.accountStatus === "active" &&
    includesValue(ACCOUNT_ROLES, actor.role) &&
    includesValue(ARTIST_STATUSES, actor.artistStatus)
  );
}

function uniqueCapabilities(
  capabilities: CommunityCapability[],
): CommunityCapability[] {
  return [...new Set(capabilities)];
}

export function getCommunityAccess(
  actor: CommunityActor | null | undefined,
): CommunityAccess {
  if (!actor?.authenticated) {
    return {
      capabilities: ["general:read"],
      artistAccess: "none",
      artistDenialReason: "sign-in-required",
      provisionalLimits: null,
    };
  }

  if (!isActiveKnownActor(actor)) {
    return {
      capabilities: ["general:read"],
      artistAccess: "none",
      artistDenialReason: "account-inactive",
      provisionalLimits: null,
    };
  }

  const capabilities = [...GENERAL_MEMBER_CAPABILITIES];

  if (actor.role === "admin") {
    capabilities.push(...ADMIN_CAPABILITIES);

    return {
      capabilities: uniqueCapabilities(capabilities),
      artistAccess: "operator",
      artistDenialReason: null,
      provisionalLimits: null,
    };
  }

  if (actor.role === "moderator") {
    capabilities.push(...MODERATOR_CAPABILITIES);

    return {
      capabilities: uniqueCapabilities(capabilities),
      artistAccess: "operator",
      artistDenialReason: null,
      provisionalLimits: null,
    };
  }

  if (actor.artistStatus === "provisional") {
    capabilities.push(...ARTIST_MEMBER_CAPABILITIES);

    return {
      capabilities: uniqueCapabilities(capabilities),
      artistAccess: "provisional",
      artistDenialReason: null,
      provisionalLimits: ARTIST_PROVISIONAL_LIMITS,
    };
  }

  if (actor.artistStatus === "verified") {
    capabilities.push(...ARTIST_MEMBER_CAPABILITIES);

    return {
      capabilities: uniqueCapabilities(capabilities),
      artistAccess: "verified",
      artistDenialReason: null,
      provisionalLimits: null,
    };
  }

  return {
    capabilities: uniqueCapabilities(capabilities),
    artistAccess: "none",
    artistDenialReason:
      actor.artistStatus === "none"
        ? "artist-status-required"
        : "artist-status-inactive",
    provisionalLimits: null,
  };
}

export function decideArtistStatusTransition({
  actor,
  from,
  to,
  isSelf,
}: {
  actor: CommunityActor | null | undefined;
  from: ArtistStatus;
  to: ArtistStatus;
  isSelf: boolean;
}): ArtistTransitionDecision {
  if (!actor?.authenticated) {
    return { allowed: false, reason: "sign-in-required" };
  }

  if (!isActiveKnownActor(actor)) {
    return { allowed: false, reason: "inactive-account" };
  }

  if (isSelf && from === "none" && to === "provisional") {
    return { allowed: true, reason: "allowed" };
  }

  if (actor.role !== "admin") {
    return { allowed: false, reason: "admin-required" };
  }

  const allowed = ADMIN_ARTIST_TRANSITIONS[from].includes(to);

  return allowed
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "invalid-transition" };
}
