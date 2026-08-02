import {
  createSupabaseModerationRepository,
  submitCommunityAppeal,
} from "../../../../../lib/server/community/moderation.ts";
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
  const body = await readJsonObject(request);
  if (!body) {
    return jsonNoStore({ ok: false, code: "invalid-json" }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const client = await createSupabaseServerClient(config);
    const result = await submitCommunityAppeal(
      {
        actor: session.member.actor,
        userId: session.member.id,
        reportId: id,
        reason: String(body.reason ?? ""),
        now: new Date(),
      },
      { repository: createSupabaseModerationRepository(client!) },
    );
    const status = result.ok
      ? 201
      : result.code === "forbidden"
        ? 403
        : result.code === "deadline-expired"
          ? 410
          : 400;
    return jsonNoStore(result, { status });
  } catch {
    return jsonServiceError();
  }
}
