import { getCurrentCommunityMember } from "../../../../../lib/server/community/session.ts";
import {
  acceptArtistInvite,
  createSupabaseVerificationDependencies,
} from "../../../../../lib/server/community/verification.ts";
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
  context: { params: Promise<{ token: string }> },
) {
  if (!isSameOriginMutation(request)) {
    return jsonNoStore({ ok: false, code: "invalid-origin" }, { status: 403 });
  }

  const config = getSupabasePublicConfig();
  const session = await getCurrentCommunityMember({ config });
  if (!session.member) {
    return jsonNoStore({ ok: false, code: "sign-in-required" }, { status: 401 });
  }

  try {
    const client = await createSupabaseServerClient(config);
    const userResult = await client!.auth.getUser();
    const email = userResult.data.user?.email;
    if (userResult.error || !email) {
      return jsonNoStore(
        { ok: false, code: "email-required" },
        { status: 400 },
      );
    }

    const { token } = await context.params;
    const result = await acceptArtistInvite(
      {
        actor: session.member.actor,
        userId: session.member.id,
        email,
        rawToken: token,
        now: new Date(),
      },
      createSupabaseVerificationDependencies(client!),
    );

    return jsonNoStore(result, { status: result.ok ? 200 : 400 });
  } catch {
    return jsonServiceError();
  }
}
