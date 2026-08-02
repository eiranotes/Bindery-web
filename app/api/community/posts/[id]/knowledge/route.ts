import { events } from "../../../../../lib/data.ts";
import {
  acceptCommunityAnswer,
  createSupabaseKnowledgeRepository,
  linkCommunityEvent,
  promoteCommunityNote,
} from "../../../../../lib/server/community/knowledge.ts";
import { getCurrentCommunityMember } from "../../../../../lib/server/community/session.ts";
import {
  isSameOriginMutation,
  jsonNoStore,
  jsonServiceError,
  readJsonObject,
} from "../../../../../lib/server/request-security.ts";
import { getSupabasePublicConfig } from "../../../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginMutation(request)) {
    return jsonNoStore({ ok: false, code: "invalid-origin" }, { status: 403 });
  }
  const config = getSupabasePublicConfig();
  if (config.status !== "configured") {
    return jsonNoStore({ ok: false, code: "not-configured" }, { status: 503 });
  }
  const session = await getCurrentCommunityMember({ config });
  if (!session.member) {
    return jsonNoStore({ ok: false, code: "sign-in-required" }, { status: 401 });
  }
  const body = await readJsonObject(request);
  if (!body) {
    return jsonNoStore({ ok: false, code: "invalid-json" }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const client = await createSupabaseServerClient(config);
    const repository = createSupabaseKnowledgeRepository(client!);
    const action = String(body.action ?? "");
    let result;

    if (action === "accept-answer") {
      result = await acceptCommunityAnswer(
        {
          actor: session.member.actor,
          userId: session.member.id,
          postId: id,
          commentId: String(body.commentId ?? ""),
          now: new Date(),
        },
        { repository },
      );
    } else if (action === "link-event") {
      const eventId = String(body.eventId ?? "");
      if (!events.some((event) => event.id === eventId)) {
        return jsonNoStore({ ok: false, code: "unknown-event" }, { status: 400 });
      }
      result = await linkCommunityEvent(
        {
          actor: session.member.actor,
          userId: session.member.id,
          postId: id,
          eventId,
          now: new Date(),
        },
        { repository },
      );
    } else if (action === "promote-note") {
      result = await promoteCommunityNote(
        {
          actor: session.member.actor,
          operatorId: session.member.id,
          postId: id,
          slug: String(body.slug ?? ""),
          summary: String(body.summary ?? ""),
          now: new Date(),
        },
        { repository },
      );
    } else {
      return jsonNoStore({ ok: false, code: "invalid-action" }, { status: 400 });
    }

    return jsonNoStore(result, {
      status: result.ok
        ? 200
        : result.code === "not-found"
          ? 404
          : result.code === "forbidden"
            ? 403
            : 400,
    });
  } catch {
    return jsonServiceError();
  }
}
