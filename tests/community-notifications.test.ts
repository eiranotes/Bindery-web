import assert from "node:assert/strict";
import test from "node:test";

import type { CommunityActor } from "../app/lib/community-access.ts";
import {
  createCommunityNotification,
  listCommunityNotifications,
  markCommunityNotificationRead,
  type CommunityNotification,
  type CommunityNotificationReader,
  type CommunityNotificationWriter,
} from "../app/lib/server/community/notifications.ts";

const member: CommunityActor = {
  authenticated: true,
  accountStatus: "active",
  role: "member",
  artistStatus: "none",
};

class MemoryNotificationStore {
  rows: CommunityNotification[] = [];

  forRecipient(recipientId: string): CommunityNotificationReader {
    return {
      list: async (limit) => this.rows
        .filter((row) => row.recipientId === recipientId)
        .slice(0, limit),
      markRead: async (id, readAt) => {
        const row = this.rows.find(
          (candidate) => candidate.id === id && candidate.recipientId === recipientId,
        );
        if (!row) return null;
        row.readAt ??= readAt;
        return row;
      },
    };
  }

  writer(): CommunityNotificationWriter {
    return {
      create: async (input) => {
        const existing = this.rows.find(
          (row) => row.recipientId === input.recipientId
            && row.deduplicationKey === input.deduplicationKey,
        );
        if (existing) return { notification: existing, created: false };
        const notification: CommunityNotification = {
          id: `notification-${this.rows.length + 1}`,
          ...input,
          readAt: null,
        };
        this.rows.push(notification);
        return { notification, created: true };
      },
    };
  }
}

test("retries for one reply create one recipient notification", async () => {
  const store = new MemoryNotificationStore();
  const command = {
    recipientId: "author-1",
    kind: "reply" as const,
    actorId: "member-2",
    targetType: "post",
    targetId: "post-1",
    eventId: "comment-1",
    payload: { commentId: "comment-1" },
    now: new Date("2026-07-28T12:00:00Z"),
  };

  const first = await createCommunityNotification(command, { repository: store.writer() });
  const retried = await createCommunityNotification(command, { repository: store.writer() });

  assert.equal(first.code, "created");
  assert.equal(retried.code, "existing");
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0]?.deduplicationKey, "reply:comment-1");
});

test("supports every required durable community event kind", async () => {
  const store = new MemoryNotificationStore();
  const events = [
    ["answer_accepted", "comment-accepted"],
    ["verification_decision", "verification-1:verified"],
    ["moderation_outcome", "action-1"],
    ["appeal_outcome", "action-2"],
  ] as const;

  for (const [kind, eventId] of events) {
    const result = await createCommunityNotification({
      recipientId: "artist-1",
      kind,
      actorId: "admin-1",
      targetType: "artist_verification",
      targetId: "verification-1",
      eventId,
      payload: {},
      now: new Date("2026-07-28T12:00:00Z"),
    }, { repository: store.writer() });
    assert.equal(result.ok, true);
  }

  assert.deepEqual(store.rows.map((row) => row.kind), events.map(([kind]) => kind));
});

test("a reader sees only its bound recipient rows", async () => {
  const store = new MemoryNotificationStore();
  await createCommunityNotification({
    recipientId: "member-1",
    kind: "reply",
    actorId: "member-2",
    targetType: "post",
    targetId: "post-1",
    eventId: "comment-1",
    payload: {},
    now: new Date("2026-07-28T12:00:00Z"),
  }, { repository: store.writer() });
  await createCommunityNotification({
    recipientId: "member-2",
    kind: "verification_decision",
    actorId: "admin-1",
    targetType: "artist_verification",
    targetId: "verification-2",
    eventId: "verification-2:rejected",
    payload: {},
    now: new Date("2026-07-28T12:01:00Z"),
  }, { repository: store.writer() });

  const memberOne = await listCommunityNotifications(
    { actor: member, limit: 20 },
    { repository: store.forRecipient("member-1") },
  );
  const otherMember = await listCommunityNotifications(
    { actor: member, limit: 20 },
    { repository: store.forRecipient("member-3") },
  );

  assert.deepEqual(memberOne.notifications.map((row) => row.recipientId), ["member-1"]);
  assert.deepEqual(otherMember.notifications, []);
});

test("marking one item read neither exposes nor changes another item", async () => {
  const store = new MemoryNotificationStore();
  for (const eventId of ["comment-1", "comment-2"]) {
    await createCommunityNotification({
      recipientId: "member-1",
      kind: "reply",
      actorId: "member-2",
      targetType: "post",
      targetId: "post-1",
      eventId,
      payload: {},
      now: new Date("2026-07-28T12:00:00Z"),
    }, { repository: store.writer() });
  }

  const result = await markCommunityNotificationRead({
    actor: member,
    notificationId: "notification-1",
    now: new Date("2026-07-28T12:05:00Z"),
  }, { repository: store.forRecipient("member-1") });
  const denied = await markCommunityNotificationRead({
    actor: member,
    notificationId: "notification-2",
    now: new Date("2026-07-28T12:06:00Z"),
  }, { repository: store.forRecipient("member-2") });

  assert.equal(result.notification?.readAt, "2026-07-28T12:05:00.000Z");
  assert.equal(store.rows[1]?.readAt, null);
  assert.equal(denied.code, "not-found");
});
