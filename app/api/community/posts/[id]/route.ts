import {
  communityCorrectionHttpStatus,
  correctCommunityPost,
  createSupabaseCommunityRepository,
  softDeleteCommunityPost,
  validateCommunityCorrectionSource,
} from "../../../../lib/server/community/posts.ts";
import { getCurrentCommunityMember } from "../../../../lib/server/community/session.ts";
import {
  isSameOriginMutation,
  jsonNoStore,
  jsonServiceError,
  readJsonObject,
} from "../../../../lib/server/request-security.ts";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config.ts";
import { createSupabaseServerClient } from "../../../../lib/supabase/server.ts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const config = getSupabasePublicConfig();
  if (config.status !== "configured") {
    return jsonNoStore({ ok: false, code: "not-configured" }, { status: 503 });
  }

  try {
    const { id } = await context.params;
    const client = await createSupabaseServerClient(config);
    const post = await createSupabaseCommunityRepository(client!).getPost(id);
    return post
      ? jsonNoStore({ ok: true, post })
      : jsonNoStore({ ok: false, code: "not-found" }, { status: 404 });
  } catch {
    return jsonServiceError();
  }
}

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

  const sourceValue =
    body.source && typeof body.source === "object" && !Array.isArray(body.source)
      ? (body.source as Record<string, unknown>)
      : null;
  const sourceValidation = validateCommunityCorrectionSource(
    session.member.actor,
    sourceValue
      ? {
          label: String(sourceValue.label ?? ""),
          url: String(sourceValue.url ?? ""),
          checkedAt: String(sourceValue.checkedAt ?? ""),
        }
      : null,
  );
  if (!sourceValidation.ok) {
    return jsonNoStore(sourceValidation.result, {
      status: communityCorrectionHttpStatus(sourceValidation.result),
    });
  }

  try {
    const { id } = await context.params;
    const client = await createSupabaseServerClient(config);
    const result = await correctCommunityPost(
      {
        actor: session.member.actor,
        userId: session.member.id,
        postId: id,
        title: String(body.title ?? ""),
        body: String(body.body ?? ""),
        reason: String(body.reason ?? ""),
        source: sourceValidation.source,
      },
      { repository: createSupabaseCommunityRepository(client!) },
    );
    return jsonNoStore(result, {
      status: communityCorrectionHttpStatus(result),
    });
  } catch {
    return jsonServiceError();
  }
}

export async function DELETE(
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
    const result = await softDeleteCommunityPost(
      {
        actor: session.member.actor,
        userId: session.member.id,
        postId: id,
        reason: String(body.reason ?? ""),
        now: new Date(),
      },
      { repository: createSupabaseCommunityRepository(client!) },
    );
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
