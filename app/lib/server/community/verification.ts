import {
  decideArtistStatusTransition,
  getCommunityAccess,
  type ArtistStatus,
  type CommunityActor,
} from "../../community-access.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CURRENT_COMMUNITY_POLICY_VERSION = "community-2026-07";

export type ArtistVerificationRecord = {
  id: string;
  userId: string;
  status: Exclude<ArtistStatus, "none">;
  activityName: string;
  proofUrl: string;
  proofUrlNormalized: string;
  primaryField: string;
  optionalPublicUrl: string | null;
  applicantNote: string | null;
  idempotencyKey: string;
  policyVersion: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewReason: string | null;
};

export type ArtistInviteRecord = {
  id: string;
  email: string;
  tokenDigest: string;
  state: "pending" | "accepted" | "expired" | "revoked";
  issuedBy: string;
  acceptedBy: string | null;
  activityName: string;
  proofUrl: string;
  proofUrlNormalized: string;
  primaryField: string;
  reason: string;
  policyVersion: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
  createdAt: string;
};

export type ArtistInviteDraft = Pick<
  ArtistInviteRecord,
  | "id"
  | "email"
  | "tokenDigest"
  | "activityName"
  | "proofUrl"
  | "proofUrlNormalized"
  | "primaryField"
  | "reason"
  | "policyVersion"
>;

export type ArtistVerificationRepository = {
  findApplicationByProofUrl(
    proofUrlNormalized: string,
  ): Promise<ArtistVerificationRecord | null>;
  getApplication(id: string): Promise<ArtistVerificationRecord | null>;
  updateApplicationStatus(input: {
    id: string;
    status: ArtistVerificationRecord["status"];
    reason: string;
  }): Promise<ArtistVerificationRecord>;
  createInvite(invite: ArtistInviteDraft): Promise<ArtistInviteRecord>;
  getInvite(id: string): Promise<ArtistInviteRecord | null>;
  findInviteByDigest(tokenDigest: string): Promise<ArtistInviteRecord | null>;
  acceptInvite(input: {
    tokenDigest: string;
    policyConsent: boolean;
    policyVersion: string;
  }): Promise<
    | {
        ok: true;
        code: "accepted";
        application: ArtistVerificationRecord;
      }
    | { ok: false; code: string }
  >;
  revokeInvite(input: {
    inviteId: string;
    reason: string;
  }): Promise<ArtistInviteRecord>;
  listApplications(
    statuses?: ArtistVerificationRecord["status"][],
  ): Promise<ArtistVerificationRecord[]>;
  listInvites(): Promise<ArtistInviteRecord[]>;
};

export type ArtistVerificationDependencies = {
  repository: ArtistVerificationRepository;
  ids?: {
    invite(): string;
  };
  tokens?: {
    create(): string;
    digest(token: string): Promise<string>;
  };
};

type ApplicationInput = {
  activityName: string;
  proofUrl: string;
  primaryField: string;
  optionalPublicUrl?: string | null;
  applicantNote?: string | null;
  policyVersion: string;
};

type VerificationResult = {
  ok: boolean;
  code: string;
  message?: string;
  application?: ArtistVerificationRecord;
  invite?: ArtistInviteRecord;
  rawToken?: string;
  retryAfterSeconds?: number;
};

export type ArtistApplicationEdgeInput = {
  activityName: string;
  proofUrl: string;
  primaryField: string;
  optionalPublicUrl: string | null;
  applicantNote: string | null;
  botToken: string;
  idempotencyKey: string;
  policyConsent: boolean;
  policyVersion: string;
};

const TRACKING_PARAMETERS = [
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
];

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isNonPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    isPrivateIpv4(normalized)
  );
}

export function normalizePublicProofUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || isNonPublicHostname(url.hostname)) {
      return null;
    }

    url.hash = "";
    for (const parameter of [...url.searchParams.keys()]) {
      if (
        parameter.toLowerCase().startsWith("utm_") ||
        TRACKING_PARAMETERS.includes(parameter.toLowerCase())
      ) {
        url.searchParams.delete(parameter);
      }
    }
    url.searchParams.sort();

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeOptionalPublicUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  return normalizePublicProofUrl(value);
}

function cleanText(value: string, maximum: number) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= maximum ? cleaned : null;
}

function validateApplicationInput(input: ApplicationInput) {
  const activityName = cleanText(input.activityName, 80);
  const primaryField = cleanText(input.primaryField, 80);
  const proofUrlNormalized = normalizePublicProofUrl(input.proofUrl);
  const optionalPublicUrl = normalizeOptionalPublicUrl(input.optionalPublicUrl);
  const applicantNote = input.applicantNote?.trim() || null;
  const policyVersion = cleanText(input.policyVersion, 80);

  if (
    !activityName ||
    !primaryField ||
    !proofUrlNormalized ||
    !policyVersion ||
    (input.optionalPublicUrl?.trim() && !optionalPublicUrl) ||
    (applicantNote && applicantNote.length > 500)
  ) {
    return null;
  }

  return {
    activityName,
    proofUrl: input.proofUrl.trim(),
    proofUrlNormalized,
    primaryField,
    optionalPublicUrl,
    applicantNote,
    policyVersion,
  };
}

