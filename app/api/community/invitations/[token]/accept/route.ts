import { getCurrentCommunityMember } from "../../../../../lib/server/community/session.ts";
import {
  acceptArtistInvite,
  createSupabaseVerificationDependencies,
  CURRENT_COMMUNITY_POLICY_VERSION,
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

  const body = await readJsonObject(request);
  if (!body) {
    return jsonNoStore({ ok: false, code: "invalid-json" }, { status: 400 });
  }
  if (body.policyConsent !== true) {
    return jsonNoStore(
      {
        ok: false,
        code: "consent-required",
        message: "현재 커뮤니티 운영 규칙에 동의해 주세요.",
      },
      { status: 400 },
    );
  }
  if (body.policyVersion !== CURRENT_COMMUNITY_POLICY_VERSION) {
    return jsonNoStore(
      {
        ok: false,
        code: "policy-version-stale",
        message: "운영 규칙이 변경되었습니다. 현재 내용을 다시 확인해 주세요.",
      },
      { status: 400 },
    );
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
        policyConsent: true,
        policyVersion: CURRENT_COMMUNITY_POLICY_VERSION,
      },
      createSupabaseVerificationDependencies(client!),
    );

    return jsonNoStore(result, { status: result.ok ? 200 : 400 });
  } catch {
    return jsonServiceError();
  }
}
