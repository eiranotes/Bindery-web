import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  isCommunityAppealExpired,
  getCommunityAppealContext,
  moderateCommunityReport,
  submitCommunityAppeal,
  type CommunityAppealContext,
  type CommunityModerationRepository,
  type ModerationReport,
} from "../app/lib/server/community/moderation.ts";

const member: CommunityActor = { authenticated: true, accountStatus: "active", role: "member", artistStatus: "none" };
const moderator: CommunityActor = { ...member, role: "moderator" };
const admin: CommunityActor = { ...member, role: "admin" };

class MemoryModerationRepository implements CommunityModerationRepository {
  report: ModerationReport = {
    id: "report-1",
    reporterId: "member-2",
    postId: "post-1",
    postAuthorId: "member-1",
    postTitle: "검토할 게시글",
    postState: "published",
    reasonCode: "misinformation",
    details: "출처 확인 필요",
    state: "open",
    createdAt: new Date().toISOString(),
  };
  actions: string[] = [];
  appealContext: CommunityAppealContext = {
    reportId: "report-1",
    postId: "post-1",
    postTitle: "검토할 게시글",
    affectedUserId: "member-1",
    reportState: "actioned",
    action: "suspend_account",
    actionAt: "2026-07-28T00:00:00.000Z",
    deadlineAt: "2026-08-11T00:00:00.000Z",
    appealedAt: null,
    appealReason: null,
  };

  async getReport(id: string) {
    return id === this.report.id ? this.report : null;
  }

  async applyAction(input: { action: string; reason: string }) {
    this.actions.push(`${input.action}:${input.reason}`);
    if (input.action === "triage") this.report.state = "triaged";
    if (["hide", "lock", "suspend_account"].includes(input.action)) this.report.state = "actioned";
    if (input.action === "dismiss") this.report.state = "dismissed";
    if (["restore", "resolve_appeal", "reject_appeal"].includes(input.action)) this.report.state = "closed";
    if (input.action === "hide") this.report.postState = "hidden";
    if (input.action === "lock") this.report.postState = "locked";
    if (["restore", "resolve_appeal"].includes(input.action)) this.report.postState = "published";
    return this.report;
  }

  async getAppealContext(id: string) {
    return id === this.report.id ? this.appealContext : null;
  }

  async submitAppeal(input: { reportId: string; reason: string }) {
    this.report.state = "appealed";
    this.appealContext.reportState = "appealed";
    this.appealContext.appealReason = input.reason;
    this.appealContext.appealedAt = "2026-07-29T00:00:00.000Z";
    return this.appealContext;
  }
}

test("denies members and requires a reason", async () => {
  const repository = new MemoryModerationRepository();
  const denied = await moderateCommunityReport(
    { actor: member, actorId: "member-1", reportId: "report-1", action: "triage", reason: "확인", now: new Date() },
    { repository },
  );
  assert.equal(denied.code, "forbidden");
  const invalid = await moderateCommunityReport(
    { actor: moderator, actorId: "mod-1", reportId: "report-1", action: "triage", reason: "", now: new Date() },
    { repository },
  );
  assert.equal(invalid.code, "invalid-input");
});

test("moderators triage and hide while appending separate actions", async () => {
  const repository = new MemoryModerationRepository();
  assert.equal((await moderateCommunityReport(
    { actor: moderator, actorId: "mod-1", reportId: "report-1", action: "triage", reason: "출처 확인 시작", now: new Date() },
    { repository },
  )).report?.state, "triaged");
  assert.equal((await moderateCommunityReport(
    { actor: moderator, actorId: "mod-1", reportId: "report-1", action: "hide", reason: "확인 전 임시 숨김", now: new Date() },
    { repository },
  )).report?.postState, "hidden");
  assert.deepEqual(repository.actions, ["triage:출처 확인 시작", "hide:확인 전 임시 숨김"]);
});

test("reserves account suspension and appeal decisions for admins", async () => {
  const repository = new MemoryModerationRepository();
  const denied = await moderateCommunityReport(
    { actor: moderator, actorId: "mod-1", reportId: "report-1", action: "suspend_account", reason: "반복 위반", now: new Date() },
    { repository },
  );
  assert.equal(denied.code, "admin-required");
  const suspended = await moderateCommunityReport(
    { actor: admin, actorId: "admin-1", reportId: "report-1", action: "suspend_account", reason: "반복 위반 확인", now: new Date() },
    { repository },
  );
  assert.equal(suspended.report?.state, "actioned");

  const deniedAppeal = await submitCommunityAppeal(
    {
      actor: member,
      userId: "member-2",
      reportId: "report-1",
      reason: "신고자에게는 이의제기 권한이 없어야 합니다.",
      now: new Date("2026-07-29T00:00:00.000Z"),
    },
    { repository },
  );
  assert.equal(deniedAppeal.code, "forbidden");

  const appealed = await submitCommunityAppeal(
    {
      actor: { ...member, accountStatus: "suspended" },
      userId: "member-1",
      reportId: "report-1",
      reason: "위반으로 판단한 근거를 다시 검토해 주세요.",
      now: new Date("2026-07-29T00:00:00.000Z"),
    },
    { repository },
  );
  assert.equal(appealed.code, "appealed");
  assert.equal(repository.report.state, "appealed");

  repository.report.postState = "hidden";
  const resolved = await moderateCommunityReport(
    { actor: admin, actorId: "admin-1", reportId: "report-1", action: "resolve_appeal", reason: "이의 인용 및 복구", now: new Date() },
    { repository },
  );
  assert.equal(resolved.report?.state, "closed");
  assert.equal(resolved.report?.postState, "published");

  repository.report.state = "appealed";
  repository.report.postState = "hidden";
  const rejected = await moderateCommunityReport(
    { actor: admin, actorId: "admin-1", reportId: "report-1", action: "reject_appeal", reason: "원 조치 유지", now: new Date() },
    { repository },
  );
  assert.equal(rejected.report?.state, "closed");
  assert.equal(rejected.report?.postState, "hidden");
  assert.equal(repository.actions.at(-1), "reject_appeal:원 조치 유지");
});

test("exposes an affected member appeal context and enforces the fourteen-day deadline", async () => {
  const repository = new MemoryModerationRepository();
  const context = await getCommunityAppealContext(
    { actor: member, userId: "member-1", reportId: "report-1" },
    { repository },
  );
  assert.equal(context.ok, true);
  assert.equal(context.appeal?.deadlineAt, "2026-08-11T00:00:00.000Z");

  const late = await submitCommunityAppeal(
    {
      actor: member,
      userId: "member-1",
      reportId: "report-1",
      reason: "기한이 지난 이의제기",
      now: new Date("2026-08-12T00:00:00.000Z"),
    },
    { repository },
  );
  assert.equal(late.code, "deadline-expired");
  assert.equal(repository.report.state, "open");
});

test("wires admin-only appeal rejection through the form and route allow-list", async () => {
  const [form, route] = await Promise.all([
    readFile(new URL("../app/components/AdminModerationForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/community/reports/[id]/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(form, /isAdmin\s*\?\s*<option value="reject_appeal"/);
  assert.match(route, /"reject_appeal"/);
});

test("marks an appeal expired only after its database deadline", () => {
  const deadline = "2026-08-11T00:00:00.000Z";
  assert.equal(
    isCommunityAppealExpired(deadline, new Date("2026-08-10T23:59:59.000Z")),
    false,
  );
  assert.equal(
    isCommunityAppealExpired(deadline, new Date("2026-08-11T00:00:01.000Z")),
    true,
  );
});