function isActiveMember(actor: CommunityActor, userId: string) {
  return (
    userId.length > 0 &&
    actor.authenticated &&
    actor.accountStatus === "active" &&
    getCommunityAccess(actor).capabilities.includes("general:write")
  );
}

function inviteId(dependencies: ArtistVerificationDependencies) {
  return dependencies.ids?.invite() ?? crypto.randomUUID();
}

function createInviteToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function digestInviteToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function applicationFromRow(row: Record<string, unknown>): ArtistVerificationRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as ArtistVerificationRecord["status"],
    activityName: String(row.activity_name),
    proofUrl: String(row.proof_url),
    proofUrlNormalized: String(row.proof_url_normalized),
    primaryField: String(row.primary_field),
    optionalPublicUrl:
      typeof row.optional_public_url === "string"
        ? row.optional_public_url
        : null,
    applicantNote:
      typeof row.applicant_note === "string" ? row.applicant_note : null,
    idempotencyKey: String(row.idempotency_key),
    policyVersion: String(row.policy_version),
    submittedAt: String(row.submitted_at),
    reviewedAt:
      typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    reviewedBy:
      typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewReason:
      typeof row.review_reason === "string" ? row.review_reason : null,
  };
}

function inviteFromRow(row: Record<string, unknown>): ArtistInviteRecord {
  return {
    id: String(row.id),
    email: String(row.invited_email),
    tokenDigest: String(row.token_digest),
    state: row.state as ArtistInviteRecord["state"],
    issuedBy: String(row.issued_by),
    acceptedBy:
      typeof row.accepted_by === "string" ? row.accepted_by : null,
    activityName: String(row.activity_name),
    proofUrl: String(row.proof_url),
    proofUrlNormalized: String(row.proof_url_normalized),
    primaryField: String(row.primary_field),
    reason: String(row.reason),
    policyVersion: String(row.policy_version),
    expiresAt: String(row.expires_at),
    acceptedAt:
      typeof row.accepted_at === "string" ? row.accepted_at : null,
    revokedAt: typeof row.revoked_at === "string" ? row.revoked_at : null,
    revokedBy: typeof row.revoked_by === "string" ? row.revoked_by : null,
    revocationReason:
      typeof row.revocation_reason === "string"
        ? row.revocation_reason
        : null,
    createdAt: String(row.created_at),
  };
}

function requireRow<T>(
  data: Record<string, unknown> | null,
  error: { message: string } | null,
  mapper: (row: Record<string, unknown>) => T,
) {
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Expected database row");
  return mapper(data);
}

