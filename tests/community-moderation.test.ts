import assert from "node:assert/strict";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  moderateCommunityReport,
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

  async getReport(id: string) {
    return id === this.report.id ? this.report : null;
  }

  async applyAction(input: { action: string; reason: string }) {
    this.actions.push(`${input.action}:${input.reason}`);
    if (input.action === "triage") this.report.state = "triaged";
    if (["hide", "lock", "suspend_account"].includes(input.action)) this.report.state = "actioned";
    if (input.action === "dismiss") this.report.state = "dismissed";
    if (["restore", "resolve_appeal"].includes(input.action)) this.report.state = "closed";
    if (input.action === "hide") this.report.postState = "hidden";
    if (input.action === "lock") this.report.postState = "locked";
    if (["restore", "resolve_appeal"].includes(input.action)) this.report.postState = "published";
    return this.report;
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

  repository.report.state = "appealed";
  repository.report.postState = "hidden";
  const resolved = await moderateCommunityReport(
    { actor: admin, actorId: "admin-1", reportId: "report-1", action: "resolve_appeal", reason: "이의 인용 및 복구", now: new Date() },
    { repository },
  );
  assert.equal(resolved.report?.state, "closed");
  assert.equal(resolved.report?.postState, "published");
});
