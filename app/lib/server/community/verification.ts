import {
  decideArtistStatusTransition,
  getCommunityAccess,
  type ArtistStatus,
  type CommunityActor,
} from "../../community-access.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export type ArtistVerificationRepository = {
  findApplicationByIdempotency(
    userId: string,
    key: string,
  ): Promise<ArtistVerificationRecord | null>;
  findApplicationByUser(
    userId: string,
  ): Promise<ArtistVerificationRecord | null>;
  findApplicationByProofUrl(
    proofUrlNormalized: string,
  ): Promise<ArtistVerificationRecord | null>;
  createProvisionalApplication(
    application: ArtistVerificationRecord,
  ): Promise<ArtistVerificationRecord>;
  getApplication(id: string): Promise<ArtistVerificationRecord | null>;
  updateApplicationStatus(input: {
    id: string;
    status: ArtistVerificationRecord["status"];
    reviewedBy: string;
    reason: string;
    reviewedAt: string;
  }): Promise<ArtistVerificationRecord>;
  createInvite(invite: ArtistInviteRecord): Promise<ArtistInviteRecord>;
  getInvite(id: string): Promise<ArtistInviteRecord | null>;
  findInviteByDigest(tokenDigest: string): Promise<ArtistInviteRecord | null>;
  acceptInvite(input: {
    inviteId: string;
    tokenDigest: string;
    userId: string;
    acceptedAt: string;
  }): Promise<ArtistVerificationRecord>;
  revokeInvite(input: {
    inviteId: string;
    reason: string;
    revokedAt: string;
  }): Promise<ArtistInviteRecord>;
  listApplications(
    statuses?: ArtistVerificationRecord["status"][],
  ): Promise<ArtistVerificationRecord[]>;
  listInvites(): Promise<ArtistInviteRecord[]>;
};