export function createSupabaseVerificationRepository(
  client: SupabaseClient,
): ArtistVerificationRepository {
  return {
    async findApplicationByProofUrl(proofUrlNormalized) {
      const { data, error } = await client
        .from("artist_verifications")
        .select("*")
        .eq("proof_url_normalized", proofUrlNormalized)
        .maybeSingle();
      if (error) throw error;
      return data ? applicationFromRow(data) : null;
    },
    async getApplication(id) {
      const { data, error } = await client
        .from("artist_verifications")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? applicationFromRow(data) : null;
    },
    async updateApplicationStatus({
      id,
      status,
      reason,
    }) {
      const { data, error } = await client
        .rpc("review_artist_application", {
          p_application_id: id,
          p_next_status: status,
          p_reason: reason,
        })
        .maybeSingle();
      return requireRow(
        data as Record<string, unknown> | null,
        error,
        applicationFromRow,
      );
    },
    async createInvite(invite) {
      const { data, error } = await client
        .rpc("issue_artist_invite", {
          p_id: invite.id,
          p_invited_email: invite.email,
          p_token_digest: invite.tokenDigest,
          p_activity_name: invite.activityName,
          p_proof_url: invite.proofUrl,
          p_proof_url_normalized: invite.proofUrlNormalized,
          p_primary_field: invite.primaryField,
          p_reason: invite.reason,
          p_policy_version: invite.policyVersion,
        })
        .maybeSingle();
      return requireRow(
        data as Record<string, unknown> | null,
        error,
        inviteFromRow,
      );
    },
    async getInvite(id) {
      const { data, error } = await client
        .from("artist_invites")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? inviteFromRow(data as Record<string, unknown>) : null;
    },
    async findInviteByDigest(tokenDigest) {
      const { data, error } = await client
        .rpc("get_artist_invite_by_token", {
          p_token_digest: tokenDigest,
        })
        .maybeSingle();
      if (error) throw error;
      return data ? inviteFromRow(data as Record<string, unknown>) : null;
    },
    async acceptInvite({ tokenDigest, policyConsent, policyVersion }) {
      const { data, error } = await client
        .rpc("accept_artist_invite", {
          p_token_digest: tokenDigest,
          p_policy_consent: policyConsent,
          p_policy_version: policyVersion,
        });
      if (error) throw error;
      if (
        typeof data !== "object" ||
        data === null ||
        typeof (data as { code?: unknown }).code !== "string" ||
        typeof (data as { ok?: unknown }).ok !== "boolean"
      ) {
        throw new Error("Invite acceptance RPC returned an invalid response");
      }

      const result = data as {
        ok: boolean;
        code: string;
        application?: Record<string, unknown>;
      };
      if (result.ok) {
        if (result.code !== "accepted" || !result.application) {
          throw new Error("Invite acceptance RPC omitted the application");
        }
        return {
          ok: true,
          code: "accepted",
          application: applicationFromRow(result.application),
        };
      }
      return { ok: false, code: result.code };
    },
    async revokeInvite({ inviteId, reason }) {
      const { data, error } = await client
        .rpc("revoke_artist_invite", {
          p_invite_id: inviteId,
          p_reason: reason,
        })
        .maybeSingle();
      return requireRow(
        data as Record<string, unknown> | null,
        error,
        inviteFromRow,
      );
    },
    async listApplications(statuses = ["provisional"]) {
      const { data, error } = await client
        .from("artist_verifications")
        .select("*")
        .in("status", statuses)
        .order("submitted_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(applicationFromRow);
    },
    async listInvites() {
      const { data, error } = await client
        .from("artist_invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(inviteFromRow);
    },
  };
}

function isVerificationResult(value: unknown): value is VerificationResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { ok?: unknown }).ok === "boolean" &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

async function verificationResultFromFunctionError(error: unknown) {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return null;

  try {
    const body = await context.json();
    return isVerificationResult(body) ? body : null;
  } catch {
    return null;
  }
}

export function createSupabaseArtistApplicationSubmitter(
  client: SupabaseClient,
) {
  return {
    async submit(input: ArtistApplicationEdgeInput): Promise<VerificationResult> {
      const { data, error } = await client.functions.invoke(
        "submit-artist-application",
        { body: input },
      );

      if (isVerificationResult(data)) return data;
      const failure = await verificationResultFromFunctionError(error);
      if (failure) return failure;
      throw (
        error ??
        new Error("Artist application Edge Function returned an invalid response")
      );
    },
  };
}

export function createSupabaseVerificationDependencies(
  client: SupabaseClient,
): ArtistVerificationDependencies {
  return {
    repository: createSupabaseVerificationRepository(client),
  };
}

export async function reviewArtistApplication(
  command: {
    actor: CommunityActor;
    applicationId: string;
    nextStatus: ArtistVerificationRecord["status"];
    reason: string;
  },
  dependencies: ArtistVerificationDependencies,
): Promise<VerificationResult> {
  const reason = cleanText(command.reason, 2000);
  if (!reason) {
    return { ok: false, code: "invalid-input", message: "검수 사유가 필요합니다." };
  }

  const application = await dependencies.repository.getApplication(
    command.applicationId,
  );
  if (!application) {
    return { ok: false, code: "not-found", message: "신청을 찾을 수 없습니다." };
  }

  const decision = decideArtistStatusTransition({
    actor: command.actor,
    from: application.status,
    to: command.nextStatus,
    isSelf: false,
  });
  if (!decision.allowed || command.actor.role !== "admin") {
    return { ok: false, code: "forbidden", message: "관리자 권한이 필요합니다." };
  }

  const updated = await dependencies.repository.updateApplicationStatus({
    id: application.id,
    status: command.nextStatus,
    reason,
  });
  return { ok: true, code: "updated", application: updated };
}

export async function issueArtistInvite(
  command: {
    actor: CommunityActor;
    issuerId: string;
    input: {
      email: string;
      activityName: string;
      proofUrl: string;
      primaryField: string;
      reason: string;
      policyVersion: string;
    };
    now: Date;
  },
  dependencies: ArtistVerificationDependencies,
): Promise<VerificationResult> {
  if (
    command.actor.role !== "admin" ||
    !getCommunityAccess(command.actor).capabilities.includes("admin:invite")
  ) {
    return { ok: false, code: "forbidden", message: "관리자 권한이 필요합니다." };
  }

  const email = command.input.email.trim().toLowerCase();
  const reason = cleanText(command.input.reason, 500);
  const input = validateApplicationInput({
    activityName: command.input.activityName,
    proofUrl: command.input.proofUrl,
    primaryField: command.input.primaryField,
    policyVersion: command.input.policyVersion,
  });
  if (!email.includes("@") || !reason || !input) {
    return { ok: false, code: "invalid-input", message: "초대 내용을 다시 확인해 주세요." };
  }

  if (
    await dependencies.repository.findApplicationByProofUrl(
      input.proofUrlNormalized,
    )
  ) {
    return { ok: false, code: "duplicate-proof", message: "이미 사용된 활동 주소입니다." };
  }

  const rawToken = dependencies.tokens?.create() ?? createInviteToken();
  const tokenDigest = dependencies.tokens
    ? await dependencies.tokens.digest(rawToken)
    : await digestInviteToken(rawToken);
  const invite: ArtistInviteDraft = {
    id: inviteId(dependencies),
    email,
    tokenDigest,
    activityName: input.activityName,
    proofUrl: input.proofUrl,
    proofUrlNormalized: input.proofUrlNormalized,
    primaryField: input.primaryField,
    reason,
    policyVersion: input.policyVersion,
  };
  const created = await dependencies.repository.createInvite(invite);
  return { ok: true, code: "created", invite: created, rawToken };
}

export async function acceptArtistInvite(
  command: {
    actor: CommunityActor;
    userId: string;
    email: string;
    rawToken: string;
    policyConsent: boolean;
    policyVersion: string;
  },
  dependencies: ArtistVerificationDependencies,
): Promise<VerificationResult> {
  if (!isActiveMember(command.actor, command.userId)) {
    return { ok: false, code: "forbidden", message: "로그인이 필요합니다." };
  }
  if (!command.policyConsent) {
    return {
      ok: false,
      code: "consent-required",
      message: "현재 커뮤니티 운영 규칙에 동의해 주세요.",
    };
  }
  if (command.policyVersion !== CURRENT_COMMUNITY_POLICY_VERSION) {
    return {
      ok: false,
      code: "policy-version-stale",
      message: "운영 규칙이 변경되었습니다. 현재 내용을 다시 확인해 주세요.",
    };
  }

  const tokenDigest = dependencies.tokens
    ? await dependencies.tokens.digest(command.rawToken)
    : await digestInviteToken(command.rawToken);
  const invite = await dependencies.repository.findInviteByDigest(tokenDigest);
  if (!invite) {
    return { ok: false, code: "invite-not-found", message: "초대를 찾을 수 없습니다." };
  }
  if (invite.state !== "pending") {
    return { ok: false, code: "invite-used", message: "이미 처리된 초대입니다." };
  }
  if (invite.email !== command.email.trim().toLowerCase()) {
    return { ok: false, code: "invite-recipient-mismatch", message: "초대 대상 계정이 아닙니다." };
  }

  const accepted = await dependencies.repository.acceptInvite({
    tokenDigest: invite.tokenDigest,
    policyConsent: command.policyConsent,
    policyVersion: command.policyVersion,
  });
  if (!accepted.ok) {
    const messages: Record<string, string> = {
      "invite-expired": "초대가 만료됐습니다.",
      "invite-not-found": "초대를 찾을 수 없습니다.",
      "invite-recipient-mismatch": "초대 대상 계정이 아닙니다.",
      "invite-used": "이미 처리된 초대입니다.",
      "consent-required": "현재 커뮤니티 운영 규칙에 동의해 주세요.",
      "policy-version-stale":
        "운영 규칙이 변경되었습니다. 현재 내용을 다시 확인해 주세요.",
    };
    return {
      ok: false,
      code: accepted.code,
      message: messages[accepted.code] ?? "초대를 처리하지 못했습니다.",
    };
  }
  return { ok: true, code: "accepted", application: accepted.application };
}

export async function revokeArtistInvite(
  command: {
    actor: CommunityActor;
    inviteId: string;
    reason: string;
  },
  dependencies: ArtistVerificationDependencies,
): Promise<VerificationResult> {
  if (
    command.actor.role !== "admin" ||
    !getCommunityAccess(command.actor).capabilities.includes("admin:invite")
  ) {
    return { ok: false, code: "forbidden", message: "관리자 권한이 필요합니다." };
  }

  const reason = cleanText(command.reason, 500);
  if (!reason) {
    return { ok: false, code: "invalid-input", message: "취소 사유가 필요합니다." };
  }

  const invite = await dependencies.repository.getInvite(command.inviteId);
  if (!invite) {
    return { ok: false, code: "invite-not-found", message: "초대를 찾을 수 없습니다." };
  }
  if (invite.state !== "pending") {
    return { ok: false, code: "invite-used", message: "대기 중인 초대만 취소할 수 있습니다." };
  }

  const revoked = await dependencies.repository.revokeInvite({
    inviteId: invite.id,
    reason,
  });
  return { ok: true, code: "revoked", invite: revoked };
}
