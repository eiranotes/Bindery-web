import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  ARTIST_STATUSES,
  getCommunityAccess,
  type AccountRole,
  type AccountStatus,
  type ArtistStatus,
  type CommunityAccess,
  type CommunityActor,
} from "../../community-access.ts";
import {
  getSupabasePublicConfig,
  type SupabasePublicConfig,
} from "../../supabase/config.ts";

export type CommunitySessionProfile = {
  id: string;
  displayName: string;
  accountStatus: unknown;
};

export type CommunitySessionSource = {
  getVerifiedSubject(): Promise<string | null>;
  getProfile(subject: string): Promise<CommunitySessionProfile | null>;
  getRoles(subject: string): Promise<unknown[]>;
  getArtistStatus(subject: string): Promise<unknown>;
};

export type CommunityMember = {
  id: string;
  displayName: string;
  actor: CommunityActor;
};

export type CommunitySessionResult = {
  state: "unconfigured" | "signed_out" | "signed_in" | "error";
  member: CommunityMember | null;
  access: CommunityAccess;
  message: string | null;
};

function includesValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function resolveRole(values: unknown[]): AccountRole {
  const roles = values.filter((value): value is AccountRole =>
    includesValue(ACCOUNT_ROLES, value),
  );

  if (roles.includes("admin")) return "admin";
  if (roles.includes("moderator")) return "moderator";
  return "member";
}

function resolveArtistStatus(value: unknown): ArtistStatus {
  return includesValue(ARTIST_STATUSES, value) ? value : "none";
}

function publicOnlyResult(
  state: "unconfigured" | "signed_out" | "error",
  message: string | null = null,
): CommunitySessionResult {
  return {
    state,
    member: null,
    access: getCommunityAccess(null),
    message,
  };
}

function isMissingAuthSession(error: { name?: string; message?: string }) {
  return (
    error.name === "AuthSessionMissingError" ||
    error.message?.toLowerCase().includes("auth session missing") === true
  );
}

async function createDefaultSessionSource(
  config: SupabasePublicConfig,
): Promise<CommunitySessionSource> {
  const { createSupabaseServerClient } = await import("../../supabase/server.ts");
  const client = await createSupabaseServerClient(config);
  if (!client) throw new Error("Supabase is not configured");

  return {
    async getVerifiedSubject() {
      const result = await client.auth.getClaims();
      if (result.error) {
        if (isMissingAuthSession(result.error)) return null;
        throw result.error;
      }
      if (!result.data) return null;

      const subject = result.data.claims.sub;
      return typeof subject === "string" && subject.length > 0 ? subject : null;
    },
    async getProfile(subject) {
      const { data, error } = await client
        .from("profiles")
        .select("id, display_name, account_status")
        .eq("id", subject)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        displayName: data.display_name,
        accountStatus: data.account_status,
      };
    },
    async getRoles(subject) {
      const { data, error } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", subject);

      if (error) throw error;
      return (data ?? []).map((row) => row.role);
    },
    async getArtistStatus(subject) {
      const { data, error } = await client
        .from("artist_verifications")
        .select("status")
        .eq("user_id", subject)
        .maybeSingle();

      if (error) throw error;
      return data?.status ?? "none";
    },
  };
}

export async function getCurrentCommunityMember({
  config = getSupabasePublicConfig(),
  source,
}: {
  config?: SupabasePublicConfig;
  source?: CommunitySessionSource;
} = {}): Promise<CommunitySessionResult> {
  if (config.status !== "configured") {
    return publicOnlyResult("unconfigured");
  }

  try {
    const sessionSource = source ?? (await createDefaultSessionSource(config));
    const subject = await sessionSource.getVerifiedSubject();
    if (!subject) return publicOnlyResult("signed_out");

    const [profile, roles, artistStatusValue] = await Promise.all([
      sessionSource.getProfile(subject),
      sessionSource.getRoles(subject),
      sessionSource.getArtistStatus(subject),
    ]);

    if (
      !profile ||
      profile.id !== subject ||
      !includesValue(ACCOUNT_STATUSES, profile.accountStatus) ||
      typeof profile.displayName !== "string" ||
      profile.displayName.trim().length === 0
    ) {
      throw new Error("Invalid community profile");
    }

    const actor: CommunityActor = {
      authenticated: true,
      accountStatus: profile.accountStatus as AccountStatus,
      role: resolveRole(roles),
      artistStatus: resolveArtistStatus(artistStatusValue),
    };
    const member: CommunityMember = {
      id: subject,
      displayName: profile.displayName,
      actor,
    };

    return {
      state: "signed_in",
      member,
      access: getCommunityAccess(actor),
      message: null,
    };
  } catch {
    return publicOnlyResult("error", "회원 권한을 확인하지 못했습니다.");
  }
}
