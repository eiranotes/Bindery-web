import assert from "node:assert/strict";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  acceptArtistInvite,
  createSupabaseArtistApplicationSubmitter,
  createSupabaseVerificationRepository,
  issueArtistInvite,
  normalizePublicProofUrl,
  revokeArtistInvite,
  reviewArtistApplication,
  type ArtistInviteRecord,
  type ArtistInviteDraft,
  type ArtistVerificationDependencies,
  type ArtistVerificationRecord,
  type ArtistVerificationRepository,
} from "../app/lib/server/community/verification.ts";

const member: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "member",
  artistStatus: "none",
};

const admin: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "admin",
  artistStatus: "none",
};

class MemoryVerificationRepository implements ArtistVerificationRepository {
  applications: ArtistVerificationRecord[] = [];
  invites: ArtistInviteRecord[] = [];
  private databaseNow: string;

  constructor(databaseNow = "2026-07-28T01:00:00.000Z") {
    this.databaseNow = databaseNow;
  }

  setDatabaseNow(databaseNow: string) {
    this.databaseNow = databaseNow;
  }

  async findApplicationByProofUrl(proofUrlNormalized: string) {
    return (
      this.applications.find(
        (application) =>
          application.proofUrlNormalized === proofUrlNormalized,
      ) ?? null
    );
  }

  async getApplication(id: string) {
    return this.applications.find((application) => application.id === id) ?? null;
  }

  async updateApplicationStatus({
    id,
    status,
    reason,
  }: {
    id: string;
    status: ArtistVerificationRecord["status"];
    reason: string;
  }) {
    const application = await this.getApplication(id);
    if (!application) throw new Error("application not found");
    application.status = status;
    application.reviewedBy = "admin-1";
    application.reviewReason = reason;
    application.reviewedAt = this.databaseNow;
    return application;
  }

