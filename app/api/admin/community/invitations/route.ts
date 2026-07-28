import { getCurrentCommunityMember } from "../../../../lib/server/community/session.ts";
import {
  createSupabaseVerificationDependencies,
  issueArtistInvite,
} from "../../../../lib/server/community/verification.ts";
import {
  isSameOriginMutation,
  jsonNoStore,
  jsonServiceError,
  readJsonObject,
} from "../../../../lib/server/request-security.ts";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
    const client = await createSupabaseServerClient(config);
    const result = await issueArtistInvite(
      {
        actor: session.member.actor,
        issuerId: session.member.id,
        input: {
          email: String(body.email ?? ""),
          activityName: String(body.activityName ?? ""),
          proofUrl: String(body.proofUrl ?? ""),
          primaryField: String(body.primaryField ?? ""),
          reason: String(body.reason ?? ""),
          policyVersion: "community-2026-07",
        },
        now: new Date(),
      },
      createSupabaseVerificationDependencies(client!),
    );

    const payload =
      result.ok && result.rawToken
        ? {
            ...result,
            acceptPath: `/community/invite/${encodeURIComponent(result.rawToken)}`,
          }
        : result;
    return jsonNoStore(payload, { status: result.ok ? 201 : 400 });
  } catch {
    return jsonServiceError();
  }
}
