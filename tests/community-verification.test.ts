import assert from "node:assert/strict";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  acceptArtistInvite,
  issueArtistInvite,
  normalizePublicProofUrl,
  revokeArtistInvite,
  reviewArtistApplication,
  submitArtistApplication,
  type ArtistInviteRecord,
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

  async findApplicationByIdempotency(userId: string, key: string) {
    return (
      this.applications.find(
        (application) =>
          application.userId === userId &&
          application.idempotencyKey === key,
      ) ?? null
    );
  }

  async findApplicationByUser(userId: string) {
    return (
      this.applications.find((application) => application.userId === userId) ??
      null
    );
  }

  async findApplicationByProofUrl(proofUrlNormalized: string) {
    return (
      this.applications.find(
        (application) =>
          application.proofUrlNormalized === proofUrlNormalized,
      ) ?? null
    );
  }

  async createProvisionalApplication(
    application: ArtistVerificationRecord,
  ) {
    this.applications.push(application);
    return application;
  }

  async getApplication(id: string) {
    return this.applications.find((application) => application.id === id) ?? null;
  }

  async updateApplicationStatus({
    id,
    status,
    reviewedBy,
    reason,
    reviewedAt,
  }: {
    id: string;
    status: ArtistVerificationRecord["status"];
    reviewedBy: string;
    reason: string;
    reviewedAt: string;
  }) {
    const application = await this.getApplication(id);
    if (!application) throw new Error("application not found");
    application.status = status;
    application.reviewedBy = reviewedBy;
    application.reviewReason = reason;
    application.reviewedAt = reviewedAt;
    return application;
  }

  async createInvite(invite: ArtistInviteRecord) {
    this.invites.push(invite);
    return invite;
  }

  async getInvite(id: string) {
    return this.invites.find((invite) => invite.id === id) ?? null;
  }

  async findInviteByDigest(tokenDigest: string) {
    return this.invites.find((invite) => invite.tokenDigest === tokenDigest) ?? null;
  }

  async acceptInvite({
    inviteId,
    userId,
    acceptedAt,
  }: {
    inviteId: string;
    tokenDigest: string;
    userId: string;
    acceptedAt: string;
  }) {
    const invite = this.invites.find((candidate) => candidate.id === inviteId);
    if (!invite) throw new Error("invite not found");
    invite.state = "accepted";
    invite.acceptedBy = userId;
    invite.acceptedAt = acceptedAt;

    const application: ArtistVerificationRecord = {
      id: `application-${userId}`,
      userId,
      status: "verified",
      activityName: invite.activityName,
      proofUrl: invite.proofUrl,
      proofUrlNormalized: invite.proofUrlNormalized,
      primaryField: invite.primaryField,
      optionalPublicUrl: null,
      applicantNote: null,
      idempotencyKey: `invite:${invite.id}`,
      policyVersion: invite.policyVersion,
      submittedAt: acceptedAt,
      reviewedAt: acceptedAt,
      reviewedBy: invite.issuedBy,
      reviewReason: invite.reason,
    };
    this.applications.push(application);
    return application;
  }

  async revokeInvite({
    inviteId,
    reason,
    revokedAt,
  }: {
    inviteId: string;
    reason: string;
    revokedAt: string;
  }) {
    const invite = await this.getInvite(inviteId);
    if (!invite) throw new Error("invite not found");
    invite.state = "revoked";
    invite.revokedAt = revokedAt;
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
  botCalls: { count: number };
  rateCalls: { count: number };
} {
  const botCalls = { count: 0 };
  const rateCalls = { count: 0 };

  return {
    repository,
    botCalls,
    rateCalls,
    botVerifier: {
      async verify(token) {
        botCalls.count += 1;
        return token === "valid-bot-token";
      },
    },
    rateLimiter: {
      async consume() {
        rateCalls.count += 1;
        return { allowed: true, retryAfterSeconds: 0 };
      },
    },
    ids: {
      application: () => "application-1",
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

test("creates an immediately provisional application and retries idempotently", async () => {
  const deps = dependencies();
  const command = {
    actor: member,
    userId: "member-1",
    input: validApplication,
    botToken: "valid-bot-token",
    idempotencyKey: "request-1",
    now: new Date("2026-07-28T10:00:00+09:00"),
  };

  const created = await submitArtistApplication(command, deps);
  assert.equal(created.ok, true);
  assert.equal(created.code, "created");
  assert.equal(created.application?.status, "provisional");
  assert.equal(
    created.application?.proofUrlNormalized,
    "https://example.com/artist",
  );

  const repeated = await submitArtistApplication(command, deps);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.code, "existing");
  assert.equal(repeated.application?.id, created.application?.id);
  assert.equal(deps.botCalls.count, 1);
  assert.equal(deps.rateCalls.count, 1);
});

test("rejects invalid bot tokens and rate-limit excess before storage", async () => {
  const invalidBot = dependencies();
  const botResult = await submitArtistApplication(
    {
      actor: member,
      userId: "member-1",
      input: validApplication,
      botToken: "expired-token",
      idempotencyKey: "request-1",
      now: new Date("2026-07-28T10:00:00+09:00"),
    },
    invalidBot,
  );
  assert.deepEqual(botResult, {
    ok: false,
    code: "bot-verification-failed",
    message: "자동 제출 방지 확인에 실패했습니다.",
  });
  assert.equal(invalidBot.repository.applications.length, 0);
  assert.equal(invalidBot.rateCalls.count, 0);

  const rateLimited = dependencies();
  rateLimited.rateLimiter.consume = async () => ({
    allowed: false,
    retryAfterSeconds: 3600,
  });
  const rateResult = await submitArtistApplication(
    {
      actor: member,
      userId: "member-1",
      input: validApplication,
      botToken: "valid-bot-token",
      idempotencyKey: "request-1",
      now: new Date("2026-07-28T10:00:00+09:00"),
    },
    rateLimited,
  );
  assert.equal(rateResult.ok, false);
  assert.equal(rateResult.code, "rate-limited");
  assert.equal(rateResult.retryAfterSeconds, 3600);
  assert.equal(rateLimited.repository.applications.length, 0);
});

test("rejects duplicate proof URLs and a second non-idempotent application", async () => {
  const deps = dependencies();
  await submitArtistApplication(
    {
      actor: member,
      userId: "member-1",
      input: validApplication,
      botToken: "valid-bot-token",
      idempotencyKey: "request-1",
      now: new Date("2026-07-28T10:00:00+09:00"),
    },
    deps,
  );

  const duplicateProof = await submitArtistApplication(
    {
      actor: member,
      userId: "member-2",
      input: { ...validApplication, activityName: "다른작가" },
      botToken: "valid-bot-token",
      idempotencyKey: "request-2",
      now: new Date("2026-07-28T11:00:00+09:00"),
    },
    deps,
  );
  assert.equal(duplicateProof.code, "duplicate-proof");

  const secondApplication = await submitArtistApplication(
    {
      actor: member,
      userId: "member-1",
      input: {
        ...validApplication,
        proofUrl: "https://example.com/artist-two",
      },
      botToken: "valid-bot-token",
      idempotencyKey: "request-3",
      now: new Date("2026-07-28T12:00:00+09:00"),
    },
    deps,
  );
  assert.equal(secondApplication.code, "already-applied");
});

test("reserves review, rejection, suspension, and revocation for active admins", async () => {
  const deps = dependencies();
  const created = await submitArtistApplication(
    {
      actor: member,
      userId: "member-1",
      input: validApplication,
      botToken: "valid-bot-token",
      idempotencyKey: "request-1",
      now: new Date("2026-07-28T10:00:00+09:00"),
    },
    deps,
  );

  const denied = await reviewArtistApplication(
    {
      actor: member,
      reviewerId: "member-2",
      applicationId: created.application!.id,
      nextStatus: "verified",
      reason: "권한 없는 검수",
      now: new Date("2026-07-28T12:00:00+09:00"),
    },
    deps,
  );
  assert.equal(denied.code, "forbidden");

  const verified = await reviewArtistApplication(
    {
      actor: admin,
      reviewerId: "admin-1",
      applicationId: created.application!.id,
      nextStatus: "verified",
      reason: "공개 활동 채널 확인",
      now: new Date("2026-07-28T12:10:00+09:00"),
    },
    deps,
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.application?.status, "verified");

  const revoked = await reviewArtistApplication(
    {
      actor: admin,
      reviewerId: "admin-1",
      applicationId: created.application!.id,
      nextStatus: "revoked",
      reason: "활동 채널 소유 확인 불가",
      now: new Date("2026-07-29T12:10:00+09:00"),
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

  const accepted = await acceptArtistInvite(
    {
      actor: member,
      userId: "member-3",
      email: "artist@example.com",
      rawToken: "raw-invite-token",
      now: new Date("2026-07-29T10:00:00+09:00"),
    },
    deps,
  );
  assert.equal(accepted.ok, true);
  assert.equal(accepted.application?.status, "verified");

  const expiredDeps = dependencies();
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

  const expired = await acceptArtistInvite(
    {
      actor: member,
      userId: "member-4",
      email: "late@example.com",
      rawToken: "raw-invite-token",
      now: new Date("2026-07-28T10:00:00+09:00"),
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
      now,
    },
    deps,
  );
  assert.equal(denied.code, "forbidden");

  const revoked = await revokeArtistInvite(
    {
      actor: admin,
      inviteId: issued.invite!.id,
      reason: "대상 이메일 변경 요청",
      now,
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
      now,
    },
    deps,
  );
  assert.equal(repeated.code, "invite-used");
});
