import { getCurrentCommunityMember } from "../../../../../lib/server/community/session.ts";
import {
  createSupabaseVerificationDependencies,
  revokeArtistInvite,
} from "../../../../../lib/server/community/verification.ts";
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
  const session = await getCurrentCommunityMember({ config });
  if (!session.member || !session.access.capabilities.includes("admin:invite")) {
    return jsonNoStore({ ok: false, code: "forbidden" }, { status: 403 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return jsonNoStore({ ok: false, code: "invalid-json" }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const client = await createSupabaseServerClient(config);
    const result = await revokeArtistInvite(
      {
        actor: session.member.actor,
        inviteId: id,
        reason: String(body.reason ?? ""),
      },
      createSupabaseVerificationDependencies(client!),
    );

    return jsonNoStore(result, {
      status: result.ok
        ? 200
        : result.code === "invite-not-found"
          ? 404
          : result.code === "invite-used"
            ? 409
            : 400,
    });
  } catch {
    return jsonServiceError();
  }
}
