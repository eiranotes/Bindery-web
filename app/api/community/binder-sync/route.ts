import { events } from "../../../lib/data.ts";
import {
  createSupabaseBinderSyncRepository,
  mergeBinderBookmarks,
} from "../../../lib/server/community/binder-sync.ts";
import { getCurrentCommunityMember } from "../../../lib/server/community/session.ts";
import {
  isSameOriginMutation,
  jsonNoStore,
  jsonServiceError,
  readJsonObject,
} from "../../../lib/server/request-security.ts";
import { getSupabasePublicConfig } from "../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

const supportedEventIds = new Set(events.map((event) => event.id));

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return jsonNoStore({ ok: false, code: "invalid-origin" }, { status: 403 });
  }

  const config = getSupabasePublicConfig();
  if (config.status !== "configured") {
    return jsonNoStore({ ok: false, code: "not-configured" }, { status: 503 });
  }

  const session = await getCurrentCommunityMember({ config });
  if (!session.member) {
    return jsonNoStore(
      { ok: false, code: "sign-in-required" },
      { status: 401 },
    );
  }

  const body = await readJsonObject(request);
  if (!body) {
    return jsonNoStore({ ok: false, code: "invalid-input" }, { status: 400 });
  }

  try {
    const client = await createSupabaseServerClient(config);
    if (!client) return jsonServiceError();
    const result = await mergeBinderBookmarks(
      {
        actor: session.member.actor,
        userId: session.member.id,
        items: body.items,
      },
      {
        repository: createSupabaseBinderSyncRepository(client),
        supportedEventIds,
      },
    );
    return jsonNoStore(result, {
      status: result.ok ? 200 : result.code === "forbidden" ? 403 : 422,
    });
  } catch {
    return jsonServiceError();
  }
}
