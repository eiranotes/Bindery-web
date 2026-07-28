import {
  createSupabaseCommunityRepository,
  setCommunityBookmark,
} from "../../../../../lib/server/community/posts.ts";
import { getCurrentCommunityMember } from "../../../../../lib/server/community/session.ts";
import {
  isSameOriginMutation,
  jsonNoStore,
  jsonServiceError,
} from "../../../../../lib/server/request-security.ts";
import { getSupabasePublicConfig } from "../../../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

async function mutate(
  request: Request,
  context: { params: Promise<{ id: string }> },
  saved: boolean,
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
    const result = await setCommunityBookmark(
      {
        actor: session.member.actor,
        userId: session.member.id,
        postId: id,
        saved,
      },
      { repository: createSupabaseCommunityRepository(client!) },
    );
    return jsonNoStore(result, { status: result.ok ? 200 : 403 });
  } catch {
    return jsonServiceError();
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return mutate(request, context, true);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return mutate(request, context, false);
}
