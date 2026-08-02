import {
  createSupabaseCommunityNotificationRepository,
  markCommunityNotificationRead,
} from "../../../../../lib/server/community/notifications.ts";
import { getCurrentCommunityMember } from "../../../../../lib/server/community/session.ts";
import {
  isSameOriginMutation,
  jsonNoStore,
  jsonServiceError,
} from "../../../../../lib/server/request-security.ts";
import { getSupabasePublicConfig } from "../../../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export async function POST(
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

  try {
    const { id } = await context.params;
    const client = await createSupabaseServerClient(config);
    const result = await markCommunityNotificationRead(
      { actor: session.member.actor, notificationId: id, now: new Date() },
      {
        repository: createSupabaseCommunityNotificationRepository(
          client!,
          session.member.id,
        ),
      },
    );
    if (!result.ok) {
      return jsonNoStore(result, { status: result.code === "not-found" ? 404 : 400 });
    }

    return new Response(null, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        Location: new URL("/me/notifications", request.url).toString(),
      },
    });
  } catch {
    return jsonServiceError();
  }
}