  async createInvite(invite: ArtistInviteDraft) {
    const createdAt = this.databaseNow;
    const created: ArtistInviteRecord = {
      ...invite,
      state: "pending",
      issuedBy: "admin-1",
      acceptedBy: null,
      expiresAt: new Date(
        new Date(createdAt).getTime() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      acceptedAt: null,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
      createdAt,
    };
    this.invites.push(created);
    return created;
  }

  async getInvite(id: string) {
    return this.invites.find((invite) => invite.id === id) ?? null;
  }

  async findInviteByDigest(tokenDigest: string) {
    return this.invites.find((invite) => invite.tokenDigest === tokenDigest) ?? null;
  }

  async acceptInvite({
    tokenDigest,
    policyConsent,
    policyVersion,
  }: {
    tokenDigest: string;
    policyConsent: boolean;
    policyVersion: string;
  }) {
    const invite = this.invites.find(
      (candidate) => candidate.tokenDigest === tokenDigest,
    );
    if (!invite) throw new Error("invite not found");
    if (!policyConsent) return { ok: false as const, code: "consent-required" };
    if (policyVersion !== "community-2026-07") {
      return { ok: false as const, code: "policy-version-stale" };
    }
    if (
      new Date(invite.expiresAt).getTime() <=
      new Date(this.databaseNow).getTime()
    ) {
      invite.state = "expired";
      return { ok: false as const, code: "invite-expired" };
    }
    invite.state = "accepted";
    invite.acceptedBy = "member-3";
    invite.acceptedAt = this.databaseNow;

    const application: ArtistVerificationRecord = {
      id: "application-member-3",
      userId: "member-3",
      status: "verified",
      activityName: invite.activityName,
      proofUrl: invite.proofUrl,
      proofUrlNormalized: invite.proofUrlNormalized,
      primaryField: invite.primaryField,
      optionalPublicUrl: null,
      applicantNote: null,
      idempotencyKey: `invite:${invite.id}`,
      policyVersion: invite.policyVersion,
      submittedAt: this.databaseNow,
      reviewedAt: this.databaseNow,
      reviewedBy: invite.issuedBy,
      reviewReason: invite.reason,
    };
    this.applications.push(application);
    return { ok: true as const, code: "accepted" as const, application };
  }

  async revokeInvite({
    inviteId,
    reason,
  }: {
    inviteId: string;
    reason: string;
  }) {
    const invite = await this.getInvite(inviteId);
    if (!invite) throw new Error("invite not found");
    invite.state = "revoked";
    invite.revokedAt = this.databaseNow;
    invite.revokedBy = "admin-1";
    invite.revocationReason = reason;
    return invite;
  }

  async listApplications() {
    return this.applications;
  }

  async listInvites() {
    return this.invites;
  }
}

function dependencies(
  repository = new MemoryVerificationRepository(),
): ArtistVerificationDependencies & {
  repository: MemoryVerificationRepository;
} {
  return {
    repository,
    ids: {
      invite: () => "invite-1",
    },
    tokens: {
      create: () => "raw-invite-token",
      digest: async (token) => `digest:${token}`,
    },
  };
}

const validApplication = {
  activityName: "종이산책",
  proofUrl: "HTTPS://Example.com/artist/?utm_source=test#works",
  primaryField: "문구·일러스트",
  optionalPublicUrl: "https://shop.example.com/paper/",
  applicantNote: "행사 참여를 준비하고 있습니다.",
  policyVersion: "community-2026-07",
};

test("normalizes public proof URLs and rejects unsafe or non-public values", () => {
  assert.equal(
    normalizePublicProofUrl("HTTPS://Example.com/artist/?utm_source=test#works"),
    "https://example.com/artist",
  );
  assert.equal(normalizePublicProofUrl("http://127.0.0.1/profile"), null);
  assert.equal(normalizePublicProofUrl("https://user:pass@example.com"), null);
  assert.equal(normalizePublicProofUrl("javascript:alert(1)"), null);
});

test("forwards explicit consent and one Turnstile token to the Edge Function", async () => {
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  const client = {
    functions: {
      async invoke(name: string, options: { body: Record<string, unknown> }) {
        calls.push({ name, body: options.body });
        return {
          data: { ok: true, code: "created", application: { id: "application-1" } },
          error: null,
        };
      },
    },
  };

  const result = await createSupabaseArtistApplicationSubmitter(
    client as never,
  ).submit({
    activityName: "종이산책",
    proofUrl: "https://example.com/artist",
    primaryField: "문구",
    optionalPublicUrl: null,
    applicantNote: null,
    botToken: "single-use-turnstile-token",
    idempotencyKey: "request-1",
    policyConsent: true,
    policyVersion: "community-2026-07",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    {
      name: "submit-artist-application",
      body: {
        activityName: "종이산책",
        proofUrl: "https://example.com/artist",
        primaryField: "문구",
        optionalPublicUrl: null,
        applicantNote: null,
        botToken: "single-use-turnstile-token",
        idempotencyKey: "request-1",
        policyConsent: true,
        policyVersion: "community-2026-07",
      },
    },
  ]);
});

test("omits caller-controlled timestamps when issuing an invitation RPC", async () => {
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  const row = {
    id: "invite-1",
    invited_email: "artist@example.com",
    token_digest: "digest:token",
    state: "pending",
    issued_by: "admin-1",
    accepted_by: null,
    activity_name: "초대작가",
    proof_url: "https://example.com/artist",
    proof_url_normalized: "https://example.com/artist",
    primary_field: "문구",
    reason: "활동 확인",
    policy_version: "community-2026-07",
    expires_at: "2026-08-04T01:00:00.000Z",
    accepted_at: null,
    revoked_at: null,
    revoked_by: null,
    revocation_reason: null,
    created_at: "2026-07-28T01:00:00.000Z",
  };
  const client = {
    rpc(name: string, body: Record<string, unknown>) {
      calls.push({ name, body });
      return {
        async maybeSingle() {
          return { data: row, error: null };
        },
      };
    },
  };

  await createSupabaseVerificationRepository(client as never).createInvite({
    id: "invite-1",
    email: "artist@example.com",
    tokenDigest: "digest:token",
    activityName: "초대작가",
    proofUrl: "https://example.com/artist",
    proofUrlNormalized: "https://example.com/artist",
    primaryField: "문구",
    reason: "활동 확인",
    policyVersion: "community-2026-07",
  });

  assert.deepEqual(calls, [{
    name: "issue_artist_invite",
    body: {
      p_id: "invite-1",
      p_invited_email: "artist@example.com",
      p_token_digest: "digest:token",
      p_activity_name: "초대작가",
      p_proof_url: "https://example.com/artist",
      p_proof_url_normalized: "https://example.com/artist",
      p_primary_field: "문구",
      p_reason: "활동 확인",
      p_policy_version: "community-2026-07",
    },
  }]);
});

test("uses timestamp-free review and revocation RPCs and forwards invite consent", async () => {
  const calls: Array<{ name: string; body: Record<string, unknown> }> = [];
  const applicationRow = {
    id: "application-1",
    user_id: "member-1",
    status: "verified",
    activity_name: "검수 작가",
    proof_url: "https://example.com/reviewed",
    proof_url_normalized: "https://example.com/reviewed",
    primary_field: "문구",
    optional_public_url: null,
    applicant_note: null,
    idempotency_key: "request-1",
    policy_version: "community-2026-07",
    submitted_at: "2026-07-28T01:00:00.000Z",
    reviewed_at: "2026-07-28T02:00:00.000Z",
    reviewed_by: "admin-1",
    review_reason: "활동 확인",
  };
  const inviteRow = {
    id: "invite-1",
    invited_email: "artist@example.com",
    token_digest: "digest:token",
    state: "revoked",
    issued_by: "admin-1",
    accepted_by: null,
    activity_name: "초대작가",
    proof_url: "https://example.com/invited",
    proof_url_normalized: "https://example.com/invited",
    primary_field: "문구",
    reason: "활동 확인",
    policy_version: "community-2026-07",
    expires_at: "2026-08-04T01:00:00.000Z",
    accepted_at: null,
    revoked_at: "2026-07-28T02:00:00.000Z",
    revoked_by: "admin-1",
    revocation_reason: "이메일 변경",
    created_at: "2026-07-28T01:00:00.000Z",
  };
  const client = {
    rpc(name: string, body: Record<string, unknown>) {
      calls.push({ name, body });
      if (name === "accept_artist_invite") {
        return { data: { ok: false, code: "consent-required" }, error: null };
      }
      return {
        async maybeSingle() {
          return {
            data: name === "review_artist_application" ? applicationRow : inviteRow,
            error: null,
          };
        },
      };
    },
  };
  const repository = createSupabaseVerificationRepository(client as never);

  await repository.updateApplicationStatus({
    id: "application-1",
    status: "verified",
    reason: "활동 확인",
  });
  await repository.revokeInvite({
    inviteId: "invite-1",
    reason: "이메일 변경",
  });
  await repository.acceptInvite({
    tokenDigest: "digest:token",
    policyConsent: true,
    policyVersion: "community-2026-07",
  });

  assert.deepEqual(calls, [
    {
      name: "review_artist_application",
      body: {
        p_application_id: "application-1",
        p_next_status: "verified",
        p_reason: "활동 확인",
      },
    },
    {
      name: "revoke_artist_invite",
      body: { p_invite_id: "invite-1", p_reason: "이메일 변경" },
    },
    {
      name: "accept_artist_invite",
      body: {
        p_token_digest: "digest:token",
        p_policy_consent: true,
        p_policy_version: "community-2026-07",
      },
    },
  ]);
});

test("reserves review, rejection, suspension, and revocation for active admins", async () => {
  const deps = dependencies();
  const created: ArtistVerificationRecord = {
    id: "application-1",
    userId: "member-1",
    status: "provisional",
    activityName: validApplication.activityName,
    proofUrl: validApplication.proofUrl,
    proofUrlNormalized: "https://example.com/artist",
    primaryField: validApplication.primaryField,
    optionalPublicUrl: validApplication.optionalPublicUrl,
    applicantNote: validApplication.applicantNote,
    idempotencyKey: "request-1",
    policyVersion: validApplication.policyVersion,
    submittedAt: "2026-07-28T01:00:00.000Z",
    reviewedAt: null,
    reviewedBy: null,
    reviewReason: null,
  };
  deps.repository.applications.push(created);

  const denied = await reviewArtistApplication(
    {
      actor: member,
      applicationId: created.id,
      nextStatus: "verified",
      reason: "권한 없는 검수",
    },
    deps,
  );
  assert.equal(denied.code, "forbidden");

  const verified = await reviewArtistApplication(
    {
      actor: admin,
      applicationId: created.id,
      nextStatus: "verified",
      reason: "공개 활동 채널 확인",
    },
    deps,
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.application?.status, "verified");

  const revoked = await reviewArtistApplication(
    {
      actor: admin,
      applicationId: created.id,
      nextStatus: "revoked",
      reason: "활동 채널 소유 확인 불가",
    },
    deps,
  );
  assert.equal(revoked.application?.status, "revoked");
});

test("issues single-use admin invitations and rejects expired acceptance", async () => {
  const deps = dependencies();
  const issued = await issueArtistInvite(
    {
      actor: admin,
      issuerId: "admin-1",
      input: {
        email: "artist@example.com",
        activityName: "초대작가",
        proofUrl: "https://example.com/invited-artist",
        primaryField: "문구",
        reason: "오프라인 행사 활동 확인",
        policyVersion: "community-2026-07",
      },
      now: new Date("2026-07-28T10:00:00+09:00"),
    },
    deps,
  );
  assert.equal(issued.ok, true);
  assert.equal(issued.rawToken, "raw-invite-token");
  assert.equal(issued.invite?.state, "pending");
  assert.equal(issued.invite?.createdAt, "2026-07-28T01:00:00.000Z");
  assert.equal(issued.invite?.expiresAt, "2026-08-04T01:00:00.000Z");

  const accepted = await acceptArtistInvite(
    {
      actor: member,
      userId: "member-3",
      email: "artist@example.com",
      rawToken: "raw-invite-token",
      policyConsent: true,
      policyVersion: "community-2026-07",
    },
    deps,
  );
  assert.equal(accepted.ok, true);
  assert.equal(accepted.application?.status, "verified");

  const expiredDeps = dependencies(
    new MemoryVerificationRepository("2026-07-01T01:00:00.000Z"),
  );
  const expiredIssue = await issueArtistInvite(
    {
      actor: admin,
      issuerId: "admin-1",
      input: {
        email: "late@example.com",
        activityName: "만료작가",
        proofUrl: "https://example.com/late-artist",
        primaryField: "일러스트",
        reason: "테스트 초대",
        policyVersion: "community-2026-07",
      },
      now: new Date("2026-07-01T10:00:00+09:00"),
    },
    expiredDeps,
  );
  assert.equal(expiredIssue.ok, true);
  expiredDeps.repository.setDatabaseNow("2026-07-28T01:00:00.000Z");

  const expired = await acceptArtistInvite(
    {
      actor: member,
      userId: "member-4",
      email: "late@example.com",
      rawToken: "raw-invite-token",
      policyConsent: true,
      policyVersion: "community-2026-07",
    },
    expiredDeps,
  );
  assert.equal(expired.code, "invite-expired");
});

test("lets only admins revoke a pending invitation with a reason", async () => {
  const deps = dependencies();
  const now = new Date("2026-07-28T10:00:00+09:00");
  const issued = await issueArtistInvite(
    {
      actor: admin,
      issuerId: "admin-1",
      input: {
        email: "invited@example.com",
        activityName: "초대작가",
        proofUrl: "https://example.com/revocable-artist",
        primaryField: "문구",
        reason: "활동 확인",
        policyVersion: "community-2026-07",
      },
      now,
    },
    deps,
  );

  const denied = await revokeArtistInvite(
    {
      actor: member,
      inviteId: issued.invite!.id,
      reason: "회원의 임의 취소",
    },
    deps,
  );
  assert.equal(denied.code, "forbidden");

  const revoked = await revokeArtistInvite(
    {
      actor: admin,
      inviteId: issued.invite!.id,
      reason: "대상 이메일 변경 요청",
    },
    deps,
  );
  assert.equal(revoked.ok, true);
  assert.equal(revoked.invite?.state, "revoked");
  assert.equal(revoked.invite?.revocationReason, "대상 이메일 변경 요청");

  const repeated = await revokeArtistInvite(
    {
      actor: admin,
      inviteId: issued.invite!.id,
      reason: "다시 취소",
    },
    deps,
  );
  assert.equal(repeated.code, "invite-used");
});

test("requires explicit current-policy consent before accepting an invitation", async () => {
  const deps = dependencies();
  const issued = await issueArtistInvite(
    {
      actor: admin,
      issuerId: "admin-1",
      input: {
        email: "consent@example.com",
        activityName: "동의 확인 작가",
        proofUrl: "https://example.com/consent-artist",
        primaryField: "문구",
        reason: "활동 확인",
        policyVersion: "community-2026-07",
      },
      now: new Date("2026-07-28T10:00:00+09:00"),
    },
    deps,
  );

  for (const [policyConsent, policyVersion, code] of [
    [false, "community-2026-07", "consent-required"],
    [true, "community-2026-06", "policy-version-stale"],
  ] as const) {
    const result = await acceptArtistInvite(
      {
        actor: member,
        userId: "member-consent",
        email: "consent@example.com",
        rawToken: "raw-invite-token",
        policyConsent,
        policyVersion,
      },
      deps,
    );
    assert.equal(result.code, code);
    assert.equal(deps.repository.applications.length, 0);
    assert.equal(issued.invite?.state, "pending");
  }
});