export type ArtistVerificationDependencies = {
  repository: ArtistVerificationRepository;
  botVerifier: {
    verify(token: string): Promise<boolean>;
  };
  rateLimiter: {
    consume(input: {
      userId: string;
      action: "artist-application";
      limit: number;
      windowSeconds: number;
      now: Date;
    }): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  };
  ids?: {
    application(): string;
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

function applicationId(dependencies: ArtistVerificationDependencies) {
  return dependencies.ids?.application() ?? crypto.randomUUID();
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
    async findApplicationByIdempotency(userId, key) {
      const { data, error } = await client
        .from("artist_verifications")
        .select("*")
        .eq("user_id", userId)
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) throw error;
      return data ? applicationFromRow(data) : null;
    },
    async findApplicationByUser(userId) {
      const { data, error } = await client
        .from("artist_verifications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ? applicationFromRow(data) : null;
    },
    async findApplicationByProofUrl(proofUrlNormalized) {
      const { data, error } = await client
        .from("artist_verifications")
        .select("*")
        .eq("proof_url_normalized", proofUrlNormalized)
        .maybeSingle();
      if (error) throw error;
      return data ? applicationFromRow(data) : null;
    },
    async createProvisionalApplication(application) {
      const { data, error } = await client
        .rpc("submit_artist_application", {
          p_id: application.id,
          p_activity_name: application.activityName,
          p_proof_url: application.proofUrl,
          p_proof_url_normalized: application.proofUrlNormalized,
          p_primary_field: application.primaryField,
          p_optional_public_url: application.optionalPublicUrl,
          p_applicant_note: application.applicantNote,
          p_idempotency_key: application.idempotencyKey,
          p_policy_version: application.policyVersion,
          p_submitted_at: application.submittedAt,
        })
        .maybeSingle();
      return requireRow(data, error, applicationFromRow);
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
      reviewedAt,
    }) {
      const { data, error } = await client
        .rpc("review_artist_application", {
          p_application_id: id,
          p_next_status: status,
          p_reason: reason,
          p_reviewed_at: reviewedAt,
        })
        .maybeSingle();
      return requireRow(data, error, applicationFromRow);
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
          p_expires_at: invite.expiresAt,
          p_created_at: invite.createdAt,
        })
        .maybeSingle();
      return requireRow(data, error, inviteFromRow);
    },
    async getInvite(id) {
      const { data, error } = await client
        .from("artist_invites")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? inviteFromRow(data) : null;
    },
    async findInviteByDigest(tokenDigest) {
      const { data, error } = await client
        .rpc("get_artist_invite_by_token", {
          p_token_digest: tokenDigest,
        })
        .maybeSingle();
      if (error) throw error;
      return data ? inviteFromRow(data) : null;
    },
    async acceptInvite({ tokenDigest, acceptedAt }) {
      const { data, error } = await client
        .rpc("accept_artist_invite", {
          p_token_digest: tokenDigest,
          p_accepted_at: acceptedAt,
        })
        .maybeSingle();
      return requireRow(data, error, applicationFromRow);
    },
    async revokeInvite({ inviteId, reason, revokedAt }) {
      const { data, error } = await client
        .rpc("revoke_artist_invite", {
          p_invite_id: inviteId,
          p_reason: reason,
          p_revoked_at: revokedAt,
        })
        .maybeSingle();
      return requireRow(data, error, inviteFromRow);
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

export function createSupabaseArtistRateLimiter(client: SupabaseClient) {
  return {
    async consume(input: {
      userId: string;
      action: "artist-application";
      limit: number;
      windowSeconds: number;
      now: Date;
    }) {
      const { data, error } = await client
        .rpc("consume_artist_application_rate_limit", {
          p_now: input.now.toISOString(),
          p_window_seconds: input.windowSeconds,
          p_max_attempts: input.limit,
        })
        .maybeSingle();
      if (error) throw error;
      return {
        allowed: data?.allowed === true,
        retryAfterSeconds:
          typeof data?.retry_after_seconds === "number"
            ? data.retry_after_seconds
            : input.windowSeconds,
      };
    },
  };
}

export function createTurnstileBotVerifier({
  secretKey = process.env.TURNSTILE_SECRET_KEY,
  remoteIp,
  fetcher = fetch,
}: {
  secretKey?: string;
  remoteIp?: string;
  fetcher?: typeof fetch;
} = {}) {
  return {
    async verify(token: string) {
      if (!secretKey?.trim() || !token.trim()) return false;

      const body = new URLSearchParams({
        secret: secretKey,
        response: token,
      });
      if (remoteIp) body.set("remoteip", remoteIp);

      try {
        const response = await fetcher(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            body,
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );
        if (!response.ok) return false;
        const result = (await response.json()) as { success?: boolean };
        return result.success === true;
      } catch {
        return false;
      }
    },
  };
}

export function createSupabaseVerificationDependencies(
  client: SupabaseClient,
  { remoteIp }: { remoteIp?: string } = {},
): ArtistVerificationDependencies {
  return {
    repository: createSupabaseVerificationRepository(client),
    botVerifier: createTurnstileBotVerifier({ remoteIp }),
    rateLimiter: createSupabaseArtistRateLimiter(client),
  };
}

export async function submitArtistApplication(
  command: {
    actor: CommunityActor;
    userId: string;
    input: ApplicationInput;
    botToken: string;
    idempotencyKey: string;
    now: Date;
  },
  dependencies: ArtistVerificationDependencies,
): Promise<VerificationResult> {
  if (!isActiveMember(command.actor, command.userId)) {
    return { ok: false, code: "forbidden", message: "로그인이 필요합니다." };
  }

  const idempotencyKey = cleanText(command.idempotencyKey, 120);
  if (!idempotencyKey) {
    return { ok: false, code: "invalid-input", message: "요청 식별값이 올바르지 않습니다." };
  }

  const existing = await dependencies.repository.findApplicationByIdempotency(
    command.userId,
    idempotencyKey,
  );
  if (existing) {
    return { ok: true, code: "existing", application: existing };
  }

  const input = validateApplicationInput(command.input);
  if (!input) {
    return { ok: false, code: "invalid-input", message: "신청 내용을 다시 확인해 주세요." };
  }

  if (!(await dependencies.botVerifier.verify(command.botToken))) {
    return {
      ok: false,
      code: "bot-verification-failed",
      message: "자동 제출 방지 확인에 실패했습니다.",
    };
  }

  const rate = await dependencies.rateLimiter.consume({
    userId: command.userId,
    action: "artist-application",
    limit: 1,
    windowSeconds: 24 * 60 * 60,
    now: command.now,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      code: "rate-limited",
      message: "신청 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  }

  if (await dependencies.repository.findApplicationByUser(command.userId)) {
    return {
      ok: false,
      code: "already-applied",
      message: "이미 처리 중이거나 완료된 작가 신청이 있습니다.",
    };
  }

  if (
    await dependencies.repository.findApplicationByProofUrl(
      input.proofUrlNormalized,
    )
  ) {
    return {
      ok: false,
      code: "duplicate-proof",
      message: "이미 다른 신청에 사용된 공개 활동 주소입니다.",
    };
  }

  const submittedAt = command.now.toISOString();
  const application: ArtistVerificationRecord = {
    id: applicationId(dependencies),
    userId: command.userId,
    status: "provisional",
    ...input,
    idempotencyKey,
    submittedAt,
    reviewedAt: null,
    reviewedBy: null,
    reviewReason: null,
  };
  const created = await dependencies.repository.createProvisionalApplication(
    application,
  );

  return { ok: true, code: "created", application: created };
}

export async function reviewArtistApplication(
  command: {
    actor: CommunityActor;
    reviewerId: string;
    applicationId: string;
    nextStatus: ArtistVerificationRecord["status"];
    reason: string;
    now: Date;
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
    reviewedBy: command.reviewerId,
    reason,
    reviewedAt: command.now.toISOString(),
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
  const createdAt = command.now.toISOString();
  const expiresAt = new Date(
    command.now.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const invite: ArtistInviteRecord = {
    id: inviteId(dependencies),
    email,
    tokenDigest,
    state: "pending",
    issuedBy: command.issuerId,
    acceptedBy: null,
    activityName: input.activityName,
    proofUrl: input.proofUrl,
    proofUrlNormalized: input.proofUrlNormalized,
    primaryField: input.primaryField,
    reason,
    policyVersion: input.policyVersion,
    expiresAt,
    acceptedAt: null,
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
    createdAt,
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
    now: Date;
  },
  dependencies: ArtistVerificationDependencies,
): Promise<VerificationResult> {
  if (!isActiveMember(command.actor, command.userId)) {
    return { ok: false, code: "forbidden", message: "로그인이 필요합니다." };
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
  if (new Date(invite.expiresAt).getTime() <= command.now.getTime()) {
    return { ok: false, code: "invite-expired", message: "초대가 만료됐습니다." };
  }
  if (invite.email !== command.email.trim().toLowerCase()) {
    return { ok: false, code: "invite-recipient-mismatch", message: "초대 대상 계정이 아닙니다." };
  }

  const application = await dependencies.repository.acceptInvite({
    inviteId: invite.id,
    tokenDigest: invite.tokenDigest,
    userId: command.userId,
    acceptedAt: command.now.toISOString(),
  });
  return { ok: true, code: "accepted", application };
}

export async function revokeArtistInvite(
  command: {
    actor: CommunityActor;
    inviteId: string;
    reason: string;
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
    revokedAt: command.now.toISOString(),
  });
  return { ok: true, code: "revoked", invite: revoked };
}
