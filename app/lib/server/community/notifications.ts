import type { SupabaseClient } from "@supabase/supabase-js";

import type { CommunityActor } from "../../community-access.ts";

export type CommunityNotificationKind =
  | "reply"
  | "answer_accepted"
  | "verification_decision"
  | "moderation_outcome"
  | "appeal_outcome";

export type CommunityNotification = {
  id: string;
  recipientId: string;
  kind: CommunityNotificationKind;
  actorId: string | null;
  targetType: string;
  targetId: string | null;
  deduplicationKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

type CreateNotificationInput = Omit<CommunityNotification, "id" | "readAt">;

export type CommunityNotificationWriter = {
  create(input: CreateNotificationInput): Promise<{
    notification: CommunityNotification;
    created: boolean;
  }>;
};

export type CommunityNotificationReader = {
  list(limit: number): Promise<CommunityNotification[]>;
  markRead(id: string, readAt: string): Promise<CommunityNotification | null>;
};

function isAuthenticatedRecipient(actor: CommunityActor) {
  return actor.authenticated;
}

function cleanIdentifier(value: string, maximum = 240) {
  const cleaned = value.trim();
  return cleaned.length > 0 && cleaned.length <= maximum ? cleaned : null;
}

export async function createCommunityNotification(
  command: {
    recipientId: string;
    kind: CommunityNotificationKind;
    actorId: string | null;
    targetType: string;
    targetId: string | null;
    eventId: string;
    payload: Record<string, unknown>;
    now: Date;
  },
  dependencies: { repository: CommunityNotificationWriter },
) {
  const recipientId = cleanIdentifier(command.recipientId, 120);
  const targetType = cleanIdentifier(command.targetType, 80);
  const eventId = cleanIdentifier(command.eventId);
  if (!recipientId || !targetType || !eventId || Number.isNaN(command.now.getTime())) {
    return { ok: false, code: "invalid-input" } as const;
  }
  if (command.actorId === recipientId) {
    return { ok: true, code: "self-suppressed", notification: null } as const;
  }

  const result = await dependencies.repository.create({
    recipientId,
    kind: command.kind,
    actorId: command.actorId,
    targetType,
    targetId: command.targetId,
    deduplicationKey: `${command.kind}:${eventId}`,
    payload: command.payload,
    createdAt: command.now.toISOString(),
  });
  return {
    ok: true,
    code: result.created ? "created" : "existing",
    notification: result.notification,
  } as const;
}

export async function listCommunityNotifications(
  command: { actor: CommunityActor; limit?: number },
  dependencies: { repository: CommunityNotificationReader },
) {
  if (!isAuthenticatedRecipient(command.actor)) {
    return { ok: false, code: "forbidden", notifications: [] } as const;
  }
  const limit = Math.min(100, Math.max(1, Math.trunc(command.limit ?? 50)));
  return {
    ok: true,
    code: "listed",
    notifications: await dependencies.repository.list(limit),
  } as const;
}

export async function markCommunityNotificationRead(
  command: {
    actor: CommunityActor;
    notificationId: string;
    now: Date;
  },
  dependencies: { repository: CommunityNotificationReader },
) {
  if (!isAuthenticatedRecipient(command.actor)) {
    return { ok: false, code: "forbidden", notification: null } as const;
  }
  const notificationId = cleanIdentifier(command.notificationId, 120);
  if (!notificationId || Number.isNaN(command.now.getTime())) {
    return { ok: false, code: "invalid-input", notification: null } as const;
  }
  const notification = await dependencies.repository.markRead(
    notificationId,
    command.now.toISOString(),
  );
  return notification
    ? { ok: true, code: "read", notification } as const
    : { ok: false, code: "not-found", notification: null } as const;
}

function notificationFromRow(row: Record<string, unknown>): CommunityNotification {
  const payload = row.payload;
  return {
    id: String(row.id),
    recipientId: String(row.recipient_id),
    kind: row.kind as CommunityNotificationKind,
    actorId: typeof row.actor_id === "string" ? row.actor_id : null,
    targetType: String(row.target_type),
    targetId: typeof row.target_id === "string" ? row.target_id : null,
    deduplicationKey: String(row.deduplication_key),
    payload: payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {},
    createdAt: String(row.created_at),
    readAt: typeof row.read_at === "string" ? row.read_at : null,
  };
}

export function createSupabaseCommunityNotificationRepository(
  client: SupabaseClient,
  recipientId: string,
): CommunityNotificationReader {
  return {
    async list(limit) {
      const { data, error } = await client
        .from("notifications")
        .select("*")
        .eq("recipient_id", recipientId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(notificationFromRow);
    },
    async markRead(id, readAt) {
      const { data, error } = await client
        .rpc("mark_community_notification_read", {
          p_notification_id: id,
          p_read_at: readAt,
        })
        .maybeSingle();
      if (error) throw error;
      return data
        ? notificationFromRow(data as Record<string, unknown>)
        : null;
    },
  };
}
