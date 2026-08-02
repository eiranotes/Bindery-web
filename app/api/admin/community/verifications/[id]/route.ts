import { getCurrentCommunityMember } from "../../../../../lib/server/community/session.ts";
import {
  createSupabaseVerificationDependencies,
  reviewArtistApplication,
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
  if (
    !session.member ||
    !session.access.capabilities.includes("admin:artist-review")
  ) {
    return jsonNoStore({ ok: false, code: "forbidden" }, { status: 403 });
  }

  const body = await readJsonObject(request);
  const { id } = await context.params;
  if (!body) {
    return jsonNoStore({ ok: false, code: "invalid-json" }, { status: 400 });
  }

  const nextStatus = String(body.nextStatus ?? "");
  if (
    !["verified", "rejected", "suspended", "revoked", "provisional"].includes(
      nextStatus,
    )
  ) {
    return jsonNoStore({ ok: false, code: "invalid-status" }, { status: 400 });
  }

  try {
    const client = await createSupabaseServerClient(config);
    const result = await reviewArtistApplication(
      {
        actor: session.member.actor,
        applicationId: id,
        nextStatus: nextStatus as
          | "verified"
          | "rejected"
          | "suspended"
          | "revoked"
          | "provisional",
        reason: String(body.reason ?? ""),
      },
      createSupabaseVerificationDependencies(client!),
    );

    return jsonNoStore(result, {
      status: result.ok ? 200 : result.code === "not-found" ? 404 : 400,
    });
  } catch {
    return jsonServiceError();
  }
}
